const open = require('open');
const promptly = require('promptly');
const puppeteer = require('puppeteer');

const { checkForPlaystationDirectRedirect, logger, notify } = require('./utils');

/** Constants */
const playstationType = {
  disc: {
    id: 3005816,
    url: 'https://direct.playstation.com/en-us/consoles/console/playstation5-console.3005816',
  },
  digital: {
    id: 3005817,
    url: 'https://direct.playstation.com/en-us/consoles/console/playstation5-digital-edition-console.3005817',
  },
};

/** Let's do this */
(async () => {
  const choice = await promptly.choose('Which version would you like? (disc or digital)', ['disc', 'digital']);
  // const choice = 'disc';
  logger.info(`Searching for PlayStation 5 ${choice} edition...`);

  const onSuccess = () => {
    logger.info('Found it! Opening queue now...');
    notify('Go get your PS5!');
    open(playstationType[choice].url);
  };

  checkForPlaystationDirectRedirect(5000, onSuccess, playstationType[choice].id, await puppeteer.launch());
})().catch((error) => {
  logger.error(error);
  notify('There was a problem, check it out!');
  throw error;
});
