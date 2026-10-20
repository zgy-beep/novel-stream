# 变更记录

本项目遵循语义化版本：

- 修 bug / 调整单个 token 值：补丁版本（2.1.x）
- 新增组件 / 新增 token（不破坏既有 DOM 与取值）：小版本（2.x.0）
- 重命名类 / token、删除 token、修改 DOM 契约：大版本（x.0.0）

## v2.2.0（2026-10-17）

描边精致化（修复 1px 圆角描边锯齿）+ 新增设计调用 API / 机器可读令牌 / AI 协作指南（小版本；无破坏性变更）。

**描边精致化**

- 移除 6 处圆角玻璃外框 1px 描边（`.nvui-modal` / `.nvui-panel` / `.nvui-floating` / `.nvui-tooltip` / `.nvui-toast` / `.nvui-glass`），
  改用「柔和顶部受光 + 阴影」成形（阴影 token 内含 `inset 0 1px 0 var(--nvui-glass-highlight)`），消除圆角处亚像素锯齿；
- `--nvui-glass-line` 改为「玻璃表面内直线分隔」：深 `rgba(255, 255, 255, 0.06)` / 浅 `rgba(255, 255, 255, 0.28)`，
  用于 modal / panel 的 header / footer 与导航底边等 7 处直线分隔（直线不产生圆角锯齿）；
- `--nvui-glass-highlight` 深 `rgba(255, 255, 255, 0.05)` / 浅 `rgba(255, 255, 255, 0.40)`（柔和顶部受光，替代外框边）；
- `.nvui-btn.is-ghost`：去 1px 描边，改 `--nvui-block-bg` 淡底（hover `--nvui-block-bg-2`）；
- `.nvui-tabs-indicator`：去 1px 内环，改底部直线强调 `box-shadow: inset 0 -2px 0 var(--nvui-accent-line)`；
- `.nvui-empty`：去虚线圆角边，改 `--nvui-bg-3` 淡底 + 居中提示；
- `--nvui-focus-ring-w` 1.5px → **2px**（单圈、整数像素，缩放更清晰，不叠内圈描边）。

**能力降级补齐（审计阶段 6 发现）**

- `.nvui-panel` 纳入 `@supports not` / `prefers-reduced-transparency: reduce` / `forced-colors: active` /
  `.nvui-solid` 四个降级块：无 `backdrop-filter`、减少透明度、高对比与实心模式下与 `.nvui-modal` 一样回退
  不透明表面（`--nvui-bg`）与系统色 `CanvasText` 边界，不再在面板上残留半透明+模糊；
- 测试新增 4 条面板降级断言（共 221 条），README §2.4 玻璃浮层清单补 `.nvui-panel`。

**新增可选文件（不计入 token / 组件类数量）**

- `nvui-api.js`：零依赖运行时 API（`createPanel` / `showToast` / `switchRow` / `inputRow` / `accordion` / `progress` /
  `openLayer` / `closeLayer` / `getToken` / `setTheme` 等），生成符合面板布局标准与无障碍契约的 DOM；Node 加载不访问 DOM；
- `tokens.json`：`tokens.css` 的机器可读镜像（`dark` 109 个 / `light` 47 个覆盖，逐值一致）；
- `AI-GUIDE.md`：给 AI 的协作指南（硬约束 / 读文件顺序 / SillyTavern 面板标准流程 / 其它软件移植 / 提示词模板 / API 速查 / 验收清单）；
- `package.json` 新增 `"main": "nvui-api.js"`（Node 侧可直接 `require('sillytavern-nvui-kit')` 做测试/静态生成）。

**文档**

- README 升 v2.2.0：文件表新增 `nvui-api.js` / `tokens.json` / `AI-GUIDE.md`，快速开始补可选 JS API 用法；
  新增第 13 章「JS API 与 AI 协作指南」（API 函数表 + createPanel 示例 + tokens.json 结构 + AI-GUIDE 用法 + 移植要点），
  原「许可」顺延为第 14 章；§3 / §4 / §7 / §12 更新描边新规（圆角玻璃无外框、直线分隔、ghost/空态/指示器去描边、焦点环 2px）；
  新增 `### 10.7 v2.1.1 → v2.2.0`；§11 增加 v2.2.0 记录；CHANGELOG / package.json 升 2.2.0。

## v2.1.1（2026-10-17）

反馈驱动补丁：描边再减弱、单圈焦点环、面板固定尺寸、隐藏滚动条（**无新增/删除类与 token，无破坏性变更**；覆盖 CSS 即可升级）。

**描边再减弱（只保留最低对比）**

- 深色：`--nvui-line` 0.07 → `0.05`、`--nvui-line-2` 0.12 → `0.08`、`--nvui-dash` 0.17 → `0.14`、
  `--nvui-block-line` 0.06 → `0.04`、`--nvui-block-line-2` 0.1 → `0.07`、
  `--nvui-glass-line` 0.06 → `0.03`、`--nvui-glass-highlight` 0.04 → `0.03`。
- 浅色：`--nvui-line` 0.08 → `0.06`、`--nvui-line-2` 0.14 → `0.10`、`--nvui-dash` 0.22 → `0.18`、
  `--nvui-block-line` 0.06 → `0.045`、`--nvui-block-line-2` 0.1 → `0.07`、
  `--nvui-glass-line` 0.35 → `0.18`、`--nvui-glass-highlight` 0.45 → `0.30`。
- 效果：分隔线、控件边、玻璃边进一步减弱，浮层近似无边框；玻璃 bg / 文字 / AA 政策不变。

**焦点环单圈 1.5px（修复输入框双描边）**

- `--nvui-focus-ring-w` 2px → `1.5px`；`.nvui-input:focus-visible` 删除内圈 `box-shadow: inset ... accent-line`，
  只保留单圈 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)`（其它组件本就单圈）。

**面板固定尺寸（折叠展开不跳变）**

- `.nvui-panel` 高度改为固定：桌面 `height: var(--nvui-panel-max-h)`（88vh）、≤600px 抽屉 `height: 92dvh`；
  宽度仍 `min(var(--nvui-panel-width), 100%)`；折叠 / 展开与 tab 切换只改变 body 内滚动内容，外框尺寸不变。

**隐藏滚动条（保留滚动能力）**

- `.nvui-panel-body` 与 `.nvui-modal-body` 增加 `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`；
  内容仍可滚动（`overflow-y: auto` / `overscroll-behavior: contain` 不变）。

**文档**

- README 升 v2.1.1：§3 设计原则补「描边再减弱 / 单圈焦点环」，§4 token 表更新全部新值，
  §7.3 弹窗正文与 §7.6 输入框聚焦说明改为单圈 1.5px，第 12 章补「固定尺寸不跳变 / 滚动条隐藏但可滚动」；
  新增 `### 10.6 v2.1.0 → v2.1.1`；§11 增加 v2.1.1 记录；CHANGELOG / package.json 升 2.1.1。

## v2.1.0（2026-10-17）

新增 **SillyTavern 插件面板布局标准（桌面 / 手机）**（小版本；无破坏性变更）。

**新增面板布局标准**

- 电脑（>600px）：`.nvui-overlay.is-panel > .nvui-panel` 居中玻璃面板，宽 `min(var(--nvui-panel-width), 100%)`（默认 880px）、
  高 `var(--nvui-panel-max-h)`（默认 88vh），顶部 `.nvui-tabs` 做分区导航。
- 手机（≤600px）：面板变为底部抽屉（bottom sheet）——底部对齐、全宽、`92dvh`、仅上圆角；隐藏顶部 tabs，
  显示 `.nvui-sheet-handle`（40×4 拖拽把手）与 `.nvui-bottom-nav` 底部图标导航（自动加 `env(safe-area-inset-bottom)`）。
- 同一份 DOM 随 600px 断点自动切换；`.nvui-panel-body` 是唯一滚动层，面板本身不滚动。
- 新增 10 个组件类（组件类总数 68 → 78）：`.nvui-panel`、`.nvui-panel-header`、`.nvui-panel-title`、
  `.nvui-panel-actions`、`.nvui-panel-body`、`.nvui-panel-footer`、`.nvui-panel-heading`、
  `.nvui-sheet-handle`、`.nvui-bottom-nav`、`.nvui-bottom-nav-item`。
- 新增 2 个尺寸令牌（token 总数 107 → 109）：`--nvui-panel-width: 880px`、`--nvui-panel-max-h: 88vh`。
- 新增状态类：`.nvui-overlay.is-panel`（面板模式遮罩）、`.nvui-switch-row.is-feature`
  （高亮功能行：左侧主色竖条 + 淡底）、`.nvui-bottom-nav-item.is-active`（手机导航当前项）。
- 排列规范（只参考常见插件面板截图的**结构**，视觉沿用 Kit Flat Glass 紫色主题）：
  面板标题栏（标题 + 次级操作 + 关闭）→ 分区导航（桌面顶部 tabs / 手机底部导航）→
  内容区（`.nvui-panel-heading` 分区标题 + 版本徽标、`is-feature` 功能开关行、`.nvui-acc` 折叠分组列表）→
  可选 `.nvui-panel-footer`。
- 无障碍：`.nvui-panel` 上 `role="dialog"` + `aria-modal="true"` + `aria-labelledby`；桌面 tabs 沿用
  tablist/tab/tabpanel 语义；手机底部导航 `<nav>` + `<button>` + `aria-current="page"`；关闭按钮 `aria-label`；
  焦点管理沿用 README §2.3 配方。
- 新增 JS 约定：桌面 tab / 手机底部导航 / tabpane 共用同一份激活状态
  （`aria-selected` / `aria-current` / `tabindex`），README 第 12 章给出同步配方。
- 文档：README 新增第 12 章「SillyTavern 插件面板布局标准（桌面 / 手机）」，原「许可」顺延为第 13 章；
  新增 `### 10.5 v2.0.1 → v2.1.0 新增面板布局标准`；§1 / §4 / §6.5 / §11 同步计数与令牌；CHANGELOG / package.json 升 2.1.0。

无破坏性变更：不删除/重命名 token 与类名，不改既有 DOM 契约；原有 `.nvui-modal` 弹窗继续可用，面板布局标准为可选新能力。

## v2.0.1（2026-10-17）

用户反馈驱动的补丁迭代（**无 token 增删、无破坏性 DOM/类名变化**；仅新增可选第 68 个组件类 `.nvui-tabs-indicator`。覆盖 CSS 即可升级；需业务适配的是 popover 级玻璃上的次要文字改用正文色，以及可选接入标签粘连指示器）。

**玻璃更透 / 浮层描边更柔和**

- 深色：`--nvui-glass-bg` 0.72 → `rgba(22, 26, 36, 0.64)`；`--nvui-glass-bg-strong` 0.88 → `rgba(22, 26, 36, 0.8)`；
  遮罩 `--nvui-overlay-bg` 0.55 → `rgba(6, 8, 14, 0.62)`（遮罩加深补偿 AA）；
  `--nvui-glass-line` 0.14 → `rgba(255, 255, 255, 0.06)`；`--nvui-glass-highlight` 0.1 → `rgba(255, 255, 255, 0.04)`；
  `--nvui-glass-blur` 18px → `20px`；`--nvui-glass-blur-sm` 10px → `12px`；`--nvui-glass-saturate` 140% → `150%`。
- 浅色：`--nvui-glass-bg-strong` 0.88 → `rgba(255, 255, 255, 0.8)`；`--nvui-glass-line` 0.7 → `rgba(255, 255, 255, 0.35)`；
  `--nvui-glass-highlight` 0.9 → `rgba(255, 255, 255, 0.45)`；`--nvui-glass-bg` 与遮罩不变。
- 效果：吐司静态形态、悬浮面板、工具提示的受光边与内高光几乎不可见，玻璃更通透，不再出现突兀亮描边。

**动效补强（关键帧 14 → 16）**

- 新增 `nvui-tabpane-in`（`.nvui-tabpane.is-active` 淡入 + 上移 6px）与 `nvui-switch-on`（`.nvui-switch-row input[type="checkbox"]:checked` 轨道回弹 0.92 → 1.04 → 1）。
- 开关按住时滑钮沿运动方向 `scaleX(1.12)` 拉伸（iOS 风格），松手弹簧回位；勾选态按住同时保留 `translateX`。
- 进度条叠 `::after` 扫光（`nvui-shimmer` 循环）；不确定进度关键帧增加 `scaleX` 呼吸（0.6 → 1 → 0.8）。
- 标签页新增可选「粘连」滑动指示器 `.nvui-tabs-indicator`（**v2.0.1 追加，第 68 个组件类**）：
  `stretch-then-settle` 算法（先拉长到「旧位置 ∪ 新位置」，`requestAnimationFrame` 两帧后收缩到目标）+ spring 过渡；
  无 JS 或未加 `is-indicator` 时自动回退为按钮自身高亮。README §7.7 提供约 25 行 JS 配方（点击 / 键盘 / resize / 字体加载同步）。

**减少动态效果与「强制播放动效」演示开关**

- 本机/系统开启「减少动态效果」（`prefers-reduced-motion: reduce`）时，kit 全部动效按无障碍红线降级为 `0.01ms`
  （含 `animation-delay` / `animation-iteration-count` 重置、`transition-duration: 0.01ms`）——这是预期行为，不是 bug。
- `preview.html` 顶部新增「强制播放动效」演示开关：给 `<body>` 加 `pv-force-motion`，并由 preview 局部 CSS 在 reduce 下覆盖动效时长
  （spinner / skeleton / progress / status-dot 等循环动画恢复 `infinite`）；支持 URL 参数 `?motion=1`，可与 `?theme=light`、`?solid=1` 叠加。
- 该开关与 `pv-` 前缀样式**仅存在于 preview.html，不进入 kit**；生产环境请尊重系统偏好（见 README §2.6）。

**数字输入框**

- 隐藏浏览器原生白色步进按钮（`::-webkit-inner-spin-button` / `::-webkit-outer-spin-button` 置 `-webkit-appearance: none; margin: 0`，并 `appearance: textfield`），暗色主题下不再突兀；
  键盘 ↑/↓ 与滚轮仍可调值；需要可见步进器时业务侧自建按钮并复用 `.nvui-icon-btn`。

**AA 政策调整（popover 级只承诺正文）**

- 深色弹窗级（遮罩 0.62 + 玻璃 0.64，纯白最坏）：text 10.33 / text-2 4.70（双达标）。
- 深色 popover 级（强玻璃 0.80，纯白最坏）：只承诺 `--nvui-text` 7.76；`--nvui-text-2` 为 3.53 不达标
  → popover 玻璃组件（`.nvui-floating` / `.nvui-tooltip` / `.nvui-toast` / `.nvui-glass`）正文必须用 `--nvui-text`，
  `.nvui-tooltip` 的 `color` 已从 `text-2` 改为 `text`。
- 浅色弹窗级（遮罩 0.30 + 玻璃 0.78，纯黑最坏）：text 9.31 / text-2 4.64；浅色 popover 级（0.80，纯黑最坏）：text 9.66 / text-2 4.81。
- 典型深色宿主 `#161a24` 下浅色弹窗级为 9.70/4.83（参考口径）。
- README §4.4 同步重写 AA 表与政策（含「popover 玻璃上的次要说明也用正文色」）；README 新增 `### 10.4 v2.0.0 → v2.0.1 修订说明`。

**文档**

- README/CHANGELOG/package.json 升 v2.0.1；README 更新 §2.4 / §4.1 / §4.2 / §4.4 / §10.3.2 玻璃取值与 AA 台词；
  §6.4.4 与 §7.17 关键帧 14 → 16；§7.5 开关按压拉伸与勾选回弹、§7.6 数字输入框隐藏原生步进按钮、
  §7.7 标签面板入场 + 新增「粘连」指示器 DOM 与 stretch-then-settle JS 配方（无 JS 回退）、
  §7.13 进度条扫光、§7.15 工具提示正文色；新增 §2.6「动效降级与强制播放动效演示开关」；
  §10.4 增补标签粘连指示器与演示强制动效；§11 增加 v2.0.1 记录（兼容性约定 2.0.x 保持）。

## v2.0.0（2026-10-17）

「Flat Glass（扁平玻璃）」设计语言升级：静态区块扁平化、浮层玻璃拟态、动效体系化、能力可降级。

**破坏性变更**

- 删除 `--nvui-shadow-accent`（主按钮悬停发光）：投影发光与「扁平优先」目标冲突；
  主按钮 hover 改为纯色加深（`--nvui-accent-strong-hover`）+ 顶部内高光。引用该 token 的插件需删除相关声明。
- 折叠面板 DOM 变更：`.nvui-acc-body` 改为 `grid-template-rows: 0fr ↔ 1fr` 高度动画容器，
  正文**必须**再包一层 `<div class="nvui-acc-inner">`（`min-height:0; overflow:hidden` + 左右内边距），
  否则展开内容会被裁剪为 0 高度。
- 视觉取值升级：`--nvui-overlay-bg` 深色改为 `rgba(6, 8, 14, 0.55)`、浅色 `rgba(15, 23, 42, 0.3)`；
  `--nvui-shadow-modal` / `--nvui-shadow-pop` 改为玻璃阴影（环境投影 + `inset 0 1px 0 var(--nvui-glass-highlight)`）；
  `--nvui-transition` / `--nvui-transition-slow` 改为组合引用新的时长/缓动令牌（`--nvui-duration-*` / `--nvui-ease-*`）。
- 焦点环统一：组件不再各写 `outline: 2px solid var(--nvui-accent)` 之类的散装样式，
  统一为 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)` + `outline-offset: var(--nvui-focus-ring-offset)`。
- 弹窗圆角改用新增的 `--nvui-radius-xl`（20px）；`--nvui-radius-lg`（16px）改用于吐司/悬浮面板/窄屏弹窗。

**新增**

- 玻璃层 7 令牌：`--nvui-glass-bg`（`rgba(22, 26, 36, 0.72)`）、`--nvui-glass-bg-strong`（`rgba(22, 26, 36, 0.88)`）、
  `--nvui-glass-line`、`--nvui-glass-highlight`、`--nvui-glass-blur`（18px）、`--nvui-glass-blur-sm`（10px）、`--nvui-glass-saturate`（140%）；
  浅色主题补齐玻璃 4 色（`rgba(255, 255, 255, 0.78)` / `0.88` 等）。
- 焦点环 3 令牌：`--nvui-focus-ring-color` / `--nvui-focus-ring-w` / `--nvui-focus-ring-offset`。
- 动效体系 12 令牌：时长 `--nvui-duration-fast|base|slow`、缓动 `--nvui-ease-standard|emphasized|spring`、
  组合 `--nvui-transition` / `--nvui-transition-slow`、循环/序列 `--nvui-shimmer-duration` / `--nvui-pulse-duration` /
  `--nvui-stagger-step` / `--nvui-enter-distance`；`--nvui-transition` 取值改为组合引用。
- 骨架屏 2 令牌（`--nvui-skeleton-bg` / `--nvui-skeleton-shine`）与 `--nvui-radius-xl`；浅色主题同步补齐。
- 新增 `--nvui-on-accent: #ffffff`（主色填充上的文字/图标色）：主按钮不再借用开关滑钮的 `--nvui-knob`，消除语义耦合（AUD-14）；两主题同值，浅色主题无需重复覆盖。
- 新增 14 个类：`.nvui-glass`（玻璃工具类）、`.nvui-solid`（实心扁平模式根开关）、`.nvui-acc-inner`（折叠裁切层）、
  `.nvui-toast` / `.nvui-toast-stack`（吐司与堆栈）、`.nvui-progress` / `.nvui-progress-bar`（进度条）、
  `.nvui-skeleton`（骨架屏）、`.nvui-status-dot`（状态点）、`.nvui-fade-in` / `.nvui-slide-up` / `.nvui-pop-in` /
  `.nvui-stagger` / `.nvui-pulse`（动效工具类）。
- 动效系统：14 个 `nvui-` 前缀关键帧（spin / fade-in / slide-up / pop-in / overlay-in/out / modal-in/out /
  toast-in/out / tab-select / shimmer / progress-indeterminate / pulse）；弹窗与遮罩进出场、折叠高度动画、
  标签页激活弹跳、开关弹簧滑钮、按钮/图标按钮按压缩放、吐司进出场、骨架屏扫光、不确定进度、状态点呼吸。
- 能力降级：每个 `backdrop-filter` 同时写 `-webkit-backdrop-filter`；`@supports not` 回退不透明；
  `.nvui-solid` 实心模式；`prefers-reduced-transparency: reduce`；`forced-colors: active`（`CanvasText` 描边）；
  窄屏弹窗模糊降档；`prefers-reduced-motion` 降级补充 `animation-delay` / `animation-iteration-count` 重置。
- AA 安全玻璃：按 sRGB 逐通道合成验算，最坏宿主背景（深色主题纯白 `#ffffff` / 浅色主题纯黑 `#000000`）下
  玻璃表面上的 `--nvui-text` 与 `--nvui-text-2` 仍 >= 4.5:1（深色 10.52/4.79、10.30/4.69；浅色 9.31/4.64、11.80/5.88；
  典型深色宿主 `#161a24` 下为 9.70/4.83、12.15/6.05）。
- 测试门禁：`test/test-ui-kit.js` 升级为 v2 守护——107 个核心 token 显式清单、玻璃合成对比度验算、
  14 关键帧全部被引用、focus ring 统一 token、折叠 grid 高度动画、降级块存在性、`!important` 预算（<=8）、
  文案取值防漂移（README 玻璃精确值）。

**可访问性修复（阶段 1 审计 AUD-06 / AUD-11 / AUD-13 / AUD-14）**

- 状态行对比度：`.nvui-status-time` / `.nvui-status-file` 改用 `--nvui-text-2`、去掉 `opacity` 降透明度，修正 11px 时间戳/路径在玻璃与浅色宿主下对比度不足的问题。
- 开关非文本对比度（WCAG 1.4.11）：`--nvui-switch-off-bg` 深色改为 `rgba(255, 255, 255, 0.34)`、浅色改为 `rgba(15, 23, 42, 0.47)`；深色 `--nvui-knob-off` 改为 `var(--nvui-text)`；关闭态轨道与页面背景、滑钮与轨道均 >= 3:1。
- 弹窗焦点管理（AUD-13）：README 补充「打开时把焦点移入弹窗（优先主按钮 / 标题 `tabindex="-1"`）、Tab 与 Shift+Tab 焦点陷阱、关闭后焦点归还触发元素」的最小实现配方，避免 `aria-modal="true"` 只停留在标记层。
- 焦点环统一走 token；`prefers-reduced-motion` 降级补齐 `animation-delay` / `animation-iteration-count` 重置。

**文档**

- README 重写为 v2 规范（设计原则/玻璃 AA/动效体系/新组件/宿主红线第 9 条/迁移对照），
  新增 `### 10.3 v1.1.0 → v2.0.0 迁移对照`；新增 `AUDIT.md` 架构审核报告；`package.json` 升级为 2.0.0。

## v1.1.0（2026-10-17）

- 独立项目化：自带 `package.json`、`LICENSE`、`CHANGELOG.md`、`test/` 与 `.gitignore`；
  不再依赖来源仓库的 `style.css`、根目录测试或相对路径链接，**可整目录移动到任意文件夹/仓库**。
- `README.md` 去除对来源仓库的相对链接，补充独立项目结构、独立运行方式与版本约定。
- 守护测试改为项目内自洽：内置核心 token 金标准取值、kit 版本在四处（package.json / CSS 头 / README / CHANGELOG / preview）一致；
  不再读取来源仓库文件，`cd` 进本目录即可运行。
- 来源说明：从 novel-stream 扩展 v1.19.1 的浮动 UI 提炼；迁移对照表保留为历史参考。

## v1.0.0（2026-10-17）

- 首个版本：84 个设计令牌（深色 + 浅色覆盖）、13 个组件族、离线组件预览页、设计规范文档、守护测试。
