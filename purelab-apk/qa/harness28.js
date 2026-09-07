/* harness28 — v25 实验总览（s16）
   P1 我的实验菜单 → s16 总览屏（不是 s07）
   P2 总览列出全部进行中实验
   P3 点非当前实验卡片 → 切换 curExp 并进入 s07
   P4 归档行点击 → 详情弹层
   P5 s15 空实验池不崩溃（统计显示 —）
   P6 pageErrors = 0 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=25&t=' + Date.now();
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
    // 预置：两个进行中实验（EXP-08 当前 + EXP-07 非当前）
    function mkWells() { const w = {}; ['A','B','C','D','E','F','G','H'].forEach(r => { for (let c = 1; c <= 12; c++)
      w[r + c] = { coord: r + c, row: r, col: c, combo: 'A', done: c % 2 === 0, input: 100, output: 0, purity: 80 + ((c * 3) % 18) }; }); return w; }
    DB.exps['EXP-08'] = { id: 'EXP-08', name: '总览实验甲', plate: '96孔板 · 进行中', drug: '样品甲', totalMass: 9600, dose: 100, comboCount: 2, wells: mkWells(), ops: {}, created: '2026.09.07' };
    DB.exps['EXP-07'] = { id: 'EXP-07', name: '总览实验乙', plate: '96孔板 · 进行中', drug: '样品乙', totalMass: 4800, dose: 50, comboCount: 1, wells: mkWells(), ops: {}, created: '2026.09.06' };
    DB.curExp = 'EXP-08'; normalizeDB(); save(); renderHome();
  });
  await page.waitForTimeout(400);

  /* P1 s15 → 我的实验 → 应到 s16 */
  await page.evaluate(() => go('s15'));
  await page.waitForTimeout(300);
  await page.evaluate(() => { const rows = document.querySelectorAll('#profile-page .menu-row'); for (const r of rows) if (r.textContent.includes('我的实验')) r.click(); });
  await page.waitForTimeout(400);
  const onS16 = await page.evaluate(() => document.getElementById('s16').classList.contains('active'));
  const onS07 = await page.evaluate(() => document.getElementById('s07').classList.contains('active'));
  ok('P1 我的实验 → s16 总览（非 s07）', onS16 && !onS07, 's16=' + onS16 + ' s07=' + onS07);

  /* P2 总览列出全部进行中实验 */
  const ovTxt = await page.evaluate(() => document.getElementById('expov-page').textContent);
  ok('P2 总览含 EXP-07/EXP-08 + 归档', ovTxt.includes('EXP-07') && ovTxt.includes('EXP-08') && ovTxt.includes('溶解度粗测'));
  ok('P2b 当前实验标记「当前」', /总览实验甲/.test(ovTxt) && ovTxt.includes('当前'));

  /* P3 点 EXP-07 卡片 → 切换并进入 s07 */
  await page.evaluate(() => { const rows = document.querySelectorAll('[data-pickexp]'); for (const r of rows) if (r.getAttribute('data-pickexp') === 'EXP-07') r.click(); });
  await page.waitForTimeout(500);
  const s07on = await page.evaluate(() => document.getElementById('s07').classList.contains('active'));
  const curNow = await page.evaluate(() => DB.curExp);
  const headTxt = await page.evaluate(() => document.getElementById('exp-head').textContent);
  ok('P3 点 EXP-07 → 切换 curExp 并进 s07', s07on && curNow === 'EXP-07', 'cur=' + curNow);
  ok('P3b s07 头部显示 EXP-07', headTxt.includes('EXP-07') && headTxt.includes('总览实验乙'), headTxt.slice(0, 40));

  /* P4 总览页归档行 → 详情弹层 */
  await page.evaluate(() => { back(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const rows = document.querySelectorAll('#expov-page [data-archid]'); if (rows[0]) rows[0].click(); });
  await page.waitForTimeout(400);
  const sheetTxt = await page.evaluate(() => document.getElementById('sheet-body').textContent);
  ok('P4 总览归档行 → 详情弹层', sheetTxt.includes('来源实验') && sheetTxt.includes('EXP-01'));
  await page.evaluate(() => closeSheet()); await page.waitForTimeout(200);

  /* P5 空实验池 → s15 不崩溃 */
  await page.evaluate(() => {
    closeSheet();
    DB.exps = {}; DB.curExp = null; normalizeDB(); save(); go('s15');
  });
  await page.waitForTimeout(400);
  const profTxt = await page.evaluate(() => document.getElementById('profile-page').textContent);
  const err5 = pageErrors.length;
  ok('P5 空池 s15 正常渲染（最佳显示 —）', profTxt.includes('试剂条目') && profTxt.includes('—'), profTxt.slice(0, 60).replace(/\s+/g, ' '));

  ok('P6 pageErrors = 0', pageErrors.length === 0, pageErrors.join(' | '));
  console.log('==== ' + pass + '/' + (pass + fail) + ' PASS · pageErrors=' + pageErrors.length + ' ====');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
