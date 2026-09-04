/* PureLab V1 黑盒测试 RUN-C —— 基于 EXP-03 的深度测试
 * B3 孔板与录入 | B4 数据一致性(步骤6) | B5 批量专项(步骤5)
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa';
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const log = [];
function rec(id, area, result, detail) {
  log.push({ id, area, result, detail: String(detail).slice(0, 600) });
  console.log(`[${result}] ${id} ${area} :: ${String(detail).slice(0, 220)}`);
}
function flush() { fs.writeFileSync(path.join(OUT, 'qa_runC.json'), JSON.stringify({ log }, null, 2), 'utf8'); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('dialog', d => d.dismiss().catch(() => {}));

  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const visScreen = () => page.evaluate(() => {
    const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return v.length ? v[0].id : 'NONE';
  });
  const visText = () => page.evaluate(() => {
    const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return v.length ? v[0].textContent.replace(/\s+/g, ' ').trim() : '(NO VISIBLE SCREEN)';
  });
  const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  const shot = async n => { const f = path.join(SHOTS, n + '.png'); await page.screenshot({ path: f }); return f; };
  const clickText = async (t, mode = 'exact') => page.evaluate(({ t, mode }) => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const cands = [].filter.call(document.querySelectorAll('button,a,div,span,li,td,[role=button],[data-go],[data-back]'), e => {
      if (!vis(e)) return false;
      const s = e.textContent.trim();
      return mode === 'prefix' ? s.startsWith(t) : (mode === 'loose' ? s.includes(t) : s === t);
    });
    if (!cands.length) return null;
    let el = cands[0];
    for (const c of cands) if (c.textContent.length < el.textContent.length) el = c;
    el.click();
    return el.tagName + '.' + el.className + ' "' + el.textContent.trim().slice(0, 30) + '"';
  }, { t, mode });
  const getToast = () => page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const t = [].filter.call(document.querySelectorAll('[class*=toast],[class*=snack]'), vis);
    return t.length ? t[0].textContent.trim().slice(0, 80) : null;
  });
  const goBack = async () => {
    for (const t of ['‹', '←', '完成', '关闭', '取消', '返回']) {
      const r = await clickText(t, 'exact');
      if (r) { await page.waitForTimeout(350); return r; }
    }
    return null;
  };
  const docInputs = () => page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    return [].filter.call(document.querySelectorAll('input,textarea'), vis).map(i => ({ ph: i.placeholder || i.type, val: i.value }));
  });
  const setVal = async (idx, value) => page.evaluate(({ idx, value }) => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const els = [].filter.call(document.querySelectorAll('input,textarea'), vis);
    const el = els[idx];
    if (!el) return null;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  }, { idx, value });
  const clickWell = async (label) => page.evaluate(l => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const el = [].find.call(document.querySelectorAll('.well,[data-well]'), e => vis(e) && (e.dataset.well === l || e.textContent.trim() === l));
    if (!el) return null;
    el.click();
    return el.className;
  }, label);
  const wait = (ms = 400) => page.waitForTimeout(ms);

  /* ============ B3: 进入实验 → 孔板 → 录入 ============ */
  await clickText('开始使用'); await wait();
  await clickText('继续实验', 'prefix'); await wait();
  rec('B3-01', '继续实验', await visScreen() === 's07' ? 'PASS' : 'INFO', `屏=${await visScreen()}`);
  const enterPlate = await clickText('进入孔板记录', 'prefix'); await wait();
  rec('B3-02', '进入孔板记录', enterPlate ? `点击=${enterPlate.slice(0, 40)} → 屏=${await visScreen()}` : '未找到入口', '');
  rec('B3-03', '孔板页盘点', 'INFO', (await visText()).slice(0, 320));
  await shot('B3_plate');

  // 点孔 C7
  const w = await clickWell('C7'); await wait();
  rec('B3-04', '点击孔C7', w ? `命中(${w.slice(0, 40)}) → 屏=${await visScreen()}` : '未命中 .well 元素', '');
  rec('B3-05', 'C7 页面内容', 'INFO', (await visText()).slice(0, 300));
  rec('B3-05b', 'C7 输入框', 'INFO', JSON.stringify(await docInputs()));
  await shot('B3_c7');

  fs.writeFileSync(path.join(OUT, 'qa_runC.json'), JSON.stringify({ log }, null, 2), 'utf8');
  console.log('--- RUN-C part1 DONE. errors=' + pageErrors.length);
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); flush(); process.exit(1); });
