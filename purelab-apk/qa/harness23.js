/* RUN-23 —— s02 多实验轮播（横向拖拽/滚轮/磁吸/缩放）+ 多实验切换 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html';
const log = [];
function rec(id, name, ok, detail) { log.push({ id, name, ok }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name} :: ${String(detail).slice(0, 220)}`); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  await page.goto(APP, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(400);
  const wait = (ms = 300) => page.waitForTimeout(ms);
  const vis = () => page.evaluate(() => { const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v[0].id; });
  const go = async a => page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (el) { el.click(); return true; } return false; }, a);
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')));

  /* M1 首页渲染 3 个进行中实验卡片 */
  await go('s02'); await wait(400);
  const m1 = await page.evaluate(() => {
    const cs = [].map.call(document.querySelectorAll('#exp-carousel .exp-card'), c => ({ id: c.getAttribute('data-expid'), go: c.hasAttribute('data-go') }));
    return { n: cs.length, ids: cs.map(c => c.id).join(','), curGo: cs.filter(c => c.go).map(c => c.id).join(',') };
  });
  rec('M1', '轮播 3 卡，激活卡 EXP-03 带 data-go', m1.n === 3 && m1.ids === 'EXP-03,EXP-02,EXP-01' && m1.curGo === 'EXP-03', JSON.stringify(m1));

  /* M2 初始居中 = 当前实验 EXP-03，居中卡 scale 最大、透明度 1 */
  const m2 = await page.evaluate(() => {
    const el = document.getElementById('exp-carousel');
    const cur = el.querySelector('[data-expid="EXP-03"]');
    const r = el.getBoundingClientRect(), cr = cur.getBoundingClientRect();
    const off = Math.abs((cr.left + cr.width / 2) - (r.left + r.width / 2));
    return { off: Math.round(off), tr: cur.style.transform, op: cur.style.opacity };
  });
  rec('M2', 'EXP-03 初始居中（偏心 <8px），scale=1 全不透明', m2.off < 8 && /scale\(1\)/.test(m2.tr) && m2.op === '1', JSON.stringify(m2));

  /* M3 滚轮横向滚动：侧卡缩放/透明度递减 */
  await page.evaluate(() => { const el = document.getElementById('exp-carousel'); el.dispatchEvent(new WheelEvent('wheel', { deltaY: 260, bubbles: true, cancelable: true })); });
  await wait(200);
  const m3 = await page.evaluate(() => {
    const el = document.getElementById('exp-carousel');
    const side = el.querySelector('[data-expid="EXP-03"]');
    return { sl: Math.round(el.scrollLeft), tr: side.style.transform, op: side.style.opacity };
  });
  const sc3 = parseFloat((m3.tr.match(/scale\(([\d.]+)\)/) || [])[1]);
  rec('M3', '滚轮驱动横向滚动，侧卡缩小变透明', m3.sl > 40 && sc3 < 0.95 && parseFloat(m3.op) < 0.95, JSON.stringify(m3));

  /* M4 滚动停止后磁吸：EXP-02 居中 */
  await wait(900);
  const m4 = await page.evaluate(() => {
    const el = document.getElementById('exp-carousel');
    const c = el.querySelector('[data-expid="EXP-02"]');
    const r = el.getBoundingClientRect(), cr = c.getBoundingClientRect();
    return Math.round((cr.left + cr.width / 2) - (r.left + r.width / 2));
  });
  rec('M4', '磁吸对齐：EXP-02 停在居中（偏心 <10px）', Math.abs(m4) < 10, 'off=' + m4);

  /* M5 鼠标拖拽滚动（带惯性） */
  const box = await page.evaluate(() => { const r = document.getElementById('exp-carousel').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x - i * 22, box.y, { steps: 2 });
  await page.mouse.up();
  await wait(1600);
  const m5 = await page.evaluate(() => {
    const el = document.getElementById('exp-carousel');
    const c = el.querySelector('[data-expid="EXP-01"]');
    const r = el.getBoundingClientRect(), cr = c.getBoundingClientRect();
    return Math.round((cr.left + cr.width / 2) - (r.left + r.width / 2));
  });
  rec('M5', '拖拽+惯性后磁吸：EXP-01 居中（偏心 <10px）', Math.abs(m5) < 10, 'off=' + m5);

  /* M6 点击非居中卡 → 只居中不跳页 */
  await page.evaluate(() => document.querySelector('#exp-carousel [data-expid="EXP-02"]').click());
  await wait(100);
  const m6 = { screen: await vis() };
  rec('M6', '点击侧卡仅居中，不跳页', m6.screen === 's02', 'screen=' + m6.screen);
  await wait(700);

  /* M7 点击已居中的侧卡 → 切换激活并进入 s07 */
  await page.evaluate(() => document.querySelector('#exp-carousel [data-expid="EXP-02"]').click());
  await wait(400);
  const m7 = await db();
  rec('M7', '点击居中卡切换激活：curExp=EXP-02 并进入 s07', await vis() === 's07' && m7.curExp === 'EXP-02' && m7.exp.id === 'EXP-02', 'screen=' + (await vis()));

  /* M8 s07 展示的是 EXP-02 的数据（独立 wells） */
  const m8 = await page.evaluate(() => document.getElementById('exp-head').textContent);
  rec('M8', 's07 标题显示 EXP-02', /EXP-02 · 手性拆分初筛/.test(m8), m8.slice(0, 50));

  /* M9 返回首页：EXP-02 变为首位激活卡 */
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s07 [data-back]'), e => e.getClientRects().length > 0).click(); }); await wait(400);
  const m9 = await page.evaluate(() => {
    const first = document.querySelector('#exp-carousel .exp-card');
    return { id: first.getAttribute('data-expid'), go: first.hasAttribute('data-go') };
  });
  rec('M9', '首页首位卡片变为激活的 EXP-02', m9.id === 'EXP-02' && m9.go, JSON.stringify(m9));

  /* M10 数据隔离：两个实验 wells 互不影响 */
  const m10 = await db();
  const c3 = m10.exps['EXP-03'].wells.C7.done, c2 = m10.exps['EXP-02'].wells.C7.done;
  rec('M10', '实验池数据隔离：EXP-03.C7 完成、EXP-02.C7 独立', c3 === true && typeof c2 === 'boolean', `C7@03=${c3} C7@02=${c2}`);

  /* M11 新建实验进入池并激活（走完整向导太长，直接调 btn-create 前置：模拟 wizard 状态后创建） */
  await go('s03'); await wait();
  await go('s04'); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-cid="B"]'), e => true).click(); });
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-cid="D"]'), e => true).click(); });
  await wait(150);
  await page.evaluate(() => document.getElementById('combo-next').click()); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#plate-config [data-well]'), e => true).click(); }); await wait(150);
  await page.evaluate(() => document.getElementById('assign-step').click()); await wait();
  await page.evaluate(() => document.getElementById('btn-create').click()); await wait();
  const m11 = await db();
  rec('M11', '新实验 EXP-04 入池并激活', !!m11.exps['EXP-04'] && m11.curExp === 'EXP-04' && m11.exp.id === 'EXP-04', 'curExp=' + m11.curExp + ' keys=' + Object.keys(m11.exps).join(','));

  /* M12 回首页 EXP-04 居中在首位 */
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s07 [data-back]'), e => e.getClientRects().length > 0).click(); }); await wait(500);
  const m12 = await page.evaluate(() => {
    const el = document.getElementById('exp-carousel');
    const first = el.querySelector('.exp-card');
    const r = el.getBoundingClientRect(), fr = first.getBoundingClientRect();
    return { id: first.getAttribute('data-expid'), off: Math.round(fr.left + fr.width / 2 - r.left - r.width / 2) };
  });
  rec('M12', '回首页 EXP-04 首位且居中', m12.id === 'EXP-04' && Math.abs(m12.off) < 10, JSON.stringify(m12));

  /* 汇总 */
  const pass = log.filter(l => l.ok).length;
  console.log(`\n==== ${pass}/${log.length} PASS · pageErrors=${pageErrors.length} ====`);
  if (pageErrors.length) console.log(pageErrors.join('\n'));
  await browser.close();
  process.exit(pass === log.length && !pageErrors.length ? 0 : 1);
})();
