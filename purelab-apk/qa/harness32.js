/* v29 smoke: countUp rolls on FIRST entry, even after reload with existing localStorage */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=29', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('purelab_db'));   // clean legacy _ui
  await page.reload({ waitUntil: 'networkidle' });
  const log = (k, v) => console.log(String(v).padEnd(6), k);
  const jsUrl = await page.evaluate(() => [...document.scripts].map(s => s.src).join(','));
  log('A1 js?v=29 loaded', /v=29/.test(jsUrl) ? 'PASS' : 'FAIL ' + jsUrl);
  // enter s07 via the cur card's mini-act
  await page.evaluate(() => { go('s02'); });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const card = document.querySelector('#s02 .exp-card.cur') || document.querySelector('#s02 .exp-card');
    const act = card && card.querySelector('.mini-act');
    (act || card).click();
  });
  await page.waitForTimeout(60);
  const t1 = await page.evaluate(() => (document.getElementById('st-n') || {}).textContent);
  await page.waitForTimeout(300);
  const t2 = await page.evaluate(() => (document.getElementById('st-n') || {}).textContent);
  await page.waitForTimeout(500);
  const t3 = await page.evaluate(() => (document.getElementById('st-n') || {}).textContent);
  log(`A2 st-n rolls (${t1} -> ${t2} -> ${t3})`, (t1 !== t2 && t2 !== t3) ? 'PASS' : 'FAIL');
  await page.waitForTimeout(800);
  const t3b = await page.evaluate(() => (document.getElementById('st-n') || {}).textContent);
  log('A3 settles at integer', /^\d+$/.test(t3b) ? 'PASS (' + t3b + '/96)' : 'FAIL got ' + t3b);
  // A4: s11 hero rolls on first entry
  await page.evaluate(() => go('s11'));
  await page.waitForTimeout(60);
  const h1 = await page.evaluate(() => (document.getElementById('res-hero') || {}).textContent);
  await page.waitForTimeout(350);
  const h2 = await page.evaluate(() => (document.getElementById('res-hero') || {}).textContent);
  log(`A4 res-hero rolls (${h1} -> ${h2})`, h1 !== h2 ? 'PASS' : 'FAIL');
  // A5: reload — _ui must NOT persist, so roll happens again after reload
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => { go('s02'); });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const card = document.querySelector('#s02 .exp-card.cur') || document.querySelector('#s02 .exp-card');
    const act = card && card.querySelector('.mini-act');
    (act || card).click();
  });
  await page.waitForTimeout(60);
  const r1 = await page.evaluate(() => (document.getElementById('st-n') || {}).textContent);
  await page.waitForTimeout(300);
  const r2 = await page.evaluate(() => (document.getElementById('st-n') || {}).textContent);
  log(`A5 rolls again after reload (${r1} -> ${r2})`, (r1 !== r2 && r1 != null) ? 'PASS' : 'FAIL');
  // A6: stagger rows in s02 archive list
  const stag = await page.evaluate(() => document.querySelectorAll('#s02 .stagger-item').length);
  log('A6 stagger rows in s02', stag > 0 ? 'PASS (' + stag + ')' : 'FAIL');
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
