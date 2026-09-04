/* RUN-PROBE —— 步骤9 随机交互测试：枚举每屏"看起来可点击"的元素并逐个点击
   判定：点击后 屏变化 / toast / DOM 状态变化 三者皆无 → 疑似死元素 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa';
const log = [];
function rec(s, r) { log.push({ screen: s, ...r }); console.log(`[${s}] ${r.el} → ${r.verdict} ${r.note || ''}`); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const visScreen = () => page.evaluate(() => {
    const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return v.length ? v[0].id : 'NONE';
  });
  const wait = (ms = 350) => page.waitForTimeout(ms);
  const goAttr = async attr => page.evaluate(a => {
    const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0);
    if (!el) return null; el.click(); return true;
  }, attr);
  const back = async () => page.evaluate(() => { const b = [].find.call(document.querySelectorAll('[data-back]'), e => e.getClientRects().length > 0); if (b) { b.click(); return true; } return false; });

  /* 对当前屏枚举候选元素并逐个点击，记录反馈 */
  const probeScreen = async (screenId) => {
    const els = await page.evaluate(() => {
      const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
      const sel = 'button,a,[data-go],[data-back],[data-toast],.chip,.seg-item,.well,[data-well],.menu-row,.arch-row,.exp-card,input[type=checkbox],.hint,.legend .lg';
      const out = [];
      [].forEach.call(document.querySelectorAll(sel), e => {
        if (!vis(e)) return;
        if (e.tagName === 'INPUT' && e.type !== 'checkbox') return;
        const r = e.getBoundingClientRect();
        out.push({
          desc: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').slice(0, 2).join('.') : ''),
          text: e.textContent.trim().slice(0, 24),
          x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
          w: Math.round(r.width), h: Math.round(r.height),
          cursor: getComputedStyle(e).cursor
        });
      });
      return out;
    });
    for (const e of els) {
      // 跳过屏外/键盘遮挡区
      if (e.y < 0 || e.y > 843 || e.x < 0 || e.x > 389) continue;
      const before = await visScreen();
      const sigBefore = await page.evaluate(() => document.body.textContent.length + '|' + (document.getElementById('toast') || {}).className);
      await page.mouse.click(e.x, e.y).catch(() => {});
      await wait(280);
      const after = await visScreen();
      const sigAfter = await page.evaluate(() => document.body.textContent.length + '|' + (document.getElementById('toast') || {}).className);
      const toastShown = await page.evaluate(() => { const t = document.getElementById('toast'); return !!(t && t.classList.contains('show')); });
      const changed = after !== before || sigAfter !== sigBefore;
      let verdict = changed ? 'OK' : 'NO-FEEDBACK';
      // 若跳走了，先回到原屏
      if (after !== before) {
        // 尝试返回（可能多层）
        for (let i = 0; i < 4; i++) { if ((await visScreen()) === before) break; await back(); await wait(200); }
        if ((await visScreen()) !== before) { await page.reload({ waitUntil: 'load' }); await wait(600); await goAttr(before); await wait(300); }
      }
      const small = (e.w < 28 || e.h < 20) ? ' ⚠小点击区' : '';
      rec(screenId, { el: e.desc + ' "' + e.text + '"', verdict: verdict + small + (e.cursor === 'default' && e.desc.startsWith('div') && !e.desc.includes('well') ? '' : ''), note: e.w + 'x' + e.h });
    }
  };

  /* 走遍各屏并探测 */
  await goAttr('s02'); await wait(); await probeScreen('s02');
  await goAttr('s03'); await wait(); await probeScreen('s03');
  await goAttr('s04'); await wait(); await probeScreen('s04');
  await goAttr('s05'); await wait(); await probeScreen('s05');
  await goAttr('s06'); await wait(); await probeScreen('s06');
  await page.reload({ waitUntil: 'load' }); await wait(600); await goAttr('s02'); await wait();
  await page.evaluate(() => document.querySelector('.exp-card').click()); await wait(); await probeScreen('s07');
  await goAttr('s08'); await wait(); await probeScreen('s08');
  await goAttr('s09'); await wait(); await probeScreen('s09');
  await back(); await wait(); await probeScreen('s08b');   // s08 第二次（选中态下）
  await goAttr('s11'); await wait(); await probeScreen('s11');
  await goAttr('s12'); await wait(); await probeScreen('s12');
  await goAttr('s13'); await wait(); await probeScreen('s13');
  await page.reload({ waitUntil: 'load' }); await wait(600); await goAttr('s02'); await wait();
  await goAttr('s15'); await wait(); await probeScreen('s15');
  await goAttr('s14'); await wait(); await probeScreen('s14');

  fs.writeFileSync(path.join(OUT, 'qa_runProbe.json'), JSON.stringify(log, null, 2), 'utf8');
  const noFb = log.filter(l => l.verdict.startsWith('NO-FEEDBACK'));
  console.log('--- PROBE DONE. total=' + log.length + ' no-feedback=' + noFb.length);
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
