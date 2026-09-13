// rev_shots.js — 视觉评审截图：全屏走查 v43 当前渲染状态
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=43', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const shot = async (name) => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: `qa/rev/${name}.png` });
    console.log('SHOT', name);
  };
  // 走屏（复用 app 内 go()，保证 nav/active 状态正确）
  const nav = async (id) => { await page.evaluate((s) => go(s), id); };

  // ---- 若首页无进行中实验，先走一遍建实验流程造数据 ----
  const hasExp = await page.evaluate(() => (document.querySelector('#home-ongoing .exp-card') !== null));
  if (!hasExp) {
    await nav('s03'); await page.click('#s03 .cta-line');
    await page.waitForTimeout(200);
    await page.click('#combo-next');               // s04 下一步
    await page.waitForTimeout(200);
    await page.click('#assign-step');              // s05 下一步
    await page.waitForTimeout(200);
    await page.click('#btn-create');               // s06 创建
    await page.waitForTimeout(400);
    console.log('SEEDED new experiment');
  } else { console.log('EXISTING experiment found'); }

  // ---- 全屏走查 ----
  await nav('s02'); await shot('01_s02_home');
  await nav('s03'); await shot('02_s03_new');
  await nav('s04'); await shot('03_s04_cond');
  await nav('s05'); await shot('04_s05_assign');
  await nav('s06'); await shot('05_s06_confirm');
  await nav('s07'); await shot('06_s07_detail');
  await nav('s08'); await shot('07_s08_plate');
  await nav('s09'); await shot('08_s09_batch');
  await nav('s10'); await shot('09_s10_welldetail');
  await nav('s11'); await shot('10_s11_results');
  await nav('s12'); await shot('11_s12_best');
  await nav('s13'); await shot('12_s13_rank');
  // sheet 玻璃弹层证据：s13 导出
  await page.click('#btn-export').catch(() => {});
  await shot('13_sheet_export');
  await page.evaluate(() => closeSheet && closeSheet()).catch(() => {});
  await nav('s14'); await shot('14_s14_reagents');
  await nav('s15'); await shot('15_s15_profile');

  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
