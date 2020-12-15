const open = require('open');
const promptly = require('promptly');
const puppeteer = require('puppeteer');

const { checkForPlaystationDirectRedirect, logger, notify } = require('./utils');

/** Constants */
const playstationType = {
  disc: {
    id: 3005816,
    url:
      'https://direct-queue.playstation.com/?c=sonyied&e=psdirectprodku1&t=https%3A%2F%2Fdirect.playstation.com%2Fen-us%2Fconsoles%2Fconsole%2Fplaystation5-console.3005816&cv=1089561812&cid=en-US',
  },
  digital: {
    id: 3005817,
    url:
      'https://direct-queue.playstation.com/?c=sonyied&e=psdirectprodku1&t=https%3A%2F%2Fdirect.playstation.com%2Fen-us%2Fconsoles%2Fconsole%2Fplaystation5-digital-edition-console.3005817&cid=en-US',
  },
};

const main = async () => {
  const choice = await promptly.choose('Which version would you like? ([disc] or digital)', ['disc', 'digital'], { default: 'disc' });
  logger.info(`Searching for PlayStation 5 ${choice} edition...`);

  const onSuccess = async () => {
    logger.info('Found it! Opening queue now...');
    await notify('Go get your PS5!');
    open(playstationType[choice].url);
  };

  const launchedPuppeteer = await puppeteer.launch();
  await checkForPlaystationDirectRedirect(5000, onSuccess, playstationType[choice].id, launchedPuppeteer);
};

/** Let's do this */
(async () => {
  await main();
})().catch(async (error) => {
  logger.error(error);
  await notify('There was a problem, check it out!');
  await main();
});

// Gracefully exit
process.on('SIGINT', () => {
  process.exit();
});
