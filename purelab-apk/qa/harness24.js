/* RUN-24 —— 实验删除（进行中/归档）+ 轮播多实验扩展性 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html';
const log = [];
function rec(id, name, ok, detail) { log.push({ id, name, ok }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name} :: ${String(detail).slice(0, 200)}`); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  await page.goto(APP, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(400);
  const wait = (ms = 300) => page.waitForTimeout(ms);
  const vis = () => page.evaluate(() => { const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none'); return v[0].id; });
  const go = async a => page.evaluate(a => { const el = [].find.call(document.querySelectorAll('[data-go="' + a + '"]'), e => e.getClientRects().length > 0); if (el) { el.click(); return true; } return false; }, a);
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('purelab_db')));

  await go('s02'); await wait(500);

  /* D1 每张进行中卡片都有删除按钮 */
  const d1 = await page.evaluate(() => {
    const cs = [].map.call(document.querySelectorAll('#exp-carousel .exp-card'), c => ({
      id: c.getAttribute('data-expid'), del: !!c.querySelector('[data-delexp]') }));
    return cs;
  });
  rec('D1', '3 张卡片均带删除按钮', d1.length === 3 && d1.every(c => c.del), JSON.stringify(d1.map(c => c.id)));

  /* D2 删除非激活实验 EXP-01（最右侧）：确认弹层 → 池中移除，不跳页 */
  await page.evaluate(() => document.querySelector('#exp-carousel [data-delexp="EXP-01"]').click()); await wait(300);
  const sheetVis = await page.evaluate(() => document.getElementById('sheet').classList.contains('show'));
  await page.evaluate(() => document.getElementById('delexp-go').click()); await wait(400);
  const d2 = await db();
  rec('D2', '删除非激活实验：弹层确认后移除', sheetVis && !d2.exps['EXP-01'] && Object.keys(d2.exps).length === 2 && (await vis()) === 's02',
    'sheet=' + sheetVis + ' keys=' + Object.keys(d2.exps).join(','));

  /* D3 删除激活实验 EXP-03：curExp 自动切到剩余最新 */
  await page.evaluate(() => document.querySelector('#exp-carousel [data-delexp="EXP-03"]').click()); await wait(300);
  await page.evaluate(() => document.getElementById('delexp-go').click()); await wait(400);
  const d3 = await db();
  const first = await page.evaluate(() => {
    const el = document.getElementById('exp-carousel');
    return { id: el.children[0].getAttribute('data-expid'), go: el.children[0].hasAttribute('data-go') };
  });
  rec('D3', '删除激活实验：curExp 切到 EXP-02 且排首位', d3.curExp === 'EXP-02' && first.id === 'EXP-02' && first.go,
    'curExp=' + d3.curExp + ' first=' + JSON.stringify(first));

  /* D4 删光 → 空池状态，无崩溃，新建页可正常打开 */
  await page.evaluate(() => document.querySelector('#exp-carousel [data-delexp="EXP-02"]').click()); await wait(300);
  await page.evaluate(() => document.getElementById('delexp-go').click()); await wait(400);
  const d4 = await db();
  const emptyHint = await page.evaluate(() => document.getElementById('home-ongoing').textContent);
  await go('s03'); await wait(300);
  const nameVal = await page.evaluate(() => document.getElementById('f-name').value);
  await page.evaluate(() => { [].find.call(document.querySelectorAll('#s03 [data-back]'), e => e.getClientRects().length > 0).click(); }); await wait();
  rec('D4', '删光后空池提示，新建页默认名不崩溃（v43 默认名=实验1）', Object.keys(d4.exps).length === 0 && /暂无进行中实验/.test(emptyHint) && /^实验1$/.test(nameVal),
    'keys=' + Object.keys(d4.exps).length + ' hint="' + emptyHint.slice(0, 20) + '" name="' + nameVal + '"');

  /* D5 归档删除：ARC-1 移除、ARC-2 保留；再删光显示空提示 */
  const d5a = await page.evaluate(() => {
    document.querySelector('[data-delarch="ARC-1"]').click();
    return document.getElementById('sheet').classList.contains('show');
  }); await wait(200);
  await page.evaluate(() => document.getElementById('delarch-go').click()); await wait(600);
  const d5 = await db();
  await page.evaluate(() => document.querySelector('[data-delarch="ARC-2"]').click()); await wait(200);
  await page.evaluate(() => document.getElementById('delarch-go').click()); await wait(600);
  const archEmpty = await page.evaluate(() => document.getElementById('home-archive').textContent);
  rec('D5', '归档删除：逐个移除并可清空', d5a && d5.archives.length === 1 && d5.archives[0].id === 'ARC-2' && /暂无归档实验/.test(archEmpty),
    'sheet=' + d5a + ' left=' + JSON.stringify(d5.archives));

  /* D6 大量实验（12 个）：轮播渲染、初始居中、跳转+磁吸正常 */
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('purelab_db'));
    const exps = {};
    for (let i = 1; i <= 12; i++) {
      const id = 'EXP-' + String(i).padStart(2, '0');
      exps[id] = { id, name: '体系' + i, plate: '96孔板 · 进行中', drug: '样品' + i,
        totalMass: 1000 * i, dose: 50 + i, comboCount: 2, wells: window.demoWells(0.08 + i * 0.02), ops: {}, created: '2026.09.0' + (i % 9 + 1) };
    }
    base.exps = exps; base.curExp = 'EXP-05';
    localStorage.setItem('purelab_db', JSON.stringify(base));
  });
  await page.reload({ waitUntil: 'load' }); await wait(400);
  await go('s02'); await wait(600);
  const d6 = await page.evaluate(() => {
    const el = document.getElementById('exp-carousel');
    const first = el.children[0];
    const r = el.getBoundingClientRect(), fr = first.getBoundingClientRect();
    el.scrollLeft = 3 * 280; el.dispatchEvent(new Event('scroll'));
    return { n: el.children.length, firstId: first.getAttribute('data-expid'),
      off: Math.round(fr.left + fr.width / 2 - r.left - r.width / 2) };
  });
  await wait(1000);
  const d6b = await page.evaluate(() => {
    const el = document.getElementById('exp-carousel');
    const cards = [].slice.call(el.children);
    let target = null;
    cards.forEach(c => { const rr = c.getBoundingClientRect(); if (Math.abs(rr.left + rr.width / 2 - el.getBoundingClientRect().left - el.getBoundingClientRect().width / 2) < 10) target = c; });
    const side = cards[0].getBoundingClientRect();
    return { centered: target ? target.getAttribute('data-expid') : '无',
      firstOpacity: parseFloat(cards[0].style.opacity || '1') };
  });
  rec('D6', '12 个实验：渲染 12 卡、激活 EXP-05 居中', d6.n === 12 && d6.firstId === 'EXP-05' && Math.abs(d6.off) < 8,
    'n=' + d6.n + ' first=' + d6.firstId + ' off=' + d6.off);
  rec('D6b', '12 卡跳转+磁吸：滚动后 EXP-10 居中、远端卡淡出', d6b.centered === 'EXP-10' && d6b.firstOpacity < 0.7,
    JSON.stringify(d6b));

  /* 汇总 */
  const pass = log.filter(l => l.ok).length;
  console.log(`\n==== ${pass}/${log.length} PASS · pageErrors=${pageErrors.length} ====`);
  if (pageErrors.length) console.log(pageErrors.join('\n'));
  await browser.close();
  process.exit(pass === log.length && !pageErrors.length ? 0 : 1);
})();
