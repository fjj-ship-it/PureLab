/* v33 smoke: no splash, direct to home */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=33', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('purelab_db'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const log = (k, v) => console.log(String(v).padEnd(6), k);
  const r = await page.evaluate(() => ({
    noS01: !document.getElementById('s01'),
    s02active: document.getElementById('s02').classList.contains('active'),
    greet: (document.getElementById('greet-en') || {}).textContent,
    stack: stack.length
  }));
  log(`N1 boot -> s02 direct (greet=${r.greet}, stack=${r.stack})`, (r.noS01 && r.s02active && r.stack === 1) ? 'PASS' : 'FAIL ' + JSON.stringify(r));
  const backRes = await page.evaluate(() => back());
  log('N2 back on home is no-op', backRes === false ? 'PASS' : 'FAIL');
  log('N3 pageErrors=' + errs.length, errs.length === 0 ? 'PASS' : 'FAIL ' + errs.join('|'));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
