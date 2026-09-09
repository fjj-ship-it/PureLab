/* v34 smoke: well photo upload (gallery) */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8899/purelab-apk/app/assets/www/index.html?v=34', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('purelab_db'));
  await page.reload({ waitUntil: 'networkidle' });
  const log = (k, v) => console.log(String(v).padEnd(6), k);
  // make a test photo
  const fs = require('fs');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAF0lEQVR4nGP8z8Dwn4EIwESMolGFI0chAG+bAR12QNRhAAAAAElFTkSuQmCC', 'base64');
  fs.writeFileSync('test_photo.png', png);
  // enter s10
  await page.evaluate(() => { go('s02'); go('s07'); DB.selWell = 'A1'; go('s10'); });
  await page.waitForTimeout(300);
  // P1 add button exists
  const hasAdd = await page.evaluate(() => !!document.getElementById('w-photo-in'));
  log('P1 add-photo input exists', hasAdd ? 'PASS' : 'FAIL');
  // P2 upload
  await page.setInputFiles('#w-photo-in', 'test_photo.png');
  await page.waitForTimeout(700);
  const r2 = await page.evaluate(() => {
    const w = DB.wells['A1'];
    return { n: (w.photos || []).length, tiles: document.querySelectorAll('#w-photos .ph-tile').length, dataUrl: (w.photos || [])[0] ? w.photos[0].startsWith('data:image/jpeg') : false };
  });
  log(`P2 photo stored (${r2.n}, tile=${r2.tiles}, jpeg=${r2.dataUrl})`, (r2.n === 1 && r2.tiles === 1 && r2.dataUrl) ? 'PASS' : 'FAIL');
  // P3 persisted to localStorage
  const r3 = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('purelab_db'));
    const exp = db.exps[db.curExp];
    const w = exp.wells['A1'];
    return !!(w && w.photos && w.photos.length === 1);
  });
  log('P3 persisted in localStorage', r3 ? 'PASS' : 'FAIL');
  // P4 viewer opens on tile click
  await page.evaluate(() => document.querySelector('#w-photos .ph-tile img').click());
  await page.waitForTimeout(250);
  const r4 = await page.evaluate(() => !!document.querySelector('.photo-viewer'));
  log('P4 photo viewer opens', r4 ? 'PASS' : 'FAIL');
  await page.evaluate(() => document.querySelector('.photo-viewer').click());
  await page.waitForTimeout(150);
  // P5 delete
  await page.evaluate(() => document.querySelector('#w-photos [data-phdel]').click());
  await page.waitForTimeout(400);
  const r5 = await page.evaluate(() => (DB.wells['A1'].photos || []).length);
  log('P5 photo deleted (' + r5 + ')', r5 === 0 ? 'PASS' : 'FAIL');
  // P6 cap at 4: add 4 then expect add button gone
  await page.setInputFiles('#w-photo-in', ['test_photo.png', 'test_photo.png', 'test_photo.png', 'test_photo.png']);
  await page.waitForTimeout(900);
  const r6 = await page.evaluate(() => ({ n: (DB.wells['A1'].photos || []).length, add: !!document.getElementById('w-photo-in') }));
  log(`P6 cap 4 (${r6.n}, addBtn=${r6.add})`, (r6.n === 4 && !r6.add) ? 'PASS' : 'FAIL');
  log('P7 pageErrors=' + errs.length, errs.length === 0 ? 'PASS' : 'FAIL ' + errs.join('|'));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
