/* harness26 — v21 归档闭环测试
   A1 新建实验出现在进行中轮播
   A2 s11「完成并归档」→ 实验移入首页归档列表首位
   A3 归档行点击弹出详情（来源实验/平均纯化率等）
   A4 归档后原实验从进行中池移除
   A5 默认归档行也可点击看详情
   A6 归档删除仍正常
   A7 pageErrors = 0 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=21&t=' + Date.now();
let pass = 0, fail = 0; const pageErrors = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('[PASS] ' + name + (extra ? ' :: ' + extra : '')); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(700);

  /* 预置：清空存储，注入一个已完成的进行中实验（96 孔全部录入） */
  await page.evaluate(() => {
    localStorage.removeItem('purelab_db');
  });
  await page.reload(); await page.waitForTimeout(600);
  await page.evaluate(() => {
    const wells = {};
    const ROWS = ['A','B','C','D','E','F','G','H'];
    ROWS.forEach(r => { for (let c = 1; c <= 12; c++) {
      wells[r + c] = { coord: r + c, row: r, col: c, combo: 'A', done: true,
        input: 100, output: 88 + ((c * 7 + r.charCodeAt(0)) % 10), purity: 88 + ((c * 7 + r.charCodeAt(0)) % 10) };
    }});
    const db = JSON.parse(localStorage.getItem('purelab_db')) || { exps: {} };   /* archives 留空 → normalizeDB 生成带详情的默认归档 */
    db.exps['EXP-09'] = { id: 'EXP-09', name: '归档闭环测试实验', plate: '96孔板 · 进行中',
      drug: '测试样品 Z', totalMass: 9600, dose: 100, comboCount: 2, wells, ops: {}, created: '2026.09.06' };
    db.curExp = 'EXP-09';
    localStorage.setItem('purelab_db', JSON.stringify(db));
  });
  await page.reload(); await page.waitForTimeout(700);

  /* A1 新建/注入的实验出现在进行中轮播 */
  const carouselTxt = await page.evaluate(() => document.getElementById('home-ongoing').textContent);
  ok('A1 进行中轮播含 EXP-09 归档闭环测试实验', carouselTxt.includes('EXP-09') && carouselTxt.includes('归档闭环测试实验'));

  /* A2 进入 s11 → 完成并归档 → 确认 → 回首页归档首位 */
  await page.evaluate(() => { document.querySelector('[data-expid="EXP-09"]').click(); });  // 进 s07
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.querySelector('[data-go="s11"]').click(); });
  await page.waitForTimeout(400);
  const onS11 = await page.evaluate(() => document.getElementById('s11').classList.contains('active'));
  ok('A2-pre 进入 s11 结果总览', onS11);
  await page.click('#btn-archive'); await page.waitForTimeout(300);
  await page.click('#arch-go'); await page.waitForTimeout(600);
  const archTxt = await page.evaluate(() => document.getElementById('home-archive').textContent);
  ok('A2 归档列表首位含「归档闭环测试实验」', archTxt.indexOf('归档闭环测试实验') > -1 && archTxt.indexOf('归档闭环测试实验') < archTxt.indexOf('溶解度粗测'));

  /* A3 点击该归档行 → 详情弹层含来源实验 EXP-09 / 平均纯化率 */
  await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-archid]');
    for (const r of rows) if (r.textContent.includes('归档闭环测试实验')) { r.click(); break; }
  });
  await page.waitForTimeout(400);
  const sheetTxt = await page.evaluate(() => document.getElementById('sheet-body').textContent);
  ok('A3 详情含来源实验 EXP-09', sheetTxt.includes('EXP-09'), sheetTxt.slice(0, 120));
  ok('A3 详情含平均纯化率与最佳孔位', /平均纯化率/.test(sheetTxt) && /最佳孔位/.test(sheetTxt));
  await page.evaluate(() => closeSheet());
  await page.waitForTimeout(300);

  /* A4 原实验从进行中池移除 */
  const carouselTxt2 = await page.evaluate(() => document.getElementById('home-ongoing').textContent);
  ok('A4 归档后 EXP-09 不再出现在进行中轮播', !carouselTxt2.includes('EXP-09'), carouselTxt2.slice(0, 80));

  /* A5 默认归档行可点击看详情 */
  await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-archid]');
    for (const r of rows) if (r.textContent.includes('溶解度粗测')) { r.click(); break; }
  });
  await page.waitForTimeout(400);
  const sheetTxt2 = await page.evaluate(() => document.getElementById('sheet-body').textContent);
  ok('A5 默认归档「溶解度粗测」详情含 EXP-01', sheetTxt2.includes('EXP-01'));
  await page.evaluate(() => closeSheet());
  await page.waitForTimeout(300);

  /* A6 归档删除仍正常 */
  await page.evaluate(() => {
    const els = document.querySelectorAll('[data-delarch]');
    for (const el of els) if (el.closest('.arch-row') && el.closest('.arch-row').textContent.includes('归档闭环测试实验')) { el.click(); break; }
  });
  await page.waitForTimeout(300);
  const hasConfirm = await page.evaluate(() => !!document.getElementById('delarch-go'));
  if (hasConfirm) { await page.click('#delarch-go'); await page.waitForTimeout(400); }
  const archTxt2 = await page.evaluate(() => document.getElementById('home-archive').textContent);
  ok('A6 归档删除后列表不再含该实验', !archTxt2.includes('归档闭环测试实验'));

  ok('A7 pageErrors = 0', pageErrors.length === 0, pageErrors.join(' | '));

  console.log('==== ' + pass + '/' + (pass + fail) + ' PASS · pageErrors=' + pageErrors.length + ' ====');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
