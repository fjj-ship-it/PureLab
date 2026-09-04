/* RUN-18 —— s10 三行原地编辑 + 备注 冒烟测试 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html';
const log = [];
function rec(id, name, ok, detail) { log.push({ id, ok }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name} :: ${String(detail).slice(0, 200)}`); }

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
  const setInput = (id, v) => page.evaluate(({ id, v }) => { const el = document.getElementById(id); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, { id, v });
  const blur = id => page.evaluate(i => { document.getElementById(i).dispatchEvent(new Event('change', { bubbles: true })); }, id);
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')));

  /* 打开演示实验 s07，点 C7 孔进详情 */
  await go('s02'); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-go="s07"]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await page.evaluate(() => { document.querySelector('#plate-mini [data-well="C7"]').click(); }); await wait();
  rec('D0', '进入 s10', await vis() === 's10', '');

  /* D1 三行输入框存在，无底部编辑行，备注默认空 */
  const d1 = await page.evaluate(() => ({
    in: !!document.getElementById('we-in'), out: !!document.getElementById('we-out'),
    pur: !!document.getElementById('we-pur'), slot: !!document.getElementById('well-edit-slot'),
    note: document.getElementById('w-note').value
  }));
  rec('D1', '三行输入+备注为空+无底部编辑行', d1.in && d1.out && d1.pur && !d1.slot && d1.note === '', JSON.stringify(d1));

  /* D2 演示孔 C7 已有数据：投入 100 / 产出 94.2 / 纯化率 94.2 */
  const d2 = await page.evaluate(() => ({ i: document.getElementById('we-in').value, o: document.getElementById('we-out').value, p: document.getElementById('we-pur').value }));
  rec('D2', '已有数据回填', d2.i === '100.0' && d2.o === '94.2' && d2.p === '94.2', JSON.stringify(d2));

  /* D3 改产出量 → 纯化率联动 */
  await setInput('we-out', '88.0'); await blur('we-out'); await wait();
  let d = await db();
  const p1 = await page.evaluate(() => document.getElementById('we-pur').value);
  rec('D3', '产出 88.0 → 纯化率 88.0', p1 === '88.0' && d.wells.C7.purity === 88 && d.wells.C7.done, `p=${p1} db=${d.wells.C7.purity}`);

  /* D4 只填纯化率 → 反推产出量 */
  await setInput('we-pur', '90'); await blur('we-pur'); await wait();
  d = await db();
  const o2 = await page.evaluate(() => document.getElementById('we-out').value);
  rec('D4', '纯化率 90 → 产出 90.0', o2 === '90.0' && d.wells.C7.output === 90, `o=${o2}`);

  /* D5 产出量留空 → 数据清除 */
  await setInput('we-out', ''); await blur('we-out'); await wait();
  d = await db();
  rec('D5', '产出量留空清除数据', d.wells.C7.done === false && d.wells.C7.output == null, `done=${d.wells.C7.done}`);

  /* D6 重新录入空孔（B6 空孔演示）+ 校验拦截 */
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s10 [data-back]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await page.evaluate(() => { document.querySelector('#plate-mini [data-well="B6"]').click(); }); await wait();
  await setInput('we-in', '100'); await setInput('we-out', '95.5');
  await blur('we-out'); await wait();
  d = await db();
  rec('D6', '空孔录入 B6 → 95.5%', d.wells.B6.done && d.wells.B6.purity === 95.5, `purity=${d.wells.B6.purity}`);

  /* D7 产出量大于投入量被拦截 */
  await setInput('we-out', '120'); await blur('we-out'); await wait();
  d = await db();
  const toast7 = await page.evaluate(() => document.getElementById('toast').textContent);
  rec('D7', '产出>投入被拦截', d.wells.B6.output === 95.5 && /大于投入量/.test(toast7), `out=${d.wells.B6.output} toast="${toast7}"`);

  /* D8 备注自填并持久化 */
  await page.evaluate(() => { const el = document.getElementById('w-note'); Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(el, '晶体边角完整，重复性好'); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await wait();
  d = await db();
  rec('D8', '备注自填持久化', d.wells.B6.note === '晶体边角完整，重复性好', `note="${d.wells.B6.note}"`);

  /* 汇总 */
  const pass = log.filter(l => l.ok).length;
  console.log(`\n==== ${pass}/${log.length} PASS · pageErrors=${pageErrors.length} ====`);
  if (pageErrors.length) console.log(pageErrors.join('\n'));
  await browser.close();
  process.exit(pass === log.length && !pageErrors.length ? 0 : 1);
})();
