const axios = require('axios').default;
const twilio = require('twilio');
const pino = require('pino');
const config = require('../config.json');
const privateConfig = require('../private.config.json');

const {
  accountSid, authToken, from, to,
} = privateConfig.twilio;

const client = twilio(accountSid, authToken);

const date = new Date();
const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
const dest = pino.destination(`${__dirname}/../logs/log-${formattedDate}`);
const logger = pino({ level: config.logLevel, prettyPrint: config.prettyPrint }, dest);

const sendSMS = async (message) => client.messages.create({
  body: message,
  from,
  to,
});

let SMSCounter = 0;

const notify = async (message) => {
  if (config.sms.active && SMSCounter < config.sms.limit) {
    await sendSMS(message);
    logger.debug(`SMSCounter: ${SMSCounter}`);
    SMSCounter += 1;
  }
};

/** addToCartLoop
 * Recursively tries to add a product to the cart
 * @return string
 */
const addToCartLoop = (id, guid, numTries, checkInterval = 10000) => new Promise((resolve) => {
  axios.post(`https://api.direct.playstation.com/commercewebservices/ps-direct-us/users/anonymous/carts/${guid}/entries`, {
    product: {
      code: id,
    },
    quantity: 1,
    cartIdCreated: false,
    findingMethod: 'pdp',
  }).catch((onFailure) => {
    logger.info('Could not add product to cart. Trying again...');
    logger.info(`Times run: ${numTries}`);
    numTries++;

    setTimeout(() => {
      addToCartLoop(id, guid, numTries);
    }, checkInterval);
  }).then(async (onSuccess) => {
    if (onSuccess) {
      const message = `Product successfully added to cart! ${onSuccess}`;
      await notify(message);
      logger.info(message);
      return resolve(onSuccess);
    }
    return resolve();
  });
});

/** getGuid
 * Get unique identifier (guid) used in subsequent results
 * Makes us look like we're human
 * @return string
 */
async function getGuid() {
  const response = await axios.post('https://api.direct.playstation.com/commercewebservices/ps-direct-us/users/anonymous/carts?fields=BASIC');
  return response.data.guid;
}

/** checkForPlaystationDirectRedirect
 * Recursively checks for redirects.
 * @param checkInterval - How often to check in ms
 * @param onSuccess - Callback function for successful redirect
 */
const checkForPlaystationDirectRedirect = async (checkInterval, onSuccess, version = 'disc', browser, numTries = 1) => {
  try {
    // Create a new incognito session each request to clear cookies and cache
    const context = await browser.createIncognitoBrowserContext();

    const page = await context.newPage();
    await page.setDefaultNavigationTimeout(0);

    const url = `https://direct.playstation.com/en-us/consoles/console/playstation5-console.${version}`;
    const response = await page.goto(url);
    const responseBody = await response.text();
    const responseStatus = await response.status();

    await context.close();

    logger.trace(`Response body: ${responseBody}`);
    logger.trace(`Response status: ${responseStatus}`);

    if (responseStatus !== 200) {
      logger.warn(`Did not get a good response from the direct playstation url request: ${responseBody}`);
      await notify('Bad response during polling, check the logs');
    }

    if (responseBody.indexOf('queue-it_log') > 0 && responseBody.indexOf('softblock') < 0) {
      logger.debug(`Response body: ${responseBody}`);
      return onSuccess();
    }

    return setTimeout(async () => {
      logger.info('No stock detected yet. Scanning again...');
      logger.info(`Number of tries: ${numTries}`);
      numTries++;

      await checkForPlaystationDirectRedirect(checkInterval, onSuccess, version, browser, numTries);
    }, checkInterval);
  } catch (error) {
    logger.error(error);
    await notify('There was a problem, check it out! Trying again in the meantime...');
    return checkForPlaystationDirectRedirect(checkInterval, onSuccess, version, browser, numTries);
  }
};

module.exports = {
  addToCartLoop,
  checkForPlaystationDirectRedirect,
  getGuid,
  notify,
  logger,
};
