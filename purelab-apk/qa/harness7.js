/* RUN-G —— 终验：s09 应用语义（仅填充未完成 vs 覆盖）+ s12 下游 + s11入口 + 持久化 */
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
    const cands = [].filter.call(document.querySelectorAll('button,a,div,span,li,td,label,[role=button],[data-go],[data-back],[data-act]'), e => {
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
    return t.length ? t[0].textContent.trim().slice(0, 100) : null;
  });
  const visInputs = () => page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    return [].filter.call(document.querySelectorAll('input,textarea'), vis).map(i => ({ ph: i.placeholder || i.type, val: i.value, checked: i.checked }));
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
  const toggleCheckbox = async () => page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const cb = [].find.call(document.querySelectorAll('input[type=checkbox]'), vis);
    if (!cb) return null;
    cb.click();
    return cb.checked;
  });
  const wait = (ms = 450) => page.waitForTimeout(ms);
  const gotoS08 = async () => {
    await clickText('开始使用'); await wait();
    await clickText('继续实验', 'prefix'); await wait();
    await clickText('进入孔板记录', 'prefix'); await wait();
  };
  const s08wellStat = () => page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const scr = [].find.call(document.querySelectorAll('.screen'), vis);
    const wells = [].filter.call(scr.querySelectorAll('.well,[data-well]'), vis);
    const byCls = {};
    wells.forEach(w => { const k = w.className.replace(/well\s*/g, '').trim() || 'plain'; byCls[k] = (byCls[k] || 0) + 1; });
    return byCls;
  });

  /* G1: s09 应用语义测试 */
  await gotoS08();
  const stat0 = await s08wellStat();
  rec('G-01', '初始统计', 'INFO', JSON.stringify(stat0));
  await clickText('批量录入', 'prefix'); await wait();
  rec('G-02', '进s09', await visScreen(), '');
  rec('G-02b', 's09输入框(含checkbox状态)', 'INFO', JSON.stringify(await visInputs()));

  // 场景1: 默认(仅填充未完成) + A行(全完成) → 预期跳过
  await clickText('A', 'exact'); await wait(200);
  let ins = await visInputs();
  await setVisInput(ins.findIndex(i => (i.ph || '').includes('产出')), '85.0');
  await clickText('应用到所选孔位', 'prefix'); await wait();
  rec('G-03', '默认+A行应用', `toast="${await getToast()}"`, '');
  await clickText('‹', 'exact'); await wait();
  const stat1 = await s08wellStat();
  rec('G-04', '应用后统计(应无变化)', JSON.stringify(stat1) === JSON.stringify(stat0) ? '确认: A行无变化(被仅填充未完成规则跳过)' : '变化:' + JSON.stringify(stat1), '');
  await shot('G04');

  // 场景2: 取消勾选"仅填充未完成孔位" + A行 → 预期覆盖
  await clickText('批量录入', 'prefix'); await wait();
  const un = await toggleCheckbox(); await wait(200);
  rec('G-05', '取消仅填充未完成', `checked=${un}`, '');
  await clickText('A', 'exact'); await wait(200);
  ins = await visInputs();
  await setVisInput(ins.findIndex(i => (i.ph || '').includes('产出')), '85.0');
  await clickText('应用到所选孔位', 'prefix'); await wait();
  rec('G-06', '覆盖模式+A行应用', `toast="${await getToast()}"`, '');
  await clickText('‹', 'exact'); await wait();
  const stat2 = await s08wellStat();
  rec('G-07', '覆盖后统计', JSON.stringify(stat2), '');
  await shot('G07');
  rec('G-07b', '覆盖判定', JSON.stringify(stat2) !== JSON.stringify(stat0) ? 'INFO(有变化)' : 'FAIL(仍无变化→应用功能失效)', '');
  // 进度文本
  rec('G-07c', 's08进度文本', 'INFO', (await scrText()).match(/\d+\/96[^组]*/) ? (await scrText()).match(/\d+\/96[^组]*/)[0] : '未找到 x/96 文本');

  /* G2: s12 下游（收藏 + 完整排名） */
  await clickText('‹', 'exact'); await wait(); // s08→s07
  await clickText('分析孔板最佳条件', 'prefix'); await wait();
  rec('G-08', '进s12', await visScreen(), '');
  const fav = await clickText('收藏此条件', 'prefix'); await wait();
  rec('G-09', '收藏此条件', fav ? `点击=${fav.slice(0, 40)} toast="${await getToast()}"` : '无反应', '');
  await shot('G09_fav');
  const rank = await clickText('查看完整排名', 'prefix'); await wait();
  rec('G-10', '查看完整排名', rank ? `屏=${await visScreen()}` : '无反应', '');
  rec('G-10b', '排名页内容', 'INFO', (await scrText()).slice(0, 320));
  await shot('G10_rank');
  // 返回链
  let b1 = await clickText('‹', 'exact'); await wait(300);
  rec('G-11', '排名返回', `→ ${await visScreen()}`, '');
  let b2 = await clickText('‹', 'exact'); await wait(300);
  rec('G-11b', '再返回', `→ ${await visScreen()}`, '');

  /* G3: s11 结果总览入口探测 */
  // s07 结果 tab
  await clickText('结果', 'exact'); await wait(400);
  rec('G-12', 's07结果tab', 'INFO', (await scrText()).slice(0, 280));
  await shot('G12_result_tab');

  /* G4: 持久化（reload 后收藏/排名是否保持——本次会话没有成功写入的数据，验证 demo 重置行为） */
  await page.reload({ waitUntil: 'load' }); await wait(800);
  await clickText('开始使用'); await wait();
  await clickText('继续实验', 'prefix'); await wait();
  await clickText('进入孔板记录', 'prefix'); await wait();
  const stat3 = await s08wellStat();
  rec('G-13', 'reload后统计', JSON.stringify(stat3) === JSON.stringify(stat0) ? 'INFO(恢复初始演示状态)' : JSON.stringify(stat3), '');

  fs.writeFileSync(path.join(OUT, 'qa_runG.json'), JSON.stringify({ log }, null, 2), 'utf8');
  console.log('--- RUN-G DONE');
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
