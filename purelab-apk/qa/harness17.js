/* RUN-17 —— s04 组合勾选/删除/传导 冒烟测试 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html';
const log = [];
function rec(id, name, ok, detail) { log.push({ id, name, ok }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name} :: ${String(detail).slice(0, 200)}`); }

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

  const vis = () => page.evaluate(() => { const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v.length ? v[0].id : 'NONE'; });
  const wait = (ms = 300) => page.waitForTimeout(ms);
  const go = async a => page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (el) { el.click(); return true; } return false; }, a);
  const clickId = async id => page.evaluate(i => { const el = document.getElementById(i); if (el) { el.click(); return true; } return false; }, id);
  const toastText = () => page.evaluate(() => document.getElementById('toast').textContent);
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')));

  /* 进入向导：s01 → s02 → s03 → s04 */
  await go('s02'); await wait();
  await go('s03'); await wait(); await go('s04'); await wait();

  /* C1 默认全不选 */
  const c1 = await page.evaluate(() => ({
    selCards: document.querySelectorAll('.combo-card.sel').length,
    count: document.getElementById('combo-count').textContent
  }));
  rec('C1', '进入 s04 默认全不选', c1.selCards === 0 && /已选 0/.test(c1.count), `sel=${c1.selCards} count="${c1.count}"`);

  /* C2 未选点下一步 → 拦截 */
  await clickId('combo-next'); await wait();
  const c2 = { screen: await vis(), toast: await toastText() };
  rec('C2', '未勾选下一步被拦截', c2.screen === 's04' && /至少 1 个/.test(c2.toast), `screen=${c2.screen} toast="${c2.toast}"`);

  /* C3 勾选 组合B、组合D */
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-cid="B"]'), e => true).click(); });
  await wait(150);
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-cid="D"]'), e => true).click(); });
  await wait(150);
  const c3 = await page.evaluate(() => ({
    sel: document.querySelectorAll('.combo-card.sel').length,
    count: document.getElementById('combo-count').textContent,
    assign: (JSON.parse(localStorage.getItem('purelab_db')).wizard || {}).assign
  }));
  rec('C3', '勾选 B/D 生效', c3.sel === 2 && /已选 2/.test(c3.count) && !c3.assign, `sel=${c3.sel} count="${c3.count}"`);

  /* C4 下一步 → s05 默认自动分配：每种组合占满一行（12 孔） */
  await clickId('combo-next'); await wait();
  const assignState = () => page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('purelab_db'));
    return { screen: [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none')[0].id,
      assign: d.wizard.assign, head: document.getElementById('assign-cur').textContent,
      mode: d.wizard.amode };
  });
  let c4 = await assignState();
  rec('C4', '默认自动分配：B 占 A 行、D 占 B 行', c4.mode === 'auto' && c4.assign && c4.assign.A1 === 'B' && c4.assign.A12 === 'B' && c4.assign.B1 === 'D' && c4.assign.B12 === 'D' && !c4.assign.C1 && /自动分配/.test(c4.head),
    `keys=${Object.keys(c4.assign || {}).length} head="${c4.head.slice(0, 40)}"`);
  await page.evaluate(() => document.querySelector('#plate-config [data-well="A1"]').click()); await wait(120);
  c4 = await assignState();
  rec('C4a', '自动模式下点孔位不改动分配', c4.assign.A1 === 'B' && Object.keys(c4.assign).length === 24, `keys=${Object.keys(c4.assign).length}`);
  await clickId('am-manual'); await wait(150);
  c4 = await assignState();
  rec('C4b', '切到手动选孔：从组合 B 开始', c4.mode === 'manual' && /正在分配 · 组合B/.test(c4.head), `head="${c4.head.slice(0, 40)}"`);
  await page.evaluate(() => document.querySelector('#plate-config [data-well="A1"]').click()); await wait(120);
  c4 = await assignState();
  rec('C4c', '手动点 A1 取消（剩 23 孔）', !c4.assign.A1 && Object.keys(c4.assign).length === 23, `keys=${Object.keys(c4.assign).length}`);
  await page.evaluate(() => document.querySelector('#plate-config [data-well="A1"]').click()); await wait(120);
  c4 = await assignState();
  rec('C4d', '再点 A1 恢复（12 孔）', c4.assign.A1 === 'B' && Object.keys(c4.assign).length === 24 && /12 孔/.test(c4.head), `keys=${Object.keys(c4.assign).length}`);
  await page.evaluate(() => document.querySelector('#plate-config [data-well="C1"]').click()); await wait(120);
  c4 = await assignState();
  rec('C4e', '手动把 C1 分给当前组合 B（25 孔）', c4.assign.C1 === 'B' && Object.keys(c4.assign).length === 25, `keys=${Object.keys(c4.assign).length} C1=${c4.assign.C1}`);
  await clickId('am-auto'); await wait(150);
  c4 = await assignState();
  rec('C4f', '切回自动分配恢复按行铺满（24 孔）', Object.keys(c4.assign).length === 24 && !c4.assign.C1 && /自动分配/.test(c4.head), `keys=${Object.keys(c4.assign).length} C1=${c4.assign.C1}`);

  /* C5 返回 s04 选择保留 */
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s05 [data-back]'), e => e.getClientRects().length > 0).click(); });
  await wait();
  const c5 = await page.evaluate(() => document.getElementById('combo-count').textContent);
  rec('C5', '返回 s04 勾选保留', /已选 2/.test(c5), `count="${c5}"`);

  /* C6 s06 确认页：门禁通过后进入，占用孔数 = 实际分配数 */
  await clickId('combo-next'); await wait();
  await clickId('assign-step'); await wait();
  const c6 = await page.evaluate(() => document.getElementById('confirm-card').textContent);
  rec('C6', 's06 显示 2 个组合 · 24 孔', /2 个 · 组合B、组合D/.test(c6) && /24 \/ 96 孔/.test(c6), c6.slice(0, 160));

  /* C7 创建实验 → 孔位按分配落组合 */
  await clickId('btn-create'); await wait();
  const c7 = await db();
  rec('C7', '创建后 A/B 两行=B、D，C1 未分配', c7.exp.comboCount === 2 && c7.wells.A1.combo === 'B' && c7.wells.A12.combo === 'B' && c7.wells.B1.combo === 'D' && c7.wells.B12.combo === 'D' && c7.wells.C1.combo === null,
    `comboCount=${c7.exp.comboCount} A1=${c7.wells.A1.combo} A12=${c7.wells.A12.combo} B1=${c7.wells.B1.combo} B12=${c7.wells.B12.combo} C1=${c7.wells.C1.combo}`);

  /* C8 删除预置组合 E */
  await go('s15'); await wait(); await go('s07'); await wait();   /* 回工作台 */
  await page.evaluate(() => { localStorage.setItem('purelab_db', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('purelab_db')), { wizard: { sel: {}, assign: null } }))); });
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-back]'), e => e.getClientRects().length > 0).click(); });  /* s07→s02 */
  await wait();
  await go('s03'); await wait(); await go('s04'); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-del="E"]'), e => true).click(); }); await wait();
  await clickId('dl-go'); await wait();
  const c8 = await page.evaluate(() => ({
    hasE: !!document.querySelector('[data-cid="E"]'),
    deleted: JSON.parse(localStorage.getItem('purelab_db')).deletedCombos,
    count: document.getElementById('combo-count').textContent
  }));
  rec('C8', '删除组合 E 生效并持久化', !c8.hasE && c8.deleted.indexOf('E') > -1, `deleted=${JSON.stringify(c8.deleted)} count="${c8.count}"`);

  /* C9 新建组合 F 并勾选传导 */
  await clickId('combo-add'); await wait(350);
  await page.evaluate(() => { const el = document.querySelector('.tpl-name[data-i="0"]'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, '乙酸乙酯'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => { const el = document.querySelector('.tpl-ratio[data-i="0"]'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, '1'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => { const el = document.querySelector('.tpl-name[data-i="1"]'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, '水'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => { const el = document.querySelector('.tpl-ratio[data-i="1"]'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, '2'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await clickId('cg-save'); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-cid="F"]'), e => true).click(); }); await wait(150);
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-cid="B"]'), e => true).click(); }); await wait(150);
  await clickId('combo-next'); await wait();
  await clickId('am-manual'); await wait(150);
  await clickId('assign-next'); await wait(150);
  await page.evaluate(() => document.querySelector('#plate-config [data-well="C1"]').click()); await wait(120);
  const c9 = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('purelab_db'));
    return { screen: [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none')[0].id, assign: d.wizard.assign };
  });
  rec('C9', '新建组合 F 手动追加 C1（A 行自动=B、C1=F）', c9.screen === 's05' && c9.assign && c9.assign.A1 === 'B' && c9.assign.C1 === 'F', `A1=${c9.assign && c9.assign.A1} C1=${c9.assign && c9.assign.C1}`);

  /* 汇总 */
  const pass = log.filter(l => l.ok).length;
  console.log(`\n==== ${pass}/${log.length} PASS · pageErrors=${pageErrors.length} ====`);
  if (pageErrors.length) console.log(pageErrors.join('\n'));
  await browser.close();
  process.exit(pass === log.length && !pageErrors.length ? 0 : 1);
})();
