# PureLab 视觉评审与玻璃质感优化方案（v43 → v44 提案）

> 评审方式：Playwright 驱动真实 Chrome（390×844），全屏走查 15 屏截图存于 `purelab-apk/qa/rev/`。
> 范围：**仅视觉风格打磨**，不动信息架构与交互流程。

---

## 一、总体评价

色板体系统一（7 色基准 + v38 文本安全派生），v41 玻璃层架构正确（只用于 nav/sheet/toast/FAB，数据区不玻璃化，有降级）。**骨架已经对了，当前差距在「玻璃的存在感」和「层次细节」**——玻璃元素底下缺可透的内容，看起来像普通白卡；几处细节有硬伤。

---

## 二、问题清单

### P1 缺陷（应修）

| # | 位置 | 证据 | 问题 | 建议 |
|---|------|------|------|------|
| 1 | s07 / s02 底部 | `rev/06_s07_detail.png` | **Toast 与 FAB 重叠**：toast（bottom 34px，居中，max-width 82%）右缘 ~355px，深绿 FAB 左缘 ~222px，两块深色叠在一起且盖住按钮文字 | showToast 时检测当前屏有无 FAB（`#s02.active .cta-glass` / `#s07.active .fab-stack`），有则给 toast 加 `.lift` 类：`bottom:calc(var(--safe-b) + 108px)` |
| 2 | 全局 | `rev/15_s15_profile.png` | 「关于 PureLab v2.10」——CSS 已 v43，版本号没同步 | app.js 版本常量改 v2.43（或与 git tag 联动） |

### P2 玻璃质感提档（本次核心）

| # | 位置 | 证据 | 问题 | 方案 |
|---|------|------|------|------|
| 3 | body 氛围光 | `rev/01_s02_home.png` | 两团光斑太淡（.20/.12）且不在玻璃元素后方，玻璃「无物可透」 | 三团光斑：右上暖棕加强至 .26、半径 380px；**新增右下第三团**（300px，rgba(192,163,129,.30)）正对 FAB；左下墨绿 .12→.16 |
| 4 | 玻璃按钮（cta-glass / fab-sub） | `rev/01_s02_home.png` | 白色梯度弱、模糊档位低（14px/1.4），观感≈白卡 | 提档为「强档玻璃」token：blur(18px) saturate(1.8)、白色梯度 .72→.36→.48、高光描边 .75、投影换暖调 rgba(126,95,54,.20) |
| 5 | 吸顶 nav | 走查 | 玻璃 nav 与背景同色，无「玻璃片厚度感」 | 补 `box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 8px 20px -12px rgba(47,58,49,.18)`（顶缘高光 + 下缘厚度投影） |
| 6 | s11 结果页 | `rev/10_s11_results.png` | 深绿 hero 与统计白卡平铺相接，两块贴死无层次 | 统计卡上叠：`margin-top:-16px; position:relative; box-shadow:0 6px 18px rgba(47,58,49,.12)`（iOS 叠卡手法） |

### P3 细节（择机）

| # | 位置 | 问题 | 方案 |
|---|------|------|------|
| 7 | 96 孔板 done 孔 | 纯平色块，无「孔」的物理感；组合 B 浅灰绿在米白底上存在感弱 | done 孔加内凹：`box-shadow: inset 0 2px 3px rgba(31,38,32,.22), inset 0 -1.5px 2px rgba(255,255,255,.28)`；图例色块保持平色不动 |
| 8 | s03 表单 | 「96 / 96 · 约 8 行（按质量估算）」折成两行，挤 | 值文案缩短为「96 / 96 · 约 8 行」，括号说明并入 hint |
| 9 | toast | 白描边 .18 在深底上几乎不可见 | 提至 .25，补顶缘高光 `inset 0 1px 0 rgba(255,255,255,.12)` |
| 10 | sheet 内 textarea | 玻璃弹层里嵌实心白块，语言略突兀 | 观察项，暂不动（CSV 长文本需纸面可读性） |

### 待确认（不默认执行）

| ? | 事项 | 说明 |
|---|------|------|
| Q1 | 向导「下一步 / 创建实验」是否升级为玻璃胶囊？ | 现为下划线文字（v38 铁律「禁胶囊」），但 v41 已引入玻璃胶囊 FAB，语言已分裂：最核心的路径用最轻的按钮。若确认升级，s03→s06 四屏 CTA 换 `cta-glass` 右下角样式，与首页呼应 |

---

## 三、关键 CSS 参数（P2 方案落地值）

```css
:root{
  /* 强档玻璃按钮（#4） */
  --blur-strong: blur(18px) saturate(1.8);
  --glass-btn: linear-gradient(135deg, rgba(255,255,255,.72), rgba(255,255,255,.36) 50%, rgba(216,211,204,.48));
}
body{
  /* 氛围光三团（#3）：右上暖光加强 + 新增右下光斑正对 FAB */
  background:
    radial-gradient(380px 380px at 88% -40px, rgba(192,163,129,.26), transparent 70%),
    radial-gradient(420px 420px at -60px 100%, rgba(83,98,83,.16), transparent 70%),
    radial-gradient(300px 300px at 100% 100%, rgba(192,163,129,.30), transparent 70%),
    var(--bg);
  background-attachment:fixed;
}
.cta-glass,.fab-sub{
  background:var(--glass-btn);
  -webkit-backdrop-filter:var(--blur-strong);backdrop-filter:var(--blur-strong);
  box-shadow:0 8px 24px rgba(126,95,54,.20), inset 0 1px 0 rgba(255,255,255,.85), inset 0 -1px 1px rgba(47,58,49,.08);
}
.nav{ box-shadow:inset 0 1px 0 rgba(255,255,255,.4), 0 8px 20px -12px rgba(47,58,49,.18); }
.well.done{ box-shadow:inset 0 2px 3px rgba(31,38,32,.22), inset 0 -1.5px 2px rgba(255,255,255,.28); }
#results-page .stat-row{ margin-top:-16px; position:relative; box-shadow:0 6px 18px rgba(47,58,49,.12); }
.toast{ border-color:rgba(255,255,255,.25); box-shadow:inset 0 1px 0 rgba(255,255,255,.12); }
.toast.lift{ bottom:calc(var(--safe-b) + 108px); }
```

JS（#1 toast 避让，showToast 内加一行判断）：

```js
const nearFab = document.querySelector('#s02.active .cta-glass, #s07.active .fab-stack');
toastEl.classList.toggle('lift', !!nearFab);
```

---

## 四、执行顺序建议

1. **A 批（修硬伤）**：#1 toast 避让 → #2 版本号
2. **B 批（玻璃提档）**：#3 氛围光 → #4 玻璃按钮 → #5 nav → #6 叠卡
3. **C 批（细节）**：#7 孔板内凹 → #8 文案 → #9 toast 描边
4. 每批完成后跑 harness 回归 + 重新截图对比（RUN-K 惯例）

## 五、已核实不动的部分

- 数据区不玻璃化铁律、玻璃节点每屏 ≤3 —— 继续遵守
- 降级方案 `@supports not backdrop-filter` —— B 批改动同步检查降级路径（玻璃按钮降级后为实色浅面板，不涉及）
- v28–v30 动效（弹簧、交错入场、折叠滚动）—— 不动
- 色板与文本安全对比度体系 —— 不动
