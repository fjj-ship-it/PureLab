/* harness30 — v27 回收率/纯度术语与字段
   R1 s10 显示 回收率 + 纯度(HPLC 实测·选填) 行
   R2 填投入/产出 → 回收率自动计算
   R3 纯度录入持久化（reload 后仍在）
   R4 s13 排名行显示「纯 xx%」
   R5 s12 最佳条件含 纯度（HPLC 实测）行
   R6 CSV 表头含 回收率(%),纯度(%)
   R7 全部 DOM 不再出现「纯化率」
   R8 pageErrors = 0 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C://Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=27&t=' + Date.now();
let pass = 0, fail = 0; const pageErrors = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('[PASS] ' + name + (extra ? ' :: ' + extra : '')); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(2500);
  await page.evaluate(() => { if (!document.getElementById('s02').classList.contains('active')) go('s02'); });
  await page.waitForTimeout(400);

  /* 种子：清一色已完成孔，纯度字段清空待录入 */
  await page.evaluate(() => {
    const wells = {};
    ['A','B','C','D','E','F','G','H'].forEach(r => { for (let c = 1; c <= 12; c++)
      wells[r + c] = { coord: r + c, row: r, col: c, combo: 'A', done: false, input: 100, output: 0, purity: 0 }; });
    DB.exps['EXP-08'] = { id: 'EXP-08', name: '回收率实验', plate: '96孔板 · 进行中', drug: '样品丁',
      totalMass: 9600, dose: 100, comboCount: 1, wells, ops: {}, created: '2026.09.07' };
    DB.curExp = 'EXP-08'; DB.selWell = 'A1'; normalizeDB(); save();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => go('s10'));
  await page.waitForTimeout(400);

  /* R1 标签 */
  const wellTxt = await page.evaluate(() => document.getElementById('well-page').textContent);
  ok('R1 s10 含 回收率 与 纯度(HPLC 实测·选填)', wellTxt.includes('回收率') && wellTxt.includes('纯度') && wellTxt.includes('HPLC 实测'));

  /* R2 录入 100 / 88 → 回收率 88.0（page.fill 与重渲染元素有竞态，用页面内事件派发） */
  await page.evaluate(() => {
    function setVal(id, v) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
    setVal('we-in', '100'); setVal('we-out', '88');
  });
  await page.waitForTimeout(400);
  const purVal = await page.evaluate(() => document.getElementById('we-pur').value);
  ok('R2 回收率自动计算 88.0', purVal === '88.0', purVal);

  /* R3 纯度录入 + 持久化 */
  await page.evaluate(() => {
    const el = document.getElementById('we-assay'); el.value = '98.6';
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await page.reload(); await page.waitForTimeout(900);
  await page.evaluate(() => { if (!document.getElementById('s02').classList.contains('active')) go('s02'); go('s10'); });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ assay: document.getElementById('we-assay').value, pur: document.getElementById('we-pur').value }));
  ok('R3 纯度 98.6 持久化', after.assay === '98.6' && after.pur === '88.0', JSON.stringify(after));

  /* R4 s13 排名行显示 纯 */
  await page.evaluate(() => go('s13'));
  await page.waitForTimeout(400);
  const rankTxt = await page.evaluate(() => document.getElementById('rank-page').textContent);
  ok('R4 排名行显示「纯 98.6%」', rankTxt.includes('纯 98.6%'), rankTxt.slice(0, 80));

  /* R5 s12 最佳条件含纯度行 */
  await page.evaluate(() => go('s12'));
  await page.waitForTimeout(400);
  const bestTxt = await page.evaluate(() => document.getElementById('best-page').textContent);
  ok('R5 s12 含 纯度（HPLC 实测）', bestTxt.includes('纯度（HPLC 实测）') && bestTxt.includes('98.6'));

  /* R6 CSV 表头 */
  await page.evaluate(() => go('s13'));
  await page.waitForTimeout(300);
  await page.click('#btn-export'); await page.waitForTimeout(400);
  const csvTxt = await page.evaluate(() => document.getElementById('csv-box').value);
  ok('R6 CSV 含 回收率(%),纯度(%)', csvTxt.split('\n')[0].includes('回收率(%)') && csvTxt.split('\n')[0].includes('纯度(%)'));

  /* R7 全 DOM 无「纯化率」 */
  await page.evaluate(() => go('s02'));
  await page.waitForTimeout(300);
  const hasOld = await page.evaluate(() => document.body.textContent.includes('纯化率'));
  ok('R7 全 app 不再出现「纯化率」', !hasOld);

  ok('R8 pageErrors = 0', pageErrors.length === 0, pageErrors.join(' | '));
  console.log('==== ' + pass + '/' + (pass + fail) + ' PASS · pageErrors=' + pageErrors.length + ' ====');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
