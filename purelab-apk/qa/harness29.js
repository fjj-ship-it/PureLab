/* harness29 — v26 最佳孔位条件信息
   C1 总览行显示 最佳% + 孔位 + 条件组合名
   C2 总览行显示组合配方行
   C3 s15 最佳统计带孔位与条件
   C4 归档详情含「最佳条件」「组合配方」
   C5 pageErrors = 0 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C://Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=26&t=' + Date.now();
let pass = 0, fail = 0; const pageErrors = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('[PASS] ' + name + (extra ? ' :: ' + extra : '')); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(1000);
  await page.evaluate(() => {
    if (!document.getElementById('s02').classList.contains('active')) go('s02');
    const wells = {};
    ['A','B','C','D','E','F','G','H'].forEach(r => { for (let c = 1; c <= 12; c++)
      wells[r + c] = { coord: r + c, row: r, col: c, combo: 'C', done: c <= 4, input: 100, output: 0, purity: 70 + c * 5 }; });
    wells.C4.purity = 96.5;   // 全板最佳 → C4
    DB.exps['EXP-08'] = { id: 'EXP-08', name: '条件信息实验', plate: '96孔板 · 进行中', drug: '样品丙',
      totalMass: 9600, dose: 100, comboCount: 3, wells, ops: {}, created: '2026.09.07' };
    DB.curExp = 'EXP-08'; normalizeDB(); save();
  });
  await page.waitForTimeout(300);

  /* C1/C2 总览行 */
  await page.evaluate(() => go('s16'));
  await page.waitForTimeout(400);
  const rowTxt = await page.evaluate(() => {
    const rows = document.querySelectorAll('.exp-ov-row');
    for (const r of rows) if (r.textContent.includes('条件信息实验')) return r.textContent;
    return '';
  });
  ok('C1 总览行含 最佳% + 孔位 C4 + 组合C', /最佳\s*96.5%\s*·\s*C4/.test(rowTxt) && rowTxt.includes('组合C'), rowTxt.slice(0, 90));
  ok('C2 总览行含配方', rowTxt.includes('丙酮 : 水 = 3 : 1'));
  const hasRecipeEl = await page.evaluate(() => !!document.querySelector('.exp-ov-row .exp-recipe'));
  ok('C2b .exp-recipe 元素存在', hasRecipeEl);

  /* C3 s15 最佳统计
     v2.10 排版修订：「C4 · 组合C」用 .nb 绑成一块（窄列不再出现「…C4·」悬尾分隔符），
     「最佳」后面的「·」随之并入整块，文本变为「EXP-08 最佳 C4 · 组合C」，正则放宽兼容两种写法 */
  await page.evaluate(() => go('s15'));
  await page.waitForTimeout(300);
  const profTxt = await page.evaluate(() => document.getElementById('profile-page').textContent);
  ok('C3 s15 最佳带孔位与条件', /96.5%/.test(profTxt) && /EXP-08 最佳\s*·?\s*C4 · 组合C/.test(profTxt), profTxt.match(/EXP-08[^试剂]*/)[0]);

  /* C4 归档详情（默认归档带 bestCombo） */
  await page.evaluate(() => { go('s16'); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const rows = document.querySelectorAll('#expov-page [data-archid]'); if (rows[0]) rows[0].click(); });
  await page.waitForTimeout(400);
  const sheetTxt = await page.evaluate(() => document.getElementById('sheet-body').textContent);
  ok('C4 归档详情含 最佳条件/组合配方', sheetTxt.includes('最佳条件') && sheetTxt.includes('组合配方'), sheetTxt.slice(0, 80));
  await page.evaluate(() => closeSheet());

  ok('C5 pageErrors = 0', pageErrors.length === 0, pageErrors.join(' | '));
  console.log('==== ' + pass + '/' + (pass + fail) + ' PASS · pageErrors=' + pageErrors.length + ' ====');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
