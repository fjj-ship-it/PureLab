const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));
  const wait = (ms = 300) => page.waitForTimeout(ms);
  const screen = () => page.evaluate(() => [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none')[0].id);
  for (let round = 1; round <= 3; round++) {
    await page.goto(APP, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => { const el = [].find.call(document.querySelectorAll('[data-go="s02"]'), e => e.getClientRects().length > 0); if (el) el.click(); }); await wait(500);
    for (const id of ['EXP-01', 'EXP-03', 'EXP-02']) {
      await page.evaluate(i => { const el = document.querySelector('#exp-carousel [data-delexp="' + i + '"]'); if (el) el.click(); else console.log('MISS del ' + i); }, id); await wait(250);
      const s1 = await screen();
      await page.evaluate(() => { const el = document.getElementById('delexp-go'); if (el) el.click(); }); await wait(350);
      const s2 = await screen();
      console.log(`round${round} del ${id}: 点删除后=${s1} 确认后=${s2}`);
    }
  }
  await browser.close();
})();
