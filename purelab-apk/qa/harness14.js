/* RUN-STRESS —— 步骤10 压力型交互测试：快速/连点/竞态序列 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa';
const log = [];
function rec(id, name, ok, detail) { log.push({ id, name, ok, detail: String(detail).slice(0, 400) }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name} :: ${String(detail).slice(0, 200)}`); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push((e && e.stack ? e.stack : String(e)).slice(0, 400)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const visScreen = () => page.evaluate(() => { const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v.length ? v[0].id : 'NONE'; });
  const wait = (ms = 300) => page.waitForTimeout(ms);
  const goAttr = async attr => page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (!el) return null; el.click(); return true; }, attr);
  const goAttrN = async (attr, n, gap = 40) => { for (let i = 0; i < n; i++) { await page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (el) el.click(); }, attr); await wait(gap); } };
  const backN = async (n, gap = 40) => { for (let i = 0; i < n; i++) { await page.evaluate(() => { const b = [].find.call(document.querySelectorAll('[data-back]'), e => e.getClientRects().length > 0); if (b) b.click(); }); await wait(gap); } };
  const stackLen = () => page.evaluate(() => window.PureLab && window.__stackLen ? window.__stackLen : -1);
  const dbJSON = () => page.evaluate(() => { const r = localStorage.getItem('purelab_db'); return r ? JSON.parse(r) : null; });
  const setInput = async (id, v) => page.evaluate(({ id, v }) => { const el = document.getElementById(id); if (!el) return; Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, { id, v });
  const clickId = async id => page.evaluate(i => { const el = document.getElementById(i); if (el) el.click(); return !!el; }, id);
  const clickVisibleText = async t => page.evaluate(x => { const el = [].find.call(document.querySelectorAll('button,[data-go]'), e => e.getClientRects().length > 0 && e.textContent.trim().startsWith(x)); if (el) { el.click(); return true; } return false; }, t);
  const tapWell = async c => page.evaluate(cc => { const el = [].find.call(document.querySelectorAll('[data-well]'), e => e.getClientRects().length > 0 && e.getAttribute('data-well') === cc); if (!el) return null; el.click(); return true; }, c);
  const chip = async l => page.evaluate(x => { const c = [].find.call(document.querySelectorAll('#batch-chips .chip'), e => e.textContent.trim() === x); if (!c) return null; c.click(); return true; }, l);
  const reset = async () => { await page.reload({ waitUntil: 'load' }); await wait(600); await goAttr('s02'); await wait(); };

  /* A: 启动页快速三连点 */
  for (let i = 0; i < 3; i++) { await page.evaluate(() => { const el = document.querySelector('[data-go="s02"]'); if (el) el.click(); }); await wait(30); }
  await wait(300);
  rec('S-01', '启动页三连点', (await visScreen()) === 's02', '屏=' + (await visScreen()));

  /* B: 向导快速连点下一步（s02→s03 然后下一步×4 快速） */
  await goAttr('s03'); await wait();
  for (let i = 0; i < 4; i++) { await page.evaluate(() => { const el = [].find.call(document.querySelectorAll('[data-go="s04"],[data-go="s05"],[data-go="s06"]'), e => e.getClientRects().length > 0); if (el) el.click(); }); await wait(50); }
  await wait(300);
  const bScreen = await visScreen();
  rec('S-02', '向导快速连点下一步', bScreen === 's06', '屏=' + bScreen + '（预期 s06）');

  /* C: 连续快速返回 ×6 */
  await backN(6);
  await wait(300);
  const cScreen = await visScreen();
  rec('S-03', '连续返回×6', ['s02', 's01'].includes(cScreen), '屏=' + cScreen + '（预期 s01/s02，无崩溃）');

  /* D+E: 新实验 + s06 双击创建 */
  await reset();
  await goAttr('s03'); await wait();
  await setInput('f-name', '压力测试实验');
  await setInput('f-drug', '布洛芬粗品');
  await goAttr('s04'); await wait(); await goAttr('s05'); await wait(); await goAttr('s06'); await wait();
  for (let i = 0; i < 3; i++) { await clickId('btn-create'); await wait(30); }   // 三连击创建
  await wait(500);
  const db1 = await dbJSON();
  rec('S-04', '创建按钮三连击', db1 && db1.exp.name === '压力测试实验' && Object.keys(db1.wells).length === 96 && (await visScreen()) === 's07',
    'exp=' + (db1 && db1.exp.id) + ' wells=' + (db1 ? Object.keys(db1.wells).length : 0) + ' 屏=' + (await visScreen()));

  /* F: s09 快速选/取消孔 */
  await goAttr('s08'); await wait(); await goAttr('s09'); await wait();
  for (let i = 0; i < 5; i++) { await chip('A'); await wait(20); }              // A 选→取消→选…5次 = 选
  await chip('B'); await chip('C'); await wait(30); await chip('B');            // B 取消, C 选
  const selCount = await page.evaluate(() => document.querySelectorAll('#batch-chips .chip.on').length);
  await setInput('b-out', '80');
  await clickVisibleText('应用到所选孔位'); await wait(500);
  const db2 = await dbJSON();
  const aDone = db2 ? Object.values(db2.wells).filter(w => w.row === 'A' && w.done).length : 0;
  const cDone = db2 ? Object.values(db2.wells).filter(w => w.row === 'C' && w.done).length : 0;
  const bDone = db2 ? Object.values(db2.wells).filter(w => w.row === 'B' && w.done).length : 0;
  rec('S-05', '快速选/取消孔后应用', selCount === 2 && aDone === 12 && cDone === 12 && bDone === 0,
    'chips=' + selCount + ' A=' + aDone + ' B=' + bDone + ' C=' + cDone);

  /* G: 批量后立即改单孔（竞态写）。应用成功后 app 已自动 back() 回 s08 */
  await tapWell('A5'); await wait();       // s08 →s10
  await clickId('w-edit'); await wait(250);
  await setInput('we-out', '95');
  for (let i = 0; i < 3; i++) { await clickId('we-save'); await wait(30); }      // 三连击保存
  await wait(400);
  const db3 = await dbJSON();
  const a5 = db3 && db3.wells.A5;
  const a5Ops = db3 && db3.ops && db3.ops.A5 ? db3.ops.A5.length : 0;
  rec('S-06', '单孔保存三连击', a5 && a5.done && a5.output === 95 && a5.purity === 95 && a5Ops === 1,
    'A5=' + JSON.stringify(a5 ? { o: a5.output, p: a5.purity } : null) + ' ops=' + a5Ops);

  /* H: 输入后立即返回再进入 */
  await backN(1); await wait();            // 立即返回 s08
  await tapWell('A5'); await wait();       // 重新进入
  const a5Again = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('purelab_db')); const w = db.wells.A5; return { out: w.output, p: w.purity }; });
  rec('S-07', '保存后立即返回再进入', a5Again.out === 95 && a5Again.p === 95, JSON.stringify(a5Again));
  await backN(1); await wait();            // 回 s08

  /* I: 批量 A(80%) 后立刻批量 B(90%) 快速连续 */
  await goAttr('s09'); await wait();
  await chip('B'); await setInput('b-out', '90'); await clickVisibleText('应用到所选孔位'); await wait(300);
  /* 应用成功后 app 已自动 back() 回 s08 */
  await goAttr('s09'); await wait();
  await chip('C'); await setInput('b-out', '70');
  await page.evaluate(() => { const c = document.getElementById('b-onlyempty'); if (c) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); } });  /* C 行已 done，取消仅填充未完成以测覆盖 */
  await clickVisibleText('应用到所选孔位'); await wait(400);
  const db4 = await dbJSON();
  const bP = db4 && db4.wells.B1 ? db4.wells.B1.purity : -1;
  const cP = db4 && db4.wells.C1 ? db4.wells.C1.purity : -1;
  const aP = db4 && db4.wells.A1 ? db4.wells.A1.purity : -1;
  rec('S-08', '连续批量不串行', aP === 80 && bP === 90 && cP === 70, 'A1=' + aP + '% B1=' + bP + '% C1=' + cP + '%');

  /* J: s07↔s08 来回快速切换×5，返回栈一致 */
  await backN(1); await wait();            // s08→s07（apply 已自动回 s08）
  for (let i = 0; i < 5; i++) { await goAttr('s08'); await wait(60); await backN(1, 60); }
  await wait(200);
  const jScreen = await visScreen();
  // 连续返回直到 s02，统计次数（应有限，不死循环）
  let backs = 0; while (backs < 12 && (await visScreen()) !== 's02') { await backN(1); backs++; await wait(60); }
  rec('S-09', 's07↔s08快速来回×5后返回', jScreen === 's07' && backs <= 6, '终屏=' + jScreen + ' 回到s02需' + backs + '次返回');

  /* K: 快速修改已存在数据 + reload 校验 */
  await goAttr('s07') /* s02→EXP卡? no: goAttr s07 not present on s02 */; await wait(100);
  await page.evaluate(() => document.querySelector('.exp-card') && document.querySelector('.exp-card').click()); await wait();
  await goAttr('s08'); await wait(); await tapWell('B3'); await wait();
  await clickId('w-edit'); await wait(200);
  await setInput('we-out', '88.8');
  await clickId('we-save'); await wait(150);
  await page.reload({ waitUntil: 'load' }); await wait(700);
  const db5 = await dbJSON();
  const b3 = db5 && db5.wells.B3;
  rec('S-10', '快速改数据+reload持久化', b3 && b3.done && b3.purity === 88.8, 'B3.purity=' + (b3 ? b3.purity : 'null'));
  rec('S-11', '全程无页面JS异常', pageErrors.length === 0, pageErrors.join(' | ') || 'clean');

  fs.writeFileSync(path.join(OUT, 'qa_runStress.json'), JSON.stringify({ log, pageErrors }, null, 2), 'utf8');
  console.log('--- STRESS DONE');
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
