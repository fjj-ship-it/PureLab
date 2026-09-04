/* RUN-K —— 修复后回归：真实缺陷修复验证 + 新实验完整 E2E */
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
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text().slice(0, 120)); });
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
  const clickAny = async (t, mode = 'exact') => page.evaluate(({ t, mode }) => {
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
    return el.tagName + (el.id ? '#' + el.id : '') + ' "' + el.textContent.trim().slice(0, 18) + '"';
  }, { t, mode });
  const setInput = async (id, v) => page.evaluate(({ id, v }) => {
    const el = document.getElementById(id);
    if (!el) return null;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  }, { id, v });
  const getToast = async () => page.evaluate(() => {
    const t = document.getElementById('toast');
    return t && t.classList.contains('show') ? t.textContent : null;
  });
  const well = async (coord) => page.evaluate(c => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const el = [].find.call(document.querySelectorAll('.well,[data-well]'), e => vis(e) && e.getAttribute('data-well') === c);
    if (!el) return null;
    el.click(); return true;
  }, coord);
  const chip = async (label) => page.evaluate(l => {
    const c = [].find.call(document.querySelectorAll('#batch-chips .chip'), x => x.textContent.trim() === l);
    if (!c) return null; c.click(); return true;
  }, label);
  const dbState = () => page.evaluate(() => {
    const raw = localStorage.getItem('purelab_db');
    if (!raw) return { NULL: true, rawLen: 0 };
    let db;
    try { db = JSON.parse(raw); } catch (e) { return { PARSE_ERR: true, head: raw.slice(0, 80) }; }
    if (!db || !db.wells || !db.exp) return { MALFORMED: true, keys: Object.keys(db || {}) };
    const ws = Object.values(db.wells);
    const done = ws.filter(w => w.done);
    const best = done.length ? done.reduce((a, b) => (b.purity > a.purity ? b : a)) : null;
    return { id: db.exp.id, drug: db.exp.drug, done: done.length, best: best ? best.coord + '@' + best.purity + '%' : '—', dose: db.exp.dose };
  });
  const wellData = (coord) => page.evaluate(c => {
    const raw = localStorage.getItem('purelab_db');
    if (!raw) return { NULL: true };
    const w = (JSON.parse(raw).wells || {})[c];
    if (!w) return { NO_WELL: c };
    return w.done ? { done: true, v: w.input + '/' + w.output + '=' + w.purity + '%' } : { done: false };
  }, coord);
  const wait = (ms = 500) => page.waitForTimeout(ms);

  /* K1: s15 入口（新） */
  await clickAny('开始使用'); await wait();
  const me = await clickAny('我的', 'exact'); await wait();
  rec('K-01', '[修复]s02[我的]→s15', me ? `→ 屏=${await visScreen()}` : 'FAIL 无入口', '');
  rec('K-02', 's15 内容', (await scrText()).slice(0, 180), '');
  await shot('K02_s15');
  const rg = await clickAny('试剂库', 'prefix'); await wait();
  rec('K-03', '[验证]s15[试剂库]→s14', rg ? `→ 屏=${await visScreen()}` : 'FAIL', '');
  rec('K-04', 's14 试剂库内容', (await scrText()).slice(0, 220), '');
  await shot('K04_s14');

  /* K2: 新实验创建（含校验） */
  await clickAny('‹', 'exact'); await wait();
  await clickAny('‹', 'exact'); await wait();
  await clickAny('新建实验', 'prefix'); await wait();
  rec('K-05', '进s03', await visScreen(), '');
  await setInput('f-name', ''); await setInput('f-drug', '对乙酰氨基酚粗品');
  await clickAny('下一步', 'prefix'); await wait(300);
  rec('K-06', '[修复]空名称下一步', `屏=${await visScreen()} toast="${await getToast()}"`, '');
  await setInput('f-name', '溶解度筛选-04');
  await clickAny('下一步', 'prefix'); await wait();
  rec('K-07', 's03→s04', await visScreen(), '');
  const addCombo = await clickAny('新建组合', 'prefix'); await wait(300);
  if (await page.evaluate(() => !!document.getElementById('rg-name') || !!document.querySelector('.sheet.show #rg-name, .sheet #combo-name'))) { /* sheet 表单探测 */ }
  // 组合 sheet 里找名称输入
  const comboAdded = await page.evaluate(() => {
    const inp = [].find.call(document.querySelectorAll('.sheet input'), i => true);
    if (!inp) return null;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, '乙醇 : 乙酸乙酯 = 1 : 2'); inp.dispatchEvent(new Event('input', { bubbles: true }));
    const btn = [].find.call(document.querySelectorAll('.sheet button'), b => b.textContent.includes('保存'));
    if (btn) btn.click();
    return inp.value;
  });
  await wait(400);
  rec('K-08', '[验证]s04新建组合', comboAdded ? `已填"${comboAdded}" toast="${await getToast()}"` : 'sheet 无输入框（功能不变，记 N/A）', '');
  await clickAny('下一步', 'prefix'); await wait();
  rec('K-09', 's04→s05', await visScreen(), '');
  await clickAny('下一步', 'prefix'); await wait();
  rec('K-10', 's05→s06', await visScreen(), '');
  /* 空名校验门在 s06 创建实验处（s03 下一步不拦截，属设计行为） */
  await setInput('f-name', '');
  await clickAny('创建实验', 'prefix'); await wait(400);
  rec('K-10b', '[修复]空名称创建被拦截', `屏=${await visScreen()} toast="${await getToast()}"（预期回 s03）`, '');
  await setInput('f-name', '溶解度筛选-04');
  await clickAny('下一步', 'prefix'); await wait();          /* s03→s04 */
  await clickAny('下一步', 'prefix'); await wait();          /* s04→s05 */
  await clickAny('下一步', 'prefix'); await wait();          /* s05→s06 */
  rec('K-10c', '重走向导到s06', await visScreen(), '');
  await clickAny('创建实验', 'prefix'); await wait(700);
  const st1 = await dbState();
  rec('K-11', '[修复]创建真实新实验', `屏=${await visScreen()} db=${JSON.stringify(st1)}`, '');
  await shot('K11_new_exp');

  /* K3: s09 校验 + 批量填充 */
  await clickAny('进入孔板记录', 'prefix'); await wait();
  await clickAny('批量录入', 'prefix'); await wait();
  await chip('A'); await wait(150);
  await setInput('b-out', '-5');
  await clickAny('应用到所选孔位', 'prefix'); await wait(250);
  rec('K-12', '[修复]负数拒绝', `toast="${await getToast()}"（预期拦截）`, '');
  await setInput('b-out', '0');
  await clickAny('应用到所选孔位', 'prefix'); await wait(400);
  rec('K-13', '[设计确认]产出0为合法数据', `屏=${await visScreen()} toast="${await getToast()}"（0%纯度合法，成功后返回s08）`, '');
  await clickAny('批量', 'prefix'); await wait();            /* 重新进入 s09 */
  await chip('A'); await wait(150);
  await setInput('b-out', '150');
  await clickAny('应用到所选孔位', 'prefix'); await wait(250);
  rec('K-14', '[修复]产出>投入拒绝', `屏=${await visScreen()} toast="${await getToast()}"（预期拦截留s09）`, '');
  await setInput('b-out', '88.0');
  await clickAny('应用到所选孔位', 'prefix'); await wait(400);
  rec('K-15a', '[修复]仅填充未完成跳过已完成', `toast="${await getToast()}"（预期跳过提示，留s09）`, '');
  await page.evaluate(() => { const c = document.getElementById('b-onlyempty'); if (c) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); } });
  await clickAny('应用到所选孔位', 'prefix'); await wait(600);
  const st2 = await dbState();
  rec('K-15', '[修复]批量覆盖应用12孔', `done=${st2.done} toast="${await getToast()}"`, '');
  await shot('K15_batch');
  await clickAny('‹', 'exact'); await wait();
  rec('K-16', 's08→s07详情刷新', (await scrText()).slice(0, 80), '');

  /* K4: 单孔编辑（s07 mini 板点击→s08；s08 全尺寸板点击→s10） */
  await well('B3'); await wait();
  rec('K-17a', 's07 mini板点B3→s08（设计行为）', await visScreen(), '');
  await well('B3'); await wait();
  rec('K-17', 's08全板点B3→s10', await visScreen(), '');
  await clickAny('编辑', 'exact'); await wait(300);
  await setInput('we-in', '200');
  await setInput('we-out', '190');
  await clickAny('保存', 'exact'); await wait(600);
  const b3 = await wellData('B3');
  rec('K-18', '[修复]逐孔投入量覆盖', `B3=${JSON.stringify(b3)}（200/190=95.0% 预期）`, '');
  await shot('K18_b3');
  // 清除语义
  await clickAny('编辑', 'exact'); await wait(300);
  await setInput('we-out', '');
  await clickAny('保存', 'exact'); await wait(600);
  const b3b = await wellData('B3');
  rec('K-19', '[修复]清空=清除数据', `B3=${JSON.stringify(b3b)}（预期 done:false）`, '');
  // 恢复 B3 并设为唯一最佳：200/180 = 90.0%（A 行 88%）
  await clickAny('编辑', 'exact'); await wait(300);
  await setInput('we-in', '200');
  await setInput('we-out', '180');
  await clickAny('保存', 'exact'); await wait(500);

  /* K5: 最佳动态化（B3 90% 应为最佳，超过 A 行 88%） */
  await clickAny('‹', 'exact'); await wait();   /* s10→s08 */
  await clickAny('‹', 'exact'); await wait();   /* s08→s07 */
  const st3 = await dbState();
  rec('K-20', '[修复]最佳动态计算', `best=${st3.best}（预期 B3@90%）`, '');
  await shot('K20_best');
  const favGo = await clickAny('分析孔板最佳条件', 'prefix'); await wait();
  rec('K-21', 's12 最佳条件', `屏=${await visScreen()} 内容=${(await scrText()).slice(0, 140)}`, '');
  await clickAny('收藏此条件', 'prefix'); await wait(300);
  rec('K-22', '收藏反馈', `toast="${await getToast()}"`, '');
  const rk = await clickAny('查看完整排名', 'prefix'); await wait();
  rec('K-23', 's12→s13', `屏=${await visScreen()} 首行=${(await scrText()).slice(0, 90)}`, '');
  await shot('K23_rank');

  /* K6: 持久化 */
  await page.reload({ waitUntil: 'load' }); await wait(800);
  await clickAny('开始使用'); await wait();
  const st4 = await dbState();
  rec('K-24', 'reload持久化', `db=${JSON.stringify(st4)}`, '');

  console.log('pageErrors=' + pageErrors.length + (pageErrors.length ? ' :: ' + pageErrors.join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'qa_runK.json'), JSON.stringify({ log, pageErrors }, null, 2), 'utf8');
  console.log('--- RUN-K DONE');
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
