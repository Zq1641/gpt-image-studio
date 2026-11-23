# Changelog

All notable changes to **gpt-image-studio** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
