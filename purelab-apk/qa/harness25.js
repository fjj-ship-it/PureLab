/* RUN-25 —— s03 预计占用孔数量实时联动 + 向导全程无报错 */
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
  const wait = (ms = 300) => page.waitForTimeout(ms);
  const go = async a => page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (el) { el.click(); return true; } return false; }, a);
  const type = async (sel, val) => page.evaluate(s => { const el = document.querySelector(s); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, s.endsWith('mass') ? undefined : undefined); }, sel) /* placeholder */;
  const setVal = async (id, val) => page.evaluate(([i, v]) => { const el = document.getElementById(i); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, val]);
  const occ = () => page.evaluate(() => document.getElementById('f-occ').textContent);

  await go('s02'); await wait(400); await go('s03'); await wait(300);

  /* O1 默认 9600/100 = 96 */
  rec('O1', '默认 9600/100 → 96 / 96 · 约 8 行', (await occ()) === '96 / 96 · 约 8 行', await occ());

  /* O2 改总质量 4800 → 48（不重进页面即时变化） */
  await setVal('f-mass', '4800'); await wait(150);
  rec('O2', '改总质量 4800 → 48 / 96 · 约 4 行', (await occ()) === '48 / 96 · 约 4 行', await occ());

  /* O3 再改投入量 50 → 96 */
  await setVal('f-dose', '50'); await wait(150);
  rec('O3', '改投入量 50 → 96 / 96 · 约 8 行', (await occ()) === '96 / 96 · 约 8 行', await occ());

  /* O4 超容量：20000/50 = 400 → 超出提示 */
  await setVal('f-mass', '20000'); await wait(150);
  const o4 = await occ();
  rec('O4', '超出 96 孔容量给出警示', /超出容量/.test(o4) && /400/.test(o4), o4);

  /* O5 清空输入 → 提示补全 */
  await setVal('f-mass', ''); await setVal('f-dose', ''); await wait(150);
  rec('O5', '清空输入给出补全提示', /请输入/.test(await occ()), await occ());

  /* O6 恢复合法值走完整向导，s06 确认页数据正确且全程无报错 */
  await setVal('f-name', '联动测试'); await setVal('f-mass', '4800'); await setVal('f-dose', '100');
  await go('s04'); await wait(300);
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-cid="B"]'), e => true).click(); });
  await wait(150);
  await page.evaluate(() => document.getElementById('combo-next').click()); await wait();
  await page.evaluate(() => document.getElementById('assign-step').click()); await wait();
  const d6 = await page.evaluate(() => ({
    screen: [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none')[0].id,
    mass: [].find.call(document.querySelectorAll('#confirm-card .kv'), () => true) ? document.getElementById('confirm-card').textContent : ''
  }));
  const confTxt = await page.evaluate(() => document.getElementById('confirm-card').textContent);
  rec('O6', '向导到 s06：质量 4800、占用 12 孔', d6.screen === 's06' && /4800/.test(confTxt) && /12 \/ 96 孔/.test(confTxt), confTxt.slice(0, 150));

  /* 汇总 */
  const pass = log.filter(l => l.ok).length;
  console.log(`\n==== ${pass}/${log.length} PASS · pageErrors=${pageErrors.length} ====`);
  if (pageErrors.length) console.log(pageErrors.join('\n'));
  await browser.close();
  process.exit(pass === log.length && !pageErrors.length ? 0 : 1);
})();
