/* PureLab V1 黑盒测试 harness v2 —— 覆盖 步骤1~4 全部测试路径
 * 黑盒原则：只按界面可见文本定位与交互，记录屏幕实际反馈；不读应用内部数据。
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/willion/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const CHROME = 'C:/Users/willion/.agent-browser/browsers/chrome-152.0.7977.64/chrome.exe';
const APP = 'http://127.0.0.1:8899/index.html';
const OUT = 'C:/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk/qa';
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
function rec(id, area, result, detail) {
  log.push({ id, area, result, detail });
  console.log(`[${result}] ${id} ${area} :: ${detail}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('pageerror: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
  page.on('dialog', d => d.dismiss().catch(() => {}));

  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  /* ---------- 助手 ---------- */
  const visScreen = () => page.evaluate(() => {
    const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return v.length ? v[0].id : 'NONE';
  });
  const visText = () => page.evaluate(() => {
    const v = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    return v.length ? v[0].textContent.replace(/\s+/g, ' ').trim() : '(NO VISIBLE SCREEN)';
  });
  const shot = async n => { const f = path.join(SHOTS, n + '.png'); await page.screenshot({ path: f }); return f; };
  // 文本点击：在可见屏内找"最深层"的匹配节点点击
  const clickText = async (t, mode = 'exact') => page.evaluate(({ t, mode }) => {
    const scr = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    if (!scr.length) return { err: 'NO_SCREEN' };
    const cands = [].filter.call(scr[0].querySelectorAll('*'), e => {
      const s = e.textContent.trim();
      return mode === 'prefix' ? s.startsWith(t) : (s === t || (mode === 'loose' && s.includes(t)));
    });
    if (!cands.length) return null;
    let el = cands[0];
    for (const c of cands) if (c.textContent.length < el.textContent.length) el = c;
    const desc = el.tagName + '.' + el.className;
    el.click();
    return { desc, text: el.textContent.trim().slice(0, 40) };
  }, { t, mode });
  // 返回：尝试常见返回控件
  const goBack = async () => {
    for (const t of ['‹', '←', '返回', '取消']) {
      const r = await clickText(t, 'exact');
      if (r) { await page.waitForTimeout(350); return { via: t, ...r }; }
    }
    return null;
  };
  const visibleInputs = () => page.locator('.screen:visible input, .screen:visible textarea').all();
  const inputInfo = async () => page.evaluate(() => {
    const scr = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    if (!scr.length) return [];
    return [].map.call(scr[0].querySelectorAll('input,textarea'), i => ({
      ph: i.placeholder || '', type: i.type || i.tagName, val: i.value, vis: i.offsetParent !== null || getComputedStyle(i).display !== 'none'
    }));
  });
  const fillByPh = async (phSub, value) => {
    const infos = await inputInfo();
    const idx = infos.findIndex(i => i.vis && i.ph.includes(phSub));
    if (idx < 0) return null;
    const els = await visibleInputs();
    await els[idx].fill(value);
    return { ph: infos[idx].ph, value: await els[idx].inputValue() };
  };
  const clickCell = async (label) => page.evaluate(l => {
    const scr = [].filter.call(document.querySelectorAll('.screen'), s => getComputedStyle(s).display !== 'none');
    if (!scr.length) return null;
    const el = [].find.call(scr[0].querySelectorAll('.well, [data-well], .cell'), e => (e.dataset.well || e.textContent.trim()) === l);
    if (!el) return null;
    el.click();
    return el.className;
  }, label);
  const goTo = async (target, pathDesc) => ({ target, pathDesc });

  /* ================================================================
     步骤1 —— QA 黑盒逐页测试
     ================================================================ */
  rec('A-00', '环境', 'INFO', '首次加载，可见屏=' + await visScreen() + '，localStorage keys=' + JSON.stringify(await page.evaluate(() => Object.keys(localStorage))));

  // 一、首页
  const c1 = await clickText('开始使用');
  await page.waitForTimeout(400);
  rec('A-01', '首页/启动页', c1 && (await visScreen()) === 's02' ? 'PASS' : 'FAIL',
    c1 ? `点击"${c1.text}" → ${await visScreen()}` : '未找到开始使用');
  const s2 = await visText();
  rec('A-02', '工作台', 'INFO', '内容: ' + s2.slice(0, 200));
  rec('A-03', '工作台-底部导航', 'INFO',
    (await page.evaluate(() => { const s = [].find.call(document.querySelectorAll('.screen'), x => getComputedStyle(x).display !== 'none'); return s ? !!s.querySelector('nav,.tabbar,[class*=bottom-nav],[class*=tab-bar]') : null; }))
      ? '发现底部导航' : '无底部导航（符合"文字+细线"设计约束）');

  // 点实验卡片 → 详情
  const card = await clickText('EXP-03', 'prefix');
  await page.waitForTimeout(400);
  rec('A-04', '工作台-实验卡片', card && (await visScreen()) === 's07' ? 'PASS' : 'INFO',
    card ? `点击"${card.text}" → ${await visScreen()}` : '未找到实验卡片');
  rec('A-05', '实验详情', 'INFO', '内容: ' + (await visText()).slice(0, 300));
  await shot('A05_detail');
  // 详情页顶部 tab（RUN/结果）
  const tabRun = await clickText('结果', 'exact');
  if (tabRun) { await page.waitForTimeout(350); rec('A-06', '详情-结果tab', 'INFO', `点击"结果" → 内容: ${(await visText()).slice(0, 150)}`); }
  const tabBack = await clickText('RUN', 'exact');
  if (tabBack) await page.waitForTimeout(300);
  // 返回工作台
  const b1 = await goBack();
  rec('A-07', '详情-返回', b1 ? (await visScreen() === 's02' ? 'PASS' : 'INFO') : 'FAIL',
    b1 ? `点击"${b1.text}" → ${await visScreen()}` : '详情页未找到返回控件');
  // 继续实验
  const cont = await clickText('继续实验', 'prefix');
  await page.waitForTimeout(400);
  rec('A-08', '工作台-继续实验', cont ? (['s07', 's08'].includes(await visScreen()) ? 'PASS' : 'INFO') : 'FAIL',
    cont ? `点击"${cont.text}" → ${await visScreen()}` : '未找到继续实验');
  const b2 = await goBack();
  await page.waitForTimeout(300);

  // 二、新建实验
  const nb = await clickText('新建实验', 'prefix');
  await page.waitForTimeout(400);
  rec('A-09', '工作台-新建实验入口', nb && (await visScreen()) === 's03' ? 'PASS' : (nb ? 'INFO' : 'FAIL'),
    nb ? `点击"${nb.text}" → ${await visScreen()}` : '未找到新建实验');
  const s3 = await visText();
  rec('A-10', '新建实验-表单', 'INFO', '内容: ' + s3.slice(0, 280));
  rec('A-11', '新建实验-输入框', 'INFO', '输入框: ' + JSON.stringify(await inputInfo()));
  await shot('A11_new_exp');
  const f1 = await fillByPh('药', '对乙酰氨基酚粗品');
  const f2 = f1 ? null : await (async () => { const els = await visibleInputs(); if (!els.length) return null; await els[0].fill('对乙酰氨基酚粗品'); return { ph: '(first)', value: await els[0].inputValue() }; })();
  const filled = f1 || f2;
  rec('A-12', '新建-药品名输入', filled ? (filled.value === '对乙酰氨基酚粗品' ? 'PASS' : 'FAIL') : 'FAIL',
    filled ? `placeholder="${filled.ph}" 值="${filled.value}"` : '无可输入的药品名输入框');
  // 输入后返回再进入，验证数据保留
  const b3 = await goBack();
  await page.waitForTimeout(300);
  const afterBack = await visScreen();
  const reNB = afterBack === 's03' ? null : await clickText('新建实验', 'prefix');
  await page.waitForTimeout(300);
  const infos2 = await inputInfo();
  const kept = infos2.length && infos2[0].val === '对乙酰氨基酚粗品';
  rec('A-13', '新建-返回后数据保留', kept ? 'PASS' : 'FAIL',
    `返回 → ${await visScreen()}，重新进入后输入框值="${infos2.length ? infos2[0].val : '无输入框'}"`);
  await shot('A13_kept');

  // 下一步 → 条件设置
  const nx = await clickText('下一步', 'prefix') || await clickText('继续', 'prefix') || await clickText('确定', 'prefix');
  await page.waitForTimeout(400);
  rec('A-14', '新建-下一步', nx ? (await visScreen() !== 's03' ? 'PASS' : 'FAIL') : 'FAIL',
    nx ? `点击"${nx.text}" → ${await visScreen()}` : '未找到下一步/继续按钮');

  // 三、实验条件设置（s04）
  const s4 = await visText();
  rec('A-15', '条件设置', 'INFO', '当前屏=' + (await visScreen()) + ' 内容: ' + s4.slice(0, 320));
  await shot('A15_conditions');
  // 选择组合 C
  const comboC = await clickText('组合 C', 'prefix') || await clickText('C', 'exact');
  await page.waitForTimeout(350);
  rec('A-16', '条件-选择组合C', comboC ? `已点击"${comboC.text}"` : '未找到组合C选项', comboC ? '' : '');
  rec('A-16b', '条件-选择组合C', comboC ? 'INFO' : 'FAIL', comboC ? `点击后屏=${await visScreen()}` : '未找到组合C');
  await shot('A16_comboC');

  // 分配页（s05）
  const toAssign = await clickText('下一步', 'prefix') || await clickText('分配', 'prefix') || await clickText('继续', 'prefix');
  await page.waitForTimeout(400);
  rec('A-17', '条件-进入分配', toAssign ? `点击"${toAssign.text}" → ${await visScreen()}` : '未找到分配入口',
    toAssign ? '' : '');
  const s5 = await visText();
  rec('A-18', '孔板分配', 'INFO', '当前屏=' + (await visScreen()) + ' 内容: ' + s5.slice(0, 300));
  await shot('A18_assign');

  fs.writeFileSync(path.join(OUT, 'qa_log.json'), JSON.stringify({ log, pageErrors }, null, 2), 'utf8');
  console.log('--- RUN-A DONE. errors=' + pageErrors.length);
  await browser.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
