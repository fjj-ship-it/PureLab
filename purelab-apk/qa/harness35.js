/* v32 smoke: launch screen 1:1 restore */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=32', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('purelab_db'));
  await page.reload({ waitUntil: 'networkidle' });
  const log = (k, v) => console.log(String(v).padEnd(6), k);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const img = document.querySelector('.launch-art-img');
    const brand = document.querySelector('.launch-brand'), sub = document.querySelector('.launch-sub'), scr = document.querySelector('.launch-script');
    const ir = img.getBoundingClientRect(), br = brand.getBoundingClientRect();
    return {
      imgLoaded: img.complete && img.naturalWidth > 0, nat: img.naturalWidth + 'x' + img.naturalHeight,
      ratioOk: Math.abs((img.naturalWidth / img.naturalHeight) - (ir.width / ir.height)) < 0.02,
      brand: brand.textContent, sub: sub.textContent, script: scr.textContent.includes('discover the best.'),
      serif: getComputedStyle(brand).fontFamily.includes('Georgia'),
      brandBelowImg: br.top > ir.bottom - 30,
      s01active: document.getElementById('s01').classList.contains('active')
    };
  });
  log('L1 launch img loaded (' + r.nat + ')', r.imgLoaded ? 'PASS' : 'FAIL');
  log('L2 img aspect preserved', r.ratioOk ? 'PASS' : 'FAIL');
  log('L3 texts (brand/sub/script)', (r.brand === 'PureLab' && r.sub === '高通量纯化实验助手' && r.script) ? 'PASS' : 'FAIL');
  log('L4 serif brand font', r.serif ? 'PASS' : 'FAIL');
  log('L5 brand below illustration', r.brandBelowImg ? 'PASS' : 'FAIL');
  await page.screenshot({ path: 'launch_preview.png' });
  // L6 tap skip -> s02, back stack is ['s02']
  await page.evaluate(() => document.getElementById('launch-tap').click());
  await page.waitForTimeout(600);
  const r2 = await page.evaluate(() => ({ onS02: document.getElementById('s02').classList.contains('active'), stackLen: stack.length }));
  log('L6 tap skip -> s02 (stack=' + r2.stackLen + ')', (r2.onS02 && r2.stackLen === 1) ? 'PASS' : 'FAIL');
  // L7 auto-advance: reload, wait 3.2s without tap
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3400);
  const r3 = await page.evaluate(() => document.getElementById('s02').classList.contains('active'));
  log('L7 auto-advance 2.6s -> s02', r3 ? 'PASS' : 'FAIL');
  log('L8 pageErrors=' + errs.length, errs.length === 0 ? 'PASS' : 'FAIL ' + errs.join('|'));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
