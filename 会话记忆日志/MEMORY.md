# PureLab 项目长期备忘

## 项目本质
- PureLab = 高通量重结晶实验 App（移动端），96 孔板为核心组件。
- 双重依据：用户参考规划图 `purelab_ref.png`（15 屏，**最高视觉依据**）+ `D:\willion\Desktop\APP提示词\` 7 份阶段提示词（14 规范页、20 组件、11 数据对象、硬约束清单）。
- 两者存在结构性差异（15 屏向导式 vs 14 页平铺）与内容冲突（图中"最佳条件"页 vs 提示词禁令），处理原则：**参考图优先**，冲突点标记给用户裁决。

## 关键资产
- 画布：https://ardot.tencent.com/file/721113761538194 （15 屏基准板 + 规范区 + 色板令牌卡，节点索引见设计文档 2.2 节）
- 设计文档：`C:\Users\willion\WorkBuddy\2026-09-01-10-27-48\PureLab 高通量重结晶实验App_设计方案与实现说明.md`
- 裁片：工作区 `_s01~_s15.png` + `_notes/_palette/_icons/_header.png`；OCR 结果 `_ocr_results.json`；提示词全文 `_prompts_full.txt`
- 裁切坐标：cols=[(30,312),(332,632),(648,950),(978,1290),(1320,1640)]，rows=[(193,950),(1047,1703),(1792,2306)]，6px 米色(249,242,234)安全边距
- 实测 7 色：#E0D8D1 #D8D3CC #C1BEB5 #9CA296 #536253 #2F3A31 #C0A381；页面背景 #F9F2EA；Caption 文字 #3F4A35
- OCR 环境：C:/Users/willion/.workbuddy/binaries/python/envs/default/Scripts/python.exe（rapidocr_onnxruntime）

## 硬约束（提示词，违反即返工）
不重设计 UI / 不加新视觉风格 / 不做 SaaS Dashboard / 不做 Excel 孔板 / 无 AI 推荐·最佳条件·自动优化 / 96 孔板永远 8×12 A-H 1-12 全项目唯一一套（状态参数驱动）/ C7 永远是 C7 / CTA 只用文字+细线，禁 Bottom Tab·胶囊·巨型按钮 / 模板只存设计结构 / 导出只选内容格式 / 下一轮实验仅用户主动选条件。

## Ardot 工具坑位
- 透明 frame（fills:[]）导出截图渲染为绿幕 rgb(71,112,76) → 所有容器显式实色填充。
- SOLID color 只能 {r,g,b}，透明度走 opacity。
- 每任务只允许一次 create_design/open_design；确认用 fetch_file_info。

## 会话恢复经验
- "继续"但上下文缺失：先查当前会话 jsonl（~/.workbuddy/projects/<工作区 slug>/<sessionId>.jsonl，user 消息为 content[].type=input_text），内含 conversation_history_summary 全文；勿凭全局记忆猜任务（跑偏到无关项目会被用户批评）。
