/* v30 smoke: seg squeeze + archive fold-on-scroll */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=30', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('purelab_db'));
  await page.reload({ waitUntil: 'networkidle' });
  const log = (k, v) => console.log(String(v).padEnd(6), k);

  // B1: s02 archive rows are fold-item and unfold (.in) shortly after render
  await page.evaluate(() => go('s02'));
  await page.waitForTimeout(900);
  const fold = await page.evaluate(() => {
    const els = [...document.querySelectorAll('#s02 .arch-row')];
    return { total: els.length, inn: els.filter(e => e.classList.contains('in')).length };
  });
  log(`B1 arch rows folded in (${fold.inn}/${fold.total})`, fold.total > 0 && fold.inn === fold.total ? 'PASS' : 'FAIL');

  // B2: enter s05 via new experiment flow — go directly: wizard needs combos; simulate by seeding amode screen
  const s05ok = await page.evaluate(() => {
    DB.wizard.sel = { A: true, B: true };
    go('s05'); renderAssign();
    return !!document.getElementById('am-seg');
  });
  log('B2 am-seg rendered', s05ok ? 'PASS' : 'FAIL');
  // B3: thumb positioned under active item
  const t1 = await page.evaluate(() => {
    const seg = document.getElementById('am-seg'), th = seg.querySelector('.seg-thumb');
    const act = seg.querySelector('.seg-item.active');
    return { w: th.style.width, x: th.style.transform, ready: seg.classList.contains('ready'), actW: act.offsetWidth };
  });
  log(`B3 thumb at active (w=${t1.w} x=${t1.x})`, (parseInt(t1.w) === t1.actW && /translateX/.test(t1.x)) ? 'PASS' : 'FAIL');
  // B4: click 手动选孔 -> thumb slides, then mode applied
  await page.evaluate(() => document.getElementById('am-manual').click());
  await page.waitForTimeout(80);
  const mid = await page.evaluate(() => document.getElementById('am-seg') ? 'old' : 're-rendered');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const head = document.querySelector('#assign-cur .combo-name');
    return { head: head ? head.textContent : '', mode: DB.wizard.amode };
  });
  log(`B4 manual applied (${after.mode}, head=${after.head})`, (after.mode === 'manual' && /正在分配/.test(after.head)) ? 'PASS' : 'FAIL');
  // B5: switch back to auto
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById('am-auto').click(); });
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => DB.wizard.amode);
  log('B5 back to auto', back === 'auto' ? 'PASS' : 'FAIL got ' + back);
  // B6: batch-seg thumb present on s09
  const b6 = await page.evaluate(() => { go('s07'); go('s09'); const seg = document.getElementById('batch-seg'); return !!seg.querySelector('.seg-thumb'); });
  log('B6 batch-seg thumb', b6 ? 'PASS' : 'FAIL');
  // B7: batch seg switch animates and applies
  await page.evaluate(() => { document.querySelector('#batch-seg .seg-item[data-seg="combo"]').click(); });
  await page.waitForTimeout(450);
  const b7 = await page.evaluate(() => batchMode);
  log('B7 batchMode=combo applied', b7 === 'combo' ? 'PASS' : 'FAIL got ' + b7);
  // B8: pageErrors
  log('B8 pageErrors=' + errs.length, errs.length === 0 ? 'PASS' : 'FAIL ' + errs.join('|'));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
