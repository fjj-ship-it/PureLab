const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
  await page.goto(APP, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(400);
  const go = async a => page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (el) { el.click(); return true; } return false; }, a);
  const wait = (ms = 300) => page.waitForTimeout(ms);
  await go('s02'); await wait(500);
  await page.evaluate(() => document.querySelector('#exp-carousel [data-delexp="EXP-01"]').click()); await wait(300);
  await page.evaluate(() => document.getElementById('delexp-go').click()); await wait(400);
  await page.evaluate(() => document.querySelector('#exp-carousel [data-delexp="EXP-03"]').click()); await wait(300);
  await page.evaluate(() => document.getElementById('delexp-go').click()); await wait(400);
  const d = await page.evaluate(() => ({
    ongoing: document.getElementById('home-ongoing').innerHTML.slice(0, 300),
    exps: Object.keys(JSON.parse(localStorage.getItem('purelab_db')).exps),
    curExp: JSON.parse(localStorage.getItem('purelab_db')).curExp
  }));
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})();
