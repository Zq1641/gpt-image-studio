# Launch Kit · 5 平台发布文案

> 配套 README + Release v0.1.0 使用。按平台调性分别给出可直接复制粘贴的稿件。
> 发稿前把文里的具体链接（`https://github.com/ponypray/gpt-image-2-desktop`）替换成你自己的。

---

## 1. V2EX · `分享创造` 节点

**标题**（≤ 60 字符，带数字/反差更易点开）：

```
开源了一个 macOS 桌面客户端，调用 gpt-image-2 一次只要几分钱（MIT）
```

**正文**：

```
自荐一下自己做的工具，gpt-image-2 的桌面客户端。

[一句话定位]
原生 macOS 客户端，把 OpenAI 的 gpt-image-2 装进一个安静的工作台，BYO API key，
按张计费（一次几分钱到几毛钱，取决于你接的 API 报价）。

[为什么做这个]
网页版生图有 3 个痛点：贵、慢、要复制粘贴 Base64。
这个工具全本地操作：键入提示词 → 点 Generate → 图直接出在屏上 → 一键保存。
批量生图、参考图拖入、8 种比例 / 3 档分辨率 / 3 档质量都有。

[有什么不一样]
- 5 个内置预设（电商 / 摄影 / 海报 / 创意 / 艺术）
- 最近的 5 次生成可回看（提示词 + 比例 + 时间）
- 不接你 API 的话，工具本身零成本

[下载]
Apple Silicon DMG（94 MB）：https://github.com/ponypray/gpt-image-2-desktop/releases

[重要提示]
⚠️ 因为没买 Apple 开发者证书（年费 $99），首次打开 macOS 会提示"已损坏"。
不是真损坏，按 README 的指引在「系统设置 → 隐私与安全性」点"仍要打开"即可。

Intel Mac / Windows / Linux 暂时没做（一个人精力有限），
想要的兄弟先 Star，后续按热度排开发优先级。

仓库：https://github.com/ponypray/gpt-image-2-desktop
协议：MIT · 求 Star 让我知道你们需要。
```

**配图**：banner.png（README 顶部那张杂志风格图）+ screenshot.png（界面展示）

**发文时间建议**：工作日 9:30-10:30 或 21:00-22:30（V2EX 流量高峰）

---

## 2. 即刻 / X (Twitter) · 短推

**首选推文**（≤ 280 字符）：

```
做了一个 macOS 桌面客户端调用 gpt-image-2。

原生壳 · BYO API key · 8 种比例 · 3 档分辨率
本机归档最近 5 张 · 一键保存

一次成本几分钱到几毛钱，看你接的 API 报价。

Apple Silicon · MIT · 0.1.0
https://github.com/ponypray/gpt-image-2-desktop
```

**配图 1 张**：`feature-cost.png`（成本透明那张最抓眼）

**Thread 备选**（3 推串成故事）：

```
1/ 想做这个工具的起因：网页版 gpt-image-2 体验割裂，每张图都要等、复制、下载。
   所以做了个原生 macOS 客户端。

2/ 它有的：8 种比例、3 档分辨率、3 档质量、5 个预设、参考图、本机归档 5 张。
   它没有的：账号体系、内购、广告、追踪。
   成本完全走你自己的 API key。

3/ 0.1.0 · Apple Silicon · MIT
   https://github.com/ponypray/gpt-image-2-desktop
   
   Intel Mac / Windows / Linux 想用？Star 让仓库作者知道。
```

**关键 tag**：`#OpenAI` `#gpt-image-2` `#macOS` `#IndieDev` `#OpenSource`

---

## 3. 少数派 (sspai.com) · 教程长文

**标题**（带数字 + 痛点）：

```
自己做一个 macOS 桌面客户端，绕过网页版 gpt-image-2 的 3 个痛点
```

**副标题**：

```
关键词：gpt-image-2 · macOS · 桌面客户端 · BYO API key · MIT 开源
```

**正文大纲**（约 2000 字，分 5 段）：

```
0 · 缘起
   网页版生图的 3 个具体痛点：生图慢（页面刷新 + 加载动画）、生图贵（看不到明细）、
   生图难（要复制粘贴 Base64 / 反复登录）。

1 · 它是什么
   一句话：把 gpt-image-2 装进一个安静的工作台。
   截 1-2 张 UI 截图，介绍三栏布局：左侧控制、中间预览、右侧预设 + 历史归档。

2 · 怎么做出来的
   技术栈：Electron 32 + React 18 + TypeScript 5 + electron-vite 2。
   为什么用 Electron：跨平台铺路、迭代快、个人项目成本低。
   一次 build 出来的产物：94 MB DMG（包含 Chromium + Node 运行时）。
   截图：build 流程 / package.json scripts 片段。

3 · 成本算了一笔账
   用截图展示 ¥0.05/image 的实际账单（已脱敏）。
   说明影响因素：分辨率（4K 是 1K 的 3-5 倍）、张数、参考图。
   强调"工具本身免费，费用全走你自己的 API 渠道"。

4 · 怎么装 / 怎么用
   - 下载：DMG 链接
   - 首次打开"已损坏"提示的处理（含 `xattr -cr` 一行命令）
   - 5 分钟上手：填 API key → 选预设 → 写提示词 → Generate → Save

5 · 路线图 & 你的 Star 是燃料
   Intel Mac / Windows / Linux 都在计划中。
   列 todo 清单。
   求 Star 求 Issue 求讨论。

结尾 · 开源协议 & 仓库链接
```

**投稿渠道**：少数派 Matrix 频道 / 少数派投稿系统（`https://sspai.com/post`）

**关键要求**：
- 投稿前自己首发在自己的少数派账号上，等 24h 没被采纳再考虑换平台
- 文中所有图片**先压缩到单张 ≤ 2 MB**（少数派图片上传限制）
- 文末加 `本文对应开源仓库：https://github.com/ponypray/gpt-image-2-desktop` 真实链接

---

## 4. 掘金 / 知乎 · 教程+软文

**标题**（搜索友好）：

```
用 Electron + React 做了一个 gpt-image-2 桌面客户端（开源 MIT）
```

**正文大纲**（约 1500 字）：

```
0 · 背景
   OpenAI 出了 gpt-image-2 网页版，但用起来有几个不爽的地方。
   这次来分享一下我怎么把它包成原生桌面 app。

1 · 技术选型
   - 为啥选 Electron：跨平台铺路、个人项目成本低、API 跟 web 一致
   - electron-vite vs 纯 vite：preload / main / renderer 三进程分离更清晰
   - React + TypeScript：成熟、招人容易（虽然这项目就我一个人）

2 · 关键模块拆解
   - 主进程 (src/main)：API 客户端、设置存储、协议处理
   - preload (src/preload)：IPC 桥
   - 渲染进程 (src/renderer)：React UI、状态管理
   - shared (src/shared)：类型 + IPC schema

3 · 一些工程细节
   - API key 怎么存：electron-store + 加密
   - 4K 图怎么不卡：流式输出 + 占位骨架
   - 历史归档：最近 5 张 + 元数据（时间、比例、provider）

4 · 打包
   - electron-builder 配置
   - "提示损坏" 问题的根源 + 解法

5 · 仓库 + 求 Star
   https://github.com/ponypray/gpt-image-2-desktop
   协议 MIT，欢迎 PR
```

**掘金 tags**：`Electron` `React` `TypeScript` `OpenAI` `开源` `macOS`

**知乎话题**：`#Electron` `#开源项目` `#OpenAI` `#macOS开发` `#独立开发`

---

## 5. Product Hunt · 英文渠道

**Tagline**（≤ 60 字符，Hacker News 风格反问/数据）：

```
A native macOS client for OpenAI's gpt-image-2. BYO key. ~$0.01/image.
```

**Description**（≤ 260 字符）：

```
A calm, native macOS desktop client for OpenAI's gpt-image-2 image
generation model. 8 aspect ratios, 3 resolution tiers, 5 built-in
presets, local archive of the last 5 generations. BYO API key — you
pay your provider, nothing else. MIT licensed. Apple Silicon only for
now; Intel/Windows/Linux on the roadmap.
```

**Topics / Categories**：`Developer Tools` · `Design Tools` · `Productivity` · `Open Source` · `Artificial Intelligence`

**First Comment (Hunter 自己发的引导文)**：

```
Hey Product Hunt 👋

I'm pony, the solo maker of gpt-image · studio.

Why this exists: GPT image models are incredible, but the web UI
fights you — slow loads, hidden pricing, and Base64 you have to copy
into a new tab. This wraps it in a calm, local, native macOS shell.

A few things to call out:

✅ BYO API key — no markup, no accounts, no telemetry
✅ 8 aspect ratios + 3 resolution tiers (1K/2K/4K)
✅ Local archive of the last 5 generations with full metadata
✅ 5 built-in presets (E-Commerce / Photography / Poster / Creative / Fine Art)

⚠️ Apple Silicon only for v0.1.0. The binary is unsigned (no Apple Dev
Program), so macOS will warn "damaged" on first open — README has the
one-click fix.

Roadmap: Intel Mac, Windows, Linux. Star the repo if you want them
sooner — I prioritize by demand.

https://github.com/ponypray/gpt-image-2-desktop

Happy to answer anything in the comments 🙏
```

**Gallery 配图顺序**（PH 列表页只能看第一张，要选最有冲击力的）：

1. `banner.png` — 杂志封面风格首图
2. `screenshot.png` — 真实界面
3. `feature-cost.png` — 成本透明
4. `feature-platforms.png` — 路线图

**PH 发布节奏**：
- 选周二-周四 **美西时间 0:01 AM**（即北京时间下午 4 点）发
- 前 4 小时自己顶 5-10 条有质量的评论（不要光发 "nice"）
- 24h 内争取到 Top 5 of the day

---

## 附录 · 通用注意事项

- **首发顺序建议**：V2EX → 即刻 → 掘金/知乎（隔 1-2 天发，避免被搜索引擎去重）→ 少数派（投稿，最长）→ Product Hunt（英文圈冲击）
- **每个平台都放仓库链接 + Star 按钮** — 这是单一转化目标
- **回复前 20 条评论用文字、附 emoji、不用图片**（人设感）
- **不要在推文里说"我做的第一个开源项目"** — 这种自我矮化会让算法降权
- **每周固定时间回复 Issues / Discussions**（哪怕只是 "triaged"）— 让仓库看起来在维护
- **30 天内不要发 "v0.2 进展如何"** — 等真有进展再说，否则 Star 数会假性回撤（关注者 unfollow 噪声）
