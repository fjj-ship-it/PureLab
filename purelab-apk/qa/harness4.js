/* RUN-D —— B4 数据一致性(步骤6) + B5 批量专项(步骤5) */
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
  console.log(`[${result}] ${id} ${area} :: ${String(detail).slice(0, 240)}`);
}
function flush() { fs.writeFileSync(path.join(OUT, 'qa_runD.json'), JSON.stringify({ log }, null, 2), 'utf8'); }

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
  const getToast = async () => page.evaluate(() => {
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
  // 导航到某孔的单孔详情
  const gotoWell = async (label) => {
    if (await visScreen() === 's10') await goBack(); // 回到 s08
    const w = await clickWell(label);
    await wait();
    return { w, screen: await visScreen() };
  };
  // 进入某孔编辑态
  const editWell = async (label) => {
    const g = await gotoWell(label);
    if (g.screen !== 's10') return { err: 'cannot open ' + label + ' → ' + g.screen };
    const ed = await clickText('编辑', 'exact');
    await wait();
    return { ed, inputs: await docInputs(), screen: await visScreen() };
  };
  const saveSheet = async () => {
    const s = await clickText('保存', 'exact') || await clickText('确定', 'exact') || await clickText('完成', 'exact');
    await wait();
    return { clicked: s, toast: await getToast() };
  };

  /* ============ B4: 数据一致性（步骤6 的 10 测试） ============ */
  await clickText('开始使用'); await wait();
  await clickText('继续实验', 'prefix'); await wait();
  await clickText('进入孔板记录', 'prefix'); await wait();

  // T1/T2: C7 编辑产出 → 计算联动
  let e7 = await editWell('C7');
  rec('D-T1a', 'C7 编辑模式', e7.err || '编辑入口=' + (e7.ed || '未找到') + ' 输入框=' + JSON.stringify(e7.inputs), e7.err || '');
  if (e7.inputs && e7.inputs.length) {
    // 找产出量输入框（第2个通常，或按占位符）
    let outIdx = e7.inputs.findIndex(i => (i.ph || '').includes('产出'));
    if (outIdx < 0) outIdx = e7.inputs.length > 1 ? 1 : 0;
    await setVal(outIdx, '90.0');
    const sv = await saveSheet();
    rec('D-T1b', 'C7 产出改90.0并保存', `保存=${sv.clicked ? sv.clicked.slice(0, 30) : '未找到保存'} toast="${sv.toast}"`, '');
    await wait(300);
    const t1 = await visText();
    const ok = t1.includes('90.0') && t1.includes('90%') || (t1.includes('90.0 mg') && t1.includes('90.0%'));
    rec('D-T2', '计算联动(纯化率=产出/投入)', ok ? 'PASS' : 'INFO', `编辑后页面: ${t1.slice(0, 220)}`);
    await shot('D_c7_90');
  }
  // T3: 结果页是否同步
  await goBack(); await wait();
  const toRes = await clickText('编辑数据', 'prefix') || null;
  await wait();
  rec('D-T3a', 's08入口', toRes ? '点击编辑数据' : '无编辑数据入口', `屏=${await visScreen()}`);
  await goBack(); await wait(300); // 回 s07
  const resTab = await clickText('结果', 'exact'); await wait(300);
  rec('D-T3b', '详情结果tab', 'INFO', (await visText()).slice(0, 200));
  await shot('D_res_tab');
  await goBack(); await wait(300);

  // T4/T5: 让 D4 成为最佳 → 再改回
  let e4 = await editWell('D4');
  if (e4.inputs && e4.inputs.length) {
    let oi = e4.inputs.findIndex(i => (i.ph || '').includes('产出'));
    if (oi < 0) oi = e4.inputs.length > 1 ? 1 : 0;
    await setVal(oi, '99.0');
    const sv4 = await saveSheet();
    await wait(300);
    const t4 = await visText();
    rec('D-T4', 'D4=99.0 后最佳归属', t4.includes('当前最佳') ? `D4详情显示当前最佳? 页面=${t4.slice(0, 120)}` : 'D4页无最佳标记', '');
    await shot('D_d4_99');
    // 孔板页看 C7 是否还有 best 环
    await goBack(); await wait(300);
    const plateTxt = await visText();
    const c7still = await page.evaluate(() => {
      const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
      const el = [].find.call(document.querySelectorAll('.well,[data-well]'), e => vis(e) && (e.dataset.well === 'C7' || e.textContent.trim() === 'C7'));
      return el ? el.className : null;
    });
    rec('D-T4b', '孔板C7样式(应为普通)', `C7 class=${c7still}`, '');
    // 改回 93.1
    let e4b = await editWell('D4');
    if (e4b.inputs && e4b.inputs.length) {
      let oi2 = e4b.inputs.findIndex(i => (i.ph || '').includes('产出'));
      if (oi2 < 0) oi2 = e4b.inputs.length > 1 ? 1 : 0;
      await setVal(oi2, '93.1');
      await saveSheet(); await wait(300);
      rec('D-T5', 'D4改回93.1', `页面=${(await visText()).slice(0, 120)}`, '');
    }
    await goBack(); await wait(300);
  } else {
    rec('D-T4', 'D4 编辑', 'FAIL', JSON.stringify(e4).slice(0, 200));
  }

  // T6: 清空 A8 产出 → 待计算状态
  let e8 = await editWell('A8');
  if (e8.inputs && e8.inputs.length) {
    let oi = e8.inputs.findIndex(i => (i.ph || '').includes('产出'));
    if (oi < 0) oi = e8.inputs.length > 1 ? 1 : 0;
    await setVal(oi, '');
    const sv8 = await saveSheet();
    rec('D-T6', '清空A8产出', `toast="${sv8.toast}" 页面=${(await visText()).slice(0, 140)}`, '');
    await shot('D_a8_empty');
    // 还原 90.4
    let e8b = await editWell('A8');
    if (e8b.inputs && e8b.inputs.length) {
      let oi2 = e8b.inputs.findIndex(i => (i.ph || '').includes('产出'));
      if (oi2 < 0) oi2 = e8b.inputs.length > 1 ? 1 : 0;
      await setVal(oi2, '90.4');
      await saveSheet(); await wait(300);
    }
    await goBack(); await wait(300);
  } else {
    rec('D-T6', 'A8 编辑', 'FAIL', JSON.stringify(e8).slice(0, 200));
  }

  // T7/T8: 返回首页再进 + reload
  await goBack(); await wait(); // s08→s07
  await goBack(); await wait(); // s07→s02
  const backHome = await visScreen();
  await clickText('继续实验', 'prefix'); await wait();
  await clickText('进入孔板记录', 'prefix'); await wait();
  const re = await visText();
  rec('D-T7', '返回首页再进(数据保留)', re.includes('64/96') || re.includes('未录入') ? 'PASS' : 'INFO', `回=${backHome} 再进内容=${re.slice(0, 150)}`);
  await page.reload({ waitUntil: 'load' }); await wait(800);
  await clickText('开始使用'); await wait();
  await clickText('继续实验', 'prefix'); await wait();
  await clickText('进入孔板记录', 'prefix'); await wait();
  const re2 = await visText();
  rec('D-T8', '关闭重开APP(数据保留)', re2.includes('未录入') || re2.includes('组合') ? 'INFO' : 'FAIL', `reload后=${re2.slice(0, 150)}`);
  await shot('D_reload');

  // T9: 同孔跨页一致（C7 三处核对）
  const s08txt = await visText();
  await clickWell('C7'); await wait();
  const s10txt = await visText();
  const c7s10 = { pct: (s10txt.match(/纯化率(\d+\.?\d*)%/) || [])[1], out: (s10txt.match(/产出量(\d+\.?\d*)/) || [])[1] };
  rec('D-T9', 'C7跨页一致', 'INFO', `s10: 产出=${c7s10.out} 纯化率=${c7s10.pct}%（与s08/结果页对照见截图）`);
  await goBack(); await wait();

  flush();
  console.log('--- RUN-D B4 DONE. errors=' + pageErrors.length);

  /* ============ B5: 批量专项（步骤5 八任务） ============ */
  // 当前在 s08。顶部"批量"按钮
  const bt = await clickText('批量', 'exact'); await wait();
  const ob = await page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const sheets = [].filter.call(document.querySelectorAll('[class*=sheet],[class*=modal],[class*=overlay]'), vis);
    return sheets.map(e => e.className + '::' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 120));
  });
  rec('B5-T1a', 's08批量按钮(条件批量?)', bt ? `点击=${bt.slice(0, 40)} sheets=${JSON.stringify(ob).slice(0, 260)}` : '未找到"批量"', '');
  await shot('B5_batch_sheet');
  // 关闭 sheet
  let cl = await clickText('关闭', 'exact') || await clickText('取消', 'exact') || await clickText('完成', 'exact') || await goBack();
  await wait(300);

  // 批量录入页 s09
  const bl = await clickText('批量录入', 'prefix'); await wait();
  rec('B5-T5a', '批量录入入口', bl ? `→ 屏=${await visScreen()}` : '未找到"批量录入"', '');
  rec('B5-T5b', '批量录入页盘点', 'INFO', (await visText()).slice(0, 320));
  rec('B5-T5c', '批量录入输入框', 'INFO', JSON.stringify(await docInputs()));
  await shot('B5_batch_entry');

  fs.writeFileSync(path.join(OUT, 'qa_runD.json'), JSON.stringify({ log }, null, 2), 'utf8');
  console.log('--- RUN-D ALL DONE. errors=' + pageErrors.length);
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); flush(); process.exit(1); });
