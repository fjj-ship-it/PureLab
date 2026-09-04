/* RUN-E —— 精准探针：逐个验证"编辑/批量/录入"入口的真实行为 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa';
const SHOTS = path.join(OUT, 'shots');
const log = [];
function rec(id, a, r, d) { log.push({ id, area: a, result: r, detail: String(d).slice(0, 600) }); console.log(`[${r}] ${id} ${a} :: ${String(d).slice(0, 240)}`); }

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
  const shot = async n => { const f = path.join(SHOTS, n + '.png'); await page.screenshot({ path: f }); return f; };
  const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  const sheetState = () => page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const s = [].filter.call(document.querySelectorAll('[class*=sheet]:not([class*=mask])'), vis);
    if (!s.length) return null;
    const el = s[0];
    return { cls: el.className, title: (el.querySelector('[class*=title]') || {}).textContent || '', bodyLen: (el.querySelector('[class*=body]') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim().length, bodyText: (el.querySelector('[class*=body]') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim().slice(0, 150), inputs: [].filter.call(el.querySelectorAll('input,textarea,button,[data-go]'), vis).length };
  });
  const clickText = async (t, mode = 'exact') => page.evaluate(({ t, mode }) => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const cands = [].filter.call(document.querySelectorAll('button,a,div,span,li,td,[role=button],[data-go],[data-back],[data-act]'), e => {
      if (!vis(e)) return false;
      const s = e.textContent.trim();
      return mode === 'prefix' ? s.startsWith(t) : (mode === 'loose' ? s.includes(t) : s === t);
    });
    if (!cands.length) return null;
    let el = cands[0];
    for (const c of cands) if (c.textContent.length < el.textContent.length) el = c;
    el.click();
    return el.tagName + '.' + el.className + ' "' + el.textContent.trim().slice(0, 24) + '"';
  }, { t, mode });
  const wait = (ms = 450) => page.waitForTimeout(ms);
  const closeSheet = async () => {
    const m = await page.evaluate(() => {
      const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
      const m = [].find.call(document.querySelectorAll('[class*=mask],[class*=overlay]'), vis);
      if (m) { m.click(); return 'mask'; }
      return null;
    });
    await wait(350);
    if (!m) await page.keyboard.press('Escape');
    await wait(250);
  };

  // 路径: s01→s02→s07→s08→s10(C7)
  await clickText('开始使用'); await wait();
  await clickText('继续实验', 'prefix'); await wait();
  await clickText('进入孔板记录', 'prefix'); await wait();
  rec('E-00', '路径', 'INFO', `屏=${await visScreen()}`);

  // 1) s08 "批量" 按钮
  const b1 = await clickText('批量', 'exact'); await wait();
  rec('E-01', 's08[批量]', b1 ? '弹sheet' : '无反应', b1 ? JSON.stringify(await sheetState()) : '');
  await shot('E01_batch_sheet');
  await closeSheet();
  rec('E-01b', '关闭sheet', await visScreen(), JSON.stringify(await sheetState()));

  // 2) s08 "批量录入" 按钮
  const b2 = await clickText('批量录入', 'prefix'); await wait();
  rec('E-02', 's08[批量录入]', b2 ? '点击' : '无反应', b2 ? `屏=${await visScreen()} sheet=${JSON.stringify(await sheetState())}` : '');
  await shot('E02_batch_entry');
  if (await sheetState()) { await closeSheet(); await wait(200); }
  // 若进了 s09 就盘点
  if (await visScreen() === 's09') {
    rec('E-02b', 's09盘点', 'INFO', await page.evaluate(() => { const v = [].find.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v.textContent.replace(/\s+/g, ' ').trim().slice(0, 320); }));
    rec('E-02c', 's09输入框', 'INFO', await page.evaluate(() => {
      const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
      return JSON.stringify([].filter.call(document.querySelectorAll('input,textarea'), vis).map(i => ({ ph: i.placeholder, val: i.value })));
    }));
    await shot('E02_s09');
  }

  // 3) s08 "编辑数据" 按钮
  const b3 = await clickText('编辑数据', 'prefix'); await wait();
  rec('E-03', 's08[编辑数据]', b3 ? '点击' : '无反应', b3 ? `屏=${await visScreen()} sheet=${JSON.stringify(await sheetState())}` : '');
  await shot('E03_edit_data');
  if (await sheetState()) await closeSheet();

  // 4) s10 C7 [编辑]
  await page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const el = [].find.call(document.querySelectorAll('.well,[data-well]'), e => vis(e) && (e.dataset.well === 'C7' || e.textContent.trim() === 'C7'));
    if (el) el.click();
  }); await wait();
  rec('E-04', '打开C7', `屏=${await visScreen()}`, '');
  const b4 = await clickText('编辑', 'exact'); await wait();
  rec('E-04b', 's10[编辑]', b4 ? '点击' : '无反应', b4 ? `屏=${await visScreen()} sheet=${JSON.stringify(await sheetState())}` : '');
  await shot('E04_edit_sheet');
  if (await sheetState()) await closeSheet();

  // 5) s07 [分析孔板最佳条件]
  await clickText('‹', 'exact'); await wait(); // s08→s07
  const b5 = await clickText('分析孔板最佳条件', 'prefix'); await wait();
  rec('E-05', 's07[分析孔板最佳条件]', b5 ? '点击' : '无反应', b5 ? `屏=${await visScreen()} sheet=${JSON.stringify(await sheetState())}` : '');
  await shot('E05_best');
  if (await sheetState()) await closeSheet();

  // 6) s02 [新建实验] 的 sheet 再确认（含空 sheet 证据）
  await clickText('‹', 'exact'); await wait(); // s07→s02
  const b6 = await clickText('新建实验', 'prefix'); await wait();
  rec('E-06', 's02[新建实验]', b6 ? '点击' : '无反应', b6 ? `屏=${await visScreen()} sheet=${JSON.stringify(await sheetState())}` : '');
  await shot('E06_new_exp_sheet');

  fs.writeFileSync(path.join(OUT, 'qa_runE.json'), JSON.stringify({ log }, null, 2), 'utf8');
  console.log('--- RUN-E DONE');
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
