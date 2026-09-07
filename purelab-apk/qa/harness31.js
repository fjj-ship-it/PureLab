/* harness31 — v28 高级动效
   M1 s16 总览行有 stagger-item 交错入场
   M2 s02 归档行有 stagger-item
   M3 删除归档：先 .leaving 滑出动画，动画后列表移除
   M4 删除实验：carousel 卡片 .leaving 后移除
   M5 s07 统计数字 span 存在且最终值正确（countUp 收敛）
   M6 s11 hero 数字 span 存在
   M7 chip.on 有弹性样式、sheet/pbar 使用弹簧曲线
   M8 pageErrors = 0 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=28&t=' + Date.now();
let pass = 0, fail = 0; const pageErrors = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('[PASS] ' + name + (extra ? ' :: ' + extra : '')); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}
function setVal(page, id, v) {
  return page.evaluate(([id, v]) => {
    const el = document.getElementById(id); el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, v]);
}
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(2500);
  await page.evaluate(() => {
    if (!document.getElementById('s02').classList.contains('active')) go('s02');
    function mkWells(n) { const w = {}; ['A','B','C','D','E','F','G','H'].forEach(r => { for (let c = 1; c <= 12; c++)
      w[r + c] = { coord: r + c, row: r, col: c, combo: 'A', done: (r.charCodeAt(0) - 65) * 12 + c <= n, input: 100, output: 85, purity: 85 }; }); return w; }
    DB.exps['EXP-08'] = { id: 'EXP-08', name: '动效实验甲', plate: '96孔板 · 进行中', drug: '样品甲', totalMass: 9600, dose: 100, comboCount: 2, wells: mkWells(48), ops: {}, created: '2026.09.07' };
    DB.exps['EXP-07'] = { id: 'EXP-07', name: '动效实验乙', plate: '96孔板 · 进行中', drug: '样品乙', totalMass: 4800, dose: 50, comboCount: 1, wells: mkWells(12), ops: {}, created: '2026.09.06' };
    DB.curExp = 'EXP-08'; normalizeDB(); save(); renderHome();
  });
  await page.waitForTimeout(500);

  /* M1/M2 stagger */
  const stag = await page.evaluate(() => ({
    ov: document.querySelectorAll('#expov-page .stagger-item').length,
    home: document.querySelectorAll('#home-archive .stagger-item').length,
    delay: (document.querySelector('#home-archive .stagger-item') || {}).style ? document.querySelector('#home-archive .stagger-item').style.animationDelay : null
  }));
  await page.evaluate(() => go('s16')); await page.waitForTimeout(400);
  stag.ov = await page.evaluate(() => document.querySelectorAll('#expov-page .stagger-item').length);
  ok('M1 s16 总览行交错入场', stag.ov >= 4, 'rows=' + stag.ov);
  ok('M2 归档行交错入场带 delay', stag.home >= 2 && stag.delay !== null, 'home=' + stag.home + ' delay=' + stag.delay);

  /* M3 删除归档：leaving 动画 */
  await page.evaluate(() => go('s02')); await page.waitForTimeout(400);
  const archId0 = await page.evaluate(() => document.querySelector('#home-archive [data-delarch]').getAttribute('data-delarch'));
  await page.evaluate(id => { document.querySelector('#home-archive [data-delarch="' + id + '"]').click(); }, archId0);
  await page.waitForTimeout(250);
  await page.click('#delarch-go'); await page.waitForTimeout(120);
  const leavingNow = await page.evaluate(() => !!document.querySelector('#home-archive .leaving'));
  await page.waitForTimeout(600);
  const goneAfter = await page.evaluate(id => !document.querySelector('#home-archive [data-archid="' + id + '"]'), archId0);
  ok('M3 删除归档先滑出后移除', leavingNow && goneAfter, 'leaving=' + leavingNow + ' gone=' + goneAfter);

  /* M4 删除实验 carousel 卡片滑出 */
  await page.evaluate(() => go('s02')); await page.waitForTimeout(300);
  const delId = await page.evaluate(() => { const c = document.querySelector('[data-delexp]'); c.click(); return c.getAttribute('data-delexp'); });
  await page.waitForTimeout(250);
  await page.click('#delexp-go'); await page.waitForTimeout(120);
  const cardLeaving = await page.evaluate(id => !!document.querySelector('.exp-card[data-expid="' + id + '"].leaving'), delId);
  await page.waitForTimeout(600);
  const cardGone = await page.evaluate(id => !document.querySelector('.exp-card[data-expid="' + id + '"]'), delId);
  ok('M4 删除实验卡片定向滑出', cardLeaving && cardGone, 'leaving=' + cardLeaving + ' gone=' + cardGone);

  /* M5 s07 数字滚动收敛 */
  await page.evaluate(() => go('s07')); await page.waitForTimeout(900);
  const r5 = await page.evaluate(() => ({ n: document.getElementById('st-n').textContent, best: document.getElementById('st-best').textContent }));
  ok('M5 s07 countUp 收敛到正确值', r5.n === '12' && r5.best === '85.0%', JSON.stringify(r5));  /* M4 已删除当前实验，剩余 EXP-07=12 孔 */

  /* M6 s11 hero span */
  await page.evaluate(() => go('s11')); await page.waitForTimeout(800);
  const hero = await page.evaluate(() => document.getElementById('res-hero') ? document.getElementById('res-hero').textContent : null);
  ok('M6 s11 hero 数字 span', hero === '85.0%', hero);

  /* M7 CSS 动效挂载 */
  const css = await page.evaluate(() => {
    const sheet = [...document.styleSheets].find(s => s.href && s.href.includes('app.css'));
    let txt = ''; try { txt = [...sheet.cssRules].map(r => r.cssText).join('\n'); } catch (e) {}
    txt = txt.replace(/\s/g, ''); return { spring: txt.includes('cubic-bezier(.34,1.35,.5,1)') || txt.includes('1.35,.5,1') || txt.includes('1.35,0.5,1'), stagger: txt.includes('rowIn'), leave: txt.includes('.leaving'), chip: txt.includes('chipPop') };
  });
  ok('M7 弹簧/交错/滑出/弹跳样式就位', css.spring && css.stagger && css.leave && css.chip, JSON.stringify(css));

  ok('M8 pageErrors = 0', pageErrors.length === 0, pageErrors.join(' | '));
  console.log('==== ' + pass + '/' + (pass + fail) + ' PASS · pageErrors=' + pageErrors.length + ' ====');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
