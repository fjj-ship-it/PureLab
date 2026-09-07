/* v31 smoke: s07 FAB group */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=31', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('purelab_db'));
  await page.reload({ waitUntil: 'networkidle' });
  const log = (k, v) => console.log(String(v).padEnd(6), k);

  await page.evaluate(() => { DB.wizard.sel = { A: true }; go('s05'); renderAssign(); go('s07'); });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const main = document.querySelector('#s07 .fab-main'), sub = document.querySelector('#s07 .fab-sub');
    const oldRow = document.querySelector('#s07 .op-row');
    const mr = main.getBoundingClientRect(), sr = sub.getBoundingClientRect();
    return {
      main: !!main, sub: !!sub, oldGone: !oldRow,
      mainRight: Math.round(window.innerWidth - mr.right), mainBottom: Math.round(window.innerHeight - mr.bottom),
      subAboveMain: sr.bottom <= mr.top + 2,
      mainVis: mr.width > 0 && mr.height > 0, subVis: sr.width > 0 && sr.height > 0
    };
  });
  log('F1 fab-main + fab-sub exist, op-row removed', (r.main && r.sub && r.oldGone) ? 'PASS' : 'FAIL ' + JSON.stringify(r));
  log(`F2 main pinned bottom-right (r=${r.mainRight}px b=${r.mainBottom}px)`, (r.mainRight <= 20 && r.mainBottom <= 30) ? 'PASS' : 'FAIL');
  log('F3 sub above main', r.subAboveMain && r.subVis ? 'PASS' : 'FAIL');
  // F4: tap main -> s08; back; tap sub -> s12
  await page.evaluate(() => document.querySelector('#s07 .fab-main').click());
  await page.waitForTimeout(300);
  const onS08 = await page.evaluate(() => document.getElementById('s08').classList.contains('active'));
  log('F4 fab-main -> s08', onS08 ? 'PASS' : 'FAIL');
  await page.evaluate(() => { back(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#s07 .fab-sub').click());
  await page.waitForTimeout(300);
  const onS12 = await page.evaluate(() => document.getElementById('s12').classList.contains('active'));
  log('F5 fab-sub -> s12', onS12 ? 'PASS' : 'FAIL');
  // F6: fab entrance animation styles present
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('#s07 .fab-main')).animationName);
  log('F6 fabIn animation', anim === 'fabIn' ? 'PASS' : 'FAIL ' + anim);
  log('F7 pageErrors=' + errs.length, errs.length === 0 ? 'PASS' : 'FAIL ' + errs.join('|'));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
