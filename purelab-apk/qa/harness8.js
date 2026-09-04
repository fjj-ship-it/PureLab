/* RUN-H —— 屏幕内容直读(不可达屏) + 可达屏截图 + s07 tab 行为 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa';
const SHOTS = path.join(OUT, 'shots');
const log = [];
function rec(id, a, r, d) { log.push({ id, area: a, result: r, detail: String(d).slice(0, 800) }); console.log(`[${r}] ${id} ${a} :: ${String(d).slice(0, 300)}`); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
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
    return el.tagName + '.' + el.className;
  }, { t, mode });
  const wait = (ms = 450) => page.waitForTimeout(ms);

  /* H1: 全部 15 屏内容直读（结构完整性验收素材） */
  for (let i = 1; i <= 15; i++) {
    const sid = 's' + String(i).padStart(2, '0');
    const txt = await page.evaluate(sid => {
      const el = document.getElementById(sid);
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : 'MISSING';
    }, sid);
    const interactive = await page.evaluate(sid => {
      const el = document.getElementById(sid);
      if (!el) return 0;
      return el.querySelectorAll('button,[data-go],[data-back],[data-act],input,textarea,.well').length;
    }, sid);
    rec('H-' + sid, '内容直读', txt === 'MISSING' ? 'FAIL' : (txt.length < 20 ? 'INFO(疑似空壳)' : 'INFO'), `[交互元素${interactive}个] ${txt.slice(0, 240)}`);
  }

  /* H2: s07 RUN/结果 tab 行为 */
  await clickText('开始使用'); await wait();
  await clickText('继续实验', 'prefix'); await wait();
  const s7 = await page.evaluate(() => document.getElementById('s07').textContent.replace(/\s+/g, ' ').trim());
  const runTab = await page.evaluate(() => {
    const el = document.getElementById('s07');
    const tabs = [].filter.call(el.querySelectorAll('[class*=tab]'), e => true);
    return tabs.map(t => t.className + '::' + t.textContent.trim().slice(0, 20));
  });
  rec('H2-01', 's07 tabs', 'INFO', JSON.stringify(runTab));
  const before = await page.evaluate(() => document.getElementById('s07').querySelector('[class*=panel],[class*=body],[class*=content]') ? 'has-panel' : 'flat');
  const rt = await clickText('结果', 'exact'); await wait(400);
  const after7 = await page.evaluate(() => document.getElementById('s07').textContent.replace(/\s+/g, ' ').trim());
  rec('H2-02', '点击[结果]tab', rt ? (s7 === after7 ? 'FAIL(内容无变化)' : 'INFO(内容有变化)') : '无反应',
    rt ? `变化片段: ${after7.slice(0, 150)}` : '');
  await page.screenshot({ path: path.join(SHOTS, 'H2_s07_resulttab.png') });

  /* H3: 可达屏截图（真实用户路径） */
  const reach = [
    ['s01', async () => { await page.reload({ waitUntil: 'load' }); await wait(700); }],
    ['s02', async () => { await clickText('开始使用'); await wait(); }],
    ['s07', async () => { await clickText('继续实验', 'prefix'); await wait(); }],
    ['s08', async () => { await clickText('进入孔板记录', 'prefix'); await wait(); }],
    ['s09', async () => { await clickText('批量录入', 'prefix'); await wait(); }],
    ['s12', async () => { await clickText('‹', 'exact'); await wait(); await clickText('‹', 'exact'); await wait(); await clickText('分析孔板最佳条件', 'prefix'); await wait(); }],
  ];
  for (const [sid, nav] of reach) {
    try { await nav(); } catch (e) { }
    await page.screenshot({ path: path.join(SHOTS, 'app_' + sid + '.png') });
    rec('H3-' + sid, '可达性截图', await page.evaluate(() => {
      const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
      return v.length ? v[0].id : 'NONE';
    }), '');
  }

  fs.writeFileSync(path.join(OUT, 'qa_runH.json'), JSON.stringify({ log }, null, 2), 'utf8');
  console.log('--- RUN-H DONE');
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
