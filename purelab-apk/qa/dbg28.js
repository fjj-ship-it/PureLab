const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));
  await page.goto(APP, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(400);
  const go = async a => page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (el) { el.click(); return true; } return false; }, a);
  const wait = (ms = 300) => page.waitForTimeout(ms);
  await go('s02'); await wait(500);
  for (const id of ['EXP-01', 'EXP-03', 'EXP-02']) {
    await page.evaluate(i => document.querySelector('#exp-carousel [data-delexp="' + i + '"]').click(), id); await wait(250);
    await page.evaluate(() => document.getElementById('delexp-go').click()); await wait(350);
  }
  const d = await page.evaluate(() => {
    const cta = [].find.call(document.querySelectorAll('[data-go="s03"]'), e => e.getClientRects().length > 0);
    const vis = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none').map(s => s.id);
    return { ctaFound: !!cta, visScreen: vis[0], sheetOpen: document.getElementById('sheet').classList.contains('show'),
             maskOpen: document.getElementById('sheet-mask').classList.contains('show') };
  });
  console.log(JSON.stringify(d));
  const r = await go('s03'); await wait(300);
  console.log('go s03 ->', r, 'screen:', await page.evaluate(() => [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none')[0].id));
  await browser.close();
})();
