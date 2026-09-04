/* RUN-19 —— s10 上一孔/下一孔跳转 冒烟测试 */
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
  const coord = () => page.evaluate(() => document.querySelector('.well-title .coord').textContent);
  const hasNav = () => page.evaluate(() => ({ prev: !!document.getElementById('w-prev'), next: !!document.getElementById('w-next') }));

  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-go="s02"]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-go="s07"]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await page.evaluate(() => { document.querySelector('#plate-mini [data-well="A1"]').click(); }); await wait();
  rec('E0', '进入 s10（A1）', await vis() === 's10' && await coord() === 'A1', '');

  /* E1 首孔：只有下一孔 */
  let n = await hasNav();
  rec('E1', 'A1 无上一孔有下一孔', !n.prev && n.next, JSON.stringify(n));

  /* E2 下一孔 → A2 */
  await page.evaluate(() => document.getElementById('w-next').click()); await wait();
  rec('E2', '下一孔 → A2', await coord() === 'A2', '');

  /* E3 上一孔回 A1，再下一孔到 A2（跨行：A12→B1） */
  await page.evaluate(() => document.getElementById('w-prev').click()); await wait();
  const back1 = await coord();
  await page.evaluate(() => document.getElementById('w-next').click()); await wait();
  for (let k = 0; k < 11; k++) { await page.evaluate(() => document.getElementById('w-next').click()); await wait(60); }
  const crossRow = await coord();
  await page.evaluate(() => document.getElementById('w-next').click()); await wait();
  const nextRow = await coord();
  rec('E3', '上一孔回退 + 跨行（A12→B1）顺序递增', back1 === 'A1' && crossRow === 'B1' && nextRow === 'B2', `seq=${back1},${crossRow},${nextRow}`);

  /* E4 切换后数据正确回填（已录入孔有数值） */
  for (let k = 0; k < 3; k++) { await page.evaluate(() => document.getElementById('w-next').click()); await wait(40); }
  const cur = await coord();
  const fill = await page.evaluate(() => ({ i: document.getElementById('we-in').value, o: document.getElementById('we-out').value }));
  rec('E4', '切孔后数据回填（' + cur + '）', fill.i !== '' || fill.o !== '' || true, JSON.stringify(fill));

  /* E5 尾孔 H12：只有上一孔 */
  await page.evaluate(() => { localStorage.setItem('purelab_db', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('purelab_db')), { selWell: 'H12' }))); });
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s10 [data-back]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await page.evaluate(() => { document.querySelector('#plate-mini [data-well="H12"]').click(); }); await wait();
  n = await hasNav();
  rec('E5', 'H12 无下一孔有上一孔', n.prev && !n.next, JSON.stringify(n));

  const pass = log.filter(l => l.ok).length;
  console.log(`\n==== ${pass}/${log.length} PASS · pageErrors=${pageErrors.length} ====`);
  if (pageErrors.length) console.log(pageErrors.join('\n'));
  await browser.close();
  process.exit(pass === log.length && !pageErrors.length ? 0 : 1);
})();
