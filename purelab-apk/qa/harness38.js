const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=35', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('purelab_db'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.evaluate(() => go('s03'));
  await page.waitForTimeout(200);
  const has = await page.evaluate(() => document.querySelector('#s03 .nav-text') !== null);
  console.log(has ? 'FAIL s03 still has skip' : 'PASS s03 skip removed');
  console.log(errs.length === 0 ? 'PASS zero pageErrors' : 'FAIL ' + errs.join('|'));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
