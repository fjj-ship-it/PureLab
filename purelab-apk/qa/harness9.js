/* RUN-I —— 修正点击目标后的基线复核
 * clickText v2：优先选带 data-go/data-back/id/button 的"真按钮"，避免点到文本等长的 wrapper
 */
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
  /* clickText v2: 候选打分——button/data-go/data-back/带id 优先于裸 div/span */
  const clickText = async (t, mode = 'exact') => page.evaluate(({ t, mode }) => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const cands = [].filter.call(document.querySelectorAll('button,a,div,span,li,td,label,[role=button],[data-go],[data-back]'), e => {
      if (!vis(e)) return false;
      const s = e.textContent.trim();
      return mode === 'prefix' ? s.startsWith(t) : (mode === 'loose' ? s.includes(t) : s === t);
    });
    if (!cands.length) return null;
    const score = e => (e.tagName === 'BUTTON' || e.getAttribute('data-go') || e.getAttribute('data-back') || e.id ? 0 : 1) * 1000 + e.textContent.length;
    cands.sort((a, b) => score(a) - score(b));
    const el = cands[0];
    el.click();
    return el.tagName + (el.id ? '#' + el.id : '') + '.' + el.className + ' "' + el.textContent.trim().slice(0, 24) + '"';
  }, { t, mode });
  const wait = (ms = 500) => page.waitForTimeout(ms);
  const lsSummary = () => page.evaluate(() => {
    try {
      const db = JSON.parse(localStorage.getItem('purelab_db') || 'null');
      if (!db) return 'NO_DB';
      const wells = Object.values(db.wells || {});
      const done = wells.filter(w => w.done).length;
      const c7 = db.wells && db.wells.C7;
      return `db=${db.exp.id} done=${done} C7=${c7 ? (c7.done ? c7.output + 'mg/' + c7.purity + '%' : 'empty') : '?'}`;
    } catch (e) { return 'ERR:' + e.message; }
  });

  /* I1: 新建实验入口（QA 曾误报空壳） */
  await clickText('开始使用'); await wait();
  rec('I-01', '进工作台', await visScreen(), '');
  const nb = await clickText('新建实验', 'prefix'); await wait();
  rec('I-02', `[复核]新建实验 →`, `点击=${nb} → 屏=${await visScreen()}`, '');
  await shot('I02_new_exp');
  // I2: s03 表单可填 + 下一步
  const setName = await page.evaluate(() => {
    const el = document.getElementById('f-name');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, '溶解度筛选-04'); el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  });
  const setDrug = await page.evaluate(() => {
    const el = document.getElementById('f-drug');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, '对乙酰氨基酚粗品'); el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  });
  rec('I-03', 's03 填表', `name="${setName}" drug="${setDrug}"`, '');
  const n1 = await clickText('下一步', 'prefix'); await wait();
  rec('I-04', 's03→s04', `点击=${n1} → 屏=${await visScreen()}`, '');
  rec('I-05', 's04 内容', (await scrText()).slice(0, 160), '');
  await shot('I05_s04');
  const n2 = await clickText('下一步', 'prefix'); await wait();
  rec('I-06', 's04→s05', `→ 屏=${await visScreen()}`, '');
  const n3 = await clickText('下一步', 'prefix'); await wait();
  rec('I-07', 's05→s06', `→ 屏=${await visScreen()}`, '');
  rec('I-08', 's06 确认卡', (await scrText()).slice(0, 200), '');
  await shot('I08_s06');
  const cr = await clickText('创建实验', 'prefix'); await wait();
  rec('I-09', '创建实验', `点击=${cr} → 屏=${await visScreen()} | ${lsSummary()}`, '');
  await shot('I09_created');

  /* I3: s09 批量应用（QA 曾误报无效）——选 C 行（含 4 个空孔）便于观察 empty→done */
  await clickText('进入孔板记录', 'prefix'); await wait();
  rec('I-10', '进s08', await visScreen(), '');
  const before = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('purelab_db'));
    return { done: Object.values(db.wells).filter(w => w.done).length };
  });
  await clickText('批量录入', 'prefix'); await wait();
  rec('I-11', '进s09', await visScreen(), '');
  await page.evaluate(() => {
    const chips = [].filter.call(document.querySelectorAll('#batch-chips .chip'), c => c.textContent.trim() === 'C');
    if (chips[0]) chips[0].click();
  }); await wait(200);
  await page.evaluate(() => {
    const el = document.getElementById('b-out');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, '85.0'); el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const ap = await clickText('应用到所选孔位', 'prefix'); await wait(700);
  const toastTxt = await page.evaluate(() => {
    const t = document.getElementById('toast');
    return t && t.classList.contains('show') ? t.textContent : '(toast已消失或未显示)';
  });
  const after = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('purelab_db'));
    return { done: Object.values(db.wells).filter(w => w.done).length };
  });
  rec('I-12', `[复核]s09应用`, `点击=${ap ? ap.slice(0, 36) : 'null'} toast="${toastTxt}" done:${before.done}→${after.done} | ${lsSummary()}`, '');
  await shot('I12_applied');
  await clickText('‹', 'exact'); await wait();
  rec('I-13', '回s08', await visScreen(), '');

  /* I4: s10 编辑（QA 曾误报无反应） */
  await page.evaluate(() => {
    const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const el = [].find.call(document.querySelectorAll('.well,[data-well]'), e => vis(e) && (e.dataset.well === 'C1'));
    if (el) el.click();
  }); await wait();
  rec('I-14', '打开C1详情', `屏=${await visScreen()}`, '');
  const ed = await clickText('编辑', 'exact'); await wait(300);
  const hasInput = await page.evaluate(() => !!document.getElementById('we-out'));
  rec('I-15', `[复核]s10编辑`, `点击=${ed} 编辑框出现=${hasInput}`, '');
  await shot('I15_edit');
  if (hasInput) {
    await page.evaluate(() => {
      const el = document.getElementById('we-out');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(el, '92.5'); el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const sv = await clickText('保存', 'exact'); await wait(600);
    const c1 = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('purelab_db'));
      const w = db.wells.C1; return w.done ? w.output + 'mg/' + w.purity + '%' : 'empty';
    });
    const toastTxt2 = await page.evaluate(() => {
      const t = document.getElementById('toast');
      return t && t.classList.contains('show') ? t.textContent : '(toast已消失)';
    });
    rec('I-16', `[复核]s10保存`, `点击=${sv ? sv.slice(0, 30) : 'null'} C1=${c1} toast="${toastTxt2}"`, '');
  }

  /* I5: s12→s13 排名（QA 曾误报死按钮） */
  await clickText('‹', 'exact'); await wait();
  await clickText('‹', 'exact'); await wait();
  rec('I-17', '回s07', await visScreen(), '');
  await clickText('分析孔板最佳条件', 'prefix'); await wait();
  rec('I-18', '进s12', await visScreen(), '');
  const rk = await clickText('查看完整排名', 'prefix'); await wait();
  rec('I-19', `[复核]查看完整排名`, `点击=${rk} → 屏=${await visScreen()}`, '');
  rec('I-20', 's13 排名页', (await scrText()).slice(0, 260), '');
  await shot('I20_rank');

  /* I6: s07[结果]→s11（QA 曾误报假tab） */
  await clickText('‹', 'exact'); await wait();
  await clickText('‹', 'exact'); await wait();
  const res = await clickText('结果', 'exact'); await wait();
  rec('I-21', `[复核]s07[结果]→s11`, `点击=${res} → 屏=${await visScreen()}`, '');
  rec('I-22', 's11 结果总览', (await scrText()).slice(0, 240), '');
  await shot('I22_s11');

  /* I7: s15 入口现状（真实缺陷确认） */
  await clickText('‹', 'exact'); await wait();
  await clickText('‹', 'exact'); await wait();
  const me = await clickText('我的', 'loose'); await wait();
  rec('I-23', `[确认]s02 找"我的"入口`, me ? `点击=${me} → ${await visScreen()}` : '工作台无任何通往 s15 的入口（真实缺陷）', '');

  fs.writeFileSync(path.join(OUT, 'qa_runI.json'), JSON.stringify({ log }, null, 2), 'utf8');
  console.log('--- RUN-I DONE');
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
