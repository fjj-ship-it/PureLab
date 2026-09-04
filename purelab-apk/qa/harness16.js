/* RUN-FIX —— 方向性修复验证：P0×2 + 视觉还原项 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa';
const log = [];
function rec(id, name, ok, detail) { log.push({ id, name, ok, detail: String(detail).slice(0, 300) }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name} :: ${String(detail).slice(0, 200)}`); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const visScreen = () => page.evaluate(() => { const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v.length ? v[0].id : 'NONE'; });
  const wait = (ms = 350) => page.waitForTimeout(ms);
  const go = async a => page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (el) { el.click(); return true; } return false; }, a);
  const back = async () => page.evaluate(() => { const b = [].find.call(document.querySelectorAll('[data-back]'), e => e.getClientRects().length > 0); if (b) { b.click(); return true; } return false; });
  const setInput = async (id, v) => page.evaluate(({ id, v }) => { const el = document.getElementById(id); if (!el) return; Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, { id, v });
  const clickId = async id => page.evaluate(i => { const el = document.getElementById(i); if (el) { el.click(); return true; } return false; }, id);
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')));

  /* F1: s01 插画 */
  const art = await page.evaluate(() => !!document.querySelector('.launch-art'));
  rec('F-01', 's01 植物插画', art, art ? 'SVG OK' : 'missing');

  /* F2: s02 深绿卡 + 缩略图 */
  await go('s02'); await wait();
  const dark = await page.evaluate(() => { const c = document.querySelector('.exp-card'); return c && c.classList.contains('dark'); });
  const thumbs = await page.evaluate(() => document.querySelectorAll('.arch-thumb').length);
  rec('F-02', 's02 深绿主卡+缩略图', dark && thumbs === 2, 'dark=' + dark + ' thumbs=' + thumbs);

  /* F3: 向导 stepper */
  const stepChk = async (scr, activeIdx) => {
    const r = await page.evaluate(() => {
      const st = document.querySelector('.screen.active .stepper');
      if (!st) return null;
      const on = [].map.call(st.querySelectorAll('.step.on'), s => s.textContent.trim());
      return { total: st.querySelectorAll('.step').length, on: on.join(',') };
    });
    return r && r.total === 3 && r.on.indexOf(String(activeIdx)) > -1 ? r : null;
  };
  await go('s03'); await wait();
  rec('F-03', 's03 stepper', !!(await stepChk('s03', 1)), JSON.stringify(await page.evaluate(() => { const st = document.querySelector('.screen.active .stepper'); return st ? st.textContent.replace(/\s+/g, ' ').trim() : null; })));
  await go('s04'); await wait();
  rec('F-04', 's04 stepper', !!(await stepChk('s04', 2)), '');
  await go('s05'); await wait();
  rec('F-05', 's05 stepper', !!(await stepChk('s05', 2)), '');
  await go('s06'); await wait();
  rec('F-06', 's06 stepper', !!(await stepChk('s06', 3)), '');

  /* F4: s06 孔板预览 + 图例 */
  const prev = await page.evaluate(() => document.querySelectorAll('.screen.active [data-well]').length);
  const leg = await page.evaluate(() => (document.querySelector('#confirm-legend') || {}).textContent.length);
  rec('F-07', 's06 孔板预览+图例', prev === 96 && leg > 20, 'wells=' + prev + ' legendLen=' + leg);

  /* F5: 创建三连击只创建一次 + 返回回工作台 */
  await back(); await wait(); await back(); await wait(); await back(); await wait();   // s06→s03
  await setInput('f-name', '方向修复验证');
  await setInput('f-drug', '布洛芬粗品');
  await go('s04'); await wait(); await go('s05'); await wait(); await go('s06'); await wait();
  for (let i = 0; i < 3; i++) { await clickId('btn-create'); await wait(40); }
  await wait(400);
  const d1 = await db();
  rec('F-08', '[P0]创建三连击只创建一次', d1.exp.name === '方向修复验证' && d1.exp.id === 'EXP-04', 'exp=' + d1.exp.id);
  await back(); await wait();
  rec('F-09', '[P0]创建后返回回工作台', (await visScreen()) === 's02', '屏=' + (await visScreen()));
  // s02→s07 正常
  await page.evaluate(() => document.querySelector('.exp-card').click()); await wait();
  rec('F-10', '工作台卡片→s07', (await visScreen()) === 's07', '');

  /* F6: s07 迷你板直达 s10 */
  await page.evaluate(() => { const el = [].find.call(document.querySelectorAll('[data-well]'), e => e.getClientRects().length > 0 && e.getAttribute('data-well') === 'B3'); if (el) el.click(); }); await wait();
  rec('F-11', 's07 迷你板点B3直达s10', (await visScreen()) === 's10', '屏=' + (await visScreen()));

  /* F7: s04 新建组合表单（名称+配方）+ 详情 + 删除 */
  await page.reload({ waitUntil: 'load' }); await wait(600); await go('s02'); await wait(); await go('s03'); await wait(); await go('s04'); await wait();
  await clickId('combo-add'); await wait(300);
  const sheetOpen = await page.evaluate(() => !!document.getElementById('cg-name') && !!document.getElementById('cg-recipe'));
  await setInput('cg-name', '组合F');
  await setInput('cg-recipe', '乙醇 : 乙酸乙酯 = 1 : 2');
  await clickId('cg-save'); await wait(400);
  const d2 = await db();
  const fInList = await page.evaluate(() => [].some.call(document.querySelectorAll('#combo-list .combo-card'), c => c.getAttribute('data-cid') === 'F'));
  rec('F-12', '新建组合带配方输入', sheetOpen && d2.customCombos && d2.customCombos.length === 1 && fInList, 'custom=' + JSON.stringify(d2.customCombos));
  // 组合卡点详情
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#combo-list .combo-card'), c => c.getAttribute('data-cid') === 'F').click(); }); await wait(300);
  const detailOk = await page.evaluate(() => document.getElementById('cd-del') !== null);
  rec('F-13', '自定义组合详情+可删除', detailOk, '');
  await clickId('cd-del'); await wait(300);
  const d3 = await db();
  rec('F-14', '删除自定义组合', d3.customCombos.length === 0, 'custom=' + JSON.stringify(d3.customCombos));

  /* F8: s11 hero 深绿 */
  await page.reload({ waitUntil: 'load' }); await wait(600); await go('s02'); await wait();
  await page.evaluate(() => document.querySelector('.exp-card').click()); await wait();
  await go('s11'); await wait();
  const heroDark = await page.evaluate(() => { const h = document.querySelector('.hero'); return h && h.classList.contains('dark'); });
  rec('F-15', 's11 深绿hero', heroDark, '');

  /* F9: s14 试剂详情 */
  await page.reload({ waitUntil: 'load' }); await wait(600); await go('s02'); await wait();
  await go('s15'); await wait(); await go('s14'); await wait();
  await page.evaluate(() => { const el = [].find.call(document.querySelectorAll('[data-rg]'), e => e.getClientRects().length > 0); if (el) el.click(); }); await wait(300);
  const rgSheet = await page.evaluate(() => (document.getElementById('sheet-title') || {}).textContent || '');
  rec('F-16', 's14 试剂卡点详情', rgSheet.indexOf('试剂详情') > -1, rgSheet);

  /* F10: s15 帮助与反馈 */
  await page.evaluate(() => document.getElementById('sheet-mask').click()); await wait(200);
  await back(); await wait();                                              /* s14→s15 */
  await clickId('m-help'); await wait(300);
  const helpOk = await page.evaluate(() => (document.getElementById('sheet-title') || {}).textContent === '帮助与反馈');
  rec('F-17', 's15 帮助与反馈', helpOk, '');

  rec('F-18', '全程无 JS 异常', pageErrors.length === 0, pageErrors.join(' | ') || 'clean');
  fs.writeFileSync(path.join(OUT, 'qa_runFix.json'), JSON.stringify({ log, pageErrors }, null, 2), 'utf8');
  console.log('--- FIX-VERIFY DONE');
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
