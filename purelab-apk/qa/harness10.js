/* RUN-J —— 定点复核 s10编辑 / s12→s13 / s07→s11（严格栈控制） */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa';
const SHOTS = path.join(OUT, 'shots');
const log = [];
function rec(id, a, r, d) { log.push({ id, area: a, result: r, detail: String(d).slice(0, 700) }); console.log(`[${r}] ${id} ${a} :: ${String(d).slice(0, 250)}`); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const visScreen = () => page.evaluate(() => {
    const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return v.length ? v[0].id : 'NONE';
  });
  const scrText = () => page.evaluate(() => {
    const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return v.length ? v[0].textContent.replace(/\s+/g, ' ').trim() : '';
  });
  const shot = async n => { const f = path.join(SHOTS, n + '.png'); await page.screenshot({ path: f }); return f; };
  // 通用点击：自身是 button/带 data-go/data-back/id → 得 0 分，否则 1000；再按文本长度升序
  const clickBtn = async (t, mode = 'exact') => page.evaluate(({ t, mode }) => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const cands = [].filter.call(document.querySelectorAll('button,a,div,span,label,[data-go],[data-back]'), e => {
      if (!vis(e)) return false;
      const s = e.textContent.trim();
      return mode === 'prefix' ? s.startsWith(t) : (mode === 'loose' ? s.includes(t) : s === t);
    });
    if (!cands.length) return null;
    const score = e => ((e.tagName === 'BUTTON' || e.tagName === 'A' || e.getAttribute('data-go') || e.getAttribute('data-back') || e.id) ? 0 : 1000) + e.textContent.length;
    cands.sort((a, b) => score(a) - score(b));
    const el = cands[0];
    el.click();
    return el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className).slice(0, 24) + ' "' + el.textContent.trim().slice(0, 20) + '"';
  }, { t, mode });
  const well = async (coord) => page.evaluate(c => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const el = [].find.call(document.querySelectorAll('.well,[data-well]'), e => vis(e) && e.getAttribute('data-well') === c);
    if (!el) return null;
    el.click(); return true;
  }, coord);
  const wait = (ms = 500) => page.waitForTimeout(ms);

  /* J1: s07 → s11（结果按钮） */
  await clickBtn('开始使用'); await wait();
  await clickBtn('继续实验', 'prefix'); await wait();
  rec('J-00', '到s07', await visScreen(), '');
  const r1 = await clickBtn('结果', 'exact'); await wait();
  rec('J-01', '[复核]s07[结果]→s11', `点击=${r1} → 屏=${await visScreen()}`, '');
  rec('J-02', 's11 内容', (await scrText()).slice(0, 220), '');
  await shot('J02_s11');

  /* J2: s11 → s13（s11 底部有"结果排名"按钮） */
  const r2 = await clickBtn('结果排名', 'prefix'); await wait();
  rec('J-03', 's11→s13', `点击=${r2} → 屏=${await visScreen()}`, '');
  rec('J-04', 's13 排名内容', (await scrText()).slice(0, 240), '');
  await shot('J04_s13');
  const r3 = await clickBtn('‹', 'exact'); await wait();
  rec('J-05', 's13→back', `→ ${await visScreen()}`, '');
  const r4 = await clickBtn('‹', 'exact'); await wait();
  rec('J-06', 'back', `→ ${await visScreen()}`, '');

  /* J3: s12 → s13 */
  await clickBtn('分析孔板最佳条件', 'prefix'); await wait();
  rec('J-07', '到s12', await visScreen(), '');
  const r5 = await clickBtn('查看完整排名', 'prefix'); await wait();
  rec('J-08', '[复核]s12[查看完整排名]→s13', `点击=${r5} → 屏=${await visScreen()}`, '');
  await clickBtn('‹', 'exact'); await wait();
  await clickBtn('‹', 'exact'); await wait();
  rec('J-09', '回到', await visScreen(), '');

  /* J4: s10 编辑单孔（走 s08 正确路径） */
  await clickBtn('进入孔板记录', 'prefix'); await wait();
  rec('J-10', '到s08', await visScreen(), '');
  await well('C1'); await wait();
  rec('J-11', '点C1→s10', `屏=${await visScreen()}`, '');
  const r6 = await clickBtn('编辑', 'exact'); await wait(300);
  const hasInput = await page.evaluate(() => !!document.getElementById('we-out'));
  rec('J-12', '[复核]s10[编辑]', `点击=${r6} 编辑框=${hasInput}`, '');
  await shot('J12_edit');
  if (hasInput) {
    await page.evaluate(() => {
      const el = document.getElementById('we-out');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(el, '92.5'); el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const r7 = await clickBtn('保存', 'exact'); await wait(600);
    const st = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('purelab_db'));
      const w = db.wells.C1;
      return { out: w.output, pur: w.purity, done: w.done };
    });
    rec('J-13', '[复核]s10保存', `点击=${r7 ? r7.slice(0, 26) : 'null'} C1: output=${st.out} purity=${st.pur}%`, '');
    const toastTxt = await page.evaluate(() => { const t = document.getElementById('toast'); return t.classList.contains('show') ? t.textContent : '(消失)'; });
    rec('J-14', '保存反馈', `toast="${toastTxt}"`, '');
    await shot('J14_saved');
  }

  fs.writeFileSync(path.join(OUT, 'qa_runJ.json'), JSON.stringify({ log }, null, 2), 'utf8');
  console.log('--- RUN-J DONE');
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
