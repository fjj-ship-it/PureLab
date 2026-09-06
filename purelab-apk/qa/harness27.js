/* harness27 — v23 问候语时段切换 + 液态玻璃按钮
   G1-G4 问候语按小时切换（mock 时间）
   B1-B3 液态玻璃按钮样式与跳转
   E1 pageErrors = 0 */
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=24&t=' + Date.now();
let pass = 0, fail = 0; const pageErrors = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('[PASS] ' + name + (extra ? ' :: ' + extra : '')); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}
async function goHome(page) {
  await page.goto(URL); await page.waitForTimeout(900);
  await page.evaluate(() => { if (!document.getElementById('s02').classList.contains('active')) go('s02'); });
  await page.waitForTimeout(400);
}
async function mockHour(page, h) {
  await page.evaluate(hr => {
    const RealDate = Date;
    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) { super(); super.setHours(hr, 0, 0, 0); } else { super(...args); }
      }
    }
    window.Date = MockDate;
    renderHome();
  }, h);
  await page.waitForTimeout(200);
}
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  page.on('pageerror', e => pageErrors.push(String(e)));
  await goHome(page);

  /* G1-G4 时段问候 */
  for (const [h, expect] of [[8, 'Good morning'], [10, 'Good morning'], [14, 'Good afternoon'], [21, 'Good evening'], [3, 'Good evening']]) {
    await mockHour(page, h);
    const g = await page.evaluate(() => document.getElementById('greet-en').textContent);
    ok('G ' + h + ':00 → ' + expect, g === expect, g);
  }

  /* B1 按钮存在且为液态玻璃类 */
  const b = await page.evaluate(() => {
    const el = document.querySelector('#s02 .cta-glass');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { text: el.textContent.trim(), bf: cs.backdropFilter || cs.webkitBackdropFilter,
      radius: cs.borderRadius, blurPx: (cs.backdropFilter || '').match(/blur\((\d+)px/) ? RegExp.$1 : null };
  });
  ok('B1 新建实验按钮用 cta-glass', !!b, b && b.text);
  ok('B2 液态玻璃：backdrop blur 生效', b && b.blurPx && +b.blurPx >= 10, b && ('blur=' + b.blurPx + 'px radius=' + b.radius));
  ok('B2b 胶囊圆角 999px', b && b.radius === '999px', b && b.radius);

  /* B3 点击跳转 s03 */
  await page.evaluate(() => { document.querySelector('#s02 .cta-glass').click(); });
  await page.waitForTimeout(400);
  ok('B3 点击跳转 s03', await page.evaluate(() => document.getElementById('s03').classList.contains('active')));

  ok('E1 pageErrors = 0', pageErrors.length === 0, pageErrors.join(' | '));
  console.log('==== ' + pass + '/' + (pass + fail) + ' PASS · pageErrors=' + pageErrors.length + ' ====');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
