/* RUN-22 —— 拖拽排序 + 竖排模板 + 结果芯片 冒烟测试 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html';
const log = [];
function rec(id, name, ok, detail) { log.push({ id, ok }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name} :: ${String(detail).slice(0, 200)}`); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
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
  const badges = () => page.evaluate(() => [].map.call(document.querySelectorAll('.combo-badge'), b => b.textContent));
  const order = () => page.evaluate(() => ((JSON.parse(localStorage.getItem('purelab_db')) || {}).comboOrder) || []);

  await go('s02'); await wait(); await go('s03'); await wait(); await go('s04'); await wait();

  /* H1 初始编号 A–E 按位置 */
  rec('H1', '初始编号 A–E', JSON.stringify(await badges()) === '["A","B","C","D","E"]', JSON.stringify(await badges()));

  /* H2 结果芯片存在且可跳 */
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s04 [data-back]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s03 [data-back]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-go="s07"]'), e => e.getClientRects().length > 0).click(); }); await wait();
  const chip = await page.evaluate(() => { const c = document.querySelector('.nav-chip'); return c ? { vis: c.getClientRects().length > 0, txt: c.textContent } : null; });
  await page.evaluate(() => document.querySelector('.nav-chip').click()); await wait();
  const s11 = await page.evaluate(() => { const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v[0].id; });
  rec('H2', '结果芯片跳转 s11', chip && chip.vis && /结果/.test(chip.txt) && s11 === 's11', JSON.stringify(chip) + ' -> ' + s11);

  /* H3 拖拽：从 s11 返回工作台再进向导 */
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s11 [data-back]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s07 [data-back]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await page.evaluate(() => { [].find.call(document.querySelectorAll('[data-go="s03"]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await go('s04'); await wait();
  const handle = await page.evaluate(() => { const h = [].map.call(document.querySelectorAll('.combo-card'), c => c.querySelector('.combo-drag'))[1]; const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y + 10, { steps: 4 });
  await page.mouse.move(handle.x, handle.y + 130, { steps: 10 });
  await page.mouse.up();
  await wait();
  const b3 = await badges();
  const o3 = await order();
  const names3 = await page.evaluate(() => [].map.call(document.querySelectorAll('.combo-card .combo-name'), n => n.textContent));
  const perm = o3.length === 5 && new Set(o3).size === 5 && o3.join() !== 'A,B,C,D,E';
  rec('H3', '拖拽后顺序持久化（新排列）', perm, `order=${JSON.stringify(o3)} names=${JSON.stringify(names3)}`);

  /* H4 编号按位置继承：徽标恒为 A–E，名字排列 = 新顺序 */
  rec('H4', '徽标恒 A–E，排列随拖拽', b3.join() === 'A,B,C,D,E', `badges=${JSON.stringify(b3)} names=${JSON.stringify(names3)}`);

  /* H5 默认自动分配按新顺序落行，切手动后可继续追加 */
  await page.evaluate(() => { document.querySelectorAll('.combo-card').forEach(c => { if (!c.classList.contains('sel')) c.click(); }); }); await wait(200);
  await page.evaluate(() => document.getElementById('combo-next').click()); await wait();
  const h5a = await page.evaluate(() => document.getElementById('assign-cur').textContent);
  const h5fill = await page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')).wizard.assign);
  await page.evaluate(() => document.getElementById('am-manual').click()); await wait(150);
  const h5b = await page.evaluate(() => document.getElementById('assign-cur').textContent);
  await page.evaluate(() => document.querySelector('#plate-config [data-well="A1"]').click()); await wait(120);
  const h5off = await page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')).wizard.assign);
  await page.evaluate(() => document.querySelector('#plate-config [data-well="A1"]').click()); await wait(120);
  const h5 = await page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')).wizard.assign);
  rec('H5', '自动按新顺序铺满（A 行=o3[0]、B 行=o3[1]）；手动下 A1 可取消再恢复',
    new RegExp('自动分配').test(h5a) && h5fill && h5fill.A1 === o3[0] && h5fill.B1 === o3[1] &&
    new RegExp('正在分配 · 组合' + o3[0]).test(h5b) && !h5off.A1 && h5.A1 === o3[0],
    `head1="${h5a.slice(0, 24)}" head2="${h5b.slice(0, 30)}" A1off=${h5off.A1} A1=${h5.A1}`);

  /* H6 竖排模板：先从 s05 返回 s04，再开新建组合 */
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s05 [data-back]'), e => e.getClientRects().length > 0).click(); }); await wait();
  await page.evaluate(() => document.getElementById('combo-add').click()); await wait(350);
  const h6 = await page.evaluate(() => ({
    rows: document.querySelectorAll('.tpl-row').length,
    leads: [].map.call(document.querySelectorAll('.tpl-lead'), l => l.textContent).join(''),
    pv: document.getElementById('cg-preview').textContent
  }));
  rec('H6', '竖排模板：2 行 + 行间冒号 + 占位预览', h6.rows === 2 && h6.leads === ':=' && /自动生成/.test(h6.pv), JSON.stringify(h6));

  /* H7 模板填 2 组分保存 */
  await type('.tpl-row:nth-child(1) .tpl-name', '乙醇');
  await type('.tpl-row:nth-child(1) .tpl-ratio', '3');
  await type('.tpl-row:nth-child(2) .tpl-name', '水');
  await type('.tpl-row:nth-child(2) .tpl-ratio', '1');
  await wait(100);
  const pv7 = await page.evaluate(() => document.getElementById('cg-preview').textContent);
  await page.evaluate(() => document.getElementById('cg-save').click()); await wait();
  const d7 = await db7(page);
  rec('H7', '模板保存：乙醇 : 水 = 3 : 1', /乙醇 : 水 = 3 : 1/.test(pv7) && d7.customCombos.some(c => c.recipe === '乙醇 : 水 = 3 : 1'), pv7);

  function db7(p) { return p.evaluate(() => JSON.parse(localStorage.getItem('purelab_db'))); }

  const pass = log.filter(l => l.ok).length;
  console.log(`\n==== ${pass}/${log.length} PASS · pageErrors=${pageErrors.length} ====`);
  if (pageErrors.length) console.log(pageErrors.join('\n'));
  await browser.close();
  process.exit(pass === log.length && !pageErrors.length ? 0 : 1);
})();
