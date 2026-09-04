/* RUN-VIS —— 步骤8 视觉验收：捕获全部 15 屏截图（纯导航，不改动数据） */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa/shots_vis';
fs.mkdirSync(OUT, { recursive: true });

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
  const shot = async n => { await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n, 'at', await visScreen()); };
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
    cands[0].click();
    return true;
  }, { t, mode });
  const back = async () => page.evaluate(() => { const b = [].find.call(document.querySelectorAll('[data-back]'), e => e.getClientRects().length > 0); if (b) { b.click(); return true; } return false; });
  const tapWell = async (coord) => page.evaluate(c => {
    const el = [].find.call(document.querySelectorAll('.well,[data-well]'), e => e.getClientRects().length > 0 && e.getAttribute('data-well') === c);
    if (!el) return null; el.click(); return true;
  }, coord);
  const wait = (ms = 500) => page.waitForTimeout(ms);

  const goAttr = async attr => page.evaluate(a => {
    const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0);
    if (!el) return null; el.click(); return true;
  }, attr);

  await shot('s01');
  await goAttr('s02'); await wait(); await shot('s02');
  await goAttr('s15'); await wait(); await shot('s15');
  await clickAny('试剂库', 'prefix'); await wait(); await shot('s14');
  await back(); await wait(); await back(); await wait();          // s14→s15→s02
  await goAttr('s03'); await wait(); await shot('s03');
  await goAttr('s04'); await wait(); await shot('s04');
  await goAttr('s05'); await wait(); await shot('s05');
  await goAttr('s06'); await wait(); await shot('s06');
  /* reload 重置页面栈，走后半程 */
  await page.reload({ waitUntil: 'load' }); await wait(700);
  await goAttr('s02'); await wait();
  await page.evaluate(() => document.querySelector('.exp-card').click()); await wait(); await shot('s07');
  await goAttr('s08'); await wait(); await shot('s08');
  await goAttr('s09'); await wait(); await shot('s09');
  await back(); await wait();                                       // s09→s08
  await tapWell('A1'); await wait(); await shot('s10');
  await back(); await wait(); await back(); await wait();          // s10→s08→s07
  await goAttr('s11'); await wait(); await shot('s11');
  await back(); await wait();                                       // s11→s07
  await goAttr('s12'); await wait(); await shot('s12');
  await goAttr('s13'); await wait(); await shot('s13');
  await browser.close();
  console.log('VIS DONE');
})().catch(e => { console.error('ERR', e); process.exit(1); });
