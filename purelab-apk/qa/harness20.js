/* RUN-20 —— s09 点选孔位批量录入 冒烟测试 */
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

  const wait = (ms = 300) => page.waitForTimeout(ms);
  const go = async a => page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (el) { el.click(); return true; } return false; }, a);
  const setInput = (id, v) => page.evaluate(({ id, v }) => { const el = document.getElementById(id); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, { id, v });
  const info = () => page.evaluate(() => document.getElementById('batch-sel-info').textContent);
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')));
  const tapWell = c => page.evaluate(c => document.querySelector('#plate-pick [data-well="' + c + '"]').click(), c);

  /* 进入 s09（s02 → s07 → 批量） */
  await go('s02'); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-go="s07"]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await go('s08'); await wait(); await go('s09'); await wait();

  /* F1 默认点选模式：板可见、chips 隐藏 */
  const f1 = await page.evaluate(() => ({
    plate: document.getElementById('pick-plate-card').style.display !== 'none',
    chips: document.getElementById('batch-chips').style.display === 'none',
    wells: document.querySelectorAll('#plate-pick .well').length
  }));
  rec('F1', '默认点选模式，96 孔板可见', f1.plate && f1.chips && f1.wells === 96, JSON.stringify(f1));

  /* F2 点选 3 孔 + 取消 1 孔 */
  await tapWell('C3'); await wait(80); await tapWell('D7'); await wait(80); await tapWell('F5'); await wait(80);
  rec('F2a', '选 3 孔 info=已选 3', (await info()) === '已选 3 孔', await info());
  await tapWell('D7'); await wait(80);
  const f2 = await page.evaluate(() => document.querySelectorAll('#plate-pick .well.sel').length);
  rec('F2b', '取消 D7 → 剩 2 孔选中', f2 === 2 && (await info()) === '已选 2 孔', `sel=${f2} info="${await info()}"`);

  /* F3 清空点选后应用 → 拦截 */
  await setInput('b-out', '88.0');
  await tapWell('C3'); await wait(60); await tapWell('F5'); await wait(60);
  await page.evaluate(() => document.getElementById('b-apply').click()); await wait();
  const f3toast = await page.evaluate(() => document.getElementById('toast').textContent);
  rec('F3', '未点选应用被拦截', /点选孔位/.test(f3toast), `toast="${f3toast}"`);

  /* F4 重新点选 2 孔，取消「仅填充未完成」后应用 → 覆盖已完成孔 */
  await tapWell('C3'); await wait(60); await tapWell('F5'); await wait(60);
  await page.evaluate(() => document.getElementById('b-onlyempty').click());   /* 取消仅填充 */
  await page.evaluate(() => document.getElementById('b-apply').click()); await wait();
  let d = await db();
  rec('F4', 'C3/F5 批量 88.0%', d.wells.C3.done && d.wells.C3.purity === 88 && d.wells.F5.done && d.wells.F5.purity === 88,
    `C3=${d.wells.C3.purity} F5=${d.wells.F5.purity}`);
  const vis4 = await page.evaluate(() => { const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v[0].id; });
  rec('F4b', '应用成功返回上一页', vis4 === 's08', `screen=${vis4}`);

  /* F5 仅填充未完成（重新勾上）：已完成 C3 跳过，空孔 B6 填入 */
  await go('s09'); await wait();
  await page.evaluate(() => document.getElementById('b-onlyempty').click());   /* 重新勾选 */
  await tapWell('C3'); await wait(60); await tapWell('A3'); await wait(60);
  await setInput('b-out', '80.0');
  await page.evaluate(() => document.getElementById('b-apply').click()); await wait();
  d = await db();
  rec('F5', '仅填充未完成：C3 跳过保持 88，A3 填入 80', d.wells.C3.purity === 88 && d.wells.A3.done && d.wells.A3.purity === 80,
    `C3=${d.wells.C3.purity} A3=${d.wells.B6.purity}`);
  const vis5 = await page.evaluate(() => { const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v[0].id; });
  rec('F5b', '混合选择成功后返回上一页', vis5 === 's08', `screen=${vis5}`);

  /* F5c 只选已完成孔 → 全部跳过，留在原页 */
  await go('s09'); await wait();
  await tapWell('C3'); await wait(60);
  await page.evaluate(() => document.getElementById('b-apply').click()); await wait();
  const vis5c = await page.evaluate(() => { const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v[0].id; });
  const toast5c = await page.evaluate(() => document.getElementById('toast').textContent);
  rec('F5c', '全部跳过时留在原页', vis5c === 's09' && /跳过/.test(toast5c), `screen=${vis5c} toast="${toast5c}"`);

  /* F6 切回按区域模式：板隐藏、chips 显示 */
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#batch-seg [data-seg="area"]'), e => true).click(); }); await wait();
  const f6 = await page.evaluate(() => ({
    plate: document.getElementById('pick-plate-card').style.display === 'none',
    chips: document.getElementById('batch-chips').style.display !== 'none'
  }));
  rec('F6', '切回区域模式 UI 正常', f6.plate && f6.chips, JSON.stringify(f6));

  const pass = log.filter(l => l.ok).length;
  console.log(`\n==== ${pass}/${log.length} PASS · pageErrors=${pageErrors.length} ====`);
  if (pageErrors.length) console.log(pageErrors.join('\n'));
  await browser.close();
  process.exit(pass === log.length && !pageErrors.length ? 0 : 1);
})();
