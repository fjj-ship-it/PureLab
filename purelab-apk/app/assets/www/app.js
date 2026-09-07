/* ============================================================
   PureLab 高通量重结晶实验助手 — 15 屏 SPA
   数据模型：Experiment → Variable/Level → Condition(组合A–E)
             → Well(8×12) → Observation/Result → Selected/Template/Lineage
   硬约束：96 孔板唯一组件（状态参数驱动）；C7 永远是 C7；
           CTA 仅文字+细线；无 Bottom Tab。
   ============================================================ */
'use strict';

/* ---------------- 令牌 ---------------- */
var COMBOS = [
  { id: 'A', name: '组合A', recipe: '乙醇 : 水 = 3 : 1',        color: '#C1BEB5' },
  { id: 'B', name: '组合B', recipe: '甲醇 : 水 = 3 : 1',        color: '#9CA296' },
  { id: 'C', name: '组合C', recipe: '丙酮 : 水 = 3 : 1',        color: '#C0A381' },
  { id: 'D', name: '组合D', recipe: '乙醇 : 丙酮 : 水 = 2 : 1 : 1', color: '#536253' },
  { id: 'E', name: '组合E', recipe: '异丙醇 : 水 = 1 : 1',      color: '#2F3A31' }
];
var REFETCH = { F: 'A', G: 'B', H: 'C' };          /* F–H 复筛区，重复 A–C 体系 */
var ROWS = ['A','B','C','D','E','F','G','H'];
var BASE  = { A: 86.8, B: 87.5, C: 88.2, D: 87.9, E: 84.5 };  /* 各组合基准回收率 */
var RANKED = { C7: 94.2, D4: 93.1, C3: 92.8, B6: 91.5, A2: 90.4 }; /* 排名五强（固定） */
var BEST_WELL = 'C7';

/* ---------------- 数据单一源 ---------------- */
function rowCombo(row) {
  return ROWS.indexOf(row) < 5 ? row : REFETCH[row];
}
function jitter(i) { return ((i * 37 + 11) % 29) / 29 * 2.2; }

function buildWells() {
  var empty = {};
  for (var i = 1; i <= 96; i++) if (i % 3 === 0) empty[i] = 1;
  delete empty[18]; delete empty[27];   /* B6、C3 必须有数据 */
  empty[19] = 1; empty[28] = 1;         /* 补足 32 个未录入孔 → 完成 64/96 */
  var wells = {};
  ROWS.forEach(function (row, r) {
    for (var c = 1; c <= 12; c++) {
      var coord = row + c, i = r * 12 + c;
      var w = { coord: coord, row: row, col: c, combo: rowCombo(row), done: !empty[i] };
      if (w.done) {
        var p = RANKED[coord] != null ? RANKED[coord]
              : Math.min(90.0, +(BASE[rowCombo(row)] + jitter(i)).toFixed(1));
        w.input = 100.0; w.output = +p.toFixed(1); w.purity = +p.toFixed(1);
      }
      wells[coord] = w;
    }
  });
  return wells;
}

/* 演示孔板：frac 为完成比例（0~1），确定性伪随机分布 */
function demoWells(frac) {
  var wells = {};
  ROWS.forEach(function (row, r) {
    for (var c = 1; c <= 12; c++) {
      var coord = row + c, i = r * 12 + c;
      var done = (i % 10) < Math.round(frac * 10);
      var w = { coord: coord, row: row, col: c, combo: rowCombo(row), done: done };
      if (done) {
        var p = Math.min(90.0, +(BASE[rowCombo(row)] + jitter(i)).toFixed(1));
        w.input = 100.0; w.output = +p.toFixed(1); w.purity = +p.toFixed(1);
        w.assay = +Math.max(80, p - 0.6 - (i % 4) * 0.9).toFixed(1);   /* 演示纯度：HPLC 实测略低于回收率 */
      }
      wells[coord] = w;
    }
  });
  return wells;
}

function freshDB() {
  function dstr(offsetDays) {
    var d = new Date(Date.now() - offsetDays * 86400000), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }
  var exp3 = { id: 'EXP-03', name: '重结晶纯化筛选', plate: '96孔板 · 进行中',
    drug: '粗品样品 A', totalMass: 9600, dose: 100.0, comboCount: 5,
    wells: buildWells(), created: dstr(6),
    ops: {
      C7: [
        { t: dstr(2) + ' 10:15', d: '修改产出量 92.2 → 94.2 mg' },
        { t: dstr(0) + ' 14:32', d: '批量录入产出量 94.2 mg' }
      ]
    } };
  var exp2 = { id: 'EXP-02', name: '手性拆分初筛', plate: '96孔板 · 进行中',
    drug: '粗品样品 B', totalMass: 4800, dose: 80.0, comboCount: 3,
    wells: demoWells(0.5), ops: {}, created: dstr(3) };
  var exp1 = { id: 'EXP-01', name: '溶剂体系摸索', plate: '96孔板 · 进行中',
    drug: '粗品样品 C', totalMass: 3200, dose: 60.0, comboCount: 2,
    wells: demoWells(0.2), ops: {}, created: dstr(1) };
  return {
    exps: { 'EXP-01': exp1, 'EXP-02': exp2, 'EXP-03': exp3 },   /* 多实验：进行中实验池 */
    curExp: 'EXP-03',                                            /* 当前激活实验 id */
    selected: {},                                  /* 已收藏条件 {组合id: true} */
    customCombos: [],                              /* 自定义组合（F–H） */
    deletedCombos: [],
    wizard: { sel: {}, assign: null },
    reagents: [
      { name: '乙醇', en: 'EtOH',     cas: '64-17-5' },
      { name: '甲醇', en: 'MeOH',     cas: '67-56-1' },
      { name: '丙酮', en: 'Acetone',  cas: '67-64-1' },
      { name: '水',   en: 'H₂O',      cas: '7732-18-5' },
      { name: '异丙醇', en: 'IPA',    cas: '67-63-0' }
    ]
  };
}

/* 迁移与激活链接：DB.exp/DB.wells/DB.ops 始终指向 exps[curExp]（旧单实验数据自动并入） */
function normalizeDB() {
  if (!DB.exps) {                                 /* 仅旧格式（无 exps 字段）才迁移；空池合法 */
    var base = DB.exp || { id: 'EXP-03', name: '重结晶纯化筛选', plate: '96孔板 · 进行中',
      drug: '粗品样品 A', totalMass: 9600, dose: 100.0, comboCount: 5 };
    DB.exps = {};
    DB.exps[base.id] = Object.assign({}, base, { wells: DB.wells || buildWells(), ops: DB.ops || {} });
    DB.curExp = base.id;
  }
  var ids = Object.keys(DB.exps);
  if (ids.length) {
    if (!DB.curExp || !DB.exps[DB.curExp]) DB.curExp = ids.sort().pop();
    var e = DB.exps[DB.curExp];
    DB.exp = e; DB.wells = e.wells; DB.ops = e.ops || (e.ops = {});
  } else {                                        /* 全部删除后：空池 */
    DB.curExp = null; DB.exp = null; DB.wells = {}; DB.ops = {};
  }
  if (!DB.selected) DB.selected = {};
  if (!DB.customCombos) DB.customCombos = [];
  if (!DB.deletedCombos) DB.deletedCombos = [];
  if (!DB.wizard) DB.wizard = { sel: {}, assign: null };
  if (!DB.archives) DB.archives = [               /* 归档实验（可删除，点击行可看详情） */
    { id: 'ARC-1', name: '溶解度粗测', sub: '96孔板 · 2024.06 · 已完成', best: '92.1%',
      detail: { expId: 'EXP-01', drug: '粗品样品 A', totalMass: 9600, dose: 100, n: 96, avg: 88.4, bestCoord: 'C07', bestCombo: '组合 B', bestRecipe: 'EA : MeOH = 1 : 2', combos: 5, created: '2024.06.02' } },
    { id: 'ARC-2', name: '溶剂体系预筛', sub: '48孔板 · 2024.05 · 已完成', best: '90.8%',
      detail: { expId: 'EXP-02', drug: '粗品样品 B', totalMass: 4800, dose: 50, n: 48, avg: 87.2, bestCoord: 'E03', bestCombo: '组合 C', bestRecipe: 'IPA : Water = 7 : 3', combos: 3, created: '2024.05.18' } }
  ];
}

var DB;
try { DB = JSON.parse(localStorage.getItem('purelab_db')) || freshDB(); }
catch (e) { DB = freshDB(); }
normalizeDB();
function save() { try { localStorage.setItem('purelab_db', JSON.stringify(DB)); } catch (e) {} }

/* ---------------- 工具 ---------------- */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* v28 动效工具：删除定向滑出（08）+ 数字滚动 */
function playLeave(el, done) {
  if (!el) { done(); return; }
  el.style.maxHeight = el.scrollHeight + 'px';
  void el.offsetHeight;                       /* 强制回流，让 max-height 过渡生效 */
  el.style.transform = '';                    /* 清掉轮播内联 transform，让 .leaving 生效 */
  el.classList.add('leaving');
  setTimeout(done, 340);
}
function countUp(el, target, dec, suffix) {
  if (!el) return;
  var from = parseFloat(el.textContent.replace(/[^\d.\-]/g, '')) || 0;
  if (target == null || isNaN(target) || Math.abs(from - target) < 0.05) {
    el.textContent = target != null ? target.toFixed(dec) + (suffix || '') : '—';
    return;
  }
  var t0 = performance.now(), dur = 550;
  function step(t) {
    var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = (from + (target - from) * e).toFixed(dec) + (suffix || '');
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function comboOf(id) {
  if (id == null) return { id: '', name: '未分配', recipe: '—', color: '#C1BEB5' };  /* 未分配列 */
  for (var i = 0; i < COMBOS.length; i++) if (COMBOS[i].id === id) return COMBOS[i];
  var cs = DB.customCombos || [];
  for (var j = 0; j < cs.length; j++) if (cs[j].id === id) return cs[j];
  return { id: id, name: '组合' + id, recipe: '—', color: '#C1BEB5' };  /* 兜底：已删除组合的旧孔位仍可渲染 */
}
function completedWells() {
  return Object.keys(DB.wells).map(function (k) { return DB.wells[k]; })
    .filter(function (w) { return w.done; });
}
function stats() {
  var arr = completedWells(), n = arr.length;
  var best = null, sum = 0;
  arr.forEach(function (w) { sum += w.purity; if (!best || w.purity > best.purity) best = w; });
  return { n: n, best: best || { coord: '—', combo: 'A', purity: 0, input: 0, output: 0, done: false }, avg: n ? sum / n : 0 };
}
/* 全新实验孔板：按逐孔分配表落组合，未分配孔 combo 为空（不可录入），统一投入量 */
function freshEmptyWells(dose, wellAssign) {
  var wells = {};
  ROWS.forEach(function (row) {
    for (var c = 1; c <= 12; c++) {
      var coord = row + c;
      wells[coord] = { coord: coord, row: row, col: c, combo: (wellAssign && wellAssign[coord]) || null, done: false, input: dose };
    }
  });
  return wells;
}
function comboAvg(cid) {
  var s = 0, n = 0;
  completedWells().forEach(function (w) { if (w.combo === cid) { s += w.purity; n++; } });
  return n ? s / n : 0;
}
/* 当前最佳孔位（动态，随数据变化） */
function bestCoord() {
  var b = stats().best;
  return b ? b.coord : null;
}

/* ---------------- Toast / Sheet ---------------- */
var toastTimer = null;
function toast(msg) {
  var t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1900);
}
function openSheet(title, html) {
  $('sheet-title').textContent = title;
  $('sheet-body').innerHTML = html;
  $('sheet').classList.add('show'); $('sheet-mask').classList.add('show');
}
function closeSheet() {
  $('sheet').classList.remove('show'); $('sheet-mask').classList.remove('show');
}
$('sheet-mask').addEventListener('click', closeSheet);

/* ---------------- 路由（页面栈，供安卓返回键使用） ---------------- */
var stack = ['s01'];
function show(id) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  $(id).classList.add('active');
  var r = { s02: renderHome, s03: renderNew, s04: renderCombos, s05: renderAssign, s06: renderConfirm,
            s07: renderRun, s08: renderRecord, s09: renderBatch, s10: renderWell,
            s11: renderResults, s12: renderBest, s13: renderRank,
            s14: renderReagents, s15: renderProfile, s16: renderExpOverview };
  if (r[id]) r[id]();
  navigatingBack = false;
  window.scrollTo(0, 0);
}
function go(id) { if (stack[stack.length - 1] !== id) { stack.push(id); show(id); } }
var navigatingBack = false;                /* 返回时不重置向导选择 */
function back() {
  if (stack.length > 1) { stack.pop(); navigatingBack = true; show(stack[stack.length - 1]); return true; }
  return false;
}
window.PureLab = { onBack: back };        /* Android 返回键桥 */
document.body.addEventListener('click', function (e) {
  var g = e.target.closest('[data-go]');
  if (g) { go(g.getAttribute('data-go')); return; }
  if (e.target.closest('[data-back]')) back();
});

/* ============================================================
   96 孔板组件（全项目唯一）：
   renderPlate(el, mode, opts)  mode: 'mini' | 'full'
   状态由数据参数驱动：empty / done / sel / best
   ============================================================ */
function renderPlate(el, mode, opts) {
  opts = opts || {};
  el.innerHTML = '';
  var p = document.createElement('div');
  p.className = 'plate' + (mode === 'mini' ? ' mini' : '');
  p.appendChild(Object.assign(document.createElement('div'), { className: 'plabel' }));
  for (var c = 1; c <= 12; c++) {
    var pc = document.createElement('div'); pc.className = 'pcol'; pc.textContent = c; p.appendChild(pc);
  }
  var selWell = DB.selWell || bestCoord() || 'C7';
  var bc = bestCoord();
  ROWS.forEach(function (row) {
    var rl = document.createElement('div'); rl.className = 'plabel'; rl.textContent = row; p.appendChild(rl);
    for (var c = 1; c <= 12; c++) {
      var w = DB.wells[row + c];
      var d = document.createElement('div');
      d.className = 'well'; d.setAttribute('data-well', w.coord);
      if (!w.done) d.classList.add('empty');
      else {
        var cm = comboOf(w.combo);
        d.style.background = cm.color;
        if (w.combo === 'E') d.style.background = 'rgba(47,58,49,.82)';
        if (w.combo === 'D') d.style.background = 'rgba(83,98,83,.8)';
      }
      if (opts.assign) {                        /* 分配模式：已分配孔=组合色实心，未分配=空形状；当前组合高亮 */
        var aid = opts.assign[w.coord];
        if (aid) {
          var am = comboOf(aid);
          d.classList.remove('empty');
          d.style.background = am.color;
          d.style.border = 'none';
          if (opts.assignCur && aid === opts.assignCur) d.classList.add('sel');
        } else {
          d.classList.add('empty');
          d.style.background = 'transparent';
          d.style.border = '';
        }
      }
      if (w.coord === selWell && mode === 'full') d.classList.add('sel');
      if (opts.selSet && opts.selSet[w.coord]) d.classList.add('sel');
      if (w.coord === bc && w.done && mode === 'full') d.classList.add('best');
      if (opts.tap) d.addEventListener('click', function () { opts.tap(this.getAttribute('data-well')); });
      p.appendChild(d);
    }
  });
  el.appendChild(p);
}
function legendHTML(ids, repeatFrom) {
  var list = ids || expCombos();
  var h = list.map(function (id) {
    var c = comboOf(id);
    return '<span class="lg"><i style="background:' + c.color + '"></i>' + c.name + ' · ' + esc(c.recipe) + '</span>';
  }).join('');
  if (repeatFrom != null && repeatFrom < ROWS.length)
    h += '<span class="lg"><i style="background:' + comboOf(list[0]).color + ';opacity:.45"></i>重复填入区（复筛）</span>';
  h += '<span class="lg"><i style="border:1px dashed var(--line);background:transparent"></i>未录入</span>';
  return h;
}

/* ============================================================
   各屏渲染
   ============================================================ */

/* 02 首页 */
var LEAF_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none">' +
  '<path d="M12 21c0-6 2-11 9-14-1 7-4 12-9 14z" fill="#536253"/>' +
  '<path d="M12 21C8 16 5 13 3 7c6 1 9 6 9 14z" fill="#2F3A31"/></svg>';
function expStats(e) {
  var n = 0, best = 0;
  Object.keys(e.wells).forEach(function (k) {
    var w = e.wells[k];
    if (w.done) { n++; if (w.purity > best) best = w.purity; }
  });
  return { n: n, pct: n / 96 * 100, best: best };
}
function renderHome() {
  normalizeDB();
  /* 问候语随时间切换：5-12 morning / 12-18 afternoon / 其余 evening */
  var hr = new Date().getHours();
  var greet = hr < 5 ? 'Good evening' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  var ge = $('greet-en'); if (ge) ge.textContent = greet;
  var ids = Object.keys(DB.exps).sort().reverse();           /* 最新实验在最前 */
  if (DB.curExp && ids.indexOf(DB.curExp) > -1) {
    ids.splice(ids.indexOf(DB.curExp), 1); ids.unshift(DB.curExp);   /* 激活实验恒排首位 */
  }
  if (!ids.length) {
    $('home-ongoing').innerHTML = '<p class="hint" style="margin:6px 2px 14px">暂无进行中实验 · 点击下方「新建实验」开始</p>';
  } else {
    var cards = ids.map(function (id) {
      var e = DB.exps[id], s = expStats(e), cur = id === DB.curExp;
      return '<div class="card exp-card dark' + (cur ? ' cur' : '') + '" data-expid="' + id + '"' + (cur ? ' data-go="s07"' : '') + '>' +
        '<div class="row1"><span class="exp-id">' + esc(e.id) + '</span>' +
        '<span class="exp-name">' + esc(e.name) + '</span>' +
        '<span class="tag run">进行中</span>' +
        '<span class="exp-del" data-delexp="' + id + '">删除</span></div>' +
        '<div class="exp-meta"><span>96孔板</span><span><b>' + s.n + '</b>/96 孔已录入</span>' +
        '<span>当前最佳 <b>' + s.best.toFixed(1) + '%</b></span></div>' +
        '<div class="pbar"><i style="width:' + s.pct.toFixed(1) + '%"></i></div>' +
        '<div class="row-act"><span class="exp-best">进度 ' + s.pct.toFixed(1) + '%</span>' +
        '<span class="mini-act">' + (cur ? '继续实验 →' : '点击进入 →') + '</span></div>' +
      '</div>';
    });
    $('home-ongoing').innerHTML = '<div class="exp-carousel" id="exp-carousel">' + cards.join('') + '</div>';
    initCarousel();
  }
  $('home-archive').innerHTML = DB.archives.length ? DB.archives.map(function (a, i) {
    return '<div class="card arch-row stagger-item" data-archid="' + a.id + '" style="animation-delay:' + Math.min(i * 45, 400) + 'ms"><span class="arch-thumb">' + LEAF_SVG + '</span>' +
      '<div class="arch-name">' + esc(a.name) + '<div class="arch-sub">' + esc(a.sub) + '</div></div>' +
      '<span class="arch-best">最佳 ' + esc(a.best) + '</span>' +
      '<span class="arch-del" data-delarch="' + a.id + '">删除</span></div>';
  }).join('') : '<p class="hint" style="margin:6px 2px">暂无归档实验 · 在 s11 结果页「完成并归档」后自动收录</p>';
  $('home-archive').querySelectorAll('[data-delarch]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.stopPropagation(); askDeleteArch(el.getAttribute('data-delarch')); });
  });
  $('home-archive').querySelectorAll('[data-archid]').forEach(function (el) {
    el.addEventListener('click', function () { showArchDetail(el.getAttribute('data-archid')); });
  });
}
/* 删除进行中实验（确认弹层） */
function askDeleteExp(id) {
  var e = DB.exps[id]; if (!e) return;
  openSheet('删除实验', '<p>将删除 <b>' + esc(e.id) + ' ' + esc(e.name) + '</b> 及其全部孔位数据，删除后不可恢复。</p>' +
    '<div class="cta-row"><button class="cta-line" id="delexp-go">确认删除 <i>→</i></button></div>');
  $('delexp-go').onclick = function () {
    closeSheet();
    leaveThenDeleteExp(id);
  };
}
/* 删除归档实验（确认弹层） */
function askDeleteArch(id) {
  var a = null;
  DB.archives.forEach(function (x) { if (x.id === id) a = x; });
  if (!a) return;
  openSheet('删除归档', '<p>将删除归档实验 <b>' + esc(a.name) + '</b>，删除后不可恢复。</p>' +
    '<div class="cta-row"><button class="cta-line" id="delarch-go">确认删除 <i>→</i></button></div>');
  $('delarch-go').onclick = function () {
    closeSheet();
    leaveThenDeleteArch(id);
  };
}
/* 归档详情（点击归档行查看） */
function showArchDetail(id) {
  var a = null;
  DB.archives.forEach(function (x) { if (x.id === id) a = x; });
  if (!a) return;
  var d = a.detail || {};
  function row(k, v) { return '<div class="arch-d-row"><span>' + k + '</span><b>' + esc(v) + '</b></div>'; }
  var body = '<div class="arch-detail">' +
    row('来源实验', d.expId || '—') +
    row('待纯化药品', d.drug || '—') +
    row('孔板规格', (a.sub || '').split(' · ')[0] || '96孔板') +
    row('完成日期', d.created || (a.sub || '').split(' · ')[1] || '—') +
    row('已录入孔位', d.n != null ? d.n + ' / 96' : '—') +
    row('平均回收率', d.avg != null ? d.avg.toFixed(1) + '%' : '—') +
    row('最佳回收率', esc(a.best)) +
    row('最佳孔位', d.bestCoord || '—') +
    row('最佳条件', d.bestCombo || '—') +
    (d.bestRecipe && d.bestRecipe !== '—' ? row('组合配方', d.bestRecipe) : '') +
    row('条件组合数', d.combos != null ? d.combos + ' 个' : '—') +
    '</div>';
  openSheet(esc(a.name), body);
}
/* 完成实验并归档（s11 结果页发起 → 移入首页归档列表） */
function askArchiveExp() {
  if (!DB.exp) { toast('当前没有进行中的实验'); return; }
  var st = stats();
  openSheet('完成实验并归档', '<p>将 <b>' + esc(DB.exp.id) + ' ' + esc(DB.exp.name) + '</b> 移入归档列表，归档后可在首页点击查看详情。</p>' +
    '<div class="cta-row"><button class="cta-line" id="arch-go">确认归档 <i>→</i></button></div>');
  $('arch-go').onclick = function () {
    var mx = 0;
    DB.archives.forEach(function (x) { var m = /^ARC-(\d+)$/.exec(x.id); if (m) mx = Math.max(mx, +m[1]); });
    var d = new Date(), pd = function (x) { return (x < 10 ? '0' : '') + x; };
    var date = d.getFullYear() + '.' + pd(d.getMonth() + 1) + '.' + pd(d.getDate());
    var done = DB.exp.name;
    var bwC = comboOf(st.best.combo);
    DB.archives.unshift({
      id: 'ARC-' + (mx + 1), name: done, sub: '96孔板 · ' + date + ' · 已完成',
      best: st.best.purity.toFixed(1) + '%',
      detail: { expId: DB.exp.id, drug: DB.exp.drug, totalMass: DB.exp.totalMass, dose: DB.exp.dose,
        n: st.n, avg: st.avg, bestCoord: st.best.coord, bestCombo: bwC.name, bestRecipe: bwC.recipe,
        combos: DB.exp.comboCount, created: date }
    });
    delete DB.exps[DB.exp.id];
    DB.curExp = Object.keys(DB.exps).sort().reverse()[0] || null;
    normalizeDB(); save(); closeSheet();
    go('s02'); toast('「' + done + '」已归档');
  };
}
/* 删除：先定向滑出（08），动画结束后真正移除 */
function leaveThenDeleteExp(id) {
  playLeave(document.querySelector('.exp-card[data-expid="' + id + '"], .exp-ov-row[data-pickexp="' + id + '"]'), function () {
    delete DB.exps[id];
    if (DB.curExp === id) DB.curExp = Object.keys(DB.exps).sort().reverse()[0] || null;
    normalizeDB(); save();
    renderHome();
    var ov = document.getElementById('expov-page');
    if (ov && document.getElementById('s16').classList.contains('active')) renderExpOverview();
    toast('已删除 ' + id);
  });
}
function leaveThenDeleteArch(id) {
  playLeave(document.querySelector('.arch-row[data-archid="' + id + '"]'), function () {
    DB.archives = DB.archives.filter(function (x) { return x.id !== id; });
    save();
    renderHome();
    var ov = document.getElementById('expov-page');
    if (ov && document.getElementById('s16').classList.contains('active')) renderExpOverview();
    toast('已删除归档');
  });
}
/* 进行中实验轮播：横向拖拽/滚轮 + 惯性 + 居中磁吸 + 距中心动态缩放/透明度/位移 */
function initCarousel() {
  var el = $('exp-carousel'); if (!el) return;
  var cards = [].slice.call(el.children);
  function midX() { var r = el.getBoundingClientRect(); return r.left + r.width / 2; }
  function centerOf(c) { return c.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft + c.offsetWidth / 2; }
  function layout() {
    var mid = midX(), max = el.clientWidth * 0.55 || 1;
    cards.forEach(function (c) {
      var r = c.getBoundingClientRect();
      var a = Math.min(1, Math.abs(r.left + r.width / 2 - mid) / max);
      c.style.transform = 'translateY(' + (a * 14).toFixed(1) + 'px) scale(' + (1 - 0.14 * a).toFixed(3) + ')';
      c.style.opacity = (1 - 0.45 * a).toFixed(3);
      c.style.zIndex = String(30 - Math.round(a * 10));   /* 最高 30，须低于弹层遮罩 z-40 */
    });
  }
  function layoutSoon() { requestAnimationFrame(layout); }
  function nearest() {
    var mid = midX(), best = null, bd = 1e9;
    cards.forEach(function (c) {
      var d = Math.abs(centerOf(c) - (el.scrollLeft + el.clientWidth / 2));
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  }
  function snapTo(c) { if (c) el.scrollTo({ left: centerOf(c) - el.clientWidth / 2, behavior: 'smooth' }); }
  function snap() { snapTo(nearest()); }
  /* 滚轮：纵向滚动量转横向 */
  el.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); cancelAnimationFrame(raf); el.scrollLeft += e.deltaY; armIdleSnap(); }
  }, { passive: false });
  /* 拖拽 + 惯性 */
  var down = false, moved = false, sx = 0, sl = 0, vel = 0, lastX = 0, lastT = 0, raf = null, idleT = null;
  function onMove(e) {
    if (!down) return;
    var dx = e.clientX - sx;
    if (Math.abs(dx) > 4) moved = true;
    el.scrollLeft = sl - dx;
    var now = Date.now(), dt = now - lastT;
    if (dt > 0) { vel = 0.8 * vel + 0.2 * ((e.clientX - lastX) / dt); lastX = e.clientX; lastT = now; }
  }
  function glide() {
    vel *= 0.94;
    if (Math.abs(vel) < 0.02) { raf = null; snap(); return; }
    el.scrollLeft -= vel * 16;
    raf = requestAnimationFrame(glide);
  }
  function onUp() {
    if (!down) return;
    down = false;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    setTimeout(function () { moved = false; }, 0);   /* 拖拽的连带 click 被抑制后立即复位 */
    if (moved && Math.abs(vel) > 0.05) raf = requestAnimationFrame(glide);
    else snap();
  }
  el.addEventListener('pointerdown', function (e) {
    down = true; moved = false; sx = e.clientX; sl = el.scrollLeft;
    lastX = e.clientX; lastT = Date.now(); vel = 0;
    cancelAnimationFrame(raf); raf = null;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
  function armIdleSnap() {
    clearTimeout(idleT);
    idleT = setTimeout(function () { if (!down && !raf) snap(); }, 150);
  }
  el.addEventListener('scroll', function () { layoutSoon(); armIdleSnap(); }, { passive: true });
  window.addEventListener('resize', layoutSoon);
  /* 删除与点击绑定：单卡也要生效（放在多卡交互逻辑之前） */
  cards.forEach(function (c) {
    var del = c.querySelector('[data-delexp]');
    if (del) del.addEventListener('click', function (e) {
      e.stopPropagation();                                    /* 不触发卡片居中/导航 */
      askDeleteExp(del.getAttribute('data-delexp'));
    });
    c.addEventListener('click', function (e) {
      if (moved) { e.stopPropagation(); moved = false; return; }
      var r0 = c.getBoundingClientRect();
      var centered = Math.abs(r0.left + r0.width / 2 - midX()) < c.offsetWidth * 0.3;
      if (!centered) { e.stopPropagation(); snapTo(c); return; }
      var id0 = c.getAttribute('data-expid');
      if (DB.curExp !== id0) {
        e.stopPropagation();
        DB.curExp = id0; normalizeDB(); save();
        renderHome(); go('s07');
      }
    });
  });
  if (cards.length < 2) { layoutSoon(); return; }
  /* 初始：当前实验居中（不可见时等可见后再做） */
  function initial() {
    if (!el.clientWidth) { requestAnimationFrame(initial); return; }
    requestAnimationFrame(function () {
      var target = cards.filter(function (c) { return c.getAttribute('data-expid') === DB.curExp; })[0] || cards[0];
      el.scrollLeft = centerOf(target) - el.clientWidth / 2;
      layout();
    });
  }
  initial();
}
document.body.addEventListener('click', function (e) {
  var t = e.target.closest('[data-toast]');
  if (t) toast(t.getAttribute('data-toast'));
});

/* 03 新建实验 */
/* s03 预计占用孔数量：总质量 ÷ 每孔投入量，实时联动 */
function updateOccupancy() {
  var el = $('f-occ'); if (!el) return;
  var mass = parseFloat($('f-mass').value), dose = parseFloat($('f-dose').value);
  el.style.color = '';
  if (!(mass > 0) || !(dose > 0)) { el.textContent = '— / 96 · 请输入质量与投入量'; return; }
  var need = Math.ceil(mass / dose);
  if (need > 96) { el.style.color = '#A2554A'; el.textContent = '超出容量 · 需 ' + need + ' 孔（板上限 96）'; return; }
  el.textContent = need + ' / 96 · 约 ' + Math.ceil(need / 12) + ' 行';
}
$('f-mass').addEventListener('input', updateOccupancy);
$('f-dose').addEventListener('input', updateOccupancy);

function renderNew() {
  var mx = 0;
  Object.keys(DB.exps).forEach(function (k) { var m = /^EXP-(\d+)$/.exec(k); if (m) mx = Math.max(mx, +m[1]); });
  var suffix = '-' + ('0' + (mx + 1)).slice(-2);
  $('f-name').value = (DB.exp && DB.exp.name) ? DB.exp.name + suffix : '重结晶纯化筛选' + suffix;
  $('f-mass').value = DB.exp ? DB.exp.totalMass : 9600;
  $('f-dose').value = DB.exp ? DB.exp.dose.toFixed(1) : '100.0';
  updateOccupancy();
}

/* 04 条件设置 */
function allCombos() {
  var list = COMBOS.filter(function (c) { return DB.deletedCombos.indexOf(c.id) < 0; })
    .concat(DB.customCombos || []);
  var ord = DB.comboOrder;                     /* 拖拽排序（编号按位置继承） */
  if (ord && ord.length) {
    list.sort(function (a, b) {
      var ia = ord.indexOf(a.id), ib = ord.indexOf(b.id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }
  return list;
}
/* 当前实验孔板实际用到的组合（按行序去重），供录入/结果/排名页使用 */
function expCombos() {
  var seen = {}, out = [];
  ROWS.forEach(function (row) {
    var w = DB.wells[row + '1'];
    var id = w ? w.combo : rowCombo(row);
    if (!id) return;                             /* 未分配行不计 */
    if (!seen[id]) { seen[id] = 1; out.push(id); }
  });
  return out;
}
/* 向导勾选 */
function selIds() {
  return allCombos().filter(function (c) { return DB.wizard.sel[c.id]; }).map(function (c) { return c.id; });
}
/* 所选组合按行落孔：每种组合占一整行（12 孔），未分配的行空置 */
function buildAssign(ids) {
  var m = {};
  ids.forEach(function (id, i) { if (i < ROWS.length) m[ROWS[i]] = id; });
  return m;
}
function renderCombos() {
  if (!navigatingBack) DB.wizard = { sel: {}, assign: null };  /* 每次进入向导默认全不选 */
  navigatingBack = false;
  renderComboList();
}
/* 纯重绘（勾选切换后调用，不重置状态） */
function renderComboList() {
  var list = allCombos();
  $('combo-count').textContent = list.length + ' 组 · 已选 ' + Object.keys(DB.wizard.sel).length;
  $('combo-list').innerHTML = list.length ? list.map(function (c, idx) {
    var on = !!DB.wizard.sel[c.id];
    var letter = String.fromCharCode(65 + idx);        /* 编号按位置：A、B、C… */
    return '<div class="card combo-card' + (on ? ' sel' : '') + '" data-cid="' + c.id + '">' +
      '<span class="combo-check' + (on ? ' on' : '') + '"></span>' +
      '<span class="combo-badge" style="background:' + c.color + '22;border:1px solid ' + c.color + '55">' + letter + '</span>' +
      '<div class="combo-main"><div class="combo-name">' + esc(c.name) + '</div>' +
      '<div class="combo-recipe">' + esc(c.recipe) + '</div></div>' +
      '<span class="combo-drag" title="拖动排序"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">' +
      '<circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/>' +
      '<circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/>' +
      '<circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg></span>' +
      '<span class="combo-act" data-detail="' + c.id + '">详情</span>' +
      '<span class="combo-act del" data-del="' + c.id + '">删除</span></div>';
  }).join('') : '<p class="hint" style="margin:6px 2px">列表为空：预置组合已全部删除，可点击「新建组合」创建 F–H。</p>';
  $('combo-list').querySelectorAll('.combo-card').forEach(function (el) {
    comboDrag(el, el.getAttribute('data-cid'));
    el.onclick = function (e) {
      if (e.target.closest('[data-del]')) { askDelete(el.getAttribute('data-cid')); return; }
      if (e.target.closest('[data-detail]')) { comboDetail(el.getAttribute('data-cid')); return; }
      if (e.target.closest('.combo-drag')) return;
      var id = el.getAttribute('data-cid');
      if (DB.wizard.sel[id]) delete DB.wizard.sel[id]; else DB.wizard.sel[id] = true;
      save(); renderComboList();
    };
  });
}
/* 拖拽排序：按住 ⠿ 上下滑动，其他卡片实时让位，松手落位（编号按新位置继承） */
function comboDrag(el, cid) {
  var handle = el.querySelector('.combo-drag');
  if (!handle) return;
  handle.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var startY = e.clientY;
    el.classList.add('dragging');
    function onMove(ev) {
      el.style.transform = 'translateY(' + (ev.clientY - startY) + 'px)';
      var r = el.getBoundingClientRect();
      var cy = r.top + r.height / 2;
      var TH = 14;                                   /* 越界阈值：防止边界抖动 */
      var sibs = Array.prototype.slice.call(el.parentNode.querySelectorAll('.combo-card'))
        .filter(function (x) { return x !== el; });
      for (var i = 0; i < sibs.length; i++) {
        var sr = sibs[i].getBoundingClientRect();
        var smid = sr.top + sr.height / 2;
        var elBefore = !!(sibs[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
        if (elBefore && cy > smid + TH) {            /* 下移越过：静态位下移，补偿偏移 */
          el.parentNode.insertBefore(el, sibs[i].nextSibling);
          startY += sr.height + 10;
          el.style.transform = 'translateY(' + (ev.clientY - startY) + 'px)';
          break;
        }
        if (!elBefore && cy < smid - TH) {           /* 上移越过：静态位上移，补偿偏移 */
          el.parentNode.insertBefore(el, sibs[i]);
          startY -= sr.height + 10;
          el.style.transform = 'translateY(' + (ev.clientY - startY) + 'px)';
          break;
        }
      }
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      el.classList.remove('dragging');
      el.style.transform = ''; el.style.zIndex = '';
      var newOrder = [].map.call(el.parentNode.querySelectorAll('.combo-card'), function (x) { return x.getAttribute('data-cid'); });
      var oldOrder = allCombos().map(function (c) { return c.id; });
      if (newOrder.join() !== oldOrder.join()) {
        DB.comboOrder = newOrder;
        save();
        toast('顺序已调整，编号按新位置继承');
      }
      renderComboList();
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
}
function askDelete(cid) {
  var c = comboOf(cid); if (!c) return;
  openSheet('删除组合',
    '<p>确定删除「' + esc(c.name) + '」？删除后它不再出现在条件设置列表中，本操作立即生效。</p>' +
    '<div class="cta-row"><button class="cta-line" id="dl-go">删除 <i>→</i></button></div>');
  $('dl-go').onclick = function () {
    var isPreset = false;
    COMBOS.forEach(function (x) { if (x.id === cid) isPreset = true; });
    if (isPreset) {
      if (DB.deletedCombos.indexOf(cid) < 0) DB.deletedCombos.push(cid);
    } else {
      DB.customCombos = (DB.customCombos || []).filter(function (x) { return x.id !== cid; });
    }
    delete DB.wizard.sel[cid];
    save(); closeSheet(); renderComboList();
    toast(c.name + ' 已删除');
  };
}
function comboDetail(cid) {
  var c = null, isCustom = true;
  allCombos().forEach(function (x) { if (x.id === cid) c = x; });
  if (!c) return;
  COMBOS.forEach(function (x) { if (x.id === cid) isCustom = false; });
  var pos = allCombos().indexOf(c);
  openSheet(c.name + ' · 配方详情',
    '<div class="form-card">' +
    kv('组合编号', pos > -1 ? String.fromCharCode(65 + pos) : c.id) + kv('试剂配比', esc(c.recipe)) +
    kv('来源', isCustom ? '本机自定义' : '预置组合') + '</div>' +
    '<div class="cta-row"><button class="cta-line" id="cd-del">删除此组合 <i>→</i></button></div>');
  $('cd-del').onclick = function () { closeSheet(); askDelete(cid); };
}
$('combo-add').addEventListener('click', function () {
  var custom = DB.customCombos || [];
  if (custom.length >= 3) { toast('自定义组合最多 3 个（F–H）'); return; }
  var nextId = String.fromCharCode(70 + custom.length);   /* F / G / H */
  var nextColor = ['#C0A381', '#9CA296', '#536253'][custom.length];
  var parts = [{ n: '', r: '' }, { n: '', r: '' }];       /* 模板组分：名称 + 份数 */
  var mode = 'tpl';
  openSheet('新建组合',
    '<div class="frow" style="padding:6px 0"><span class="flabel">组合名</span>' +
    '<input id="cg-name" value="组合' + nextId + '" style="text-align:right;font-weight:600"></div>' +
    '<div class="seg" id="cg-seg" style="margin:12px 0 2px">' +
    '<button class="seg-item active" data-m="tpl">模板填写</button>' +
    '<button class="seg-item" data-m="free">自由输入</button></div>' +
    '<div id="cg-body"></div>' +
    '<div class="cta-row"><button class="cta-line" id="cg-save">保存 <i>→</i></button></div>');
  function composed() {
    var names = parts.map(function (p) { return p.n.trim(); });
    var ratios = parts.map(function (p) { return p.r.trim(); });
    return { names: names, ratios: ratios, str: names.join(' : ') + ' = ' + ratios.join(' : ') };
  }
  function renderBody() {
    if (mode === 'tpl') {
      var rows = parts.map(function (p, i) {
        return '<div class="tpl-row">' +
          '<span class="tpl-lead">' + (i ? ':' : '') + '</span>' +
          '<span class="tpl-no">' + (i + 1) + '</span>' +
          '<input class="tpl-name" data-i="' + i + '" data-f="n" value="' + esc(p.n) + '" placeholder="试剂名">' +
          '<span class="tpl-rwrap"><input class="tpl-ratio" data-i="' + i + '" data-f="r" inputmode="decimal" value="' + esc(p.r) + '" placeholder="0"><i class="tpl-unit">份</i></span>' +
          (parts.length > 2 ? '<button class="tpl-x" data-x="' + i + '" title="移除">×</button>' : '') +
        '</div>';
      }).join('');
      $('cg-body').innerHTML =
        '<div class="tpl-rows">' + rows + '</div>' +
        '<div class="tpl-eq"><span class="tpl-lead">=</span><span id="cg-preview"></span></div>' +
        (parts.length < 3 ? '<button class="text-act" id="cg-addpart">＋ 加一种试剂</button>' : '');
      $('cg-body').querySelectorAll('.tpl-row input').forEach(function (inp) {
        inp.addEventListener('input', function () {
          parts[+inp.getAttribute('data-i')][inp.getAttribute('data-f')] = inp.value;
          tplPreview();
        });
      });
      $('cg-body').querySelectorAll('.tpl-x').forEach(function (b) {
        b.onclick = function () { parts.splice(+b.getAttribute('data-x'), 1); renderBody(); };
      });
      var addBtn = $('cg-addpart');
      if (addBtn) addBtn.onclick = function () { parts.push({ n: '', r: '' }); renderBody(); };
      tplPreview();
    } else {
      var c = composed(), prefill = '';
      if (c.names.every(String) && c.ratios.every(String)) prefill = c.str;
      $('cg-body').innerHTML =
        '<div class="frow" style="padding:6px 0"><span class="flabel">试剂配比</span>' +
        '<input id="cg-recipe" value="' + esc(prefill) + '" placeholder="如 乙醇 : 乙酸乙酯 = 1 : 2" style="text-align:right;font-weight:600"></div>';
    }
  }
  function tplPreview() {
    var c = composed();
    var full = c.names.every(String) && c.ratios.every(String);
    $('cg-preview').innerHTML = full
      ? '<span class="tpl-pv-str">' + esc(c.str) + '</span>'
      : '<span class="tpl-pv-void">配比预览（填写后自动生成）</span>';
  }
  $('cg-seg').querySelectorAll('.seg-item').forEach(function (b) {
    b.addEventListener('click', function () {
      $('cg-seg').querySelectorAll('.seg-item').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active'); mode = b.getAttribute('data-m'); renderBody();
    });
  });
  renderBody();
  setTimeout(function () { var f = $('cg-name'); if (f) f.focus(); }, 250);
  $('cg-save').onclick = function () {
    var nm = $('cg-name').value.trim();
    if (!nm) { toast('请填写组合名'); return; }
    var rc;
    if (mode === 'tpl') {
      var ok = parts.every(function (p) { return p.n.trim() && p.r.trim() && parseFloat(p.r) > 0; });
      if (!ok) { toast('请完整填写模板：每种试剂的名称和份数（份数需大于 0）'); return; }
      rc = composed().str;
    } else {
      rc = $('cg-recipe').value.trim();
      if (!rc) { toast('请填写试剂配比'); return; }
    }
    DB.customCombos = DB.customCombos || [];
    DB.customCombos.push({ id: nextId, name: nm, recipe: rc, color: nextColor });
    save(); closeSheet(); renderComboList();
    toast(nm + ' 已保存，记得勾选使用');
  };
});
/* 下一步门禁：至少勾选 1 个组合（保留手动分配，仅清掉已取消勾选组合的孔位） */
$('combo-next').addEventListener('click', function () {
  var sel = selIds();
  if (!sel.length) { toast('请先勾选至少 1 个试剂组合'); return; }
  var keep = {};
  Object.keys(DB.wizard.assign || {}).forEach(function (k) {
    if (sel.indexOf(DB.wizard.assign[k]) > -1) keep[k] = DB.wizard.assign[k];
  });
  DB.wizard.assign = keep;
  save(); go('s05');
});

/* 05 孔板分配：默认自动分配（每种组合占满一行 12 孔），可切手动逐孔自定义 */
function countCombo(cid) {
  var n = 0;
  Object.keys(DB.wizard.assign).forEach(function (k) { if (DB.wizard.assign[k] === cid) n++; });
  return n;
}
function autoFillRows() {
  var sel = selIds(), m = {};
  sel.forEach(function (id, i) {
    if (i < ROWS.length) for (var c = 1; c <= 12; c++) m[ROWS[i] + c] = id;
  });
  return m;
}
function renderAssign() {
  var sel = selIds();
  if (!sel.length) { back(); toast('请先勾选至少 1 个试剂组合'); return; }
  if (!DB.wizard.amode) DB.wizard.amode = 'auto';
  var auto = DB.wizard.amode === 'auto';
  if (auto) { DB.wizard.assign = autoFillRows(); save(); }   /* 自动模式：按行铺满 */
  if (!DB.wizard.assign) DB.wizard.assign = {};
  if (DB.wizard.cur == null || DB.wizard.cur >= sel.length) DB.wizard.cur = 0;
  var cur = DB.wizard.cur, cid = sel[cur], cm = comboOf(cid);
  renderPlate($('plate-config'), 'mini', {
    assign: DB.wizard.assign, assignCur: auto ? null : cid,
    tap: auto
      ? function () { toast('自动分配按行落孔 · 点「手动选孔」可自定义'); }
      : function (coord) {
          var owner = DB.wizard.assign[coord];
          if (owner === cid) delete DB.wizard.assign[coord];
          else if (owner) { toast('该孔位已分配给 ' + comboOf(owner).name); return; }
          else DB.wizard.assign[coord] = cid;
          save(); renderAssign();
        }
  });
  var seg = '<div class="seg" style="margin:0 0 10px">' +
    '<button class="seg-item' + (auto ? ' active' : '') + '" id="am-auto">自动分配</button>' +
    '<button class="seg-item' + (auto ? '' : ' active') + '" id="am-manual">手动选孔</button></div>';
  var head;
  if (auto) {
    head = '<div class="card assign-head">' +
      '<span class="combo-badge" style="background:var(--ink);color:var(--bg)">A</span>' +
      '<div class="combo-main"><div class="combo-name">自动分配 · 每种组合占满一行</div>' +
      '<div class="combo-recipe">' + sel.length + ' 种组合 × 12 孔 = ' + sel.length * 12 + ' 孔</div></div></div>';
  } else {
    var nav = '<span class="assign-pos">' + (cur + 1) + ' / ' + sel.length + '</span>';
    if (cur > 0) nav += '<button class="text-act" id="assign-prev">‹ 上一组合</button>';
    if (cur < sel.length - 1) nav += '<button class="text-act" id="assign-next">下一组合 ›</button>';
    else nav += '<span class="text-act off">已是最后一个 ›</span>';
    head = '<div class="card assign-head">' +
        '<span class="combo-badge" style="background:' + cm.color + '22;border:1px solid ' + cm.color + '55">' + String.fromCharCode(65 + cur) + '</span>' +
        '<div class="combo-main"><div class="combo-name">正在分配 · ' + cm.name + '</div>' +
        '<div class="combo-recipe">' + esc(cm.recipe) + '</div></div>' +
        '<span class="assign-count">' + countCombo(cid) + ' 孔</span>' +
      '</div>' +
      '<div class="op-row" style="justify-content:space-between">' + nav + '</div>';
  }
  $('assign-cur').innerHTML = seg + head;
  $('am-auto').onclick = function () { if (DB.wizard.amode !== 'auto') { DB.wizard.amode = 'auto'; save(); renderAssign(); } };
  $('am-manual').onclick = function () { if (DB.wizard.amode !== 'manual') { DB.wizard.amode = 'manual'; DB.wizard.cur = 0; save(); renderAssign(); } };
  if (!auto) {
    if (cur > 0) $('assign-prev').onclick = function () { DB.wizard.cur--; save(); renderAssign(); window.scrollTo(0, 0); };
    if (cur < sel.length - 1) $('assign-next').onclick = function () { DB.wizard.cur++; save(); renderAssign(); window.scrollTo(0, 0); };
  }
  $('legend-config').innerHTML = sel.map(function (id) {
    var c = comboOf(id);
    return '<span class="lg"><i style="background:' + c.color + '"></i>' + c.name + ' · ' + esc(c.recipe) + '（' + countCombo(id) + ' 孔）</span>';
  }).join('') + '<span class="lg"><i style="border:1px dashed var(--line);background:transparent"></i>未分配</span>';
  $('assign-note').textContent = auto
    ? '每种组合默认占满一整行（12 孔）；需要自定义不同孔位个数，请切到「手动选孔」。'
    : '点击孔位即为当前组合选孔（可连续点选/取消）；点「下一组合」切换到下一个条件继续配置。';
}
/* 下一步门禁：每个组合至少分配 1 孔 */
$('assign-step').addEventListener('click', function () {
  var sel = selIds();
  if (!sel.length) { toast('请先勾选试剂组合'); go('s04'); return; }
  var missing = sel.filter(function (id) { return countCombo(id) === 0; });
  if (missing.length) { toast(comboOf(missing[0]).name + ' 还没有分配孔位'); return; }
  go('s06');
});

/* 06 确认设置 */
var createLock = false;                     /* 防重复提交：三连击只创建一次 */
function renderConfirm() {
  createLock = false;
  var name = $('f-name') && $('f-name').value || (DB.exp.name + '-04');
  DB.newName = name;
  var sel = selIds();
  var assign = DB.wizard.assign || {};
  var assigned = Object.keys(assign).length;
  var selNames = sel.map(function (id) { return comboOf(id).name; }).join('、');
  $('confirm-card').innerHTML =
    kv('实验名称', esc(name)) + kv('待纯化药品', esc($('f-drug').value)) +
    kv('初始标样总质量', $('f-mass').value + ' mg') +
    kv('每孔溶剂投入量', (+$('f-dose').value).toFixed(1) + ' mg') +
    kv('试剂组合', sel.length + ' 个 · ' + esc(selNames)) +
    kv('预计占用孔数量', assigned + ' / 96 孔');
  renderPlate($('plate-confirm'), 'mini', { assign: assign });
  $('confirm-legend').innerHTML = legendHTML(sel, null).replace('未录入', '未分配空行');
}
function kv(k, v, warm) {
  return '<div class="kv" style="padding-left:0;padding-right:0"><span class="k">' + k +
         '</span><span class="v' + (warm ? ' warm' : '') + '">' + v + '</span></div>';
}
$('btn-create').addEventListener('click', function () {
  if (createLock) return;                   /* 快速连点只创建一次 */
  var name = ($('f-name').value || '').trim();
  if (!name) { toast('请填写实验名称'); go('s03'); return; }
  var dose = parseFloat($('f-dose').value);
  if (isNaN(dose) || dose <= 0) { toast('每孔溶剂投入量需为正数'); go('s03'); return; }
  var sel = selIds();
  if (!sel.length) { toast('请先在条件设置中勾选试剂组合'); go('s04'); return; }
  createLock = true;
  var mx = 0;
  Object.keys(DB.exps).forEach(function (k) { var m = /^EXP-(\d+)$/.exec(k); if (m) mx = Math.max(mx, +m[1]); });
  var nid = 'EXP-0' + (mx + 1);
  var dCreate = new Date(), pd = function (x) { return (x < 10 ? '0' : '') + x; };
  var created = dCreate.getFullYear() + '.' + pd(dCreate.getMonth() + 1) + '.' + pd(dCreate.getDate());
  var assign = DB.wizard.assign || {};
  var nAssign = Object.keys(assign).length;
  var exp = {
    id: nid, name: name, plate: '96孔板 · 进行中',
    drug: ($('f-drug').value || '').trim() || '未命名样品',
    totalMass: parseFloat($('f-mass').value) || 0, dose: dose, comboCount: sel.length,
    wells: freshEmptyWells(dose, assign), ops: {}, created: created
  };
  DB.exps[exp.id] = exp;                                   /* 加入进行中实验池 */
  DB.curExp = exp.id;
  DB.exp = exp; DB.wells = exp.wells; DB.ops = exp.ops; DB.selWell = null;
  save(); toast('实验 ' + nid + ' 已创建 · ' + nAssign + ' 孔待录入');
  stack = ['s01', 's02', 's07'];            /* 清空向导栈：返回键回工作台 */
  show('s07');
});

/* 07 实验详情 */
function renderRun() {
  var st = stats();
  var ui = DB._ui = DB._ui || {};
  $('exp-head').innerHTML =
    '<div class="t">' + esc(DB.exp.id) + ' · ' + esc(DB.exp.name) + '</div>' +
    '<div class="s">96孔板 · 进行中 · 待纯化药品：' + esc(DB.exp.drug) + '</div>';
  $('exp-stats').innerHTML =
    '<div class="stat"><div class="v"><span id="st-n">' + (ui.runN != null ? ui.runN : st.n) + '</span><small>/96 孔</small></div><div class="k">已录入 ' + (st.n / 96 * 100).toFixed(1) + '%</div></div>' +
    '<div class="stat"><div class="v warm"><span id="st-best">' + (ui.runBest != null ? ui.runBest.toFixed(1) : st.best.purity.toFixed(1)) + '%</span></div><div class="k">当前最佳 · ' + st.best.coord + '</div></div>' +
    '<div class="stat"><div class="v"><span id="st-avg">' + (ui.runAvg != null ? ui.runAvg.toFixed(1) : st.avg.toFixed(1)) + '%</span></div><div class="k">平均回收率</div></div>';
  countUp($('st-n'), st.n, 0);
  countUp($('st-best'), st.best.purity, 1, '%');
  countUp($('st-avg'), st.avg, 1, '%');
  ui.runN = st.n; ui.runBest = st.best.purity; ui.runAvg = st.avg;
  renderPlate($('plate-mini'), 'mini', {
    tap: function (coord) { DB.selWell = coord; save(); go('s10'); }   /* 直达单孔详情，少一跳 */
  });
}

/* 08 孔板视图 */
function renderRecord() {
  renderPlate($('plate-full'), 'full', {
    tap: function (coord) {
      DB.selWell = coord; save(); go('s10');   /* 任意孔可查看/录入（含未完成孔） */
    }
  });
  $('legend-full').innerHTML = legendHTML();
}
$('edit-hint').addEventListener('click', function () {
  toast('点击已完成的孔位即可编辑数据');
});

/* 09 批量录入：按区域 / 按组合 / 点选孔位（96 孔板自由多选） */
var batchMode = 'pick', batchSel = {}, batchSelCoords = {};
function renderBatch() {
  batchSel = {}; batchSelCoords = {};
  $('b-in').value = DB.exp.dose.toFixed(1);
  batchUI();
}
function batchUI() {
  var pick = batchMode === 'pick';
  $('batch-chips').style.display = pick ? 'none' : '';
  $('pick-plate-card').style.display = pick ? '' : 'none';
  if (pick) {
    $('batch-sel-title').textContent = '点选孔位（点击板孔选中 / 取消）';
    renderPickPlate();
  } else {
    $('batch-sel-title').textContent = batchMode === 'area' ? '选择区域（行）' : '选择组合（行映射）';
    batchChips();
  }
  updateBatchInfo();
}
function renderPickPlate() {
  renderPlate($('plate-pick'), 'mini', {
    tap: function (coord) {
      if (batchSelCoords[coord]) delete batchSelCoords[coord];
      else batchSelCoords[coord] = true;
      renderPickPlate(); updateBatchInfo();
    },
    selSet: batchSelCoords
  });
}
function updateBatchInfo() {
  var n = selWellCount();
  $('batch-sel-info').textContent = n ? '已选 ' + n + ' 孔' : '未选择';
}
function batchChips() {
  var wrap = $('batch-chips'); wrap.innerHTML = '';
  var items = batchMode === 'area' ? ROWS : expCombos();
  items.forEach(function (id) {
    var b = document.createElement('button');
    b.className = 'chip' + (batchSel[id] ? ' on' : ''); b.textContent = id;
    b.onclick = function () { batchSel[id] = !batchSel[id]; if (!batchSel[id]) delete batchSel[id]; batchChips(); updateBatchInfo(); };
    wrap.appendChild(b);
  });
}
function selWellCount() {
  if (batchMode === 'pick') return Object.keys(batchSelCoords).length;
  var n = 0;
  Object.keys(batchSel).forEach(function (id) {
    if (batchMode === 'area') { n += 12; return; }
    ROWS.forEach(function (row) {                       /* 按组合：命中该列 8 孔 */
      for (var c = 1; c <= 12; c++) {
        var w = DB.wells[row + c];
        if (w && w.combo === id) n++;
      }
    });
  });
  return n;
}
document.querySelectorAll('#batch-seg .seg-item').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('#batch-seg .seg-item').forEach(function (x) { x.classList.remove('active'); });
    b.classList.add('active'); batchMode = b.getAttribute('data-seg');
    batchSel = {}; batchSelCoords = {}; batchUI();
  });
});
$('b-apply').addEventListener('click', function () {
  var out = parseFloat($('b-out').value), dose = parseFloat($('b-in').value);
  if (isNaN(dose) || dose <= 0) { toast('投入量需为正数'); return; }
  if (isNaN(out)) { toast('请输入产出量'); return; }
  if (out < 0) { toast('产出量不能为负数'); return; }
  if (out > dose) { toast('产出量大于投入量，请核对'); return; }
  var pick = batchMode === 'pick';
  if (pick && !Object.keys(batchSelCoords).length) { toast('请先点选孔位'); return; }
  if (!pick && !Object.keys(batchSel).length) { toast('请先选择' + (batchMode === 'area' ? '区域' : '组合')); return; }
  var onlyEmpty = $('b-onlyempty').checked, n = 0, skipped = 0, now = nowStr();
  function applyWell(w) {
    if (!w.combo) { skipped++; return; }               /* 未分配列不可录入 */
    if (onlyEmpty && w.done) { skipped++; return; }
    w.input = dose; w.output = +out.toFixed(1);
    w.purity = +(out / dose * 100).toFixed(1); w.done = true; n++;
  }
  if (pick) {
    Object.keys(batchSelCoords).forEach(function (c) { applyWell(DB.wells[c]); });
  } else if (batchMode === 'combo') {
    ROWS.forEach(function (row) {
      for (var c = 1; c <= 12; c++) {
        var w = DB.wells[row + c];
        if (w.combo && batchSel[w.combo]) applyWell(w);
      }
    });
  } else {
    ROWS.forEach(function (row) {
      if (!batchSel[row]) return;
      for (var c = 1; c <= 12; c++) applyWell(DB.wells[row + c]);
    });
  }
  if (n) { (DB.ops._batch = DB.ops._batch || []).push({ t: now, d: '批量录入 ' + n + ' 孔 · 产出量 ' + out.toFixed(1) + ' mg' }); }
  save(); batchSelCoords = {};
  if (!n) { toast('所选 ' + skipped + ' 孔均已完成，被「仅填充未完成」跳过'); renderPickPlate(); return; }
  toast('已应用至 ' + n + ' 孔' + (skipped ? '（跳过已完成 ' + skipped + ' 孔）' : ''));
  back();
});
function nowStr() {
  var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
  return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* 10 单孔详情：投入量/产出量/回收率三行直接编辑，备注自填可留空 */
function wellNum(v) { v = String(v).trim(); if (v === '') return null; var x = parseFloat(v); return isNaN(x) ? null : x; }
function renderWell() {
  var w = DB.wells[DB.selWell || bestCoord() || 'C7'];
  var cm = comboOf(w.combo);
  var ops = (DB.ops[w.coord] || []);
  if (DB.ops._batch) ops = DB.ops._batch.concat(ops);
  $('well-page').innerHTML =
    '<div class="well-title"><span class="coord">' + w.coord + '</span>' +
      '<span class="combo-badge" style="background:' + cm.color + '22;border:1px solid ' + cm.color + '55;width:28px;height:28px;font-size:12px">' + w.combo + '</span>' +
      '<div><div class="combo-name" style="font-size:13px">' + cm.name + '</div>' +
      '<div class="recipe">' + esc(cm.recipe) + '</div></div>' +
      (w.coord === bestCoord() ? '<span class="tag run" style="margin-left:auto">当前最佳</span>' : '') +
    '</div>' +
    '<div class="form-card kv-card">' +
      '<div class="kv"><span class="k">投入量</span><span class="iedit"><input id="we-in" type="number" step="0.1" min="0" inputmode="decimal" value="' + (w.input != null ? w.input.toFixed(1) : '') + '" placeholder="—"><span class="unit">mg</span></span></div>' +
      '<div class="kv"><span class="k">产出量</span><span class="iedit"><input id="we-out" type="number" step="0.1" min="0" inputmode="decimal" value="' + (w.output != null ? w.output.toFixed(1) : '') + '" placeholder="—"><span class="unit">mg</span></span></div>' +
      '<div class="kv"><span class="k">回收率</span><span class="iedit"><input id="we-pur" type="number" step="0.1" min="0" inputmode="decimal" value="' + (w.purity != null ? w.purity.toFixed(1) : '') + '" placeholder="—"><span class="unit">%</span></span></div>' +
      '<div class="kv"><span class="k">纯度<i class="assay-sub">HPLC 实测 · 选填</i></span><span class="iedit"><input id="we-assay" type="number" step="0.1" min="0" max="100" inputmode="decimal" value="' + (w.assay != null ? w.assay.toFixed(1) : '') + '" placeholder="—"><span class="unit">%</span></span></div>' +
    '</div>' +
    '<p class="hint">回收率 = 产出量 ÷ 投入量 × 100%（称重自动计算）；纯度需 HPLC 等仪器实测，可留空。</p>' +
    '<div class="sec-head"><span class="sec-zh">备注</span><span class="sec-en">NOTE</span></div>' +
    '<div class="card note-card"><textarea id="w-note" rows="2" placeholder="填写备注，可留空">' + esc(w.note || '') + '</textarea></div>' +
    '<div class="sec-head"><span class="sec-zh">操作记录</span><span class="sec-en">TIMELINE</span></div>' +
    '<div class="card tl">' + (ops.length ? ops.map(function (o) {
      return '<div class="tl-row"><div class="tl-t">' + esc(o.t) + '</div><div class="tl-d">' + esc(o.d) + '</div></div>';
    }).join('') : '<div class="tl-row"><div class="tl-t">' + nowStr() + '</div><div class="tl-d">记录创建</div></div>') + '</div>';
  $('well-nav-bar').innerHTML = wellNavHTML(w.coord);
  bindWellNav(w);
  bindWellEdits(w);
}
/* 底部上一孔/下一孔直达（A1→H12 顺序） */
function wellSeq() {
  var coords = [];
  ROWS.forEach(function (r) { for (var c = 1; c <= 12; c++) coords.push(r + c); });
  return coords;
}
function wellNavHTML(cur) {
  var seq = wellSeq(), i = seq.indexOf(cur);
  var CHEV_L = '<svg class="wnav-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14 5 7 12 14 19"/></svg>';
  var CHEV_R = '<svg class="wnav-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 5 17 12 10 19"/></svg>';
  function btn(coord, dir) {
    var off = !coord;
    var cm = off ? null : comboOf(DB.wells[coord].combo);
    var dot = off ? '' : '<span class="wnav-dot" style="background:' + cm.color + '"></span>';
    if (dir < 0) {
      return (off ? '<span class="wnav-btn off">' : '<button class="wnav-btn" id="w-prev">') +
        CHEV_L +
        '<span class="wnav-txt"><span class="wnav-k">上一孔 · PREV</span>' +
        '<span class="wnav-c">' + dot + (coord || '—') + '</span></span>' +
        (off ? '</span>' : '</button>');
    }
    return (off ? '<span class="wnav-btn off r">' : '<button class="wnav-btn r" id="w-next">') +
      '<span class="wnav-txt"><span class="wnav-k">下一孔 · NEXT</span>' +
      '<span class="wnav-c">' + (coord || '—') + dot + '</span></span>' +
      CHEV_R +
      (off ? '</span>' : '</button>');
  }
  return '<div class="wnav">' + btn(seq[i - 1], -1) +
    '<span class="wnav-sep"></span>' + btn(seq[i + 1], 1) + '</div>';
}
function bindWellNav(w) {
  var seq = wellSeq(), i = seq.indexOf(w.coord);
  function step(delta) {
    var t = seq[i + delta];
    if (!t) return;
    DB.selWell = t; save(); renderWell();
    window.scrollTo(0, 0);
  }
  if (i > 0) $('w-prev').onclick = function () { step(-1); };
  if (i < seq.length - 1) $('w-next').onclick = function () { step(1); };
}
/* 单孔联动编辑：投入/产出/回收率互推（回收率=产出÷投入）；纯度为仪器实测，单独选填 */
function bindWellEdits(w) {
  var snap = { done: !!w.done, input: w.input, output: w.output };
  function apply(src) {
    var vi = wellNum($('we-in').value), vo = wellNum($('we-out').value), vp = wellNum($('we-pur').value);
    var va = wellNum($('we-assay').value);
    if (va != null && va >= 0 && va <= 100) w.assay = +va.toFixed(1); else delete w.assay;
    if (src === 'pur' && vp != null && vi != null && vi > 0) {      /* 填回收率 → 反推产出量 */
      vo = +(vp / 100 * vi).toFixed(1);
      $('we-out').value = vo.toFixed(1);
    }
    if (vi != null && vi > 0 && vo != null && vo >= 0 && vo <= vi) {
      w.input = vi; w.output = vo; w.purity = +(vo / vi * 100).toFixed(1); w.done = true;
      if (src !== 'pur') $('we-pur').value = w.purity.toFixed(1);
    } else if (vi != null && vi > 0 && wellNum($('we-out').value) == null) {
      w.input = vi; w.done = false; delete w.output; delete w.purity;
      $('we-pur').value = '';
    }
    save();
  }
  [['we-in', 'in'], ['we-out', 'out'], ['we-pur', 'pur'], ['we-assay', 'assay']].forEach(function (p) {
    $(p[0]).addEventListener('input', function () { apply(p[1]); });
    $(p[0]).addEventListener('change', function () { wellCommit(w, snap); });
  });
  $('w-note').addEventListener('change', function () {
    w.note = this.value.trim(); save();
  });
}
function wellCommit(w, snap) {
  if (!w.combo) { toast('未分配组合的孔位不可录入'); renderWell(); return; }
  var vi = wellNum($('we-in').value), vo = wellNum($('we-out').value), vp = wellNum($('we-pur').value);
  var va = wellNum($('we-assay').value);
  if (vi == null || vi <= 0) { toast('投入量需为正数'); renderWell(); return; }
  if (vp != null && vp > 100) { toast('回收率不能超过 100%'); renderWell(); return; }
  if (va != null && va > 100) { toast('纯度不能超过 100%'); renderWell(); return; }
  if (vo == null) {                          /* 产出量留空 → 该孔回到未录入 */
    if (snap.done) (DB.ops[w.coord] = DB.ops[w.coord] || []).unshift({ t: nowStr(), d: '清除数据（原产出量 ' + snap.output.toFixed(1) + ' mg）' });
    var had = snap.done || snap.output != null;
    w.done = false; delete w.output; delete w.purity; delete w.assay;
    save(); renderWell();
    if (had) toast(w.coord + ' 数据已清除');
    return;
  }
  if (vo < 0) { toast('产出量不能为负数'); renderWell(); return; }
  if (vo > vi) { toast('产出量大于投入量，请核对'); renderWell(); return; }
  w.input = vi; w.output = vo; w.purity = +(vo / vi * 100).toFixed(1); w.done = true;
  if (va != null && va >= 0 && va <= 100) w.assay = +va.toFixed(1); else delete w.assay;
  $('we-pur').value = w.purity.toFixed(1);
  var changed = !snap.done || snap.input !== vi || snap.output !== vo;
  if (changed) {
    (DB.ops[w.coord] = DB.ops[w.coord] || []).unshift({
      t: nowStr(),
      d: (snap.done ? '修改数据 投入 ' + snap.input.toFixed(1) + '→' + vi.toFixed(1) +
        ' / 产出 ' + snap.output.toFixed(1) + '→' + vo.toFixed(1) + ' mg'
        : '录入数据 投入 ' + vi.toFixed(1) + ' / 产出 ' + vo.toFixed(1) + ' mg')
    });
  }
  save(); renderWell();
  if (changed) toast(w.coord + ' 已保存 · 回收率 ' + w.purity.toFixed(1) + '%' + (w.assay != null ? ' · 纯度 ' + w.assay.toFixed(1) + '%' : ''));
}

/* 11 结果总览 */
function renderResults() {
  var st = stats();
  var ui = DB._ui = DB._ui || {};
  var buckets = { '<85': 0, '85–90': 0, '90–95': 0, '≥95': 0 };
  completedWells().forEach(function (w) {
    if (w.purity < 85) buckets['<85']++;
    else if (w.purity < 90) buckets['85–90']++;
    else if (w.purity < 95) buckets['90–95']++;
    else buckets['≥95']++;
  });
  var maxB = Math.max.apply(null, Object.keys(buckets).map(function (k) { return buckets[k]; }).concat([1]));
  var distRows = Object.keys(buckets).map(function (k) {
    return '<div class="dist-row"><span class="dist-k">回收率 ' + k + '</span>' +
      '<span class="dist-bar"><i style="width:' + (buckets[k] / maxB * 100) + '%"></i></span>' +
      '<span class="dist-v">' + buckets[k] + '</span></div>';
  }).join('');
  var avgRows = expCombos().map(function (id) {
    var c = comboOf(id), a = comboAvg(id);
    return '<div class="dist-row"><span class="dist-k">' + c.name + '</span>' +
      '<span class="dist-bar"><i style="width:' + (a / 100 * 100) + '%;background:' + c.color + '"></i></span>' +
      '<span class="dist-v">' + a.toFixed(1) + '</span></div>';
  }).join('');
  $('results-page').innerHTML =
    '<div class="hero dark"><span class="big" id="res-hero">' + (ui.resHero != null ? ui.resHero.toFixed(1) : st.best.purity.toFixed(1)) + '%</span>' +
      '<span class="who">当前最佳回收率<br><b>' + st.best.coord + '</b>（' + comboOf(st.best.combo).name + '）</span></div>' +
    '<div class="stat-row">' +
      '<div class="stat"><div class="v"><span id="res-n">' + (ui.resN != null ? ui.resN : st.n) + '</span><small>/96</small></div><div class="k">已录入 ' + (st.n / 96 * 100).toFixed(1) + '%</div></div>' +
      '<div class="stat"><div class="v"><span id="res-avg">' + (ui.resAvg != null ? ui.resAvg.toFixed(1) : st.avg.toFixed(1)) + '%</span></div><div class="k">平均回收率</div></div>' +
      '<div class="stat"><div class="v">' + (96 - st.n) + '<small> 孔</small></div><div class="k">待录入</div></div>' +
    '</div>' +
    '<div class="sec-head"><span class="sec-zh">回收率分布</span><span class="sec-en">DISTRIBUTION</span></div>' +
    '<div class="card dist">' + distRows + '</div>' +
    '<div class="sec-head"><span class="sec-zh">组合均值</span><span class="sec-en">BY COMBO</span></div>' +
    '<div class="card dist combo-avg">' + avgRows + '</div>' +
    '<div class="op-row"><button class="text-act" data-go="s12">最佳条件</button>' +
    '<button class="text-act" data-go="s13">结果排名</button>' +
    '<button class="text-act" id="btn-archive">完成并归档</button></div>';
  var ab = $('btn-archive'); if (ab) ab.onclick = askArchiveExp;
  countUp($('res-hero'), st.best.purity, 1, '%');
  countUp($('res-n'), st.n, 0);
  countUp($('res-avg'), st.avg, 1, '%');
  ui.resHero = st.best.purity; ui.resN = st.n; ui.resAvg = st.avg;
}

/* 12 最佳条件 */
function renderBest() {
  var st = stats();
  if (!st.n) {
    $('best-page').innerHTML =
      '<div class="card" style="margin-top:14px;padding:28px 18px;text-align:center;color:var(--ink3)">' +
      '尚未录入任何数据。<br>完成实验录入后，这里将自动给出表现最好的条件。</div>';
    return;
  }
  var w = st.best, cm = comboOf(w.combo);
  $('best-page').innerHTML =
    '<div class="card" style="margin-top:14px">' +
      '<div class="row1" style="display:flex;align-items:center;gap:10px">' +
        '<span class="combo-badge" style="background:' + cm.color + '22;border:1px solid ' + cm.color + '55">' + cm.id + '</span>' +
        '<div><div class="combo-name">' + cm.name + '</div><div class="combo-recipe">' + esc(cm.recipe) + '</div></div>' +
        '<span style="margin-left:auto;font-size:26px;font-weight:700;color:var(--warm)">' + w.purity.toFixed(1) + '%</span>' +
      '</div>' +
      '<div class="pbar" style="margin-top:14px"><i style="width:' + w.purity + '%;background:var(--warm)"></i></div>' +
    '</div>' +
    '<div class="form-card" style="margin-top:14px">' +
      kv('最佳孔位', w.coord) + kv('投入量', w.input.toFixed(1) + ' mg') +
      kv('产出量', w.output.toFixed(1) + ' mg') + kv('回收率', w.purity.toFixed(1) + '%', true) +
      (w.assay != null ? kv('纯度（HPLC 实测）', w.assay.toFixed(1) + '%') : '') +
    '</div>' +
    '<p class="hint">收藏后，新建实验时可在「下一轮条件」中由你主动选用该条件；应用不做任何自动推荐。</p>' +
    '<div class="cta-row"><button class="cta-line" id="btn-fav">' +
      (DB.selected[cm.id] ? '已收藏 ✓' : '收藏此条件') + ' <i>→</i></button></div>' +
    '<div class="op-row"><button class="text-act" data-go="s13">查看完整排名</button></div>';
  $('btn-fav').onclick = function () {
    DB.selected[cm.id] = true; save(); renderBest();
    toast(cm.name + ' 已收藏 · 可用于下一轮实验');
  };
}

/* 13 结果排名 */
var rankFilter = 'ALL';
function renderRank() {
  var list = completedWells().sort(function (a, b) { return b.purity - a.purity; });
  if (rankFilter !== 'ALL') list = list.filter(function (w) { return w.combo === rankFilter; });
  var chips = '<div class="chip-wrap" style="margin:12px 0 10px">' +
    ['ALL'].concat(expCombos()).map(function (id) {
      var label = id === 'ALL' ? '全部组合' : '组合' + id;
      return '<button class="chip' + (rankFilter === id ? ' on' : '') + '" data-rf="' + id + '">' + label + '</button>';
    }).join('') + '</div>';
  var rows = list.slice(0, 20).map(function (w, i) {
    var cm = comboOf(w.combo);
    return '<div class="rank-row" data-well="' + w.coord + '">' +
      '<span class="rank-no' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span>' +
      '<span class="rank-coord">' + w.coord + '</span>' +
      '<span class="rank-combo"><i style="width:9px;height:9px;border-radius:50%;background:' + cm.color + '"></i>' + cm.name + '</span>' +
      '<span class="rank-pct">' + w.purity.toFixed(1) + '%</span>' +
      (w.assay != null ? '<span class="rank-assay">纯 ' + w.assay.toFixed(1) + '%</span>' : '') + '</div>';
  }).join('');
  $('rank-page').innerHTML = chips +
    '<div class="card rank-card">' + rows + '</div>' +
    '<p class="hint">点击行查看单孔详情；导出仅选择内容与格式，不改变数据。</p>';
  $('rank-page').querySelectorAll('[data-rf]').forEach(function (b) {
    b.onclick = function () { rankFilter = b.getAttribute('data-rf'); renderRank(); };
  });
  $('rank-page').querySelectorAll('[data-well]').forEach(function (r) {
    r.onclick = function () { DB.selWell = r.getAttribute('data-well'); save(); go('s10'); };
  });
}
$('btn-export').addEventListener('click', function () {
  var lines = ['排名,孔位,组合,试剂配比,投入量(mg),产出量(mg),回收率(%),纯度(%)'];
  completedWells().sort(function (a, b) { return b.purity - a.purity; }).forEach(function (w, i) {
    var cm = comboOf(w.combo);
    lines.push([(i + 1), w.coord, cm.name, '"' + cm.recipe + '"', w.input.toFixed(1), w.output.toFixed(1), w.purity.toFixed(1), w.assay != null ? w.assay.toFixed(1) : ''].join(','));
  });
  var csv = lines.join('\n');
  openSheet('导出数据 · CSV 预览',
    '<textarea id="csv-box">' + esc(csv) + '</textarea>' +
    '<div class="cta-row"><button class="cta-line" id="csv-copy">全选并复制 <i>→</i></button></div>');
  $('csv-copy').onclick = function () {
    var box = $('csv-box'); box.focus(); box.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    toast(ok ? '已复制到剪贴板' : '已全选，长按文本框复制');
  };
});

/* 14 试剂库 */
function renderReagents() {
  $('reagent-page').innerHTML =
    '<div class="search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2F3A31" stroke-width="2">' +
      '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>' +
      '<input id="rg-q" placeholder="搜索试剂"></div>' +
    '<div id="rg-list"></div>' +
    '<button class="ghost-add" id="rg-add">＋ 添加试剂</button>';
  rgList('');
  $('rg-q').addEventListener('input', function () { rgList(this.value); });
  $('rg-add').addEventListener('click', function () {
    openSheet('添加试剂',
      '<div class="frow" style="padding:6px 0"><span class="flabel">名称</span>' +
      '<input id="rg-name" placeholder="如 乙酸乙酯" style="text-align:left;font-weight:600"></div>' +
      '<div class="cta-row"><button class="cta-line" id="rg-save">保存 <i>→</i></button></div>');
    $('rg-save').onclick = function () {
      var v = $('rg-name').value.trim();
      if (!v) { toast('请输入试剂名称'); return; }
      DB.reagents.push({ name: v, en: '—', cas: '—' }); save(); closeSheet(); renderReagents();
      toast('已添加 ' + v);
    };
  });
}
function rgList(q) {
  q = q.trim().toLowerCase();
  var rows = DB.reagents.filter(function (r) {
    return !q || r.name.toLowerCase().indexOf(q) > -1 || r.en.toLowerCase().indexOf(q) > -1;
  }).map(function (r) {
    return '<div class="card rg-row" data-rg="' + esc(r.name) + '"><div><div class="rg-name">' + esc(r.name) + '</div>' +
      '<div class="rg-cas">CAS ' + esc(r.cas) + '</div></div>' +
      '<span class="rg-abbr">' + esc(r.en) + '</span></div>';
  }).join('');
  $('rg-list').innerHTML = rows || '<p class="hint">未找到匹配试剂</p>';
  $('rg-list').querySelectorAll('[data-rg]').forEach(function (el) {
    el.onclick = function () {
      var r = DB.reagents.filter(function (x) { return x.name === el.getAttribute('data-rg'); })[0];
      if (!r) return;
      var used = allCombos().filter(function (c) { return c.recipe.indexOf(r.name) > -1; }).map(function (c) { return c.name; });
      openSheet(r.name + ' · 试剂详情',
        '<div class="form-card">' + kv('英文名', r.en) + kv('CAS 号', r.cas) +
        kv('用于组合', used.length ? esc(used.join('、')) : '—') + '</div>');
    };
  });
}

/* 15 我的 */
function renderProfile() {
  var st = stats();
  var best = 0, bestId = '—', bestTxt = '';
  Object.keys(DB.exps).forEach(function (id) {
    var w = bestWellOf(DB.exps[id]);
    if (w && w.purity > best) {
      best = w.purity; bestId = id;
      bestTxt = esc(w.coord) + ' · ' + esc(comboOf(w.combo).name);
    }
  });
  $('profile-page').innerHTML =
    '<div class="me-head"><div class="avatar">L</div>' +
      '<div><div class="me-name">LabExplorer</div>' +
      '<div class="me-sub">专注实验操作 · 数据本地留存 · 不做自动推荐</div></div></div>' +
    '<div class="stat-row">' +
      '<div class="stat"><div class="v">' + (DB.exp ? DB.exp.comboCount : 0) + '</div><div class="k">试剂组合</div></div>' +
      '<div class="stat"><div class="v">' + DB.reagents.length + '</div><div class="k">试剂条目</div></div>' +
      '<div class="stat"><div class="v warm">' + (best ? best.toFixed(1) + '%' : '—') + '</div><div class="k">' + esc(bestId) + ' 最佳' + (best ? ' · ' + bestTxt : '') + '</div></div>' +
    '</div>' +
    '<div class="menu">' +
      menuRow('我的实验', '', 's16') +
      menuRow('试剂库', '', 's14') +
      '<div class="menu-row" id="m-backup">数据备份<span class="sub">JSON</span><i class="arr">›</i></div>' +
      '<div class="menu-row" id="m-help">帮助与反馈<i class="arr">›</i></div>' +
      '<div class="menu-row" id="m-reset">设置<span class="sub">重置演示数据</span><i class="arr">›</i></div>' +
      '<div class="menu-row" id="m-about">关于 PureLab<span class="sub">v1.0</span><i class="arr">›</i></div>' +
    '</div>';
  $('m-help').onclick = function () {
    openSheet('帮助与反馈',
      '<div class="form-card">' +
      kv('记录建议', '产出量称重后立即录入，支持批量按行录入') +
      kv('数据安全', '全部数据仅保存在本机，可在「数据备份」导出 JSON') +
      kv('修改数据', '孔板页点击任意孔位即可查看、修改或清除') + '</div>' +
      '<p class="hint">V1 暂无在线反馈通道，问题请记录后联系课程负责同学。</p>');
  };
  $('m-backup').onclick = function () {
    openSheet('数据备份 · JSON 预览',
      '<textarea id="bk-box">' + esc(JSON.stringify(DB, null, 1)) + '</textarea>' +
      '<div class="cta-row"><button class="cta-line" id="bk-copy">全选并复制 <i>→</i></button></div>');
    $('bk-copy').onclick = function () {
      var box = $('bk-box'); box.focus(); box.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      toast(ok ? '已复制到剪贴板' : '已全选，长按文本框复制');
    };
  };
  $('m-reset').onclick = function () {
    openSheet('重置演示数据', '<p>将清除本机保存的全部实验数据，恢复为初始演示数据（3 个进行中实验）。</p>' +
      '<div class="cta-row"><button class="cta-line" id="rs-go">确认重置 <i>→</i></button></div>');
    $('rs-go').onclick = function () {
      try { localStorage.removeItem('purelab_db'); } catch (e) {}
      DB = freshDB(); normalizeDB(); save(); closeSheet(); show('s02'); toast('已重置');
    };
  };
  $('m-about').onclick = function () {
    openSheet('关于 PureLab',
      '<p><b>PureLab 高通量重结晶实验助手 v1.0</b></p>' +
      '<p style="margin-top:8px">15 屏结构复刻自设计基准板（purelab_ref.png），视觉令牌取自原图实测 7 色色板。' +
      '96 孔板为全项目唯一组件（8×12，A–H × 1–12），状态由数据参数驱动。</p>');
  };
}
function menuRow(label, sub, target) {
  return '<div class="menu-row" data-go="' + target + '">' + label +
         (sub ? '<span class="sub">' + sub + '</span>' : '') + '<i class="arr">›</i></div>';
}

/* 16 实验总览：进行中 + 已归档，点卡片进入对应实验 */
function bestWellOf(e) {
  var bw = null;
  Object.keys(e.wells).forEach(function (k) {
    var w = e.wells[k];
    if (w.done && (!bw || w.purity > bw.purity)) bw = w;
  });
  return bw;
}
function renderExpOverview() {
  var ids = Object.keys(DB.exps).sort().reverse();
  var ongoing = ids.length ? ids.map(function (id, i) {
    var e = DB.exps[id], s = expStats(e), cur = id === DB.curExp;
    var bw = bestWellOf(e), bc = bw ? comboOf(bw.combo) : null;
    return '<div class="exp-ov-row stagger-item" data-go="s07" data-pickexp="' + id + '" style="animation-delay:' + Math.min(i * 50, 400) + 'ms">' +
      '<div class="row1"><span class="exp-id">' + esc(e.id) + '</span>' +
      '<span class="exp-name">' + esc(e.name) + '</span>' +
      '<span class="tag run">' + (cur ? '当前' : '进行中') + '</span></div>' +
      '<div class="exp-meta"><span><b>' + s.n + '</b>/96 孔已录入</span>' +
      (bw ? '<span>最佳 <b>' + bw.purity.toFixed(1) + '%</b> · ' + esc(bw.coord) + '</span>' +
            '<span>条件 <b>' + esc(bc.name) + '</b></span>' : '<span>最佳 <b>—</b></span>') + '</div>' +
      (bc && bc.recipe && bc.recipe !== '—' ? '<div class="exp-recipe">' + esc(bc.name) + ' · ' + esc(bc.recipe) + '</div>' : '') +
      '<div class="pbar"><i style="width:' + s.pct.toFixed(1) + '%"></i></div></div>';
  }).join('') : '<p class="hint" style="margin:6px 2px 14px">暂无进行中实验 · 首页「新建实验」开始</p>';
  var archived = DB.archives.length ? DB.archives.map(function (a, i) {
    return '<div class="card arch-row stagger-item" data-archid="' + a.id + '" style="animation-delay:' + Math.min(i * 45, 400) + 'ms"><span class="arch-thumb">' + LEAF_SVG + '</span>' +
      '<div class="arch-name">' + esc(a.name) + '<div class="arch-sub">' + esc(a.sub) + '</div></div>' +
      '<span class="arch-best">最佳 ' + esc(a.best) + '</span>' +
      '<span class="arch-del" data-delarch="' + a.id + '">删除</span></div>';
  }).join('') : '<p class="hint" style="margin:6px 2px">暂无归档实验</p>';
  $('expov-page').innerHTML =
    '<div class="sec-head"><span class="sec-zh">进行中的实验</span><span class="sec-en">ONGOING</span></div>' + ongoing +
    '<div class="sec-head"><span class="sec-zh">已归档实验</span><span class="sec-en">ARCHIVE</span></div>' + archived;
  document.getElementById('expov-page').querySelectorAll('[data-pickexp]').forEach(function (el) {
    el.addEventListener('click', function () {
      var id = el.getAttribute('data-pickexp');
      if (id !== DB.curExp) { DB.curExp = id; normalizeDB(); save(); toast('已切换到 ' + id); }
    });
  });
  document.getElementById('expov-page').querySelectorAll('[data-delarch]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.stopPropagation(); askDeleteArch(el.getAttribute('data-delarch')); });
  });
  document.getElementById('expov-page').querySelectorAll('[data-archid]').forEach(function (el) {
    el.addEventListener('click', function () { showArchDetail(el.getAttribute('data-archid')); });
  });
}

/* ---------------- 启动 ---------------- */
renderHome();
show('s01');
