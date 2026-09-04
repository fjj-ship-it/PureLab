/* PureLab V1 黑盒测试 RUN-B —— 完整测试战役
 * B1 新建实验真相 | B2 创建全流程 | B3 孔板录入 | B4 数据一致性(步骤6)
 * B5 批量专项(步骤5) | B6 异常输入(步骤7) | B7 交互审计(步骤9) | B8 试剂库/我的
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
  log.push({ id, area, result, detail: String(detail).slice(0, 500) });
  console.log(`[${result}] ${id} ${area} :: ${String(detail).slice(0, 220)}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('dialog', d => d.dismiss().catch(() => {}));

  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  /* ---------- 助手：全文档可见性（getClientRects 判定真实渲染） ---------- */
  const visScreen = () => page.evaluate(() => {
    const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return v.length ? v[0].id : 'NONE';
  });
  const visText = () => page.evaluate(() => {
    const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return v.length ? v[0].textContent.replace(/\s+/g, ' ').trim() : '(NO VISIBLE SCREEN)';
  });
  const observe = () => page.evaluate(() => {
    const vis = e => e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const scr = [].find.call(document.querySelectorAll('.screen'), s => vis(s));
    const sheets = [].filter.call(document.querySelectorAll('[class*=sheet],[class*=modal],[class*=overlay],[class*=popup],[class*=drawer]'), vis)
      .map(e => e.className + '::' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 80));
    const inputs = [].filter.call(document.querySelectorAll('input,textarea'), i => vis(i) && !(scr && scr.contains(i) === false && !vis(i)))
      .filter(i => vis(i)).map(i => ({ ph: i.placeholder || i.type, val: i.value }));
    const toast = [].filter.call(document.querySelectorAll('[class*=toast],[class*=snack]'), vis).map(e => e.textContent.trim().slice(0, 60));
    return { screen: scr ? scr.id : 'NONE', sheets, inputs, toast };
  });
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
  const goBack = async () => {
    for (const t of ['‹', '←', '返回', '取消', '关闭']) {
      const r = await clickText(t, 'exact');
      if (r) { await page.waitForTimeout(350); return r; }
    }
    return null;
  };
  const fillInputByPh = async (phSub, value) => page.evaluate(({ phSub, value }) => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const els = [].filter.call(document.querySelectorAll('input,textarea'), i => vis(i) && (i.placeholder || '').includes(phSub));
    if (!els.length) return null;
    const el = els[0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ph: el.placeholder, value: el.value };
  }, { phSub, value });
  const clickWell = async (label) => page.evaluate(l => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const el = [].find.call(document.querySelectorAll('.well,[data-well]'), e => vis(e) && (e.dataset.well === l || e.textContent.trim() === l));
    if (!el) return null;
    el.click();
    return el.className;
  }, label);
  const wait = (ms = 400) => page.waitForTimeout(ms);

  /* ============ B1: 新建实验真相调查 ============ */
  const c0 = await clickText('开始使用'); await wait();
  rec('B1-01', '进入工作台', await visScreen() === 's02' ? 'PASS' : 'FAIL', await visScreen());
  const before = await observe();
  const nb = await clickText('新建实验', 'prefix'); await wait();
  const after = await observe();
  rec('B1-02', '新建实验点击反馈', JSON.stringify({ before: before.screen, after: after.screen, sheets: after.sheets.length, inputs: after.inputs.length }),
    `点击=${nb} | after.sheets=${JSON.stringify(after.sheets).slice(0, 200)} | inputs=${JSON.stringify(after.inputs)}`);
  await shot('B1_new_exp_state');

  /* ============ B2: 完整创建流程（黑盒用户路径） ============ */
  // 若新建流程在 sheet/页面上有输入框，依次填写
  let cur = await observe();
  const hasForm = cur.inputs.length > 0 || cur.screen === 's03';
  rec('B2-01', '新建流程可达性', hasForm ? 'INFO' : 'FAIL',
    hasForm ? '发现表单入口' : '点击新建实验后既无屏幕切换也无表单出现 → 疑似死按钮');

  if (hasForm) {
    const allInputs = () => page.evaluate(() => {
      const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
      return [].filter.call(document.querySelectorAll('input,textarea'), vis).map(i => ({ ph: i.placeholder || i.type, val: i.value }));
    });
    rec('B2-02', '表单盘点', 'INFO', JSON.stringify(await allInputs()));
    await shot('B2_form');
    // 依次填入前两个非空输入框
    const fill1 = await fillInputByPh('药', '对乙酰氨基酚粗品') || await fillInputByPh('名', '对乙酰氨基酚粗品') || await fillInputByPh('', '对乙酰氨基酚粗品');
    rec('B2-03', '填药品名', fill1 ? `ph="${fill1.ph}" val="${fill1.value}"` : '未找到可填输入框', '');
    const infos = await allInputs();
    // 找投入量输入框
    const amt = await fillInputByPh('投入', '100') || await fillInputByPh('量', '100');
    rec('B2-04', '填投入量', amt ? `ph="${amt.ph}" val="${amt.value}"` : '未找到投入量输入框', '');
    await wait(200);
    // 下一步/继续
    let nx = await clickText('下一步', 'prefix') || await clickText('继续', 'prefix');
    await wait();
    rec('B2-05', '下一步', nx ? `点击=${nx} → 屏=${await visScreen()}` : '未找到下一步', '');
    await shot('B2_step2');

    /* ============ 条件设置页 ============ */
    cur = await observe();
    rec('B2-06', '条件设置页', 'INFO', `屏=${cur.screen} 文本=${(await visText()).slice(0, 250)}`);
    // 选择组合
    const combos = [];
    for (const t of ['组合 A', '组合 B', '组合 C', '组合 D', '组合 E']) {
      const r = await clickText(t, 'prefix');
      if (r) combos.push(t);
    }
    rec('B2-07', '选择组合', 'INFO', `可选组合: ${combos.join(', ') || '无(FAIL)'}`);
    await shot('B2_combos');
    // 批量设置入口
    const batchEntry = await clickText('批量', 'loose');
    await wait();
    rec('B2-08', '批量设置入口', batchEntry ? `点击=${batchEntry} 屏=${await visScreen()}` : '未找到"批量"入口', '');
    await shot('B2_batch');
    // 关闭可能的 sheet
    let cl = await clickText('关闭', 'exact') || await clickText('取消', 'exact') || await clickText('完成', 'exact');
    await wait(200);

    // 进入分配
    const toAssign = await clickText('下一步', 'prefix') || await clickText('分配', 'prefix');
    await wait();
    rec('B2-09', '进入分配页', toAssign ? `点击=${toAssign} → ${await visScreen()}` : '未找到入口', '');
    rec('B2-10', '分配页内容', 'INFO', (await visText()).slice(0, 280));
    await shot('B2_assign');
  }

  fs.writeFileSync(path.join(OUT, 'qa_runB.json'), JSON.stringify({ log, pageErrors }, null, 2), 'utf8');
  console.log('--- RUN-B1/B2 DONE. errors=' + pageErrors.length);
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
