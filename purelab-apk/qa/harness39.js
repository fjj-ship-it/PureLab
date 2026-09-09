/* v36 smoke: condition dimensions (combo × temp) */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=36', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('purelab_db'));
  await page.reload({ waitUntil: 'networkidle' });
  const log = (k, v) => console.log(String(v).padEnd(6), k);
  await page.waitForTimeout(300);
  // C1 seg exists with two tabs
  await page.evaluate(() => go('s04'));
  await page.waitForTimeout(200);
  const c1 = await page.evaluate(() => {
    const seg = document.getElementById('cond-seg');
    return { seg: !!seg, tabs: [...seg.querySelectorAll('.seg-item')].map(b => b.textContent) };
  });
  log('C1 cond seg (tabs=' + c1.tabs.join('/') + ')', (c1.seg && c1.tabs.length === 3) ? 'PASS' : 'FAIL');
  // C2 select combos A,B then switch to temp tab
  await page.evaluate(() => {
    DB.wizard.sel = { A: true, B: true };
    document.querySelector('#cond-seg [data-ctab="temp"]').click();
  });
  await page.waitForTimeout(400);
  const c2 = await page.evaluate(() => ({
    tempPanelShown: document.getElementById('panel-temp').style.display !== 'none',
    levels: [...document.querySelectorAll('#temp-list .combo-card')].map(e => e.getAttribute('data-t'))
  }));
  log('C2 temp tab shows levels (' + c2.levels.join(',') + ')', (c2.tempPanelShown && c2.levels.length === 3) ? 'PASS' : 'FAIL');
  // C3 select 60℃,70℃
  await page.evaluate(() => {
    DB.wizard.tempSel = { '60℃': true, '70℃': true }; renderTempList();
  });
  await page.waitForTimeout(200);
  // C4 go to s05: auto assign should produce 4 rows A-60/A-70/B-60/B-70 with temps
  await page.evaluate(() => { go('s05'); renderAssign(); });
  await page.waitForTimeout(300);
  const c4 = await page.evaluate(() => {
    const rows = {};
    Object.keys(DB.wizard.assign).forEach(k => {
      const key = DB.wizard.assign[k] + '|' + (DB.wizard.assignTemp[k] || '');
      rows[key] = (rows[key] || 0) + 1;
    });
    return { pairs: Object.keys(rows).sort(), each12: Object.values(rows).every(n => n === 12), wellTemp: DB.wells ? null : null };
  });
  log('C4 auto grid ' + JSON.stringify(c4.pairs), (c4.pairs.length === 4 && c4.each12) ? 'PASS' : 'FAIL');
  // C5 create experiment with temps, check well.temp + best display
  const c5 = await page.evaluate(() => {
    DB.fName = 1;
    // walk create via direct exp creation path like btn-create would
    var assign = DB.wizard.assign, at = DB.wizard.assignTemp;
    var exp = { id: 'EXP-90', name: 'T-温度测试', plate: '96孔板 · 进行中', drug: '样品T', totalMass: 9600, dose: 100,
      comboCount: 2, tempLevels: selTemps().slice(), wells: freshEmptyWells(100, assign, at), ops: {}, created: '2026.09.09' };
    DB.exps['EXP-90'] = exp; DB.curExp = 'EXP-90'; normalizeDB();
    // fill A1 (A/60℃) as best
    var w = exp.wells['A1'];
    w.output = 94.2; w.purity = 94.2; w.done = true;
    save(); show('s07');
    return { temp: exp.wells['B12'].temp, best: (document.querySelector('#exp-stats') || {}).textContent || '' };
  });
  await page.waitForTimeout(700);
  const c5b = await page.evaluate(() => document.getElementById('exp-stats').textContent);
  log('C5 well.temp set (B12=' + c5.temp + ')', c5.temp === '70℃' ? 'PASS' : 'FAIL');
  log('C6 s07 best shows temp', /A1 · 60℃/.test(c5b) ? 'PASS' : 'FAIL ' + c5b.slice(0, 60));
  // C7 best page shows 结晶温度 row
  await page.evaluate(() => go('s12'));
  await page.waitForTimeout(300);
  const c7 = await page.evaluate(() => document.getElementById('best-page').textContent);
  log('C7 s12 结晶温度 row', /结晶温度/.test(c7) && /60℃/.test(c7) ? 'PASS' : 'FAIL');
  // C8 CSV includes 温度 column
  await page.evaluate(() => go('s11'));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('btn-export').click());
  await page.waitForTimeout(300);
  const c8 = await page.evaluate(() => (document.getElementById('csv-box') || {}).value || '');
  log('C8 csv temp column', /^排名,孔位,组合,试剂配比,温度,/.test(c8) ? 'PASS' : 'FAIL');
  // C9 new temp level sheet
  await page.evaluate(() => { go('s04'); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { DB.wizard.ctab = 'temp'; renderCondTab(); document.getElementById('temp-add').click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { document.getElementById('new-temp').value = '65℃'; document.getElementById('temp-save').click(); });
  await page.waitForTimeout(300);
  const c9 = await page.evaluate(() => DB.tempLevels.indexOf('65℃') >= 0);
  log('C9 add 65℃ level', c9 ? 'PASS' : 'FAIL');
  log('C10 pageErrors=' + errs.length, errs.length === 0 ? 'PASS' : 'FAIL ' + errs.join('|'));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
