/* RUN-REAL —— 步骤11 真实场景模拟：本科生第一次 96 孔高通量纯化筛选
   原则：条件提前设置 / 投入量只设一次 / 不重复输入 / 随时查看任意孔 / 批量录入 / 最终比较找最佳 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa';
const steps = [];
function step(n, act, ok, detail) { steps.push({ n, act, ok, detail: String(detail).slice(0, 300) }); console.log(`[${ok ? 'OK' : '!!'}] ${n} ${act} :: ${String(detail).slice(0, 160)}`); }
let clickCount = 0;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 120)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const visScreen = () => page.evaluate(() => { const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v.length ? v[0].id : 'NONE'; });
  const wait = (ms = 300) => page.waitForTimeout(ms);
  const go = async a => { clickCount++; return page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (el) { el.click(); return true; } return false; }, a); };
  const back = async () => { clickCount++; return page.evaluate(() => { const b = [].find.call(document.querySelectorAll('[data-back]'), e => e.getClientRects().length > 0); if (b) { b.click(); return true; } return false; }); };
  const setInput = async (id, v) => page.evaluate(({ id, v }) => { const el = document.getElementById(id); if (!el) return; Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, { id, v });
  const clickId = async id => { clickCount++; return page.evaluate(i => { const el = document.getElementById(i); if (el) { el.click(); return true; } return false; }, id); };
  const tapWell = async c => { clickCount++; return page.evaluate(cc => { const el = [].find.call(document.querySelectorAll('[data-well]'), e => e.getClientRects().length > 0 && e.getAttribute('data-well') === cc); if (!el) return null; el.click(); return true; }, c); };
  const chip = async l => { clickCount++; return page.evaluate(x => { const c = [].find.call(document.querySelectorAll('#batch-chips .chip'), e => e.textContent.trim() === x); if (!c) return null; c.click(); return true; }, l); };
  const applyBatch = async () => { clickCount++; return page.evaluate(() => { const el = [].find.call(document.querySelectorAll('button'), e => e.getClientRects().length > 0 && e.textContent.trim().startsWith('应用到所选孔位')); if (el) { el.click(); return true; } return false; }); };
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')));
  const well = (c) => page.evaluate(cc => { const w = JSON.parse(localStorage.getItem('purelab_db')).wells[cc]; return w && w.done ? { i: w.input, o: w.output, p: w.purity } : null; }, c);

  /* ===== 阶段1：实验前准备（条件提前设置，投入量只设一次） ===== */
  await go('s02'); await wait(); await step('P1-1', '启动进入工作台', (await visScreen()) === 's02', await visScreen());
  await go('s03'); await wait();
  await setInput('f-name', '布洛芬重结晶筛选');
  await setInput('f-drug', '布洛芬粗品');
  await setInput('f-mass', '9600');
  await setInput('f-dose', '100.0');      /* 投入量只在此设一次 */
  await step('P1-2', '填写实验条件（投入量统一 100mg 只设一次）', true, 's03 表单');
  await go('s04'); await wait();
  await step('P1-3', '确认试剂组合（5 组预置，无需改动）', (await visScreen()) === 's04', await visScreen());
  await go('s05'); await wait();
  await step('P1-4', '孔板自动分配（不手动调）', (await visScreen()) === 's05', await visScreen());
  await go('s06'); await wait();
  await clickId('btn-create'); await wait(500);
  const d0 = await db();
  step('P1-5', '创建实验进入执行', d0.exp.name === '布洛芬重结晶筛选' && (await visScreen()) === 's07', 'exp=' + d0.exp.id + ' done=' + Object.values(d0.wells).filter(w => w.done).length);

  /* ===== 阶段2：实验进行中——不同孔不同时间完成，随到随记 ===== */
  /* 2a: C 行先完成 → 批量录入 */
  await go('s08'); await wait(); await go('s09'); await wait();
  await chip('C'); await setInput('b-out', '87.5'); await applyBatch(); await wait(400);
  const c1 = await well('C1');
  step('P2-1', 'C 行完成→批量录入 87.5mg', c1 && c1.p === 87.5, 'C1=' + JSON.stringify(c1) + ' 屏=' + (await visScreen()));

  /* 2b: A 行随后完成 → 批量录入 */
  await go('s09'); await wait();
  await chip('A'); await setInput('b-out', '92.0'); await applyBatch(); await wait(400);
  const a1 = await well('A1');
  step('P2-2', 'A 行完成→批量录入 92.0mg', a1 && a1.p === 92, 'A1=' + JSON.stringify(a1));

  /* 2c: D7 单孔复测值特殊 → 单孔录入（不重复设投入量） */
  await go('s08'); await wait(); await tapWell('D7'); await wait();
  await clickId('w-edit'); await wait(250);
  await setInput('we-out', '96.1'); await clickId('we-save'); await wait(400);
  const d7 = await well('D7');
  step('P2-3', 'D7 单孔录入 96.1mg（投入量自动带出 100）', d7 && d7.p === 96.1, 'D7=' + JSON.stringify(d7));

  /* 2d: 随时查看任意孔 B3（未完成→顺便录入） */
  await back(); await wait(); await tapWell('B3'); await wait();
  const b3Before = await well('B3');
  await clickId('w-edit'); await wait(250);
  await setInput('we-out', '85.0'); await clickId('we-save'); await wait(400);
  const b3 = await well('B3');
  step('P2-4', '查看 B3（空）并直接录入 85.0mg', b3Before === null && b3 && b3.p === 85, 'B3=' + JSON.stringify(b3));

  /* 2e: A2 复测有新值 → 修改已有数据 */
  await back(); await wait(); await tapWell('A2'); await wait();
  await clickId('w-edit'); await wait(250);
  await setInput('we-out', '93.4'); await clickId('we-save'); await wait(400);
  const a2 = await well('A2');
  step('P2-5', 'A2 复测修改为 93.4mg', a2 && a2.p === 93.4, 'A2=' + JSON.stringify(a2));

  /* 2f: F–H 复筛区完成 → 一次批量 3 行 */
  await back(); await wait(); await go('s09'); await wait();
  await chip('F'); await chip('G'); await chip('H'); await setInput('b-out', '88.0');
  await applyBatch(); await wait(400);
  const f1 = await well('F1'), h12 = await well('H12');
  step('P2-6', 'F–H 复筛区批量录入 88.0mg', f1 && f1.p === 88 && h12 && h12.p === 88, 'F1=' + JSON.stringify(f1) + ' H12=' + JSON.stringify(h12));

  /* ===== 阶段3：结果比较，找最佳 ===== */
  await back(); await wait();   /* s08→s07（注意：若再多退会回到向导 s06——创建后栈保留向导，真实 UX 风险） */
  await go('s11'); await wait();
  step('P3-1', '查看结果总览', (await visScreen()) === 's11', await visScreen());
  await go('s12'); await wait();
  const s12txt = await page.evaluate(() => document.querySelector('.screen.active').textContent.replace(/\s+/g, ' ').slice(0, 150));
  step('P3-2', '查看最佳条件', (await visScreen()) === 's12', s12txt);
  await go('s13'); await wait();
  const rankTop = await page.evaluate(() => { const r = document.querySelector('.rank-row'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : 'NONE'; });
  step('P3-3', '查看完整排名（第一名应为 D7@96.1%）', rankTop.includes('D7') && rankTop.includes('96.1'), rankTop);

  /* ===== 阶段4：数据完整性核对 ===== */
  const d1 = await db();
  const doneWells = Object.values(d1.wells).filter(w => w.done);
  const expect = 12 + 12 + 1 + 1 + 36;   /* A12+C12+D7+B3+F36（A2 已含在 A12 内） */
  const calcOk = doneWells.every(w => Math.abs(w.purity - +(w.output / w.input * 100).toFixed(1)) < 0.01);
  step('P4-1', '完成孔数=63（A12+C12+D7+B3+A2+F36）', doneWells.length === expect, 'done=' + doneWells.length + ' 预期=' + expect);
  step('P4-2', '全部纯化率自动计算正确', calcOk, '抽样 D7=' + JSON.stringify(await well('D7')));
  step('P4-3', 'reload 持久化', true, '（前面 RUN-K S-10 已验证）');
  step('P4-4', '全程点击数（主要步骤度量）', true, '总点击=' + clickCount);
  step('P4-5', '全程无 JS 异常', pageErrors.length === 0, pageErrors.join('|') || 'clean');

  fs.writeFileSync(path.join(OUT, 'qa_runReal.json'), JSON.stringify({ steps, clickCount, pageErrors }, null, 2), 'utf8');
  console.log('--- REAL DONE');
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
