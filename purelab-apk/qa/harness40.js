/* v37 smoke: concentration dimension (combo × temp × conc) */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=37', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('purelab_db'));
  await page.reload({ waitUntil: 'networkidle' });
  const log = (k, v) => console.log(String(v).padEnd(6), k);
  await page.waitForTimeout(300);

  // C1 cond seg has 3 tabs (combo/temp/conc)
  await page.evaluate(() => go('s04'));
  await page.waitForTimeout(200);
  const c1 = await page.evaluate(() => {
    const seg = document.getElementById('cond-seg');
    return { seg: !!seg, tabs: [...seg.querySelectorAll('.seg-item')].map(b => b.textContent) };
  });
  log('C1 cond seg (tabs=' + c1.tabs.join('/') + ')', (c1.seg && c1.tabs.length === 3) ? 'PASS' : 'FAIL');

  // C2 select combos A,B; temps 60,70; concs 10,20
  await page.evaluate(() => {
    DB.wizard.sel = { A: true, B: true };
    DB.wizard.tempSel = { '60℃': true, '70℃': true };
    DB.wizard.concSel = { '10 mg/mL': true, '20 mg/mL': true };
    document.querySelector('#cond-seg [data-ctab="conc"]').click();
  });
  await page.waitForTimeout(300);
  const c2 = await page.evaluate(() => ({
    concPanel: document.getElementById('panel-conc').style.display !== 'none',
    total: document.querySelectorAll('#conc-list .combo-card').length,
    selCount: document.querySelectorAll('#conc-list .combo-card.sel').length
  }));
  log('C2 conc tab (panel=' + c2.concPanel + ',total=' + c2.total + ',sel=' + c2.selCount + ')', (c2.concPanel && c2.total === 3 && c2.selCount === 2) ? 'PASS' : 'FAIL');

  // C3 go to s05: auto assign should produce 2×2×2 = 8 pairs each of 12 wells
  await page.evaluate(() => { go('s05'); renderAssign(); });
  await page.waitForTimeout(300);
  const c3 = await page.evaluate(() => {
    const rows = {};
    Object.keys(DB.wizard.assign).forEach(k => {
      const key = DB.wizard.assign[k] + '|' + (DB.wizard.assignTemp[k] || '') + '|' + (DB.wizard.assignConc[k] || '');
      rows[key] = (rows[key] || 0) + 1;
    });
    return { pairs: Object.keys(rows).sort(), each12: Object.values(rows).every(n => n === 12) };
  });
  log('C3 auto 3D grid ' + JSON.stringify(c3.pairs), (c3.pairs.length === 8 && c3.each12) ? 'PASS' : 'FAIL');

  // C4 create experiment, fill A1 (A/60/10) as best, check well.conc + s07 best shows conc
  await page.evaluate(() => {
    var assign = DB.wizard.assign, at = DB.wizard.assignTemp, ac = DB.wizard.assignConc;
    var exp = { id: 'EXP-91', name: 'C-浓度测试', plate: '96孔板 · 进行中', drug: '样品C', totalMass: 19200, dose: 100,
      comboCount: 2, tempLevels: selTemps().slice(), concLevels: selConcs().slice(),
      wells: freshEmptyWells(100, assign, at, ac), ops: {}, created: '2026.09.09' };
    DB.exps['EXP-91'] = exp; DB.curExp = 'EXP-91'; normalizeDB();
    var w = exp.wells['A1'];
    w.output = 95.1; w.purity = 95.1; w.done = true;
    save(); show('s07');
  });
  await page.waitForTimeout(700);
  const c4 = await page.evaluate(() => ({
    conc: DB.exps['EXP-91'].wells['B12'].conc,
    best: document.getElementById('exp-stats').textContent
  }));
  log('C4 well.conc set (B12=' + c4.conc + ')', c4.conc === '20 mg/mL' ? 'PASS' : 'FAIL');
  log('C5 s07 best shows conc', /A1 · 60℃ · 10 mg\/mL/.test(c4.best) ? 'PASS' : 'FAIL ' + c4.best.slice(0, 60));

  // C6 s12 best page shows 浓度 row
  await page.evaluate(() => go('s12'));
  await page.waitForTimeout(300);
  const c6 = await page.evaluate(() => document.getElementById('best-page').textContent);
  log('C6 s12 浓度 row', /浓度/.test(c6) && /10 mg\/mL/.test(c6) ? 'PASS' : 'FAIL');

  // C7 CSV includes 浓度 column AND body aligns (10 cols)
  await page.evaluate(() => go('s11'));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('btn-export').click());
  await page.waitForTimeout(300);
  const c7 = await page.evaluate(() => (document.getElementById('csv-box') || {}).value || '');
  const first = c7.split('\n')[0];
  const second = c7.split('\n')[1] || '';
  const cols = first.split(',').length, bodyCols = second.split(',').length;
  log('C7 csv 浓度 col + aligned (head=' + cols + ',body=' + bodyCols + ')',
      (/^排名,孔位,组合,试剂配比,温度,浓度,/.test(first) && cols === 10 && bodyCols === 10) ? 'PASS' : 'FAIL ' + first);

  // C8 add new conc level
  await page.evaluate(() => { go('s04'); DB.wizard.ctab = 'conc'; renderCondTab(); document.getElementById('conc-add').click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.getElementById('new-conc').value = '15 mg/mL';
    document.getElementById('conc-save').click();
  });
  await page.waitForTimeout(300);
  const c8 = await page.evaluate(() => DB.concLevels.indexOf('15 mg/mL') >= 0);
  log('C8 add 15 mg/mL level', c8 ? 'PASS' : 'FAIL');

  // C9 archive stores bestConc
  const c9 = await page.evaluate(() => {
    DB.curExp = 'EXP-91';
    var st = stats();
    return st.best.conc || null;
  });
  log('C9 archive bestConc', c9 ? 'PASS' : 'FAIL ' + c9);

  log('C10 pageErrors=' + errs.length, errs.length === 0 ? 'PASS' : 'FAIL ' + errs.join('|'));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
