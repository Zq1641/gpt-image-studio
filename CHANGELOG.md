# Changelog

All notable changes to **gpt-image-studio** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.1] · 2026-11-23

### Fixed
- **提示词胶囊原子化交互修复（Issue 1）**：
  - `@图N` 与 `⟦skill:NAME⟧` 胶囊标记增加 `contenteditable="false"` 与 `user-select: all`，彻底禁止光标切入胶囊内部或逐字删除单个字符。
  - 增加 Backspace / Delete 键盘监听，光标位于胶囊前后时一键整体删除整颗胶囊。
  - 胶囊插入与文本转换自动维护空格边界，用户在胶囊后键入的内容严格作为独立文本节点，不再与胶囊粘连融为一体。
- **Output 输出区域卡片框架与尺寸自适应修复（Issue 2 & 3）**：
  - 废弃存在循环尺寸测算与抖动收缩的 `usePrintSize` ResizeObserver 监听，改用稳健纯 CSS Flex 布局。
  - 彻底移除 `.print-frame` 错误的 `margin-top: auto`，使其与 Archive 列表顶部对齐并等高拉伸，恢复完整的卡片背景边框与阴影。
  - 修复历史回填后重新生成时图片不显示的视觉阻断问题，确保空状态、生成中 Spinner（Exposing plate）、历史图片以及最新生成的图片在 Output 卡片中无缝切换与即时渲染。

## [0.3.0] · 2026-11-23

### Refined & Fixed
- **Studio Notebook 视觉与排版重构**：完整恢复暖纸质感与深墨色调（`#F4F1EA` / `#1A1815`），修复 `layout.css` 中基础字体的继承缺失。
- **左栏 Sidebar 紧凑排版**：模型展示恢复 Fraunces 衬线体大字，收敛标签云墙为小巧快速切换菜单；尺寸与细节控制整合为单行紧凑胶囊（`[Auto | 1K | 2K | 4K | 6K | 8K | +]`），彻底消灭左栏滚动条。
- **Presets 与 Skills 双模合一**：右上角增加极简标签切换，找回 5 大经典灵感模板（电商、摄影、海报、创意、艺术），并无缝支持用户上传的自定义纯文本 Skills。
- **Prompt Skill 胶囊去噪**：废除刺眼的大红背景，改用暖纸墨水灰底配合画廊蓝（`#1F3FE0`）`◆` 标志装饰，与正文及 `@图1` 完美融入。
- **底部 Output 与 Archive 严格对齐**：去除 Archive 列表强制的 1:1 比例锁死，恢复自然拉伸与内部平滑滚动；Output 配备磨砂质感放大镜工具条。
- **网络与图片下载稳定性增强**：针对 GPT Image 2.6 及各类中转接口，增加 Axios 自动跟随重定向与流式下载兜底，彻底解决中转返回 URL 时的下载超时与报错。

## [0.2.0] · 2026-11-13

### Added
- Skills（右上角，替换原 Presets 模板区）：上传 `.md` / `.txt` 纯文本 skill，
  全文存盘持久化（`settings.json`，同名覆盖），排版沿用原 toc 行语言
  （编号 + 中文大字 + 英文小字 + hover →）；点击一行即往输入框插入红色
  名称胶囊（`◆ 名字`，只显示名不显示全文）；hover 行尾 × 两步删除。
  生成时胶囊自动展开成全文拼入提示词（重复引用只拼一次），未知/已删
  胶囊禁用 Generate 并提示；Archive 列表显示 `◆ 名字` + `· N skill` 计数，
  回填恢复原文。
- 流式自适应布局：顶行右列 170~210px 浮动、底行双列等分剩余宽度；
  Output 正方形边长实测列宽×行高取 min（200~560px），Archive 列表
  flex 拉伸 + 内部滚动——窗口任意放大缩小，两区顶部永远对齐、字体字号不变.
- Cancel generation: the Generate button becomes a "取消生成" cancel button while
  a request is in flight (`generate:cancel` now aborts the in-flight HTTP call,
  with stale-response guards so late replies never clobber the UI).
- Per-entry history delete (hover a row for ×), with orphaned plate files
  garbage-collected when no other entry references them.
- Reference snapshots persisted per history entry — refilling a history row now
  restores its reference plates, no re-upload needed.
- Model picker: sidebar model chips + trailing "+" add button (no dropdown),
  two-step inline delete confirm, stored as a global model list; selection is
  written back to the active preset.
- Cache janitor next to Clear: shows live sizes for generated plates /
  reference snapshots / history index, with targeted cleanup per item.

### Fixed
- App renamed from GPT Image 2 to GPT Image (`com.pony.gptimagestudio`,
  `GPT Image-0.1.0-arm64.dmg`): on first launch the app copies settings /
  history / images from the legacy `GPT Image 2` (or dev `gpt-image-2`)
  folder when the new folder is empty — copy-only, the old folder is kept,
  and existing data is never overwritten.
- README no longer claims "most recent 5 generations" — the archive keeps full
  history (unbounded, newest first).
- Single-flight generation: a second Generate while one is in flight is ignored
  up front (renderer sync guard) with a main-process `busy` backstop, so rapid
  double-clicks can no longer overwrite each other's results.
- Archive list renders 100 entries per page with "加载更多" instead of mounting
  the entire history at once.
- `history.json` is now written atomically (tmp + rename); a corrupt index is
  renamed to `history.corrupt-<timestamp>.json` for recovery instead of being
  dropped — no user data is ever deleted by the app itself.
- URL-mode proxy downloads now time out after 60s and are capped at 50MB.
- Bottom-row alignment: the archive list now stretches to share the print
  frame's exact top and bottom (internal scroll), with equal-height headers.

## [0.1.0] · 2026-08-01

### Added
- First public release of the macOS desktop client.
- Native shell for OpenAI's GPT image generation models
  (`gpt-image-2` / `gpt-image-2.5` and compatible relays).
- Multiple aspect ratios: `21:9`, `16:9`, `3:2`, `4:3`, `1:1`, `3:4`, `2:3`, `9:16`.
- Three resolution tiers: `1K`, `2K`, `4K`.
- Three quality tiers: `Low`, `Med`, `High`.
- Quantity selector (1–4 plates per prompt).
- Reference image upload (drag-and-drop or click; supports JPG / PNG / WebP).
- Five built-in presets: **E-Commerce / Photography / Poster Design / Creative Art / Fine Art**.
- In-app archive of the full generation history with prompt metadata
  (previously documented as "most recent 5" — the code already kept everything).
- One-click save of generated plates to disk.
- Multi-provider API key configuration (BYO key).
- Universal macOS design language, English/Chinese mixed UI.

### Platform
- Apple Silicon (M-series) DMG, signed as an un-notarized developer build.
- Intel Mac, Windows, and Linux builds **planned** for future releases.

### Notes
- The app is a **client only**. You supply your own API key. Costs depend on
  the provider you configure and are typically a few cents to a few dozen cents
  per image.
- On first launch, macOS may show a "damaged" warning because the binary is
  not notarized. See the README for the standard workaround.
