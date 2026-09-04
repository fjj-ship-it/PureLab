/* RUN-21 —— 新建组合配比模板 冒烟测试 */
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
  const type = (sel, v) => page.evaluate(({ sel, v }) => { const el = document.querySelector(sel); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, { sel, v });
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')));

  await go('s02'); await wait(); await go('s03'); await wait(); await go('s04'); await wait();
  await page.evaluate(() => document.getElementById('combo-add').click()); await wait(350);

  /* G1 默认模板模式：2 组分 + 预览提示 */
  const g1 = await page.evaluate(() => ({
    names: document.querySelectorAll('.tpl-name').length,
    ratios: document.querySelectorAll('.tpl-ratio').length,
    pv: document.getElementById('cg-preview').textContent
  }));
  rec('G1', '默认模板：2 组分 + 占位预览', g1.names === 2 && g1.ratios === 2 && /自动生成/.test(g1.pv), JSON.stringify(g1));

  /* G2 填模板 → 预览实时生成 */
  await type('.tpl-name[data-i="0"]', '乙酸乙酯');
  await type('.tpl-ratio[data-i="0"]', '1');
  await type('.tpl-name[data-i="1"]', '水');
  await type('.tpl-ratio[data-i="1"]', '2');
  await wait(100);
  const g2 = await page.evaluate(() => document.getElementById('cg-preview').textContent);
  rec('G2', '预览 = 乙酸乙酯 : 水 = 1 : 2', /乙酸乙酯 : 水 = 1 : 2/.test(g2), g2);

  /* G3 加一种试剂 → 3 组分 */
  await page.evaluate(() => document.getElementById('cg-addpart').click()); await wait(150);
  const g3 = await page.evaluate(() => document.querySelectorAll('.tpl-name').length);
  rec('G3', '加组分 → 3 组分', g3 === 3, `names=${g3}`);

  /* G4 不完整保存被拦截 */
  await page.evaluate(() => document.getElementById('cg-save').click()); await wait();
  const g4 = await page.evaluate(() => document.getElementById('toast').textContent);
  rec('G4', '模板不完整拦截', /完整填写模板/.test(g4), `toast="${g4}"`);

  /* G4b 补全第 3 组分后保存 → 列表出现组合F，配方正确 */
  await type('.tpl-name[data-i="2"]', '乙醇');
  await type('.tpl-ratio[data-i="2"]', '1');
  await page.evaluate(() => document.getElementById('cg-save').click()); await wait();
  let d = await db();
  const g4b = await page.evaluate(() => { const card = document.querySelector('[data-cid="F"]'); return card ? card.textContent : ''; });
  rec('G4b', '保存 F：乙酸乙酯 : 水 : 乙醇 = 1 : 2 : 1', d.customCombos.length === 1 && d.customCombos[0].recipe === '乙酸乙酯 : 水 : 乙醇 = 1 : 2 : 1' && /乙酸乙酯/.test(g4b),
    d.customCombos[0] ? d.customCombos[0].recipe : 'none');

  /* G5 自由输入模式：切换带预填，可改 */
  await page.evaluate(() => document.getElementById('combo-add').click()); await wait(350);
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#cg-seg [data-m="free"]'), e => true).click(); }); await wait(150);
  const g5 = await page.evaluate(() => document.getElementById('cg-recipe') ? 'has-input' : 'NO');
  rec('G5', '自由输入模式可用', g5 === 'has-input', `value="${g5}"`);
  await type('#cg-recipe', '甲醇 : 水 = 2 : 1');
  await page.evaluate(() => document.getElementById('cg-save').click()); await wait();
  d = await db();
  rec('G5b', '自由输入保存 G', d.customCombos.length === 2 && d.customCombos[1].recipe === '甲醇 : 水 = 2 : 1', d.customCombos[1] ? d.customCombos[1].recipe : 'none');

  const pass = log.filter(l => l.ok).length;
  console.log(`\n==== ${pass}/${log.length} PASS · pageErrors=${pageErrors.length} ====`);
  if (pageErrors.length) console.log(pageErrors.join('\n'));
  await browser.close();
  process.exit(pass === log.length && !pageErrors.length ? 0 : 1);
})();
