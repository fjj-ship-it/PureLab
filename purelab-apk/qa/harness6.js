/* RUN-F —— s09 批量录入 E2E + 结果/试剂库/我的盘点 + 异常输入(步骤7) */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa';
const SHOTS = path.join(OUT, 'shots');
const log = [];
function rec(id, a, r, d) { log.push({ id, area: a, result: r, detail: String(d).slice(0, 700) }); console.log(`[${r}] ${id} ${a} :: ${String(d).slice(0, 260)}`); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 150)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const visScreen = () => page.evaluate(() => {
    const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return v.length ? v[0].id : 'NONE';
  });
  const scrText = (id) => page.evaluate(sid => {
    const el = sid ? document.getElementById(sid) : [].find.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }, id);
  const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  const shot = async n => { const f = path.join(SHOTS, n + '.png'); await page.screenshot({ path: f }); return f; };
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
  const getToast = async () => page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const t = [].filter.call(document.querySelectorAll('[class*=toast],[class*=snack]'), vis);
    return t.length ? t[0].textContent.trim().slice(0, 80) : null;
  });
  const visInputs = () => page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    return [].filter.call(document.querySelectorAll('input,textarea'), vis).map(i => ({ ph: i.placeholder || i.type, val: i.value }));
  });
  const setVisInput = async (idx, value) => page.evaluate(({ idx, value }) => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const els = [].filter.call(document.querySelectorAll('input,textarea'), vis);
    const el = els[idx];
    if (!el) return null;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  }, { idx, value });
  const wait = (ms = 450) => page.waitForTimeout(ms);
  const gotoS08 = async () => {
    await clickText('开始使用'); await wait();
    await clickText('继续实验', 'prefix'); await wait();
    await clickText('进入孔板记录', 'prefix'); await wait();
    return await visScreen();
  };
  const plateStat = () => page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const scr = [].find.call(document.querySelectorAll('.screen'), vis);
    if (!scr) return null;
    const wells = [].filter.call(scr.querySelectorAll('.well,[data-well]'), vis);
    const byCls = {};
    wells.forEach(w => { const k = w.className.replace(/well\s*/g, '').trim() || 'plain'; byCls[k] = (byCls[k] || 0) + 1; });
    return { total: wells.length, byCls };
  });

  /* ---------- F1: s09 批量录入 E2E（任务5: 一次录入 12 孔产出量） ---------- */
  rec('F-00', '路径', await gotoS08(), '');
  const before = await plateStat();
  rec('F-01', '录入前孔板统计', 'INFO', JSON.stringify(before));
  const bl = await clickText('批量录入', 'prefix'); await wait();
  rec('F-02', '进入s09', await visScreen() === 's09' ? 'PASS' : 'FAIL', `屏=${await visScreen()}`);
  // 选择 A 行
  const rowA = await clickText('A', 'exact'); await wait();
  rec('F-03', '选择A行', rowA || '未找到A按钮', '');
  await shot('F03_rowA');
  // 填产出量
  const inputs = await visInputs();
  rec('F-04', '输入框盘点', 'INFO', JSON.stringify(inputs));
  const outIdx = inputs.findIndex(i => (i.ph || '').includes('产出'));
  await setVisInput(outIdx, '85.0');
  // 应用
  const app = await clickText('应用到所选孔位', 'prefix'); await wait();
  rec('F-05', '应用到所选孔位', app ? `点击=${app.slice(0, 40)} toast="${await getToast()}"` : '未找到应用按钮', '');
  await shot('F05_applied');
  // 返回 s08 验证
  await clickText('‹', 'exact'); await wait();
  rec('F-06', '回s08', `屏=${await visScreen()}`, '');
  const after = await plateStat();
  rec('F-07', '录入后孔板统计', JSON.stringify(before) === JSON.stringify(after) ? 'FAIL(无变化)' : 'INFO', `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  const s8t = await scrText();
  const m = s8t.match(/(\d+)\/96 孔已录入/) || (await scrText()).match(/(\d+)\/96/);
  rec('F-08', '进度数字', 'INFO', `s08文本截取: ${(await scrText()).slice(0, 120)}`);
  await shot('F08_plate_after');

  /* ---------- F2: s09 异常输入（步骤7） ---------- */
  await clickText('批量录入', 'prefix'); await wait();
  rec('F2-00', '重进s09', await visScreen(), '');
  const cases = [
    ['0', '零值'], ['-5', '负数'], ['999999', '超大数'], ['abc', '文字'], ['5kg', '异常单位'], ['88.55', '小数']
  ];
  for (const [val, name] of cases) {
    const ins = await visInputs();
    const oi = ins.findIndex(i => (i.ph || '').includes('产出'));
    await setVisInput(oi, val);
    // 选 B 行避免覆盖 A 行数据
    await clickText('B', 'exact'); await wait(150);
    const ap = await clickText('应用到所选孔位', 'prefix'); await wait();
    const toast = await getToast();
    rec('F2-' + name, `产出量="${val}"`, 'INFO', `应用按钮=${ap ? '有' : '无'} toast="${toast}"`);
    await shot('F2_' + name);
  }
  // 投入量异常
  const ins2 = await visInputs();
  const ii = ins2.findIndex(i => (i.ph || '').includes('投入') || i.ph === '');
  if (ii >= 0) {
    for (const [val, name] of [['', '投入留空'], ['-1', '投入负数'], ['1e9', '投入超大']]) {
      await setVisInput(ii, val);
      await clickText('C', 'exact'); await wait(150);
      const ap = await clickText('应用到所选孔位', 'prefix'); await wait();
      rec('F2-投' + name, `投入量="${val}"`, 'INFO', `toast="${await getToast()}"`);
    }
  }

  /* ---------- F3: 其余屏幕盘点（步骤1 七/试剂库/我的） ---------- */
  // s11/s12/s13 通过 s07 入口
  await clickText('‹', 'exact'); await wait(); // s09→s08
  await clickText('‹', 'exact'); await wait(); // s08→s07
  rec('F3-00', '回s07', await visScreen(), '');
  const s7t = await scrText();
  rec('F3-01', 's07重测[分析孔板最佳条件]', s7t.includes('分析孔板最佳条件') ? '入口存在' : '入口不存在', '');
  const r5 = await clickText('分析孔板最佳条件', 'prefix'); await wait();
  rec('F3-02', '点击分析孔板最佳条件', r5 ? `屏=${await visScreen()} 文本=${(await scrText()).slice(0, 200)}` : '无反应', '');
  await shot('F3_best');
  await clickText('‹', 'exact'); await wait(300);
  // s11/s12/s13 尝试经底部导航文字（s07 有 RUN/结果 tabs；结果总览入口在哪?）
  for (const t of ['结果总览', '排名', '结果']) {
    const r = await clickText(t, 'exact');
    if (r) { await wait(300); rec('F3-03', `入口[${t}]`, `屏=${await visScreen()} 内容=${(await scrText()).slice(0, 150)}`, ''); await clickText('‹', 'exact'); await wait(300); }
  }
  // s14 试剂库: 从 s02 找入口
  await clickText('‹', 'exact'); await wait(300); // s07→s02
  for (const t of ['试剂库', '试剂', '我的']) {
    const r = await clickText(t, 'loose');
    if (r) { await wait(350); const sid = await visScreen(); rec('F3-04', `s02入口[${t}]`, `点击 → ${sid}`, (await scrText()).slice(0, 260)); await shot('F3_' + sid); await clickText('‹', 'exact'); await wait(300); }
  }
  // s15 我的 直达探测
  const s15probe = await page.evaluate(() => {
    const el = document.getElementById('s15');
    return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) : 'NO s15';
  });
  rec('F3-05', 's15我的(内容)', 'INFO', s15probe);
  const s14probe = await page.evaluate(() => {
    const el = document.getElementById('s14');
    return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 350) : 'NO s14';
  });
  rec('F3-06', 's14试剂库(内容)', 'INFO', s14probe);

  fs.writeFileSync(path.join(OUT, 'qa_runF.json'), JSON.stringify({ log, pageErrors }, null, 2), 'utf8');
  console.log('--- RUN-F DONE. errors=' + pageErrors.length);
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); fs.writeFileSync(path.join(OUT, 'qa_runF.json'), JSON.stringify({ log }, null, 2), 'utf8'); process.exit(1); });
