# SillyTavern 插件 UI Kit · Flat Glass 设计规范

> 版本：**v3.1.1**（2026-11-17）· 设计语言 **Flat Glass（扁平玻璃）** · 零依赖 · 可整目录复用

给 SillyTavern 插件用的自包含浮动 UI 设计系统：两个 CSS 文件接入即可获得一致的弹窗、面板、表单、反馈与动效；需要时再加一个零依赖 JS API 生成符合规范的 DOM。**样式层没有运行时；`nvui-api.js` 是可选增强。**

> 阅读约定：文中所有「当前取值」（令牌数量、组件类数量、焦点环宽度、面板尺寸等）以 `tokens.css` / `tokens.json` / `test/test-ui-kit.js` 为唯一事实源；版本历史只保留摘要，完整记录见 [CHANGELOG.md](CHANGELOG.md)。

| 关键事实 | 当前值 |
| :--- | :--- |
| 设计令牌 | 111 个（深色默认）+ 47 个浅色覆盖 |
| 组件类 | 84 个（`nvui-` 前缀；`is-*` 状态类另计） |
| 关键帧 | 16 个 |
| `!important` 预算 | 18 条（四类，见 [§9](#9-命名与工程约定)；v2.8.0 新增 force 玻璃 4 条） |
| 运行依赖 | 0 个（Node 仅测试用） |
| 验证 | `npm test`（规范守护，零依赖） |
| 效果预览 | [preview.html](preview.html) · [在线版](https://zgy-beep.github.io/ui-kit/preview.html) |

**先看哪一章**

| 你的目的 | 建议路径 |
| :--- | :--- |
| 新插件接入，先跑起来 | [§2 快速开始](#2-快速开始) → [§7 组件规范](#7-组件规范) |
| 用 JS 直接生成面板 | [§13.1 设计调用 API](#131-设计调用-apinvui-apijs) |
| 查颜色 / 字号 / 间距 / 动效 | [§4](#4-配色规范) → [§5](#5-文字与排版) → [§6](#6-尺寸间距圆角阴影动效层级) |
| 旧项目迁移 / 版本升级 | [§10 迁移与升级](#10-从-novel-stream-迁移对照表) → [CHANGELOG.md](CHANGELOG.md) |
| 排查宿主兼容问题 | [§8 宿主兼容红线](#8-sillytavern-宿主兼容红线) → [§13.7 宿主模态](#137-载体与宿主模态主动让位而非硬压) |
| 让 AI 按规范写界面 | [AI-GUIDE.md](AI-GUIDE.md) + [tokens.json](tokens.json) |

**30 秒最小示例**（完整骨架、焦点管理与进出场时序见 [§2.3](#23-弹窗骨架含浮层载体)）

```css
@import url('./ui-kit/tokens.css');
@import url('./ui-kit/components.css');
```

```html
<dialog class="nvui-tl" id="hello_layer">
    <div class="nvui-overlay" id="hello_overlay" hidden>
        <div class="nvui-modal" role="dialog" aria-modal="true" aria-labelledby="hello_title">
            <div class="nvui-modal-header">
                <b class="nvui-modal-title" id="hello_title">你好</b>
                <span class="nvui-modal-actions">
                    <button type="button" class="nvui-icon-btn" data-close aria-label="关闭">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </span>
            </div>
            <div class="nvui-modal-body">把面板内容放这里。</div>
            <div class="nvui-modal-footer">
                <button type="button" class="nvui-btn is-primary" data-close>好</button>
            </div>
        </div>
    </div>
</dialog>
```

> 打开：`layer.show(); overlay.hidden = false;`；关闭、Esc、焦点归还见 [§2.3](#23-弹窗骨架含浮层载体)。想要完整插件面板（桌面居中 / 手机底部抽屉）直接看 [§12](#12-sillytavern-插件面板布局标准桌面--手机) 或 `NVUI.createPanel()`。

**运行时资产（接入只需要这些）**

| 文件 | 作用 |
| :--- | :--- |
| [`tokens.css`](tokens.css) | 设计令牌：表面 / 玻璃 / 分隔 / 文字 / 主色 / 语义 / 焦点环 / 字体 / 间距 / 圆角 / 阴影 / 动效 / 层级 / 尺寸；深色默认 111 个，`.nvui-theme-light` 覆盖 47 个 |
| [`components.css`](components.css) | 组件样式与 16 个关键帧：全部 `nvui-` 前缀，颜色只引用 token |
| [`nvui-api.js`](nvui-api.js) | **可选**零依赖运行时：`createPanel` / `showToast` / `switchRow` / `inputRow` / `accordion` / `progress` 等，生成合规 DOM 与无障碍属性；Node 下 `require` 不访问 DOM |
| [`tokens.json`](tokens.json) | `tokens.css` 的机器可读镜像（dark 111 / light 47），供构建工具、其它软件与 AI 读取；由 CSS 生成，勿手改 |
| [`preview.html`](preview.html) | 离线组件预览（双击即开）：深 / 浅主题、实心 / 玻璃、面板 / 动效 / API 演示，支持 URL 参数 |
| [`st-extension-template/`](st-extension-template/) | 可直接复制的 SillyTavern 扩展骨架（manifest + index.js + style.css + 内嵌 kit 运行时） |

**项目与维护文件**

| 文件 | 作用 |
| :--- | :--- |
| [`README.md`](README.md) | 本规范：定位、接入、令牌、组件、宿主红线、迁移、API |
| [`AI-GUIDE.md`](AI-GUIDE.md) | 给 AI 编码助手的操作手册：硬约束、读文件顺序、面板标准流程、提示词模板、验收清单 |
| [`CHANGELOG.md`](CHANGELOG.md) | 变更记录与版本时间线（**历史事实的唯一来源**） |
| [`MAINTAINING.md`](MAINTAINING.md) | 维护流程规范：提交时机与信息格式、版本三态与升位判定、GitHub issue 关闭判据、每轮 DoD |
| [`MIGRATION-v3.md`](MIGRATION-v3.md) | **v2.9 → v3.0 迁移指南**：四类破坏性变更的杀伤力分级、v1/v2 状态映射、尺寸载体切换与过渡开关历史、升级步骤 |
| [`MIGRATION-v2.md`](MIGRATION-v2.md) | v2.0 → v2.9 历史版本差异速查（每条一行「下游需要做什么」） |
| [`UPGRADING.md`](UPGRADING.md) | 常青升级指南：从上一版升到当前版本的具体动作与验收清单 |
| [`AUDIT.md`](AUDIT.md) | 架构审核报告：v1.1.0 评估、v2.0.0/v2.0.1 复核与问题清单 |
| [`ROADMAP.md`](ROADMAP.md) | 下一阶段计划：v3.1.0 / v4.0.0 的任务拆解、验收标准、风险与待拍板项（追踪：GitHub issue #19 已结项） |
| [`ISSUES.md`](ISSUES.md) | 缺陷与审查项的本地追踪表：复现证据、修复点、实机数据（与 GitHub Issues 双向对应） |
| [`package.json`](package.json) | 项目元信息与 `npm test` / `test:browser` / `test:e2e` 入口 |
| [`LICENSE`](LICENSE) | MIT 许可 |
| [`test/test-ui-kit.js`](test/test-ui-kit.js) | 规范守护测试：token 完整性、三方覆盖、无硬编码颜色、WCAG 与玻璃合成对比度、宿主红线、动效/降级、版本自洽 |
| [`test/st-*.js`](test/) | 真实 SillyTavern 宿主实机脚本（需 `playwright-core` + 本机 Chrome）：层级、玻璃降级、宿主模态让位、性能实测 |

目录

- [1. 它是什么 / 不是什么](#1-它是什么--不是什么)
- [2. 快速开始](#2-快速开始)
- [3. 设计原则](#3-设计原则)
- [4. 配色规范](#4-配色规范)
- [5. 文字与排版](#5-文字与排版)
- [6. 尺寸、间距、圆角、阴影、动效、层级](#6-尺寸间距圆角阴影动效层级)
- [7. 组件规范](#7-组件规范)
- [8. SillyTavern 宿主兼容红线](#8-sillytavern-宿主兼容红线)
- [9. 命名与工程约定](#9-命名与工程约定)
- [10. 从 novel-stream 迁移对照表](#10-从-novel-stream-迁移对照表)
- [11. 版本管理](#11-版本管理)
- [12. SillyTavern 插件面板布局标准（桌面 / 手机）](#12-sillytavern-插件面板布局标准桌面--手机)
- [13. JS API 与 AI 协作指南](#13-js-api-与-ai-协作指南)
- [14. 许可](#14-许可)

> 常用小节直达：[§2.3 弹窗骨架](#23-弹窗骨架含浮层载体)、[§4.4 AA 验算](#44-aa-安全玻璃与合成对比度验算)、[§7.7 标签页与指示器](#77-标签页激活弹跳--粘连指示器)、[§7.8 折叠面板](#78-折叠面板新-dom--高度动画)、[§12.5 面板 DOM](#125-完整-dom-示例含-aria--roles)、[§13.1 API](#131-设计调用-apinvui-apijs)、[§13.7 宿主模态](#137-载体与宿主模态主动让位而非硬压)。

---

## 1. 它是什么 / 不是什么

**是什么**

- 一套**自包含、主题可切换的浮动 UI 设计系统**：弹窗、插件面板、标签页、折叠分组、胶囊开关、独立复选框、按钮、输入行、提示/告警、状态行、徽标、空态、骨架屏、进度条、吐司、悬浮面板。
- 一套 **Flat Glass（扁平玻璃 / 玻璃拟态）设计语言**：静态区块只用色阶与间距表达层级（不描边、不投影、不渐变）；浮层（弹窗 / 遮罩 / 悬浮面板 / 工具提示 / 吐司 / `.nvui-glass`）用半透明磨砂玻璃 + 柔和受光边 + 阴影。**动效与能力降级全部写在 CSS 内**。
- 一套 **SillyTavern 插件面板布局标准**：电脑居中玻璃面板 / 手机底部抽屉 + 底部图标导航，同一份 DOM 随 600px 断点自动切换（见 [§12](#12-sillytavern-插件面板布局标准桌面--手机)）。
- 一套**可选的设计调用接口与 AI 资产**：`nvui-api.js`（零依赖 JS API）、`tokens.json`（机器可读令牌）、`AI-GUIDE.md`（AI 协作手册），见 [§13](#13-js-api-与-ai-协作指南)。
- 一套**可复制的实现**：把本目录整个拷进插件，`@import` 两个 CSS 即可用；无构建工具、无第三方依赖。
- 一个**独立项目**：自带 `package.json` / `LICENSE` / `CHANGELOG.md` / `test/`，可整目录复制或移动到任意文件夹/仓库，`npm test` 即可独立验证。
- 一套**有守护的规范**：`test/test-ui-kit.js` 自动检查令牌是否齐全、组件是否被预览与文档覆盖、是否泄漏裸选择器、是否硬编码颜色、对比度是否达标（含玻璃合成对比度）、动效与降级红线、版本是否自洽。
- 一套**可降级的动效体系**：动效只表达层级/方向/因果，全部尊重 `prefers-reduced-motion`；玻璃能力缺失、用户减少透明度、强制颜色模式、窄屏低性能设备都有明确回退。

**不是什么**

- **不是通用组件框架**：样式层没有 JS 运行时，交互（标签切换、折叠开合、拖拽、Esc/遮罩关闭、弹窗进出场收尾）由业务用少量原生 JS 按约定实现；`nvui-api.js` 只是可选的 DOM 生成器，不用它也能完整使用本规范。
- **不是酒馆主题的替代品**：不要把 `.nvui-*` 组件塞进聊天消息流；聊天区必须沿用宿主主题变量。
- **不提供图标字体**：图标沿用宿主的 Font Awesome（`<i class="fa-solid fa-...">`）；kit 内只有纯 CSS 的箭头/滑钮/加载环/状态点/骨架扫光。
- **不是动效库**：只提供入场/反馈/循环三类基础动效与工具类，不做复杂页面转场编排。
- **不是玻璃滤镜包装器**：玻璃只允许用在浮层上，静态区块不允许 `backdrop-filter`；玻璃承担的是「浮在内容之上」的空间语义。

**术语约定**（全文统一用词）

| 术语 | 含义 |
| :--- | :--- |
| 载体 | `<dialog class="nvui-tl">` 浮层容器，负责层级与 fixed 包含块；非模态 `show()`。正文统一用「载体」，「浮层载体 / 顶层载体」是其同义说法 |
| 浮层 | 载体内的遮罩 / 弹窗 / 悬浮面板 / 工具提示 / 吐司 |
| 弹窗 | `.nvui-modal`，带遮罩的通用对话框 |
| 面板 | `.nvui-panel`，插件设置面板（电脑居中 / 手机底部抽屉） |
| 吐司 | 右下角短暂提示 `.nvui-toast` |
| 宿主 | 承载插件的 SillyTavern 页面 |
| 令牌 | `--nvui-*` CSS 变量，唯一事实源是 `tokens.css`（镜像 `tokens.json`） |
| 组件类 | `components.css` 定义的 `nvui-*` 视觉类，当前 80 个 |
| 状态类 | `is-*` 前缀的状态修饰类（`is-active` / `is-open` / `is-primary` ...），不计入 80 |

---

## 2. 快速开始

本目录是独立项目：不依赖任何外部仓库或父目录，可整目录复制和移动到任意位置。最小验证只需要 `npm test`（**运行时零依赖**，无需 `npm install`）；预览直接双击 `preview.html`。

浏览器/宿主套件需要一个**开发期**依赖（不进 4 个发布资产）：`npm i` 会装上 `playwright-core`，Chrome 走本机安装（`CHROME_PATH` 可覆盖）。依赖解析与缺包时的修复命令统一在 `scripts/resolve-browser.js`；一键门禁见 `npm run verify:all`（CI 无 Chrome 时浏览器段自动跳过）。

```text
ui-kit/
  tokens.css            <- 设计令牌（先引入）
  components.css        <- 组件样式与关键帧
  nvui-api.js           <- 可选：零依赖 JS API
  tokens.json           <- 可选：令牌机器可读镜像
  AI-GUIDE.md           <- 可选：给 AI 的协作手册
  preview.html          <- 离线预览页
  README.md             <- 本规范
  CHANGELOG.md
  AUDIT.md
  LICENSE
  package.json
  test/                 <- 规范守护测试 + 实机脚本
  st-extension-template/ <- 可直接复制的 ST 扩展骨架
```

> Node.js 要求 >= 16，仅测试需要；`tokens.css` / `components.css` 在浏览器与酒馆中直接使用，无 Node 依赖。

### 2.1 引入

核心只有两个 CSS 文件，**`tokens.css` 必须排在 `components.css` 之前**。按使用场景三选一：

| 方式 | 适用场景 | 入口 |
| :--- | :--- | :--- |
| 本地目录（推荐） | 常规酒馆插件 | `@import` 插件内的 `./ui-kit/` 目录 |
| 在线 CDN | 网页 / 外部项目 / 一次性演示 | jsDelivr 固定 tag |
| 酒馆助手单文件 | Tavern Helper / JS-Slash-Runner 脚本 | 运行时动态加载并挂到顶层文档 |

#### 2.1.1 本地目录（常规酒馆插件）

插件 `style.css` 顶部引入（`@import` 必须在所有规则之前）：

```css
@import url('./ui-kit/tokens.css');
@import url('./ui-kit/components.css');
```

集成后的目录结构：

```text
your-plugin/
  manifest.json
  index.js
  style.css          <- 顶部 @import ./ui-kit/...
  ui-kit/            <- 本目录（可整目录拷入）
    tokens.css
    components.css
    nvui-api.js      <- 可选：<script src="./ui-kit/nvui-api.js"></script>
    tokens.json
    AI-GUIDE.md
    preview.html
    README.md
    CHANGELOG.md
    AUDIT.md
    LICENSE
    package.json
    test/
```

需要 JS 生成面板或吐司时，再引入运行时：

```html
<script src="./ui-kit/nvui-api.js"></script>
```

```js
const panel = NVUI.createPanel({
    id: 'my_plugin_panel',
    title: '我的插件设置',
    version: 'v1.0.0',
    tabs: [
        { key: 'basic', label: '基本设置', icon: 'fa-solid fa-sliders' },
        { key: 'advanced', label: '高级', icon: 'fa-solid fa-wrench' }
    ]
});
panel.addSwitch('basic', { label: '启用自动连载', value: true, feature: true });
panel.open();
```

API 生成的 DOM 自动符合 [§12](#12-sillytavern-插件面板布局标准桌面--手机) 的布局标准与 §7 的无障碍契约（`role`/`aria`、桌面 tabs 与手机底部导航同步、焦点管理、Esc / 点遮罩关闭）。完整函数表见 [§13.1](#131-设计调用-apinvui-apijs)。

#### 2.1.2 在线 CDN（网页 / 外部项目）

```html
<!-- 设计令牌与组件样式 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v3.1.1/tokens.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v3.1.1/components.css">

<!-- 可选运行时 API -->
<script src="https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v3.1.1/nvui-api.js"></script>
```

> 三份资源必须锁定**同一个 tag**，避免令牌、样式与运行时版本漂移；CDN 缓存刷新可能略晚于 tag 推送。

#### 2.1.3 酒馆助手（Tavern Helper）单文件脚本

单文件脚本里动态加载 CDN 资源，并挂到 `window.parent` 的顶层文档：

```js
async function ensureNVUI() {
    const W = window.parent || window, D = W.document;
    if (W.NVUI) return W.NVUI;
    const CDN = 'https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v3.1.1'; // 三份资源锁同一 tag

    // v2.7.2：先等 CSS 就绪再初始化，否则玻璃探测会在 CSS 缺席时误判为「不支持模糊」
    const loadCss = (id, href) => new Promise((resolve, reject) => {
        const existing = D.getElementById(id);
        if (existing && existing.sheet) { resolve(); return; }
        const link = D.createElement('link');
        link.id = id; link.rel = 'stylesheet'; link.href = href;
        link.onload = resolve;
        link.onerror = () => reject(new Error('NVUI: 样式加载失败 ' + href));
        D.head.appendChild(link);
    });
    await loadCss('nvui-css-tokens', `${CDN}/tokens.css`);
    await loadCss('nvui-css-components', `${CDN}/components.css`);

    if (!W.NVUI) {
        await new Promise((resolve, reject) => {
            const s = D.createElement('script');
            s.id = 'nvui-js-api'; s.src = `${CDN}/nvui-api.js`;
            s.onload = resolve; s.onerror = reject;
            D.head.appendChild(s);
        });
    }
    return W.NVUI;
}

(async () => {
    const NVUI = await ensureNVUI();
    const panel = NVUI.createPanel({
        id: 'my_helper_panel',
        title: '我的酒馆助手工具',
        version: 'v1.0.0',
        tabs: [{ key: 'basic', label: '基本设置', icon: 'fa-solid fa-sliders' }]
    });
    panel.addSwitch('basic', { label: '开启功能', value: true });
    panel.open();
})();
```

### 2.2 作用域与主题

浮层根节点加 `nvui-scope`；浅色主题叠加 `nvui-theme-light`；实心扁平（关闭玻璃）叠加 `nvui-solid`。三种根开关互相独立，可任意组合：

```html
<div class="nvui-scope"> ... 深色玻璃（默认） ... </div>
<div class="nvui-scope nvui-theme-light"> ... 浅色玻璃 ... </div>
<div class="nvui-scope nvui-solid"> ... 深色实心扁平（无玻璃） ... </div>
<div class="nvui-scope nvui-theme-light nvui-solid"> ... 浅色实心扁平 ... </div>
```

| 根类 | 作用 |
| :--- | :--- |
| `.nvui-scope` | 组件作用域 + 基础排版（`box-sizing` / `color` / 字号 / 行高）；必加 |
| `.nvui-theme-light` | 切换浅色令牌覆盖（定义在 `tokens.css` 末尾） |
| `.nvui-solid` | 实心扁平模式：全部玻璃表面回退为不透明 `--nvui-bg` / `--nvui-bg-2`，`backdrop-filter: none` |

另有 **`.nvui-form-scope`**（v2.7.0）：只用于**自定义普通容器**的表单隔离 opt-in。容器显式加类后，内部既有 `.nvui-input` 才共享 [§7.6.1](#761-宿主表单控件隔离层v260v270-opt-in-扩展--修复-github-9) 的 7 条宿主表单隔离；不加类时行为完全不变。它不是布局/浮层作用域，不替代 `.nvui-scope`，也不创建定位、遮罩或模态。

### 2.3 弹窗骨架（含浮层载体）

```html
<dialog class="nvui-tl" id="your_modal_layer">
    <div class="nvui-overlay" id="your_overlay" hidden>
        <div class="nvui-modal" role="dialog" aria-modal="true" aria-labelledby="your_modal_title">
            <div class="nvui-modal-header">
                <b class="nvui-modal-title" id="your_modal_title">
                    标题<span class="nvui-modal-ver">v1.0.0</span>
                </b>
                <span class="nvui-modal-actions">
                    <button type="button" class="nvui-icon-btn" data-close aria-label="关闭">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </span>
            </div>
            <div class="nvui-modal-body"> ... </div>
            <div class="nvui-modal-footer">
                <button type="button" class="nvui-btn is-ghost" data-close>取消</button>
                <button type="button" class="nvui-btn is-primary">确定</button>
            </div>
        </div>
    </div>
</dialog>
```

```js
const layer = document.getElementById('your_modal_layer');
const overlay = document.getElementById('your_overlay');
let lastTrigger = null;
let closing = false;

function openModal() {
    lastTrigger = document.activeElement;
    try { layer.show(); } catch (e) { layer.setAttribute('open', ''); } // 旧内核兜底
    overlay.hidden = false;      // 触发 .nvui-overlay 入场（nvui-overlay-in / nvui-modal-in）
    focusIntoModal(layer.querySelector('.nvui-modal'));
}

function closeModal() {
    if (overlay.hidden || closing) return;   // 幂等：animationend 与兜底定时器只收尾一次
    closing = true;
    overlay.classList.add('is-closing');     // 触发退场（nvui-overlay-out / nvui-modal-out）
    const done = () => {
        if (!closing) return;
        closing = false;
        overlay.hidden = true;
        overlay.classList.remove('is-closing');
        try { layer.close(); } catch (e) { layer.removeAttribute('open'); }
        lastTrigger?.focus();
        lastTrigger = null;
    };
    overlay.addEventListener('animationend', done, { once: true });
    setTimeout(done, 260);                   // 兜底：动画被降级/中断时也能收尾（200ms + 60ms 余量）
}

overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });
```

> 不想手写这套时序时，直接用 `NVUI.openLayer(layer, overlay)` / `NVUI.closeLayer(layer, overlay)`（见 [§13.1](#131-设计调用-apinvui-apijs)）；`NVUI.createPanel()` 已内置全部边界处理。

**为什么必须用 `<dialog class="nvui-tl">` 载体、为什么不能用 `showModal()`**：见 [§8](#8-sillytavern-宿主兼容红线) 第 1 条。

**焦点管理**（`aria-modal="true"` 的必要配套，否则键盘用户仍能 Tab 到背景）：

```js
function focusIntoModal(modal) {
    const target = modal.querySelector('[data-autofocus], .nvui-btn.is-primary, .nvui-modal-title');
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus();
}

function trapFocus(modal, e) {
    if (e.key !== 'Tab') return;
    const items = [...modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// 接入：打开时 focusIntoModal(modal) + modal.addEventListener('keydown', (e) => trapFocus(modal, e))；
// 关闭后 lastTrigger?.focus()（已在 closeModal 的 done 中处理）。
```

> 仅写 `aria-modal="true"` 而不做焦点陷阱与焦点归还，等于把无障碍停留在标记层。完整的进出场 CSS 与 JS 对应关系见 [§7.3](#73-遮罩与弹窗玻璃--进出场)。

### 2.4 玻璃与降级

- 玻璃只用于浮层：`.nvui-overlay` / `.nvui-modal` / `.nvui-panel` / `.nvui-floating` / `.nvui-tooltip` / `.nvui-toast` / `.nvui-glass`。
- **玻璃态 = 透明面板 + 面板背后的强模糊（v2.7.2 增强）**：面板态（`.nvui-overlay.is-panel`）单独使用更透的玻璃：遮罩为 `color-mix(--nvui-bg 20%)` + `blur(24px)`，面板为 `color-mix(--nvui-bg 30%)` + 顶部 token 柔光 + `blur(48px) saturate(190%) brightness(1.12)`；浅色主题面板提高到 62% 不透明底。面板背后的聊天内容会明显可见但被强模糊，这才是玻璃效果。面板/遮罩的玻璃规则同时提升到 `dialog.nvui-tl` 作用域，避免真实 ST 中其它扩展内嵌的旧版 kit CSS 按加载顺序覆盖。
  > 面板态是**视觉优先档**：在纯白/极亮宿主下不承诺 text-2 的 AA（正文仍建议深色宿主使用）；需要严格 AA 或完全可读时用 `.nvui-solid` 或减少透明度降级。宿主禁用 blur（Fast UI）时仍进入 97% 近不透明回退，见后文。
- **Fast UI 强制玻璃（v2.8.0，可选）**：`NVUI.createPanel({ glass: 'force' })` / `panel.setGlassMode('force')` 只对**本面板**用 4 条作用域 `!important` 覆盖宿主 `body.no-blur * { backdrop-filter: unset !important }`；`prefers-reduced-transparency` / `forced-colors` / 浏览器不支持时自动回退。默认 `auto` 尊重宿主；`force` 必须在插件设置里给用户关闭项。
- 弹窗级用 `--nvui-glass-bg`（`rgba(22, 26, 36, 0.64)`，背后有遮罩压暗，正文与次要文字双 AA）；直接叠在宿主上的 popover 级用 `--nvui-glass-bg-strong`（`rgba(22, 26, 36, 0.8)`，**只承诺正文 `--nvui-text` 的 AA**）。口径见 [§4.4](#44-aa-安全玻璃与合成对比度验算)。
- 圆角玻璃表面（弹窗 / 面板 / 悬浮面板 / 工具提示 / 吐司 / `.nvui-glass`）**不画 1px 外框描边**：圆角处的 1px 半透明描边在缩放时会出现亚像素锯齿，改用「柔和顶部受光（`--nvui-glass-highlight`）+ 阴影」成形。header / footer / 导航底边这类直线分隔保留 1px（`--nvui-glass-line`）。
- 五层降级链（`components.css` 已内置，业务无需处理）：

| 降级条件 | CSS 行为 |
| :--- | :--- |
| 浏览器不支持 `backdrop-filter` | `@supports not (...)` 回退为不透明表面 |
| 用户系统开启「减少透明度」 | `prefers-reduced-transparency: reduce` 回退为不透明表面 |
| 强制颜色 / 高对比模式 | `forced-colors: active` 用系统色 `CanvasText` 描边，去阴影与模糊 |
| **宿主全局禁用模糊**（如酒馆 Fast UI 默认 `body.no-blur`） | 运行时读实际计算值后给根节点加 `.nvui-glass-fallback`：改用 token 派生 97% 不透明色（`color-mix`）的**近不透明回退**（深色 text-2 6.02、浅色 6.42，AA 达标；有效透出约 1.1% / 2.1%），既保留极轻玻璃感又不出现聊天文字重影，不再整块不透明 |
| 用户主动不想要透明 / 低性能设备 | 根节点加 `.nvui-solid` 强制实心（优先级高于自动回退） |

- 窄屏（`max-width: 600px`）弹窗与面板的 `backdrop-filter` 自动降档为 `--nvui-glass-blur-sm`（12px）降低移动端 GPU 开销，保留 `92dvh` 与安全区规则（面板仍是「透明 + 背后模糊」的玻璃态，只是模糊半径更小）。
- **真实酒馆默认观感说明**：SillyTavern `fast_ui_mode` 默认 `true`，宿主会给 `body` 加 `no-blur` 并全局 `unset !important` 掉 `backdrop-filter`。kit 会自动进入 97% 近不透明回退（`.nvui-glass-fallback`，极轻透出），在面板上不再出现聊天文字重影；想要完整玻璃效果需在酒馆设置里关闭 Fast UI 模式。运行时 API 的探测/回退/恢复见 §7.2。

### 2.5 折叠面板 DOM（破坏性变更）

高度动画靠 `grid-template-rows: 0fr` 与 `1fr` 过渡实现，因此 `nvui-acc-body` 内部**必须**再包一层 `.nvui-acc-inner`（负责 `min-height: 0`、`overflow: hidden` 与左右内边距；上下留白用内部伪元素实现，避免 padding 撑开 0fr 轨道）：

```html
<div class="nvui-acc is-open">
    <button type="button" class="nvui-acc-head" aria-expanded="true">
        <span class="nvui-acc-title"><i class="fa-solid fa-folder"></i>保存位置</span>
        <span class="nvui-acc-summary">默认目录 plugins/auto-save/logs</span>
        <i class="nvui-acc-chev"></i>
    </button>
    <div class="nvui-acc-body">
        <div class="nvui-acc-inner"> ... 展开内容 ... </div>
    </div>
</div>
```

```js
const acc = document.querySelector('.nvui-acc');
const head = acc.querySelector('.nvui-acc-head');

head.addEventListener('click', () => {
    const open = acc.classList.toggle('is-open');
    head.setAttribute('aria-expanded', String(open));
});
```

业务 JS 只切 `.nvui-acc.is-open` 与 `aria-expanded`，不要手写高度。从 v1.1.0 升级时漏掉 `.nvui-acc-inner` 会导致展开内容被裁成 0 高，见 [§10.3](#103-v110--v200-迁移对照)。

### 2.6 动效降级与「强制播放动效」演示开关

- `components.css` 全局尊重系统偏好：开启「减少动态效果」（`prefers-reduced-motion: reduce`）时，所有动画与过渡统一降级为 `0.01ms`（含 `animation-delay`、`animation-iteration-count: 1`、`transition-duration: 0.01ms`）。**这是无障碍红线，不是 bug**，不要为了「好看」绕过它。
- 若本机长期处于「减少动态效果」（部分 Windows 默认如此），直接打开 `preview.html` 会几乎看不到动效——这是预期行为。
- `preview.html` 顶部提供「强制播放动效」开关（**仅演示用途，不属于 kit**）：给 `<body>` 加 `pv-force-motion`，仅对演示页局部覆盖动效时长；也支持 URL 参数 `?motion=1`，可与 `?theme=light`、`?solid=1`、`?panel=1`、`?api=1` 叠加。生产环境请尊重系统偏好，不要把这个开关复制进插件。

---

## 3. 设计原则

1. **扁平优先（Flat First）**：静态区块（按钮、折叠、徽标、输入、标签页、卡片）只靠色阶与间距表达层级，**不加 1px 描边、不加投影、不用渐变**。边界靠 `--nvui-block-bg` / `--nvui-block-bg-2` 的填空表达。
2. **玻璃只用于浮层（Glass for Overlays Only）**：只有弹窗、遮罩、悬浮面板、工具提示、吐司、`.nvui-glass` 允许「半透明底 + `backdrop-filter` 模糊/饱和 + 柔和顶部受光 + 阴影」。圆角玻璃不画 1px 外框描边（会出亚像素锯齿）。
3. **动效只表达层级/方向/因果（Meaningful Motion）**：只用来表达「从哪来、到哪去、谁包含谁」；全部可降级（尊重 `prefers-reduced-motion`，含 `animation-delay`），关键信息不能只放在动画里。
4. **AA 安全玻璃**：玻璃是承载文字的表面。按最坏宿主背景做合成对比度验算：**弹窗级**正文与次要文字均 >= 4.5:1；**popover 级**只承诺正文 >= 4.5:1（popover 上的说明文字也用正文色）。详见 [§4.4](#44-aa-安全玻璃与合成对比度验算)。
5. **浮层自包含、主题可切换**：自有浮层只用 kit 令牌（或 `.nvui-theme-light` 覆盖），不读宿主主题变量，保证深浅主题下观感一致。
6. **颜色一律走 token（禁止硬编码颜色）**：`components.css` 内出现 `#hex` / `rgb()` / `hsl()` 视为缺陷；换色只改 `tokens.css`，不改组件。测试会扫描。
7. **唯一强调色 + 语义色各司其职**：紫色是「可交互 / 当前选中」的唯一强调色；成功 / 注意 / 错误 / 进行中只用语义色，不用主色表达状态。
8. **层级靠表面与间距，不靠描边堆盒子**：`bg` → `bg-2` → `bg-3` → `block-bg` → `block-bg-2` 由深到浅分层；只有表达「浮起」时才用玻璃与阴影。
9. **可用性优先**：开关整行可点、按钮最小高度 `--nvui-control-h`、图标按钮 28×28、触屏留足间距；折叠收起态必须给当前值摘要。
10. **可访问性内建**：对比度（含玻璃合成）、`focus-visible` 单圈 2px 焦点环、`aria-*` 语义、尊重 `prefers-reduced-motion` / `prefers-reduced-transparency` / `forced-colors`、读屏文本用 `.nvui-sr-only`。
11. **不污染宿主**：全部 `nvui-` 前缀、无裸元素选择器、无全局重置；`!important` 只用在白名单四类共 18 条（[§9](#9-命名与工程约定)）。
12. **描边精致化**：焦点环为单圈 2px 整数像素、不叠内圈；圆角玻璃无外框；ghost 按钮/空态/标签指示器去圆角描边；直线分隔保留 1px 玻璃分隔色。

**快速判断（违反即返工）**

- 在聊天消息流里用 `.nvui-*`：不允许（用宿主主题变量）。
- 给静态按钮加投影 / 渐变 / 光晕：不允许（扁平优先）。
- 在组件样式里写 `#8b6dff` 而不是 `var(--nvui-accent)`：不允许（禁止硬编码颜色）。
- 把 `.nvui-panel` 或浮层直接 `position: fixed` 挂到 `body`：不允许（必须进 `dialog.nvui-tl` 载体，见 [§8](#8-sillytavern-宿主兼容红线)）。

## 4. 配色规范

> `tokens.css` 共定义 **111 个令牌**（深色默认，挂在 `:root` 与 `.nvui-scope` 上），`.nvui-theme-light` 覆盖其中 **47 个**；`tokens.json` 是同一份数据的机器可读镜像，供构建工具与其它软件读取。本章只回答「有哪些令牌、怎么选」；玻璃表面到底能不能读，见 [4.4](#44-aa-安全玻璃与合成对比度验算)。

### 4.1 深色主题令牌（默认，`:root` / `.nvui-scope`）

深色是默认主题。同一组令牌同时挂在 `:root` 与 `.nvui-scope` 上：整页可用，局部容器也可用。组件样式只引用这些令牌，不写颜色字面量。本章 4.1 列出 51 个颜色、玻璃、焦点与骨架类令牌，第 5 章 15 个排版令牌，第 6 章 44 个尺寸、动效与层级令牌，再加 1 个版本令牌 `--nvui-kit-version`，合计 111 个令牌。

**表面 / 背景（11）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-bg` | `#161a24` | 弹窗与浮层本体表面 |
| `--nvui-bg-2` | `#1c2130` | 次级面板、popover 实心底 |
| `--nvui-bg-3` | `#232939` | 分组底，再深一档 |
| `--nvui-block-bg` | `rgba(255, 255, 255, 0.05)` | 可点区块底 |
| `--nvui-block-bg-2` | `rgba(255, 255, 255, 0.078)` | 区块悬停与展开态 |
| `--nvui-input-bg` | `rgba(0, 0, 0, 0.22)` | 输入控件底 |
| `--nvui-code-bg` | `rgba(0, 0, 0, 0.3)` | 行内代码底 |
| `--nvui-overlay-bg` | `rgba(6, 8, 14, 0.62)` | 弹窗遮罩（验算见 4.4） |
| `--nvui-switch-off-bg` | `rgba(255, 255, 255, 0.34)` | 开关关闭态轨道 |
| `--nvui-knob` | `#ffffff` | 开关开启态滑钮 |
| `--nvui-knob-off` | `var(--nvui-text)` | 开关关闭态滑钮 |

静态区块只靠色阶分层：`bg` / `bg-2` / `bg-3` 是三级表面，`block-bg` 表达「可点」而不是「更高层级」，所以可点区块不叠投影、不画 1px 外框。

**玻璃层（7）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-glass-bg` | `rgba(22, 26, 36, 0.64)` | 弹窗级玻璃 |
| `--nvui-glass-bg-strong` | `rgba(22, 26, 36, 0.8)` | popover 级玻璃 |
| `--nvui-glass-line` | `rgba(255, 255, 255, 0.06)` | 玻璃表面内直线分隔 |
| `--nvui-glass-highlight` | `rgba(255, 255, 255, 0.05)` | 顶部柔和受光 |
| `--nvui-glass-blur` | `20px` | 弹窗级模糊半径 |
| `--nvui-glass-blur-sm` | `12px` | popover 级模糊半径 |
| `--nvui-glass-saturate` | `150%` | 玻璃背后饱和度提升 |

玻璃只在浮层上使用。两级不透明度分工明确：`glass-bg` 是弹窗级（背后有遮罩压暗），`glass-bg-strong` 是 popover 级（直接叠在任意宿主上，只承诺正文 AA，见 4.4）。

**焦点环（3）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-focus-ring-color` | `var(--nvui-accent)` | 焦点环颜色 |
| `--nvui-focus-ring-w` | `2px` | 焦点环宽度（单圈） |
| `--nvui-focus-ring-offset` | `2px` | 焦点环外扩距离 |

组件只允许 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)` 配 `outline-offset`，不得各写各的像素值；折叠标题与底部导航项用负 offset，避免环被容器裁掉。

**分隔线（5）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-line` | `rgba(255, 255, 255, 0.05)` | 常规分隔线 |
| `--nvui-line-2` | `rgba(255, 255, 255, 0.08)` | 强调边界 |
| `--nvui-dash` | `rgba(255, 255, 255, 0.14)` | 虚线空态与检查中 |
| `--nvui-block-line` | `rgba(255, 255, 255, 0.04)` | 区块内发丝线 |
| `--nvui-block-line-2` | `rgba(255, 255, 255, 0.07)` | 控件内嵌描边 |

分隔线只保留「刚够认出层级」的最低对比；可点区块之间靠间距与底色区分，不靠描边。

**文字（3）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-text` | `#e9ecf3` | 正文、标题（14.71:1） |
| `--nvui-text-2` | `#98a1b3` | 次要说明（6.70:1） |
| `--nvui-text-3` | `#7d879b` | 关键提示外的小字（4.81:1） |

> `--nvui-text-3` 相比历史实现值 `#6c7487`（3.72:1）**提亮一档**才达到 AA；需要完全还原旧观感的插件可覆盖该令牌，但规范推荐用新值，且任何玻璃表面上的正文都不要用它承载信息。

**主色（8）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-accent` | `#8b6dff` | 轨道、选中态、焦点环 |
| `--nvui-accent-2` | `#a997ff` | 图标与强调文字 |
| `--nvui-accent-strong` | `#6d4df2` | 填充按钮底（白字 5.26:1） |
| `--nvui-accent-strong-hover` | `#5b3fd6` | 填充按钮悬停 |
| `--nvui-on-accent` | `#ffffff` | 主色填充上的文字与图标 |
| `--nvui-accent-bg` | `rgba(139, 109, 255, 0.14)` | 主色淡底 |
| `--nvui-accent-bg-hover` | `rgba(139, 109, 255, 0.24)` | 主色淡底悬停 |
| `--nvui-accent-line` | `rgba(139, 109, 255, 0.4)` | 主色描边 |

主色是唯一强调色。填充按钮底色必须用 `--nvui-accent-strong`（白字 5.26:1 达 AA），不能用 `--nvui-accent`（白字不达标）；hover 只加深底色，不再发光，也不使用外发光阴影。

**语义色（12）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-ok` | `#4ade80` | 成功（9.98:1） |
| `--nvui-ok-bg` | `rgba(74, 222, 128, 0.12)` | 成功淡底 |
| `--nvui-ok-line` | `rgba(74, 222, 128, 0.35)` | 成功描边 |
| `--nvui-warn` | `#fbbf24` | 需要注意（10.42:1） |
| `--nvui-warn-bg` | `rgba(251, 191, 36, 0.12)` | 注意淡底 |
| `--nvui-warn-line` | `rgba(251, 191, 36, 0.35)` | 注意描边 |
| `--nvui-danger` | `#f87171` | 错误（6.29:1） |
| `--nvui-danger-bg` | `rgba(248, 113, 113, 0.12)` | 错误淡底 |
| `--nvui-danger-line` | `rgba(248, 113, 113, 0.35)` | 错误描边 |
| `--nvui-info` | `#3498db` | 进行中（5.52:1） |
| `--nvui-info-bg` | `rgba(52, 152, 219, 0.12)` | 信息淡底 |
| `--nvui-info-line` | `rgba(52, 152, 219, 0.35)` | 信息描边 |

每个语义色都配好了 `-bg`（淡底）与 `-line`（描边）两个派生，组件直接用配套令牌，不要自己调透明度。

**骨架屏（2）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-skeleton-bg` | `rgba(255, 255, 255, 0.055)` | 骨架屏底色 |
| `--nvui-skeleton-shine` | `rgba(255, 255, 255, 0.12)` | 骨架屏扫光 |

骨架屏用于「已知结构、未知内容」的占位：底色画块，扫光表示仍在加载。两个令牌成对使用，扫光透明度不要手调，否则深色主题下会出现一条刺眼的亮带。

### 4.2 浅色主题（`.nvui-theme-light`，47 个覆盖）

在任意容器上叠加 `.nvui-theme-light` 即整体切浅色。所有组件只消费令牌，因此不需要第二套组件样式。浅色块覆盖 47 个令牌，其余 63 个沿用深色默认值；下表的「值」列均为浅色值。未被覆盖的 63 个多数与主题无关（间距、字号、字重、行高、圆角、时长、缓动、组件尺寸、层级），另含 `--nvui-focus-ring-w`、`--nvui-focus-ring-offset` 与玻璃模糊 3 项，两主题同值。

**表面 / 玻璃（15）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-bg` | `#f7f8fc` | 弹窗与浮层本体表面 |
| `--nvui-bg-2` | `#eef1f8` | 次级面板、popover 实心底 |
| `--nvui-bg-3` | `#e5e9f3` | 分组底 |
| `--nvui-block-bg` | `rgba(15, 23, 42, 0.035)` | 可点区块底 |
| `--nvui-block-bg-2` | `rgba(15, 23, 42, 0.06)` | 区块悬停与展开态 |
| `--nvui-input-bg` | `rgba(255, 255, 255, 0.9)` | 输入控件底 |
| `--nvui-code-bg` | `rgba(15, 23, 42, 0.06)` | 行内代码底 |
| `--nvui-overlay-bg` | `rgba(15, 23, 42, 0.3)` | 弹窗遮罩 |
| `--nvui-switch-off-bg` | `rgba(15, 23, 42, 0.47)` | 开关关闭态轨道 |
| `--nvui-knob` | `#ffffff` | 开关开启态滑钮 |
| `--nvui-knob-off` | `#ffffff` | 开关关闭态滑钮 |
| `--nvui-glass-bg` | `rgba(255, 255, 255, 0.78)` | 弹窗级玻璃 |
| `--nvui-glass-bg-strong` | `rgba(255, 255, 255, 0.8)` | popover 级玻璃 |
| `--nvui-glass-line` | `rgba(255, 255, 255, 0.28)` | 玻璃表面内直线分隔 |
| `--nvui-glass-highlight` | `rgba(255, 255, 255, 0.4)` | 顶部柔和受光 |

浅色玻璃的不透明度更高（0.78 / 0.80）：它可能叠在深色宿主上，必须靠更实的白底把对比度拉回 AA。

**分隔线 / 文字（8）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-line` | `rgba(15, 23, 42, 0.06)` | 常规分隔线 |
| `--nvui-line-2` | `rgba(15, 23, 42, 0.1)` | 强调边界 |
| `--nvui-dash` | `rgba(15, 23, 42, 0.18)` | 虚线空态与检查中 |
| `--nvui-block-line` | `rgba(15, 23, 42, 0.045)` | 区块内发丝线 |
| `--nvui-block-line-2` | `rgba(15, 23, 42, 0.07)` | 控件内嵌描边 |
| `--nvui-text` | `#1f2430` | 正文、标题（14.62:1） |
| `--nvui-text-2` | `#4a5365` | 次要说明（7.28:1） |
| `--nvui-text-3` | `#5f6879` | 关键提示外的小字（5.29:1） |

**主色（7）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-accent` | `#6d4df2` | 轨道、选中态、焦点环 |
| `--nvui-accent-2` | `#5b3fd6` | 图标与强调文字（6.33:1） |
| `--nvui-accent-strong` | `#6d4df2` | 填充按钮底（白字 5.26:1） |
| `--nvui-accent-strong-hover` | `#5b3fd6` | 填充按钮悬停 |
| `--nvui-accent-bg` | `rgba(109, 77, 242, 0.12)` | 主色淡底 |
| `--nvui-accent-bg-hover` | `rgba(109, 77, 242, 0.2)` | 主色淡底悬停 |
| `--nvui-accent-line` | `rgba(109, 77, 242, 0.4)` | 主色描边 |

**语义色（12）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-ok` | `#15803d` | 成功（4.73:1） |
| `--nvui-ok-bg` | `rgba(21, 128, 61, 0.1)` | 成功淡底 |
| `--nvui-ok-line` | `rgba(21, 128, 61, 0.32)` | 成功描边 |
| `--nvui-warn` | `#b45309` | 需要注意（4.73:1） |
| `--nvui-warn-bg` | `rgba(180, 83, 9, 0.1)` | 注意淡底 |
| `--nvui-warn-line` | `rgba(180, 83, 9, 0.32)` | 注意描边 |
| `--nvui-danger` | `#dc2626` | 错误（4.55:1） |
| `--nvui-danger-bg` | `rgba(220, 38, 38, 0.09)` | 错误淡底 |
| `--nvui-danger-line` | `rgba(220, 38, 38, 0.3)` | 错误描边 |
| `--nvui-info` | `#1d4ed8` | 进行中（6.31:1） |
| `--nvui-info-bg` | `rgba(29, 78, 216, 0.09)` | 信息淡底 |
| `--nvui-info-line` | `rgba(29, 78, 216, 0.3)` | 信息描边 |

**焦点环 / 骨架屏 / 阴影（5）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-focus-ring-color` | `var(--nvui-accent)` | 焦点环颜色（必须覆盖） |
| `--nvui-skeleton-bg` | `rgba(15, 23, 42, 0.05)` | 骨架屏底色 |
| `--nvui-skeleton-shine` | `rgba(15, 23, 42, 0.1)` | 骨架屏扫光 |
| `--nvui-shadow-modal` | `0 16px 40px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.1), inset 0 1px 0 var(--nvui-glass-highlight)` | 弹窗玻璃阴影 |
| `--nvui-shadow-pop` | `0 10px 26px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.08), inset 0 1px 0 var(--nvui-glass-highlight)` | popover 玻璃阴影 |

> `--nvui-on-accent`、`--nvui-focus-ring-w`、`--nvui-focus-ring-offset` 三个令牌只在深色块定义，浅色直接继承：`on-accent` 两主题同为 `#ffffff`，焦点环宽度与偏移也不随主题变化。

浅色主题下的三个注意点：

- 玻璃不透明度更高（0.78 / 0.80），不要为了「更透」把它调低，调低后叠在深色宿主上会掉出 AA。
- 开关关闭态轨道与滑钮都是白色系，靠 `--nvui-switch-off-bg` 的墨色轨道区分，不要改回浅灰。
- 语义色在浅色下刻意加深（ok 从亮绿改深绿等），文字对比度才够，不要直接复用深色值。

### 4.3 配色使用规则

- **Do**：正文与标题用 `--nvui-text`，解释性文字用 `--nvui-text-2`，提示小字用 `--nvui-text-3`——`text-3` 不承载关键信息。
- **Do**：未选中控件用 `text-2` 与 `block-bg`；选中 / 激活统一用主色系（accent / accent-bg / accent-line）。主色即「可交互、当前」。
- **Do**：语义色只表达语义——ok 成功、warn 注意，danger 错误与破坏性操作、info 进行中；淡底与描边用配套的 `-bg` / `-line`。
- **Do**：玻璃表面的正文与次要文字一律用 `--nvui-text`；popover 级玻璃上的说明文字也只能用正文色（原因见 4.4）。
- **Do**：非文本对比度按 WCAG 1.4.11 保证：开关关闭态轨道与页面背景、滑钮与轨道、焦点环与相邻背景均不低于 3:1；玻璃受光边只做装饰。
- **Don't**：用主色表示错误或警告，或用 danger 做装饰——用户会误判可点性。
- **Don't**：在同一视图引入第二种强调色；需要更多区分时用层级、字号与图标。
- **Don't**：把 `--nvui-text-3` 当正文色用，或在它上面再叠 `opacity`。
- **Don't**：在组件样式里硬编码颜色（`#hex` / `rgb()` 都不行），也不要直接引用宿主主题变量；**禁止硬编码颜色**是测试守护的红线。

常见错误与正确写法对照：

| 常见写法 | 问题 | 正确做法 |
| :--- | :--- | :--- |
| `color: #8b6dff` | 硬编码颜色，换主题后失效 | 改用 `--nvui-accent` |
| 主按钮底用 `--nvui-accent` | 白字对比度不足，不达 AA | 改用 `--nvui-accent-strong` |
| popover 玻璃上用 `--nvui-text-2` | 强玻璃上仅 3.53:1 | 改用 `--nvui-text` |
| 用 `opacity` 弱化次要文字 | 玻璃合成后对比度掉到 3:1 左右 | 改用 `--nvui-text-2` 或 `--nvui-text-3` |

```css
/* 正确：全部取值走令牌 */
.nvui-panel-title { color: var(--nvui-text); }
.nvui-status-time { color: var(--nvui-text-2); }
.nvui-btn.is-primary {
    background: var(--nvui-accent-strong);
    color: var(--nvui-on-accent);
}
```

本章所有取值由 `test/test-ui-kit.js` 守护；命名约定与 `!important` 预算（18 条）见第 9 章。

### 4.4 AA 安全玻璃与合成对比度验算

玻璃是半透明表面，真实可读性取决于「它下面是什么」，所以规范按**最坏宿主**验算。验算分四步：

1. 取宿主最坏底色（深色主题取纯白、浅色主题取纯黑）。
2. 按 sRGB 逐通道叠加遮罩：`result = fg * a + bg * (1 - a)`。
3. 在同一底色上再叠加玻璃层，得到最终合成表面色。
4. 用 WCAG 2.1 相对亮度公式算对比度，与 4.5:1（正文）比对。

**深色主题**（`--nvui-text` `#e9ecf3` / `--nvui-text-2` `#98a1b3`）

| 层级 | 合成路径（宿主最坏情况） | text | text-2 | 结论 |
| :--- | :--- | :--- | :--- | :--- |
| 弹窗级 | 纯白 `#ffffff`，叠 `--nvui-overlay-bg` `rgba(6, 8, 14, 0.62)`，再叠 `--nvui-glass-bg` `rgba(22, 26, 36, 0.64)` | 10.33:1 | 4.70:1 | 双 AA 达标 |
| popover 级 | 纯白 `#ffffff`，直接叠 `--nvui-glass-bg-strong` `rgba(22, 26, 36, 0.8)` | 7.76:1 | 3.53:1 | 只承诺正文 AA |

**浅色主题**（`--nvui-text` `#1f2430` / `--nvui-text-2` `#4a5365`）

| 层级 | 合成路径（宿主最坏情况） | text | text-2 | 结论 |
| :--- | :--- | :--- | :--- | :--- |
| 弹窗级 | 纯黑 `#000000`，叠 `--nvui-overlay-bg` `rgba(15, 23, 42, 0.3)`，再叠 `--nvui-glass-bg` `rgba(255, 255, 255, 0.78)` | 9.31:1 | 4.64:1 | 双 AA 达标 |
| popover 级 | 纯黑 `#000000`，直接叠 `--nvui-glass-bg-strong` `rgba(255, 255, 255, 0.8)` | 9.66:1 | 4.81:1 | 双 AA 达标 |

> 口径：按「深色主题宿主纯白 / 浅色主题宿主纯黑」的最坏情况计算。若宿主本身就是典型深色 `#161a24`，浅色弹窗级为 9.70 / 4.83，比表中的最坏值更宽松，仅作参考。

> **自动近不透明回退（v2.7.2，`.nvui-glass-fallback`）**：宿主禁用模糊时用 token 派生 97% 不透明色（`color-mix(in srgb, var(--nvui-bg-2) 97%, transparent)`）——深色 text 13.23 / text-2 6.02，浅色 12.88 / 6.42，**仍保持双 AA**；有效透出约 1.1% / 2.1%，只保留极轻玻璃感。0.80 半透明档在真实聊天密集背景下会出现可读文字重影，已废弃。

**AA 政策**

1. **弹窗级玻璃**（`.nvui-modal`，背后有遮罩压暗）：正文与次要文字都承诺不低于 4.5:1，可以放心用 `text-2` 写说明。
2. **popover 级玻璃**（`.nvui-floating` / `.nvui-tooltip` / `.nvui-toast` / `.nvui-glass`，直接用强玻璃）：只承诺正文 `--nvui-text`；`--nvui-text-2` 仅 3.53:1。所以这些组件上的说明文字也一律用正文色，kit 已把 `.nvui-tooltip` 的 `color` 设为 `--nvui-text`。
3. 需要「正文 + 次要说明」都达 AA 时，把内容放进弹窗（遮罩后），或改用实心表面（`.nvui-solid` 与能力降级路径）。
4. `--nvui-text-3` 只做非关键装饰提示，任何玻璃表面都不用它承载信息。
5. 改完令牌要同步维护 `tokens.json` 镜像（它由 `tokens.css` 生成，不是手写第二份），否则文档、JSON 与 CSS 会三方不一致。
6. **面板态高透明档（v2.7.2）**：面板态使用遮罩 20% + 面板 30% 的双层透明与更强 blur，属于**视觉优先档**；纯白/极亮宿主下不承诺 `text-2` 的 4.5:1。需要严格 AA 时用 `.nvui-solid` 或让系统「减少透明度」降级。

改动任何玻璃、遮罩或文字取值后，必须重跑 `test/test-ui-kit.js` 的玻璃合成对比度检查，并同步更新本表与 `CHANGELOG.md`；表格里的数字是测试断言的一部分，不是说明性估算。测试按上表逐项比对，容差为 ±0.02，因此小数位也要保持一致。

## 5. 文字与排版

字号、字重、行高三组令牌覆盖全部排版需求，组件不再写死 `font-size`。

文字颜色只分三档，加一个主色强调位：

| 文本类型 | 令牌 | 说明 |
| :--- | :--- | :--- |
| 标题与正文 | `--nvui-text` | 唯一可以承载关键信息的文字色 |
| 次要说明 | `--nvui-text-2` | 开关行标题、状态行、时间戳 |
| 提示性小字 | `--nvui-text-3` | 摘要、占位符、非关键装饰 |
| 强调文字与图标 | `--nvui-accent-2` | 只用于可点项或当前项 |

**字号 / 字重 / 行高（15）**

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-fs-2xs` | `10px` | 计数角标 |
| `--nvui-fs-xs` | `11px` | 版本号、状态时间 |
| `--nvui-fs-sm` | `12px` | 说明、状态行、按钮 |
| `--nvui-fs-md` | `13px` | 面板正文、折叠标题 |
| `--nvui-fs-lg` | `14px` | 弹窗正文（桌面） |
| `--nvui-fs-xl` | `15px` | 弹窗正文（手机） |
| `--nvui-fs-2xl` | `16px` | 大标题、面板标题 |
| `--nvui-fw-regular` | `400` | 摘要、普通说明 |
| `--nvui-fw-medium` | `500` | 按钮、徽标 |
| `--nvui-fw-semibold` | `600` | 折叠标题、选中标签 |
| `--nvui-fw-bold` | `700` | 区块标题、弹窗标题 |
| `--nvui-lh-tight` | `1.4` | 按钮、标签、输入框 |
| `--nvui-lh-normal` | `1.5` | 正文、状态行、吐司 |
| `--nvui-lh-relaxed` | `1.6` | 说明小字、告警、提示 |
| `--nvui-lh-loose` | `1.8` | 弹窗正文（长文阅读） |

常见场景的字号组合（与组件实现一致）：

| 场景 | 字号 / 字重 / 行高 |
| :--- | :--- |
| 面板正文 | `--nvui-fs-md` / `--nvui-fw-regular` / `--nvui-lh-normal` |
| 弹窗正文 | 桌面 `--nvui-fs-lg`、手机 `--nvui-fs-xl` / `--nvui-lh-loose` |
| 弹窗与面板标题 | `--nvui-fs-2xl` / `--nvui-fw-bold` / `--nvui-lh-tight` |
| 区块标题与折叠标题 | `--nvui-fs-md` / `--nvui-fw-bold` 或 `--nvui-fw-semibold` |
| 说明与状态行 | `--nvui-fs-sm` / `--nvui-lh-relaxed` 或 `--nvui-lh-normal` |
| 角标与次要元信息 | `--nvui-fs-2xs` 或 `--nvui-fs-xs` |

规则：

- 字体一律 `font-family: inherit`，沿用宿主主题字体；kit 不自带字体、不引外部字体。
- 中文正文不做字间距；只有 `.nvui-section-title` 用 `0.5px` 拉开层级。
- 一屏内的字号层级不超过 3 档；数字（上限、计数）右对齐，避免跳动。
- 长文本用 `word-break: break-word`；文件名与路径用 `.nvui-code` 或等宽字体栈。
- 玻璃、告警、吐司上的文字必须满足 [4.4](#44-aa-安全玻璃与合成对比度验算) 的 AA 结论，不要靠 `opacity` 弱化文字（玻璃合成后会把对比度压到 3:1 左右）。
- 字号与行高只从上面 15 个令牌里选，不在组件里写 `13.5px` 这类中间值。
- 标题用 `<b>` 等语义标签承载，视觉样式交给类，不要用字号表达标题层级。

```html
<!-- 标题、正文、说明各用一档：不要靠加粗或放大硬凑层级 -->
<b class="nvui-panel-title">插件设置</b>
<p class="nvui-hint">修改后立即生效</p>
```

## 6. 尺寸、间距、圆角、阴影、动效、层级

### 6.1 间距（4px 基准）

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-space-05` | `2px` | 最小间隙、角标内边 |
| `--nvui-space-1` | `4px` | 图标与文字、紧凑按钮组 |
| `--nvui-space-15` | `6px` | 按钮内竖向、标题内间隙 |
| `--nvui-space-2` | `8px` | 行内元素、堆栈小间距 |
| `--nvui-space-25` | `10px` | 列表行竖向、输入行内边 |
| `--nvui-space-3` | `12px` | 面板内块间距、按钮横向 |
| `--nvui-space-4` | `16px` | 面板与弹窗内边距 |
| `--nvui-space-5` | `20px` | 松散堆栈 |
| `--nvui-space-6` | `24px` | 空态与分区间隔 |

间距刻度是 4px 基准（含 2px 与 6px、10px 两个半档）。不要写 `5px` / `7px` 这类刻度外数值；需要更密的视觉时改字号或行高，而不是压缩间距。

- 行内元素之间用 `--nvui-space-1` 或 `--nvui-space-15`；同一分组内的行之间用 `--nvui-space-2`。
- 分组之间用 `--nvui-space-3` 到 `--nvui-space-4`；容器内边距用 `--nvui-space-4`。
- 竖向节奏靠间距而非分隔线：能靠留白分开的，就不加 1px 线。
- 组件内的 padding 与 gap 同样只取刻度：按钮横向 `--nvui-space-3`、竖向 `--nvui-space-15`。

### 6.2 圆角

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-radius-xs` | `6px` | 行内代码、小提示条 |
| `--nvui-radius-sm` | `8px` | 输入框、按钮、工具提示 |
| `--nvui-radius` | `12px` | 折叠分组、空态、卡片 |
| `--nvui-radius-lg` | `16px` | 悬浮面板、吐司、窄屏弹窗 |
| `--nvui-radius-xl` | `20px` | 弹窗、桌面面板 |
| `--nvui-radius-pill` | `999px` | 开关、徽标、标签页、进度条 |

圆角只用于容器边界；文字、图标不加圆角。同一层级内的浮层用同一档圆角，不要按内容长度选。容器与内部控件形成两档即可：容器用 `--nvui-radius` 或更大，内部控件用 `--nvui-radius-sm`。胶囊件（开关、徽标、标签页）一律 `--nvui-radius-pill`，不要用固定像素近似。

### 6.3 阴影

阴影只服务浮层（弹窗、悬浮面板、工具提示、吐司、`.nvui-glass`），静态区块不加投影。阴影 = 环境投影 + 顶部 1px 内高光，内高光引用 `--nvui-glass-highlight`，让玻璃边缘看起来受光；圆角玻璃只靠柔光与阴影成形，不画 1px 外框（组件侧细节见第 7 章）。下表为深色值，浅色值见 4.2。

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-shadow-modal` | `0 16px 48px rgba(0, 0, 0, 0.42), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 var(--nvui-glass-highlight)` | 弹窗与面板 |
| `--nvui-shadow-pop` | `0 10px 30px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.25), inset 0 1px 0 var(--nvui-glass-highlight)` | 悬浮面板、提示、吐司 |

浅色主题的阴影值见 4.2，投影改用低透明度的墨色。不要给静态区块加投影表达层级，层级用 `--nvui-bg` 到 `--nvui-bg-3` 的色阶与间距表达。

### 6.4 动效

动效只表达层级、方向与因果：入场用 `slow` + `emphasized`，颜色与微反馈用 `fast` + `standard`，需要回弹的反馈才用 `spring`。

选择顺序：

- 只改颜色、背景或做按压反馈：用 `--nvui-transition`（120ms + standard）。
- 位置、高度、进出场：用 `--nvui-transition-slow`（320ms + emphasized），或按需组合 `slow` 与 `emphasized`。
- 需要回弹：只在开关滑钮、吐司、弹出等少数反馈上用 `--nvui-ease-spring`，不要到处上弹簧。
- 循环动画：时长用 `--nvui-spin-duration` / `--nvui-shimmer-duration` / `--nvui-pulse-duration`，不写裸秒数。

#### 6.4.1 时长

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-duration-fast` | `120ms` | 颜色、背景、按压缩放 |
| `--nvui-duration-base` | `200ms` | 淡入、遮罩进出、标签激活 |
| `--nvui-duration-slow` | `320ms` | 弹窗与吐司入场、折叠高度 |

三档时长是封顶值：hover 与按压用 `fast`，状态切换用 `base`，进出场用 `slow`。超过 320ms 的动效会让面板显得迟钝，不要在业务里另写 500ms 之类的值。

#### 6.4.2 缓动

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 颜色、透明度、遮罩 |
| `--nvui-ease-emphasized` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | 位移、高度、进出场 |
| `--nvui-ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 开关滑钮、吐司、弹出 |

#### 6.4.3 组合 / 循环 / 位移

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-transition` | `var(--nvui-duration-fast) var(--nvui-ease-standard)` | 通用过渡组合 |
| `--nvui-transition-slow` | `var(--nvui-duration-slow) var(--nvui-ease-emphasized)` | 折叠、箭头旋转等慢过渡 |
| `--nvui-spin-duration` | `0.8s` | 加载环旋转周期 |
| `--nvui-shimmer-duration` | `1.4s` | 扫光与不确定进度周期 |
| `--nvui-pulse-duration` | `1.8s` | 状态点呼吸周期 |
| `--nvui-stagger-step` | `45ms` | 列表子项延迟步长 |
| `--nvui-enter-distance` | `10px` | 入场位移距离 |

#### 6.4.4 关键帧清单（16 个，全部 `nvui-` 前缀且被引用）

| 关键帧 | 使用方 | 变化属性 | 说明 |
| :--- | :--- | :--- | :--- |
| `nvui-spin` | `.nvui-spinner` | `transform` | 加载环旋转 |
| `nvui-fade-in` | `.nvui-fade-in`、`.nvui-tooltip` | `opacity` | 纯淡入 |
| `nvui-slide-up` | `.nvui-slide-up`、`.nvui-stagger > *` | `opacity` + `transform` | 淡入并上移 10px |
| `nvui-pop-in` | `.nvui-pop-in` | `opacity` + `transform` | 0.94 缩放到 1 |
| `nvui-overlay-in` | `.nvui-overlay` | `opacity` | 遮罩入场 |
| `nvui-overlay-out` | `.nvui-overlay.is-closing` | `opacity` | 遮罩退场 |
| `nvui-modal-in` | `.nvui-overlay:not([hidden]) .nvui-modal` | `opacity` + `transform` | 上移 14px 并 0.97 缩放 |
| `nvui-modal-out` | `.nvui-overlay.is-closing .nvui-modal` | `opacity` + `transform` | 下沉 8px 并 0.98 缩放 |
| `nvui-toast-in` | `.nvui-toast` | `opacity` + `transform` | 上移 16px 并 0.98 缩放 |
| `nvui-toast-out` | `.nvui-toast.is-closing` | `opacity` + `transform` | 下沉 10px 并 0.98 缩放 |
| `nvui-tab-select` | `.nvui-tab.is-active` | `opacity` + `transform` | 选中弹跳 0.94 到 1 |
| `nvui-tabpane-in` | `.nvui-tabpane.is-active` | `opacity` + `transform` | 淡入并上移 6px |
| `nvui-switch-on` | `.nvui-switch-row input[type="checkbox"]:checked` | `transform` | 轨道回弹 0.92 到 1.04 |
| `nvui-shimmer` | `.nvui-skeleton::after`、`.nvui-progress-bar::after` | `transform` | 扫光平移一轮 |
| `nvui-progress-indeterminate` | `.nvui-progress.is-indeterminate .nvui-progress-bar` | `transform` | 平移并 scaleX 呼吸 |
| `nvui-pulse` | `.nvui-pulse`、`.nvui-status-dot.is-live` | `opacity` + `transform` | 呼吸到 0.55 |

这 16 个关键帧只改 `opacity` 与 `transform`，全部以 `nvui-` 前缀命名，不会污染宿主命名空间；每个都至少被一处 `animation` 引用，没有只定义不使用的死动画。

#### 6.4.5 合成友好与降级规则

- 动画只改 `opacity` / `transform` 等合成友好属性；不改 `width` / `height` / `top` / `left` / `margin`，避免触发布局与重绘。
- 两个例外：折叠面板用 `grid-template-rows` 做真实高度动画，进度条用 `width` 表达进度（业务驱动、低频、非循环）；扫光与不确定进度一律用 `transform` 平移。
- 循环动画时长必须走 `--nvui-shimmer-duration` / `--nvui-pulse-duration` / `--nvui-spin-duration`，不写裸秒数。
- 同一屏同时运行的循环动画不超过 2 个；`stagger` 只给列表入场用，不用于循环，且只覆盖前 10 个子项。
- `prefers-reduced-motion: reduce` 下 kit 统一把动画与过渡降到 `0.01ms` 并清掉 stagger 延迟，业务无需自己判断。

```html
<!-- 列表入场：子项自动按 45ms 递增延迟 -->
<div class="nvui-stagger">
    <div class="nvui-badge">第一项</div>
    <div class="nvui-badge">第二项</div>
    <div class="nvui-badge">第三项</div>
</div>
```

### 6.5 组件尺寸

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-control-h` | `32px` | 按钮与输入框统一高度 |
| `--nvui-switch-w` | `36px` | 开关轨道宽 |
| `--nvui-switch-h` | `21px` | 开关轨道高 |
| `--nvui-switch-knob` | `15px` | 滑钮直径 |
| `--nvui-switch-knob-offset` | `2px` | 滑钮距轨道内边 |
| `--nvui-switch-knob-on` | `15px` | 勾选态滑钮右移距离 |
| `--nvui-modal-width` | `680px` | 弹窗最大宽度 |
| `--nvui-modal-max-h` | `80vh` | 弹窗最大高度（手机 92dvh） |
| `--nvui-panel-width` | `720px` | 插件面板最大宽度 |
| `--nvui-panel-max-h` | `88vh` | 插件面板固定高（手机 92dvh） |

面板宽度按 `width: var(--nvui-panel-w, min(var(--nvui-panel-width), 100%))` 使用，桌面定宽、窄屏自动收满；高度用固定值而非内容撑开，折叠展开只改变内部滚动区域，外框不跳变。改这 10 个令牌即可整体缩放控件，不要在组件里另写尺寸。

> **v3.0.0：尺寸有了独立的运行时载体。** `createPanel` 不再往面板上写内联 `style.width/height`，
> 改为写 `--nvui-panel-w` / `--nvui-panel-h` 两个**实例级**变量；上面那两个令牌是**全局默认值**，
> 只要没有任何实例写入，`var()` 就回落到它们。两者分工：
>
> | 想改什么 | 改哪里 |
> | :--- | :--- |
> | 所有面板的默认尺寸 | `--nvui-panel-width` / `--nvui-panel-max-h`（`tokens.css` 或运行时覆盖） |
> | 某一个面板的尺寸 | `.nvui-panel { width: 500px }`（v3.0.0 起真的生效，不必 `!important`），或 `panel.style.setProperty('--nvui-panel-w', '640px')` |
> | 持久化记住的尺寸 | `persist.size`（`true` / `false` / `'width-only'`），载体同上 |
>
> **v3.1 起没有第二条写入路径**：v3.0.0 曾有 `data-nvui-legacy-size` 过渡开关（命中时仍写内联 px），
> 现已移除，kit 恒写变量。宿主 CSS 硬依赖 `style.width` 的下游请改用 `panel.style.setProperty()` 或
> 自己的选择器，不要再找开关；迁移细节见 [MIGRATION-v3.md](MIGRATION-v3.md) §1。

- 桌面：面板 720px × 88vh，弹窗最大 680px × 80vh。
- 手机（600px 及以下）：面板与弹窗高度都切到 92dvh，面板改为全宽底部抽屉。
- 控件高度统一取 `--nvui-control-h`；开关整体尺寸由 `--nvui-switch-w` / `--nvui-switch-h` / `--nvui-switch-knob` 三个令牌决定。
- 手机宽度下不要放大控件来「填满」屏幕：尺寸令牌不变，靠布局让内容自然流动。

### 6.6 层级

| 令牌 | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-z-layer` | `1000000` | 载体档：`dialog.nvui-tl` 自身（非模态 `show()` 不进 top layer，档位必须显式给） |
| `--nvui-kit-version` | `"3.1.1"` | v2.8.0 起：纯 CSS 下游可读的 kit 版本（与 `package.json` / `NVUI.version` 一致） |
| `--nvui-z-floating` | `1000010` | 悬浮入口与悬浮面板 |
| `--nvui-z-overlay` | `1000020` | 子浮层：遮罩与弹窗层 |
| `--nvui-z-tooltip` | `1000030` | 工具提示；吐司载体也取此档 |

四档都在 100 万以上的安全区且互不重叠，足以压过宿主的正 z-index 表面（酒馆的竞争上限约 29999）。

遇到「面板可见但点不到」，按下面顺序排查：

1. 浮层是否真的在 `dialog.nvui-tl` 载体里：裸 `position: fixed` 挂 body 会被宿主内容整块压住。
2. 载体是否真的打开了：未 `show()` 的载体是 `display: none`。
3. 子浮层档位是否用对：普通面板内容不需要 tooltip 档，用错会盖住吐司或反而被遮罩盖住。
4. 宿主是否处于模态：`showModal()` 会给整页加 `inert`，此时任何档位都无效，只能按 `.is-host-modal` 让位。

> 实测约束：非模态 `dialog.show()` 不进浏览器 top layer（只有 `showModal()` 进，而它给整页加 `inert`、会废掉宿主交互，因此 kit 禁用模态）。层级完全由载体自身的 `z-index: var(--nvui-z-layer)` 保证——`position: fixed` 会创建层叠上下文，载体内部子元素的 `z-index` 只在载体内部生效，压不过宿主的高层级区域。

载体内部的子浮层（`.nvui-overlay` / `.nvui-floating` / `.nvui-toast-stack`）在载体自己的层叠上下文里比较 floating / overlay / tooltip 三档；多个载体同级时由 DOM 顺序决定，所以吐司载体单独用 `.nvui-tl-toast` 提到 `--nvui-z-tooltip`。

```html
<!-- 载体固定结构：层级由 dialog.nvui-tl 自身保证 -->
<dialog class="nvui-tl">
    <div class="nvui-overlay">
        <div class="nvui-modal" role="dialog" aria-modal="true">...</div>
    </div>
</dialog>
```

宿主若用 `dialog.showModal()` 打开模态弹窗，上面任何档位都无效——模态给整页加 `inert`，`inert` 元素不参与命中测试。此时 kit 载体自动加 `.is-host-modal`（不可点并压暗）主动让位，模态关闭后自动还原；宿主层级红线的完整说明见第 8 章，载体与模态的交互细节见 13.7 节。

层级问题不要靠「再加 100 万」解决：先把浮层收进载体，再用四档里合适的一档。数值一旦上调，宿主任何更高层表面都会让同一处问题在别的页面复现。

## 7. 组件规范

本章是组件层规范：每个组件按「定位 → DOM（可选）→ 类名 / 状态表 → 规则 → a11y」阅读。组件类以测试登记的 **80 个** 为准（`test/test-ui-kit.js` 的 `COMPONENT_CLASSES`），状态类 `is-*` 不计入。颜色、字号、尺寸、动效等取值一律以第 4 / 5 / 6 章为准，本章只写结构、状态与行为；焦点移入 / 陷阱 / 归还的完整配方统一见 §2.3，不再重复。所有组件都可在 `preview.html` 中看到实际效果。

### 7.1 作用域与基础

浮层根节点必须落在作用域类里：`.nvui-scope` 负责排版继承与 `box-sizing`，主题与实心模式是叠加开关。`.nvui-form-scope` 是表单隔离的显式 opt-in 根（v2.7.0），细节见 §7.6.1。

| 类名 | 作用 | 备注 |
| :--- | :--- | :--- |
| `.nvui-scope` | 组件作用域 + 基础排版（`box-sizing` / `color` / 字号 / 行高） | 浮层根节点必加 |
| `.nvui-theme-light` | 浅色令牌覆盖根类 | 与 `.nvui-scope` 叠加；覆盖定义在 `tokens.css` 末尾 |
| `.nvui-form-scope` | 自定义普通容器的表单隔离 opt-in | 不创建定位 / 遮罩 / 模态，不替代 `.nvui-scope` |
| `.nvui-sr-only` | 读屏专用隐藏文本 | 不用 `display:none`，需要读屏朗读时使用 |

规则：

- 三个根开关（`.nvui-scope` / `.nvui-theme-light` / `.nvui-solid`）可任意组合；主题与实心模式只切令牌与玻璃表面，不改布局。
- 组件规则只写在 `.nvui-*` / `dialog.nvui-tl` 作用域下，不使用裸元素选择器；ID 级作用域仅用于对抗宿主既有全局样式。
- 新增组件类必须同时登记到 `test/test-ui-kit.js` 与本章表格，组件类总数同步为 80。
- 无障碍：`.nvui-sr-only` 用于补充读屏文字，视觉隐藏但可被朗读，不要拿它隐藏可交互控件。

另有三类「公开但未登记进 80 个清单」的辅助类，不要把它们算作组件类：

| 类名 | 用途 | 归属 |
| :--- | :--- | :--- |
| `.nvui-tl-toast` | 吐司载体提级（`z-index: var(--nvui-z-tooltip)`） | §7.14 |
| `.nvui-theme-toggle` | 面板头部主题切换按钮（v2.5.0） | 第 12 章 |
| `.nvui-update-pill` | 面板头部版本更新胶囊（v2.5.0） | 第 12 章 |

### 7.2 玻璃工具类与实心模式

`.nvui-glass` 给任意容器套一层 popover 级玻璃；`.nvui-solid` 是根节点开关，把全部玻璃表面回退为不透明表面（实心扁平）。圆角玻璃不画外框 1px 描边、popover 级只承诺正文 AA，两条政策见 §3 与 §4.4，本节不再展开。

| 类名 / 状态 | 说明 |
| :--- | :--- |
| `.nvui-glass` | 默认 strong 档（`--nvui-glass-bg-strong`）+ 20px 模糊 + `--nvui-shadow-pop`；无外框描边，靠顶部受光与阴影成形；文字用 `--nvui-text` |
| `.nvui-glass.is-subtle` | 弹窗级低档（`--nvui-glass-bg`）+ 12px 模糊、去阴影；仅当底下已有遮罩或深色画布时使用 |
| `.nvui-solid` | 用户主动实心：`overlay` / `modal` / `panel` / `floating` / `tooltip` / `toast` / `glass` 全部改不透明底并 `backdrop-filter: none` |
| `.nvui-glass-fallback` | **自动**近不透明回退（v2.7.2，运行时探测到宿主禁用模糊时加在根节点）：改用 token 派生 97% 不透明色并关模糊（极轻透出）；`.nvui-solid` 优先级更高，可覆盖它 |

降级链由 `components.css` 内置，业务不写分支：

| 条件 | 行为 |
| :--- | :--- |
| 浏览器不支持 `backdrop-filter` | 回退不透明表面（弹窗 `--nvui-bg`，popover 级 `--nvui-bg-2`） |
| `prefers-reduced-transparency: reduce` | 同上，并 `backdrop-filter: none` |
| `forced-colors: active` | 玻璃表面加 `1px solid CanvasText`，去阴影与模糊 |
| 窄屏（`max-width: 600px`） | 弹窗模糊降档为 `--nvui-glass-blur-sm` |
| 宿主全局禁用模糊（Fast UI / `body.no-blur`） | `NVUI.syncGlassFallback()` 读实际计算值，自动加 `.nvui-glass-fallback`（97% token 派生近不透明档，不再整块 `.nvui-solid`）；CSS 就绪前不落回退并自动重探 |

规则：`.nvui-glass` 直接叠在任意宿主背景上时必须用默认 strong 档，只有确认底下已有遮罩 / 深色画布时才用 `.is-subtle`；popover 玻璃上的说明文字一律用 `--nvui-text`。无障碍：玻璃只做视觉层次，状态语义必须由实色文字 / 图标 / 圆点承担。

### 7.3 遮罩与弹窗（玻璃 + 进出场）

结构固定为 `dialog.nvui-tl > .nvui-overlay > .nvui-modal > (header + body + footer)`：

```html
<dialog class="nvui-tl" id="your_modal_layer">
    <div class="nvui-overlay" id="your_overlay" hidden>
        <div class="nvui-modal" role="dialog" aria-modal="true" aria-labelledby="your_modal_title">
            <div class="nvui-modal-header">
                <b class="nvui-modal-title" id="your_modal_title">标题<span class="nvui-modal-ver">v1.0.0</span></b>
                <span class="nvui-modal-actions">
                    <button type="button" class="nvui-icon-btn" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
                </span>
            </div>
            <div class="nvui-modal-body">...</div>
            <div class="nvui-modal-footer">
                <button type="button" class="nvui-btn is-ghost" data-close>取消</button>
                <button type="button" class="nvui-btn is-primary">确定</button>
            </div>
        </div>
    </div>
</dialog>
```

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-tl` | `<dialog>` 载体：fixed 铺满视口（`100dvh`）、`pointer-events: none`、未打开时 `display: none`；自带 `z-index: var(--nvui-z-layer)` |
| `.nvui-overlay` | 全屏遮罩：flex 居中、`--nvui-overlay-bg` 底 + 小档磨砂；`hidden` 属性即可隐藏；`.is-closing` 播退场 |
| `.nvui-modal` | 弹窗本体：`--nvui-glass-bg` 玻璃、`--nvui-radius-xl`、`--nvui-shadow-modal` |
| `.nvui-modal-header` | 头部：标题 + 右侧操作区，底部 1px 直线分隔（`--nvui-glass-line`），不可压缩 |
| `.nvui-modal-title` | 标题（内联 flex）；`.is-lg` 为大标题变体，内嵌图标用主色 2 |
| `.nvui-modal-ver` | 版本号胶囊（`fs-xs`、淡底） |
| `.nvui-modal-actions` | 头部右侧操作区（图标按钮组） |
| `.nvui-modal-body` | 正文区：可滚动、`overscroll-behavior: contain`、长文行高 1.8；窄屏字号升到 `--nvui-fs-xl` 并隐藏滚动条（保留滚动能力） |
| `.nvui-modal-footer` | 底部操作区：右对齐按钮组，顶部 1px 直线分隔 |
| `.nvui-icon-btn` | 28×28 方形图标按钮：hover 加底色、`:active` 缩放 0.92、带统一焦点环 |

规则：

- 打开：`dialog.show()`（旧内核兜底 `setAttribute('open', '')`）+ `overlay.hidden = false`；关闭：加 `.is-closing`，等 `animationend` 或约 260ms 兜底后 `hidden = true` 并移除类、`dialog.close()`。完整配方见 §2.3，也可直接用 `NVUI.openLayer()` / `NVUI.closeLayer()`。
- 关闭必须同时支持 Esc 与点遮罩（判定 `e.target === overlay`）；不要用 `showModal()`（会给整页加 `inert`，理由见 §8）。
- 业务不要自己写 `display:none` 收尾，否则退场动画被跳过；焦点移入 / 陷阱 / 归一见 §2.3。
- 无障碍：`.nvui-modal` 上 `role="dialog"` + `aria-modal="true"` + `aria-labelledby` 指向 `.nvui-modal-title`；关闭按钮必须有 `aria-label`；不要自动聚焦破坏性按钮。

面板族 10 个类也登记在组件清单里，职责如下，布局与响应式规则统一见第 12 章：

| 类名 | 职责 |
| :--- | :--- |
| `.nvui-panel` | 面板本体（flex 纵向、固定高、宽度 `var(--nvui-panel-w, min(var(--nvui-panel-width), 100%))`，默认 720px 上限；v3.0.0 起尺寸写变量而非内联 px）+ 玻璃底 |
| `.nvui-panel-header` / `.nvui-panel-title` | 标题栏；标题用 `fs-2xl` 粗体、单行省略 |
| `.nvui-panel-actions` / `.nvui-panel-body` | 标题栏右侧操作组；body 是唯一滚动层（隐藏滚动条、`overscroll-behavior: contain`） |
| `.nvui-panel-footer` / `.nvui-panel-heading` | 可选底部操作区；内容区「分区标题 + 版本徽标」行 |
| `.nvui-sheet-handle` / `.nvui-bottom-nav` | 手机底部抽屉 40×4 拖拽把手；手机底部图标导航容器（桌面均隐藏） |
| `.nvui-bottom-nav-item` | 底部导航项（`is-active` + `aria-current="page"`） |

### 7.4 按钮

扁平规则：按钮没有可见描边与投影，层级只靠底色；hover 升一档底色，`:active` 缩放到 0.97 给按压反馈。

| 类名 / 状态 | 说明 |
| :--- | :--- |
| `.nvui-btn` | 默认中性按钮：`--nvui-block-bg` 底、无描边，悬停 `--nvui-block-bg-2` |
| `.nvui-btn-row` | 按钮组：等宽（`flex: 1 1 140px`）并自动换行，窄屏单列 |
| `.nvui-actions` | 默认按钮组容器（v2.8.0）：`flex + wrap + gap 8px + 右对齐`；不想记 `.nvui-btn-row` / footer 时的通用出口 |
| `.nvui-btn.is-primary` | 主操作：`--nvui-accent-strong` 实心 + `--nvui-on-accent` 文字 + 顶部内高光 |
| `.nvui-btn.is-secondary` | 次级操作：主色淡底 + 主色文字 |
| `.nvui-btn.is-ghost` | 弱操作：淡底、无描边 |
| `.nvui-btn.is-danger` | 破坏性操作：语义红淡底 |
| `.nvui-btn.is-sm` | 小尺寸 |
| `.nvui-btn.is-block` | 通栏 |
| `.nvui-btn:disabled` | 禁用态：降透明度 + `not-allowed` |

规则：同一区块主按钮最多 1 个；破坏性操作必须用 `is-danger` 且二次确认；按钮文字 2~6 个汉字，图标在前、文字在后；hover 不允许加投影或发光。无障碍：一律写 `<button type="button">`；纯图标按钮必须给 `aria-label`；禁用用原生 `disabled` 而不是只加类。

### 7.5 胶囊开关行（弹簧回弹）

```html
<label class="nvui-switch-row">
    <input type="checkbox" checked>
    <span>导出时嵌入图片</span>
</label>
```

| 部分 / 状态 | 规则 |
| :--- | :--- |
| `.nvui-switch-row` | 整行 label 可点；`row-reverse` 实现左标题右开关；底部发丝线（`:last-child` 去掉）；`.is-feature` 高亮功能行（左侧主色竖条 + 淡底） |
| `input[type="checkbox"]` | 36×21 胶囊；`appearance: none`；清掉宿主 `::before` 对勾；`::after` 为 15px 滑钮 |
| `:checked` | 轨道变 `--nvui-accent`，滑钮右移并变白，同时播 `nvui-switch-on` 回弹（0.92 → 1.04 → 1） |
| `:active::after` | 按住时滑钮沿运动方向 `scaleX(1.12)`，松手弹簧回位；`:active` 时轨道整体 `scale(0.96)` |
| `:focus-visible` | 统一焦点环 token（当前 2px 整数像素，单圈不叠内圈） |

规则：业务侧用 `change` 事件同步设置并刷新摘要；不要自写 `::before` 对勾或额外描边。无障碍：label 包裹 input，点击文字即可切换；说明文字用可见 `<span>`，不要用 `title`（移动端不可见）。

#### 7.5.1 独立复选框 `.nvui-checkbox`（v2.6.0 · 批量选择）

胶囊开关表达「启用 / 禁用」；批量选择（多选列表、表格行、卡片多选）用独立复选框。它是裸 `<input>`，可整列批量生成，语义仍是原生 checkbox。

```html
<label class="my-row"><input type="checkbox" class="nvui-checkbox" checked><span>条目 A</span></label>
<label class="my-row"><input type="checkbox" class="nvui-checkbox" id="check-all"><span>全选</span></label>
```

| 部分 / 状态 | 规则 |
| :--- | :--- |
| `.nvui-checkbox` | 16×16 小方块：`--nvui-input-bg` 底 + `--nvui-line-2` 1px 描边 + `--nvui-radius-sm`；`appearance: none`、显式宽高、`display: inline-block`（压掉宿主 `display: grid`） |
| `::before` / `::after` | `::before` 与 `.nvui-switch-row` 共用宿主对勾压制（`content: none` + `display: none`），不新增 `!important`；`::after` 是纯 CSS 对勾（`border` 旋转 45° + `--nvui-on-accent`），未选中时 `opacity: 0` |
| `:checked` / `:indeterminate` | 选中：主色底 + 同色描边 + 对勾淡入；半选：主色底 + 中央横杠，由 JS 设 `input.indeterminate = true` |
| `:hover` / `:disabled` | hover 只把描边提到中性线色；disabled 降透明度并禁用指针 |
| 宿主隔离 | 选择器写成 `.nvui-checkbox[type="checkbox"]`（0,2,0），只命中 kit 自己的类，不接管宿主其它 checkbox |

规则：半选态只由原生 `indeterminate` 属性驱动，不要自己画第三种状态；该组件自带元素级隔离，不依赖 `.nvui-scope`。无障碍：保留原生 checkbox 语义（Tab 聚焦 / Space 切换）；列表项必须有可见文字或 `aria-label`。

### 7.6 输入行

```html
<label class="nvui-input-row">
    <input class="nvui-input is-number" type="number" value="5">
    <span>单图上限 (MB)</span>
</label>
```

| 类名 / 状态 | 说明 |
| :--- | :--- |
| `.nvui-input-row` | 左标题 + 右控件（`row-reverse`），底部发丝线 |
| `.nvui-input` | 输入框：`--nvui-input-bg` 扁平底 + `--nvui-control-h` 高；hover 底色微提亮；基础态不加描边 / 投影 |
| `.nvui-input.is-number` | 数值框：定宽 96px、右对齐；原生步进按钮已隐藏，键盘 ↑/↓ 与滚轮仍可调值 |
| `.nvui-input.is-path` | 路径框：200px、最大 60% 行宽 |
| `.nvui-input:focus-visible` | 单圈 2px 焦点环（`outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)`），不叠加内圈描边 |

规则：所有可编辑控件必须有可见 label（label 包裹即可）；失焦或回车触发保存；数值用 `min` / `max` / `step` 限制；需要可见步进器时用 `.nvui-icon-btn` 自建，不要依赖原生控件。无障碍：label 与控件关联；校验失败要给文字说明，不能只用红色边框。

#### 7.6.1 宿主表单控件隔离层（v2.6.0，v2.7.0 opt-in 扩展 · 修复 GitHub #9）

第三方主题常用「元素选择器 + `!important`」重写全局 `input` / `select` / `textarea`。`.nvui-input` 是裸类（0,1,0），在 `!important` 面前必输，于是浅色主题下会出现深底 + 深字。隔离层只落在三个有界作用域：`dialog.nvui-tl`、`.nvui-panel` 两个默认载体，以及显式加 `.nvui-form-scope` 的自定义普通容器。

```html
<div class="nvui-form-scope">
    <input class="nvui-input" type="text" value="普通容器内的 kit 输入框">
    <select class="nvui-input"><option>选项 A</option></select>
    <textarea class="nvui-input" rows="2">多行文本</textarea>
</div>
```

```css
dialog.nvui-tl input.nvui-input,
dialog.nvui-tl select.nvui-input,
dialog.nvui-tl textarea.nvui-input,
.nvui-panel input.nvui-input,
.nvui-panel select.nvui-input,
.nvui-panel textarea.nvui-input,
.nvui-form-scope input.nvui-input,
.nvui-form-scope select.nvui-input,
.nvui-form-scope textarea.nvui-input {
    background: var(--nvui-input-bg) !important;
    color: var(--nvui-text) !important;
    border: none !important;
    border-radius: var(--nvui-radius-sm);
}
```

| 规则 | 说明 |
| :--- | :--- |
| 作用域 | 默认仍是 `dialog.nvui-tl` 与 `.nvui-panel` 双载体；v2.7.0 起，显式加 `.nvui-form-scope` 的自定义容器成为第三作用域，未加类不接管 |
| `!important` 分配 | 表单隔离 7 条（基础态 `background` / `color` / `border` 3 条 + `select` 的 `margin` 1 条 + `:hover` 的 `background` 1 条 + `option` 与默认载体 `optgroup` 的 `background` / `color` 2 条）；全文件总量 18 条（另含 checkbox 2、reduced-motion 5、force 玻璃 4）见 §9 |
| 值 | 全部来自 token；`border: none` / `margin: 0` 是对宿主描边与外边距的明确 reset，不是新配色 |
| `:hover` | 必须同作用域再声明一次 `background: var(--nvui-block-bg) !important`，否则会被基础态的 `!important` 压掉 |
| 外边界 | 三个作用域之外的 `.nvui-input` 不接管；作用域内非 `.nvui-input` 控件同样不接管 |

规则：新增属性或作用域必须先改 §9 的 `!important` 预算与测试断言，不能顺手放行；`.nvui-form-scope` 只作隔离根标记，不创建定位 / 遮罩 / 模态，也不替代 `.nvui-scope`。无障碍：`select` 的 `option` 颜色不能作为唯一信息载体，选中状态需要文字可辨。

### 7.7 标签页（激活弹跳 / 粘连指示器）

```html
<nav class="nvui-tabs" role="tablist" aria-label="设置分区">
    <span class="nvui-tabs-indicator" aria-hidden="true"></span>
    <button type="button" class="nvui-tab is-active" role="tab"
            id="tab_a" aria-selected="true" aria-controls="pane_a">连载</button>
    <button type="button" class="nvui-tab" role="tab"
            id="tab_b" aria-selected="false" aria-controls="pane_b">过滤</button>
</nav>
<div class="nvui-tabpane is-active" id="pane_a" role="tabpanel" aria-labelledby="tab_a">...</div>
<div class="nvui-tabpane" id="pane_b" role="tabpanel" aria-labelledby="tab_b">...</div>
```

| 类名 / 状态 | 说明 |
| :--- | :--- |
| `.nvui-tabs` | 横向滚动容器（`position: relative`），底部发丝线，隐藏滚动条 |
| `.nvui-tab` | 单个标签按钮：透明底、`text-2`，`:active` 缩放 0.97；`.is-active` 主色淡底 + 加粗 + 播 `nvui-tab-select` 弹跳 |
| `.nvui-tabpane` | 面板默认 `display:none`，`.is-active` 时显示并播 `nvui-tabpane-in` 入场（淡入 + 上移 6px） |
| `.nvui-tabs-indicator` | 可选粘连滑动指示器：`position:absolute`、`pointer-events:none`、默认 `opacity:0`；位置与尺寸由 `--nvui-tab-ind-x` / `--nvui-tab-ind-y` / `--nvui-tab-ind-w` / `--nvui-tab-ind-h` 驱动；底部直线强调 `inset 0 -2px 0 var(--nvui-accent-line)` |
| `.nvui-tabs.is-indicator` | 启用指示器模式：指示器 `opacity:1`；`.nvui-tab.is-active` 背景透明且关掉 `nvui-tab-select`，避免双重动画 |

规则：只切 `display`，绝不重建 tabpane DOM（否则丢输入焦点与异步结果）；只有当前标签可 Tab 聚焦（`tabIndex=0/-1`），左右方向键切换由 JS 实现。指示器是可选增强：不插 `.nvui-tabs-indicator` 或不执行下面的配方时，自动回退为按钮自身高亮，即无 JS 回退路径。

下面是可独立运行的配方（返回 `{ activate, syncIndicator }` 以便面板复用；`NVUI` 控制器已内置同名 `syncIndicator()`）：

```js
function setupTabs(nav) {
    const tabs = [...nav.querySelectorAll('.nvui-tab')];
    const ind = nav.querySelector('.nvui-tabs-indicator');
    if (!tabs.length) return null;

    const box = (el) => ({ l: el.offsetLeft, t: el.offsetTop, r: el.offsetLeft + el.offsetWidth, b: el.offsetTop + el.offsetHeight });
    function apply(r) {
        if (!ind) return;
        ind.style.setProperty('--nvui-tab-ind-x', r.l + 'px');
        ind.style.setProperty('--nvui-tab-ind-y', r.t + 'px');
        ind.style.setProperty('--nvui-tab-ind-w', (r.r - r.l) + 'px');
        ind.style.setProperty('--nvui-tab-ind-h', (r.b - r.t) + 'px');
    }
    const activeTab = () => nav.querySelector('.nvui-tab.is-active') || tabs[0];
    function syncIndicator(tab) {
        if (ind) apply(box(tab || activeTab()));
    }
    function activate(tab) {
        const from = box(activeTab());
        const to = box(tab);
        tabs.forEach((t) => {
            const on = t === tab;
            t.classList.toggle('is-active', on);
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
            const pane = document.getElementById(t.getAttribute('aria-controls'));
            if (pane) {
                pane.classList.toggle('is-active', on);
                pane.hidden = !on;
            }
        });
        if (!ind) return; // 无指示器：纯按钮高亮（无 JS 回退）
        // stretch-then-settle：先拉长到「旧位置 ∪ 新位置」，两帧后再收缩/回弹到目标
        apply({ l: Math.min(from.l, to.l), t: Math.min(from.t, to.t), r: Math.max(from.r, to.r), b: Math.max(from.b, to.b) });
        requestAnimationFrame(() => requestAnimationFrame(() => apply(to)));
    }

    nav.classList.add('is-indicator');
    syncIndicator(activeTab());
    nav.addEventListener('click', (e) => {
        const tab = e.target.closest('.nvui-tab');
        if (tab) activate(tab);
    });
    nav.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const i = tabs.indexOf(activeTab());
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        next.focus();
        activate(next);
    });
    nav.addEventListener('scroll', () => syncIndicator(), { passive: true });
    window.addEventListener('resize', () => syncIndicator());
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => syncIndicator());
    }
    return { activate, syncIndicator };
}
// 用法：document.querySelectorAll('.nvui-tabs').forEach(setupTabs);
```

注意：

- 坐标用 `offsetLeft` / `offsetTop`（相对 `.nvui-tabs`，组件已设 `position: relative`），不要用 `getBoundingClientRect`，否则滚动容器会引入页面滚动偏移。
- 横向滚动容器里切换标签前先 `tab.scrollIntoView({ block: 'nearest', inline: 'nearest' })`，再调 `activate()`；`scroll` 事件监听保证用户手动滚动后指示器仍对齐当前标签。
- `resize`、字体加载完成、语言切换（文字宽度变化）后必须重算，否则指示器错位。
- 无障碍：`role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected` + `aria-controls`；切换时同步 `tabIndex`，左右方向键可切换。

### 7.8 折叠面板（新 DOM + 高度动画）

v2 的高度动画靠 `grid-template-rows: 0fr` ↔ `1fr` 过渡实现，因此 `.nvui-acc-body` 内部必须再包一层 `.nvui-acc-inner`（负责 `min-height: 0`、`overflow: hidden` 与左右内边距）：

```html
<div class="nvui-acc is-open">
    <button type="button" class="nvui-acc-head" aria-expanded="true">
        <span class="nvui-acc-title"><i class="fa-solid fa-folder"></i>保存位置</span>
        <span class="nvui-acc-summary">默认目录 plugins/auto-save/logs</span>
        <i class="nvui-acc-chev"></i>
    </button>
    <div class="nvui-acc-body">
        <div class="nvui-acc-inner"> ... 展开内容 ... </div>
    </div>
</div>
```

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-acc` | 分组容器：`block-bg` 扁平底 + 12px 圆角、无描边；`.is-open` 底色升到 `block-bg-2` |
| `.nvui-acc-head` | 整行标题按钮；维护 `aria-expanded`；hover 加深；焦点环用负 offset 内缩 |
| `.nvui-acc-title` | 左侧标题（可带图标） |
| `.nvui-acc-summary` | 右侧当前值摘要：单行省略；收起态唯一线索，必须维护 |
| `.nvui-acc-chev` | 纯 CSS 箭头，展开时旋转 225° |
| `.nvui-acc-body` | 高度动画容器：`display: grid; grid-template-rows: 0fr`，`.is-open` 时 `1fr`，过渡用 `--nvui-duration-slow` + `--nvui-ease-emphasized` |
| `.nvui-acc-inner` | 裁切层：`min-height: 0; overflow: hidden` + 左右内边距；正文必须包在这一层里，否则展开内容会被裁成 0 高 |

规则：开合只切 `.is-open` 与 `aria-expanded`，不重建 DOM，不要手写 `height` / `max-height`；默认建议全部收起。从 v1 升级的插件必须补 `.nvui-acc-inner`（破坏性 DOM 变更，详见 §10.3）。

持久化接管注入内容（v2.6.0 · GitHub #11）：`innerHTML` 注入的折叠条不会自动进入持久化，需要显式登记。

| API | 说明 |
| :--- | :--- |
| `panel.trackAccordion(node, id?, options?)` | 接管单个 `.nvui-acc`，返回实际 id；稳定键优先级为「显式 id > `node.id` > `data-nvui-acc-key` > 面板内 DOM 顺序（`acc_auto_<n>`）」，前三者按原始字符串保存 |
| `panel.adoptAccordions(root, options?)` | 批量接管 `root` 的后代，返回本次新增数量；重复调用返回 0；拒绝 `document` / `document.body` |

```js
const panel = NVUI.createPanel({
    id: 'my_plugin',
    title: '我的插件',
    persist: { size: true, tab: true, accordion: true }
});
panel.body.innerHTML = '<div class="nvui-acc" id="acc-advanced">...折叠结构...</div>';
panel.adoptAccordions(panel.body); // 默认不绑定点击，只接管持久化
```

规则：**默认不绑定点击**（避免与调用方已有监听形成双重 toggle），需要 kit 提供开合时显式传 `{ bind: true }`；节点已有 `setOpen` 时保留其原逻辑，仅包装持久化调度；`destroy()` 会解绑接管监听。无障碍：标题本身是 `<button>`，`aria-expanded` 随开合更新；摘要不是唯一信息（正文展开后仍可读到）。

### 7.9 区块标题 / 提示 / 告警

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-section-title` | 区块标题（图标 + 粗体 + 0.5px 字距） |
| `.nvui-hint` | 说明小字（`--nvui-fs-sm`、`--nvui-text-3`）；`.is-warn` 变注意色 |
| `.nvui-alert` | 告警条：左侧 2px 竖线 + 淡底，扁平无满框描边；语义变体 `.is-checking` / `.is-success` / `.is-warning` / `.is-error` / `.is-info` |

规则：告警不要铺满深底色，用竖线 + 淡底保持扁平；同一屏告警不超过 2 条；告警文字用 `text-2`，语义靠左侧竖线与图标传达。无障碍：告警必须同时有可读文字，颜色不能单独承担语义。

### 7.10 状态行与状态点

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-status-line` | 状态行：`is-updating` / `is-success` / `is-skipped` / `is-error`，颜色即状态 |
| `.nvui-status-time` | 右侧时间戳（`margin-left:auto`、`--nvui-text-2`，不用 opacity） |
| `.nvui-status-file` | 状态行内的文件路径（独占一行、可换行、`--nvui-text-2`） |
| `.nvui-status-dot` | 7px 状态点 + 接触光晕；变体 `.is-ok` / `.is-warn` / `.is-danger` / `.is-info`；`.is-live` 播 `nvui-pulse` 呼吸 |

```html
<div class="nvui-status-line is-updating">
    <span class="nvui-status-dot is-info is-live"></span>
    <span>正在同步</span>
    <span class="nvui-status-time">21:54</span>
    <span class="nvui-status-file">plugins/auto-save/logs/2026-10-17.txt</span>
</div>
```

规则：只用颜色表达状态的地方必须同时有文字或图标；状态点只是辅助视觉；`.is-live` 只用于进行中 / 在线，不要给静态状态加循环动画。无障碍：状态变化需要文本同步更新，读屏用户不应只依赖颜色与呼吸动画。

### 7.11 徽标 / 标签块 / 空态 / 加载

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-badge` | 胶囊徽标：仅淡底、无描边；语义变体 `.is-accent` / `.is-success` / `.is-warn` / `.is-danger` / `.is-info` |
| `.nvui-chip` | 内容标签块（小圆角、`block-bg` 底） |
| `.nvui-chip-count` | 标签后的计数角标（`--nvui-fs-2xs` 降一档文字色） |
| `.nvui-empty` | 空态：`--nvui-bg-3` 淡底 + 居中提示，无虚线圆角边 |
| `.nvui-spinner` | 纯 CSS 加载环（`nvui-spin` 循环，可用 `fa-spin` 替代） |

规则：徽标 / 标签块是静态区块，不加投影、不用玻璃；一屏徽标不超过 5 个；计数角标只放数字，不放单位。无障碍：徽标内的状态文字要可读，图标单独出现时必须配 `aria-label` 或可见文字。

### 7.12 骨架屏

```html
<div class="nvui-skeleton is-title"></div>
<div class="nvui-skeleton is-text"></div>
<div class="nvui-skeleton is-block"></div>
<div class="nvui-skeleton is-circle"></div>
```

| 类名 / 状态 | 说明 |
| :--- | :--- |
| `.nvui-skeleton` | 骨架屏：`--nvui-skeleton-bg` 底 + `::after` 渐变扫光（`nvui-shimmer` 循环）；默认高 12px |
| `.nvui-skeleton.is-text` | 文本行：高 10px |
| `.nvui-skeleton.is-title` | 标题：高 14px、宽 40% |
| `.nvui-skeleton.is-block` | 区块：高 48px |
| `.nvui-skeleton.is-circle` | 头像 / 图标：28px 圆 |

规则：骨架屏只表示内容加载中，不表示操作进行中（后者用进度条 / 加载环）；扫光用 `transform` 平移；减少动效偏好下扫光自动停止；不要放真实文字；加载完成后整体替换骨架节点，不做交叉淡入。无障碍：骨架屏是视觉占位，业务需在容器上同步 `aria-busy` 或状态文本。

### 7.13 进度条

```html
<div class="nvui-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="42">
    <span class="nvui-progress-bar" style="width: 42%"></span>
</div>
<div class="nvui-progress is-indeterminate" role="progressbar" aria-label="正在准备">
    <span class="nvui-progress-bar"></span>
</div>

<!-- 可选：带可视标题 / 数值（v2.9.0，GH-#21） -->
<div class="nvui-progress-field">
    <span data-nvui-part="label" aria-hidden="true">导出进度</span>
    <span data-nvui-part="value" aria-hidden="true">42%</span>
    <div class="nvui-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="42" aria-label="导出进度">
        <span class="nvui-progress-bar" style="width: 42%"></span>
    </div>
</div>
```

| 类名 / 状态 | 说明 |
| :--- | :--- |
| `.nvui-progress` | 轨道：高 4px、胶囊圆角、`--nvui-block-bg` 底、`overflow:hidden` |
| `.nvui-progress-bar` | 条本体：`display:block; height:100%; width:0`，宽度由业务 JS 用内联样式或 CSS 变量设置；`::after` 扫光表示进行中 |
| `.nvui-progress.is-indeterminate` | 不确定进度：条宽 40%，循环平移 + `scaleX` 呼吸 |
| `.nvui-progress.is-ok` / `.is-warn` / `.is-danger` | 语义变体：条色改为 ok / warn / danger |
| `.nvui-progress.is-idle` / `.is-complete` | 进度 0% / 100% 时停掉扫光；`NVUI.progress().setValue()` 自动维护，手写 DOM 时按需手动加 |
| `.nvui-progress-field` | **v2.9.0 新增**：带可视标题 / 数值的外层容器（网格第一行放 `[data-nvui-part="label"]` 与 `[data-nvui-part="value"]`，第二行是整行轨道）。仅 `progress({ showLabel, showValue })` 生成；手写 DOM 时直接套这层即可，可视文本请自行 `aria-hidden="true"`（语义由轨道的 `role=progressbar` 承担） |

规则：确定进度必须带 `role="progressbar"` + `aria-valuemin` / `aria-valuemax` / `aria-valuenow`；不确定进度至少给 `aria-label`；进度条不放在玻璃上；数值更新频率高于 10Hz 时不要做宽度过渡；不要用扫光表达真实进度值。无障碍：数值变化要同步 `aria-valuenow`，读屏用户才能感知进度。
**可视标签**：`progress({ showLabel: true, showValue: true })` 会额外渲染可视标题与百分比；这两段文本带 `aria-hidden="true"`，语义仍由轨道的 `role="progressbar"` + `aria-valuenow` 承担，避免读屏把同一进度播报两遍。默认关闭，既有调用的 DOM 与返回值不变。

### 7.14 吐司

```html
<dialog class="nvui-tl">
    <div class="nvui-toast-stack">
        <div class="nvui-toast is-success" role="status">
            <i class="fa-solid fa-circle-check"></i><span>已保存</span>
        </div>
    </div>
</dialog>
```

| 类名 / 状态 | 说明 |
| :--- | :--- |
| `.nvui-toast` | 吐司：`--nvui-glass-bg-strong` 玻璃 + `--nvui-radius-lg` + `--nvui-shadow-pop`；插入即播 `nvui-toast-in`；`role="status"` 让读屏播报；`.is-closing` 播退场并 `pointer-events:none`；`.is-success` / `.is-warn` / `.is-danger` 只改图标颜色 |
| `.nvui-toast-stack` | 堆栈容器：`position:fixed` 右下、`z-index: var(--nvui-z-tooltip)`、`pointer-events:none`（子吐司恢复 `auto`）、`bottom: calc(var(--nvui-space-4) + env(safe-area-inset-bottom))` |

**优先用运行时**（已处理载体、图标、退场、宿主模态降级）：

```js
NVUI.showToast({ message: '已保存', type: 'success' });
```

手写时 `.nvui-toast-stack` 必须来自 `dialog.nvui-tl` 载体（酒馆 `html` 上的 transform 会让直接挂 body 的 fixed 元素位置错乱），`stack` 获取方式如下：

```js
const layer = document.querySelector('dialog.nvui-tl');
const stack = layer && layer.querySelector('.nvui-toast-stack');

function showToast(text, kind = 'success') {
    if (!stack) return;
    const t = document.createElement('div');
    t.className = `nvui-toast is-${kind}`;
    t.setAttribute('role', 'status');
    t.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i><span></span>';
    t.querySelector('span').textContent = text;
    stack.appendChild(t);
    setTimeout(() => {
        t.classList.add('is-closing');
        const done = () => t.remove();
        t.addEventListener('animationend', done, { once: true });
        setTimeout(done, 260); // 兜底约 260ms（= 200ms base + 60ms 余量），避免动画被降级时节点残留
    }, 3200);
}
```

规则：同一时刻吐司不超过 3 条；文案控制在 24 个汉字内；吐司不是唯一反馈（重要结果仍要在页面上可查）；图标 + 文案一起用，不要只靠 emoji 或裸露图标。无障碍：`role="status"` 已内建；重要信息不能只靠会自动消失的吐司。

### 7.15 悬浮面板 / 工具提示（玻璃）

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-floating` | 悬浮入口 / 小工具窗外观：默认胶囊形态，popover 级玻璃；`.is-panel` 为竖向面板（大圆角），`.is-dragging` 为拖拽中 |
| `.nvui-floating-handle` | 拖拽把手（`cursor: grab`、`touch-action: none`） |
| `.nvui-tooltip` | 轻量工具提示（`position:fixed`、最大 340px，由 JS 定位；`pointer-events:none`；入场淡入；文字用 `--nvui-text`） |

规则：组件不提供定位逻辑，拖拽 / 位置记忆 / 点击判定由各插件实现（建议 pointer 事件 + 阈值区分点击与拖动）；`.nvui-floating` 与 `.nvui-tooltip` 必须放进 `dialog.nvui-tl` 载体（fixed 包含块问题）或由 `NVUI` 载体托管；工具提示只做说明，不承载可点内容；popover 玻璃上的说明文字一律用正文色。无障碍：悬浮入口必须可键盘操作并有 `aria-label`；工具提示内容不能是唯一信息来源。

### 7.16 布局工具与文字工具类

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-stack` | 竖向堆叠，`gap = --nvui-space-3`；`.is-loose` 加大到 `space-5` |
| `.nvui-row` | 横向排列（`align-items:center`，`gap = --nvui-space-2`）；`.is-between` 两端对齐 |
| `.nvui-grow` | 占满剩余宽度（`flex:1 1 auto; min-width:0`） |
| `.nvui-divider` | 发丝分割线（`--nvui-line`） |
| `.nvui-muted` / `.nvui-muted-2` | 文字色：次要（`text-2`）/ 提示（`text-3`） |
| `.nvui-accent-text` / `.nvui-ok-text` / `.nvui-warn-text` / `.nvui-danger-text` / `.nvui-info-text` | 语义文字色 |
| `.nvui-code` | 行内代码：`--nvui-code-bg` 底 + 小圆角 + 等宽字体 |

规则：文字色工具类只允许用于文字，不要拿来改背景；`.nvui-grow` 的父级必须是 flex 容器；分割线不要替代间距（优先用 `gap`）。无障碍：语义文字色仍需保证对比度，不要用 `text-3` 承载关键信息。

### 7.17 动效工具类与关键帧

| 类名 | 效果 | 时长 / 缓动 |
| :--- | :--- | :--- |
| `.nvui-fade-in` | 淡入 | `--nvui-duration-base` + standard |
| `.nvui-slide-up` | 淡入 + 上移 `--nvui-enter-distance` | `--nvui-duration-slow` + emphasized |
| `.nvui-pop-in` | 缩放 0.94 → 1 淡入 | `--nvui-duration-slow` + spring |
| `.nvui-stagger` | 容器：直接子项按 `nth-child` 递增 `--nvui-stagger-step`（1~10），子项播 `nvui-slide-up` | 同上 |
| `.nvui-pulse` | 循环呼吸缩放 | `--nvui-pulse-duration` |

规则：工具类只负责入场，元素渲染 / 插入时播放一次；需要重播时先移除类、强制 reflow（`void el.offsetWidth`）再加回；`stagger` 只用于列表首屏，不要给表单控件用；循环动画（`pulse`）同一屏不超过 2 个。16 个关键帧的完整清单与「只做合成友好动画」规则见 §6.4。无障碍：所有动效必须尊重 `prefers-reduced-motion`，降级后信息与布局不能丢失。

### 7.18 无障碍速查

- 弹窗：`role="dialog"` + `aria-modal="true"` + `aria-labelledby`；关闭按钮要有 `aria-label`；焦点管理见 §2.3。
- 标签页：`role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected` + `aria-controls` + `tabIndex=0/-1`。
- 折叠：标题是 `<button>`，`aria-expanded` 随开合更新；收起时回收正文焦点。
- 开关与复选框：`label` 包裹原生 `input`，不要用 `div` 模拟；批量选择保留原生 checkbox 语义。
- 吐司与状态：`role="status"`；重要信息不能只靠会自动消失的提示或颜色。
- 进度条：`role="progressbar"` + `aria-value*`；不确定进度要有 `aria-label`。
- 焦点可见：所有交互元素走 `--nvui-focus-ring-*` token（当前单圈 2px 整数像素），不要自写 outline。
- 动效与降级：尊重 `prefers-reduced-motion` / `prefers-reduced-transparency` / `forced-colors`，由 `components.css` 内置处理。

## 8. SillyTavern 宿主兼容红线

以下每条都来自真实酒馆（桌面 / 手机 / Docker / 浅色主题）踩过的坑，**下个插件请直接照做**。详细的实机证据与复盘见 [§13.5.1](#1351-层级-p0-修复浮层被酒馆内容压住)、[§13.7](#137-载体与宿主模态主动让位而非硬压) 与 [AUDIT.md](AUDIT.md)。

1. **body 级浮层必须进 `<dialog class="nvui-tl">` 载体，并用非模态 `show()`。**
   - 酒馆 `html` 上有 `transform`，`position: fixed` 的包含块会变成文档盒子，手机端浮层被顶出屏幕；
   - `showModal()` 会给整个文档加 `inert`，悬浮入口/其它弹窗全部点不到；
   - 非模态 `show()` **不进浏览器 top layer**，层级完全由载体自身的 `z-index: var(--nvui-z-layer)`（`1000000`，压过宿主竞争上限约 29999）保证。酒馆 `#sheld`（`position:absolute; z-index:30`）会整块盖住没有档位的载体，这是实机冒烟测出的真 bug；
   - 载体 `pointer-events: none` 放行页面，子浮层（`.nvui-overlay` / `.nvui-floating` / `.nvui-toast-stack`）各自恢复 `auto`；
   - 未 `show()` 的 dialog 是 `display: none`，关闭时用 `close()` 或切 `hidden`。
2. **所有 checkbox 必须隔离宿主样式。** 酒馆给每个 `input[type=checkbox]` 挂了 `appearance: none; display: grid` + `::before` 对勾（clip-path + inset box-shadow）。自定义开关必须 `appearance: none` + 显式宽高 + 压掉 `::before`（`content: none !important; display: none !important`），否则会出现「蓝色尖角 / 勾选态不可见」。kit 的 `.nvui-switch-row` 与 `.nvui-checkbox` 已内置且共用同一条压制，不新增 `!important`。
3. **不要用裸元素选择器写样式。** 一律 `.nvui-*` / `dialog.nvui-tl` 前缀；ID 级作用域只用于对抗宿主既有全局样式。
4. **颜色只用 token。** 浮层自带深色主题（或 `.nvui-theme-light`），不要引用酒馆 `--SmartTheme*` 变量，否则浅色主题下观感不可控；聊天区内联组件除外。
5. **移动端三件事**：`100dvh` 与 `env(safe-area-inset-bottom)`；弹窗正文 `-webkit-overflow-scrolling: touch`；键盘弹起时用 `visualViewport` 复算位置与滚动。
6. **不要用 emoji 当图标。** 用 Font Awesome（`<i class="fa-solid fa-...">`）或纯 CSS/SVG 图形。
7. **动效必须可降级。** 尊重 `prefers-reduced-motion`（kit 已内置全局降级并清掉 `animation-delay`）；不要把关键信息只放在动画里。若系统开启「减少动态效果」，所有动效会降级为 `0.01ms`，这是无障碍红线，见 [§2.6](#26-动效降级与强制播放动效演示开关)。
8. **一次只显示必要的浮层。** 多个载体可共存，但同一时刻只 `show()` 必要的；浮层之间用 `hidden` 切换，不要重复创建 DOM。
9. **`backdrop-filter` 玻璃要管好兼容、性能与降级。**
   - 每个 `backdrop-filter` 必须同时写 `-webkit-backdrop-filter`（Safari / 旧 WebKit），顺序不能反；
   - 只用于小面积浮层，不给全屏静态区块用；窄屏自动降档 `--nvui-glass-blur-sm`；不要在动画里改 `blur` 半径（会逐帧重采样）；
   - 回退链：`@supports not (...)` 回退不透明、`prefers-reduced-transparency: reduce` 回退不透明、`forced-colors: active` 用系统色描边、`.nvui-solid` 手动实心、以及 v2.7.2 新增的宿主禁模糊自动近不透明回退 `.nvui-glass-fallback`（详见 [§2.4](#24-玻璃与降级)）；
   - 不要用玻璃表达状态：状态色必须是实色文字/图标/圆点。
10. **宿主模态弹窗期间，kit 浮层必须主动让位。** 宿主 `dialog.showModal()` 会给整个文档加 `inert`，`inert` 元素不参与命中测试，因此 kit 浮层**物理上不可能**既压过模态又保持可交互——任何 z-index / top layer 手段都无效（`popover="manual"` 亦然，实测证伪）。正确做法是让载体自动加 `.is-host-modal`（不可点 + 压暗 + 去色），宿主模态关闭后自动还原；kit 的运行时已内置该机制，宿主无需配合。详见 [§13.7](#137-载体与宿主模态主动让位而非硬压)。
11. **表单控件的宿主 `!important` 覆盖必须用「有界作用域 + 精确属性」夺回。** 第三方主题会对 `input` / `select` / `textarea` 下 `background: ... !important`，裸类 `.nvui-input`（0,1,0）必输，浅色主题会出现「深底深字」。kit 只在 `dialog.nvui-tl` / `.nvui-panel` 两个默认载体，以及显式加 `.nvui-form-scope` 的自定义容器内，对 `background` / `color` / `border` / `select margin` / `:hover background` / `option` 的 `background`+`color` 使用 `!important`（共 7 条，预算见 [§9](#9-命名与工程约定)）。

---

## 9. 命名与工程约定

- **前缀**：组件类全部 `nvui-`，kebab-case；状态类统一 `is-` 前缀（`is-active` / `is-open` / `is-primary` / `is-closing` / `is-live` ...）。
- **令牌命名**：`--nvui-<类别>-<档位>`；类别固定为 `bg` / `block-bg` / `glass` / `line` / `text` / `accent` / `on-accent` / `focus-ring` / `ok|warn|danger|info` / `radius` / `space` / `fs` / `fw` / `lh` / `shadow` / `duration` / `ease` / `transition` / `skeleton` / `z` 等。**新增令牌必须同步更新本 README 的令牌表与 `test/test-ui-kit.js` 的 `CORE_TOKENS` 清单**；每个 `--nvui-*` 都必须被测试显式登记，防漏登记与僵尸令牌。
- **关键帧命名**：全部 `nvui-` 前缀，且必须被至少一处 `animation:` 引用；新增关键帧同时登记到 [§6.4.4](#644-关键帧清单16-个全部-nvui--前缀且被引用) 与 `CHANGELOG.md`。
- **动效令牌命名**：时长 `--nvui-duration-<fast|base|slow>`，缓动 `--nvui-ease-<standard|emphasized|spring>`，循环周期 `--nvui-<效果>-duration`（`spin` / `shimmer` / `pulse`），序列参数 `--nvui-stagger-step` / `--nvui-enter-distance`；组件内不允许硬编码毫秒数（循环 / 序列动画一律走 token）。
- **`@supports` 政策**：能力检测只用于「渐进增强的回退」，不用于区分主题；每个玻璃/模糊特性必须有对应的 `@supports not` 或媒体查询回退，且回退后视觉效果仍然可用（不透明表面）。允许的媒体查询：`prefers-reduced-motion`、`prefers-reduced-transparency`、`forced-colors`、`max-width: 600px`。
- **焦点环统一走 token**：组件只允许 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color);` + `outline-offset: var(--nvui-focus-ring-offset)`，不得各写像素值或直接写 `outline: 2px solid var(--nvui-accent)`；当前为单圈 2px 整数像素。
- **玻璃 AA 红线**：新增玻璃表面必须复用 `--nvui-glass-bg` / `--nvui-glass-bg-strong`，不得自造 alpha 值；玻璃上的文字只能用 `--nvui-text`（popover 级一律正文色）；改动玻璃/遮罩/文字取值必须重跑合成对比度测试并同步 [§4.4](#44-aa-安全玻璃与合成对比度验算) 与 `CHANGELOG.md`。
- **颜色**：`components.css` 内禁止 `#hex` / `rgb()` / `hsl()` 字面量，只能用 `var(--nvui-*)`（`transparent` / `inherit` / `currentColor` 除外）。这条即「禁止硬编码颜色」，测试会扫描。
- **`!important` 预算**：总数 **18**，只允许四类，且只允许清单内的属性值：
  1. **宿主 checkbox `::before` 压制（2 条）**：`.nvui-checkbox` / `.nvui-switch-row` 共用 `content: none` + `display: none`；
  2. **`prefers-reduced-motion` 降级块（5 条）**：`animation-duration` / `animation-iteration-count` / `animation-delay` / `transition-duration` / `scroll-behavior`；
  3. **宿主表单控件隔离（7 条）**：作用域为 `dialog.nvui-tl` + `.nvui-panel` 两个默认载体，以及显式加 `.nvui-form-scope` 的自定义容器；值只能是 `var(--nvui-input-bg)` / `var(--nvui-text)` / `border: none` / `margin: 0` / `var(--nvui-block-bg)` / `var(--nvui-bg-2)`；
  4. **v2.8.0 force 玻璃（4 条）**：仅 `dialog.nvui-tl[data-nvui-glass="force"]` 下的 panel/overlay 各 `background` + `backdrop-filter`，用于覆盖宿主 Fast UI 的 `!important`。

  其它地方一律不得使用；新增类别必须先改本节预算，并同步 `test/test-ui-kit.js` 的分类计数、作用域选择器与精确属性值断言。
- **选择器**：不得出现裸元素选择器（`input { ... }` / `button { ... }`）与全局重置；所有规则必须在 `.nvui-` / `dialog.nvui-tl` 作用域下；v2.8.0 的零 specificity 默认间距允许 `:where(...)` 形式。
- **图标**：Font Awesome `<i>`；纯 CSS 图形只用于箭头 / 滑钮 / 加载环 / 状态点 / 骨架扫光。
- **无 emoji**：README、CSS、HTML、JS 文案中不使用 emoji。
- **文件结构**：本目录是自包含独立项目（`package.json` / `LICENSE` / `CHANGELOG.md` / `test/` 齐全），可直接整目录复制或移动；`preview.html` 必须保持离线可打开（无 CDN、无网络请求）；文档内部链接一律用同目录相对路径，不引用父目录。
- **版本**：kit 版本必须按 [§11.2](#112-版本一致性清单) 的清单原子同步；对外暴露的插件版本由各插件自己的 `manifest.json` 独立管理，不要求与 kit 版本一致。
- **测试**：新增/修改组件后在本目录运行 `npm test`（等价 `node test/test-ui-kit.js`）。该测试守护「令牌完整」「组件被预览与文档覆盖」「无硬编码颜色」「WCAG 与玻璃合成对比度」「核心取值金标准」「动效/降级红线」「版本自洽」「模板副本一致」。
- **发布前检查**：`npm test` 通过后，再按 [§11.2](#112-版本一致性清单) / [§11.3](#113-git-tag-与-github-releases) 同步版本与标签；不要边改源码边改文档。

---

## 10. 从 novel-stream 迁移对照表

本章回答两个问题：**旧项目（novel-stream）的写法怎么换成 kit**，以及**kit 自身从 v1.1.0 到现在需要怎么升级**。逐版本变更明细以 [CHANGELOG.md](CHANGELOG.md) 为准，本章只给「需要动手做什么」。

### 10.1 Token 映射

| novel-stream 旧 token | UI Kit token | 说明 |
| :--- | :--- | :--- |
| `--nv-bg` | `--nvui-bg` | 同名同值 |
| `--nv-bg-2` / `--nv-bg-3` | `--nvui-bg-2` / `--nvui-bg-3` | 同名同值 |
| `--nv-line` / `--nv-line-2` / `--nv-dash` | `--nvui-line` / `--nvui-line-2` / `--nvui-dash` | 同名同值 |
| `--nv-block-bg` / `--nv-block-bg-2` | `--nvui-block-bg` / `--nvui-block-bg-2` | 同名同值 |
| `--nv-block-line` / `--nv-block-line-2` | `--nvui-block-line` / `--nvui-block-line-2` | 同名同值 |
| `--nv-text` / `--nv-text-2` | `--nvui-text` / `--nvui-text-2` | 同名同值 |
| `--nv-text-3` | `--nvui-text-3` | 值提亮一档（AA 对比度） |
| `--nv-accent` / `--nv-accent-2` | `--nvui-accent` / `--nvui-accent-2` | 同名同值 |
| `--nv-accent-bg` / `--nv-accent-line` | `--nvui-accent-bg` / `--nvui-accent-line` | 同名同值 |
| `--nv-ok` / `--nv-warn` / `--nv-danger` | `--nvui-ok` / `--nvui-warn` / `--nvui-danger` | 同名同值；新增配套 `-bg` / `-line` |
| `--nv-radius` | `--nvui-radius` | 同名同值；kit 扩展 `xs` / `sm` / `lg` / `xl` / `pill` |
| （无） | `--nvui-accent-strong` / `--nvui-accent-strong-hover` | 新增：填充按钮底（白字 AA） |
| （无） | `--nvui-info` / `--nvui-info-bg` / `--nvui-info-line` | 新增：进行中 / 信息（旧实现借用了宿主主题色） |
| （无） | 玻璃 7 令牌（`--nvui-glass-*`） | v2 新增：浮层磨砂玻璃 |
| （无） | 焦点环 3 令牌（`--nvui-focus-ring-*`） | v2 新增：统一 focus-visible |
| （无） | 动效体系令牌（`--nvui-duration-*` / `--nvui-ease-*` / `--nvui-transition*` / 循环周期 / `--nvui-stagger-step` / `--nvui-enter-distance`） | v2 新增：把散落的时长/缓动收敛成体系 |
| （无） | 骨架屏 2 令牌（`--nvui-skeleton-bg` / `--nvui-skeleton-shine`） | v2 新增 |
| （无） | 字号 / 间距 / 阴影 / 尺寸 / 层级令牌 | 新增：把散落的具体数值收敛成 token |

### 10.2 组件类名映射

| novel-stream 旧类名 | UI Kit 类名 | 说明 |
| :--- | :--- | :--- |
| `.novel-modal-overlay` | `.nvui-overlay` | 遮罩 |
| `.novel-modal` / `-header` / `-title` / `-body` | `.nvui-modal` / `.nvui-modal-header` / `.nvui-modal-title` / `.nvui-modal-body` | 弹窗骨架；kit 新增 `.nvui-modal-ver` / `.nvui-modal-actions` / `.nvui-modal-footer` |
| `.novel-icon-btn` | `.nvui-icon-btn` | 图标按钮 |
| `.novel-btn` + `.btn-export` / `.btn-sync` / `.btn-test` / `.btn-download` | `.nvui-btn` + `.is-primary` / `.is-secondary` / `.is-ghost` | 按语义选变体，不再按业务命名 |
| `.novel-btn-row` | `.nvui-btn-row` | 按钮组 |
| `.checkbox_label`（借用宿主类）+ `.novel-switch-row` | `.nvui-switch-row` | kit 自己实现胶囊开关与宿主样式隔离 |
| `.novel-row` | `.nvui-input-row` + `.nvui-input` | 输入行 |
| `.novel-tabs` / `.novel-tab` / `.novel-tabpane` | `.nvui-tabs` / `.nvui-tab` / `.nvui-tabpane` | 标签页；可选 `.nvui-tabs-indicator` |
| `.novel-acc` / `-head` / `-title` / `-summary` / `-chev` / `-body` | `.nvui-acc` / `-head` / `-title` / `-summary` / `-chev` / `-body` | 折叠面板；v2 起正文需再包 `.nvui-acc-inner` |
| `.novel-section-title` | `.nvui-section-title` | 区块标题 |
| `.novel-mv-hint` | `.nvui-hint` | 说明小字 |
| `.novel-alert` | `.nvui-alert` | 告警条 |
| `.novel-status-line` / `-time` / `-file` | `.nvui-status-line` / `-time` / `-file` | 状态行；新增 `.nvui-status-dot` |
| `.novel-mv-badge` / `.novel-chip-count` | `.nvui-badge` / `.nvui-chip-count` | 徽标与计数 |
| `.novel-tag-chip` | `.nvui-chip` | 标签块 |
| `.novel-floating-window` | `.nvui-floating` | 悬浮面板（拖拽逻辑各插件自实现） |
| `.novel-chip-tooltip` | `.nvui-tooltip` | 工具提示 |
| `.novel-tag-badge` 等业务徽标 | `.nvui-badge` + `is-accent` / `is-success` / `is-warn` / `is-danger` / `is-info` | 语义变体取代业务命名 |
| 外层 `<dialog class="novel-tl">` | `<dialog class="nvui-tl">` | 浮层载体 |

**组件类演进**（当前 80 个，测试按 80 校验）

| 版本 | 组件类 | 新增内容 |
| :--- | :--- | :--- |
| v1.0.0 | 13 个组件族（当时按组件族统计） | 弹窗、按钮、开关、输入行、标签页、折叠、徽标、状态行等 |
| v2.0.0 | 67 | 玻璃/实心/吐司/进度条/骨架屏/状态点/动效工具类/`.nvui-acc-inner` 等 14 类（v2 起改按类统计） |
| v2.0.1 | 68（可选第 68 类） | `.nvui-tabs-indicator` 粘连指示器（可选增强） |
| v2.1.0 | 78 类 | 面板布局 10 类（`.nvui-panel` 等，见 §12.4） |
| v2.6.0 | 79 | `.nvui-checkbox` 独立复选框 |
| v2.7.0 | 80 | `.nvui-form-scope` opt-in 表单作用域 |

### 10.3 v1.1.0 → v2.0.0 迁移对照

v2.0.0 是 kit 的**破坏性大版本**（Flat Glass 设计语言）。从 v1.1.0 升级按下面顺序处理。

**破坏性变更（必须处理）**

| 变更 | v1.1.0 | v2.0.0+ | 升级动作 |
| :--- | :--- | :--- | :--- |
| 删除 `--nvui-shadow-accent` | 存在（主按钮悬停发光） | 已删除（投影发光与扁平化冲突） | 删掉所有对其的引用；主按钮 hover 现在由 `--nvui-accent-strong-hover` 纯色加深 + 内高光承担 |
| 折叠面板 DOM | `.nvui-acc-body` 直接放内容，靠 `display: none` 切换 | `.nvui-acc-body > div.nvui-acc-inner > 内容`，靠 `grid-template-rows: 0fr ↔ 1fr` 过渡 | 给每个折叠正文包一层 `<div class="nvui-acc-inner">`，否则展开内容高度被裁成 0 |
| 遮罩取值 | 深 `rgba(6,8,14,0.72)` | 深 `rgba(6, 8, 14, 0.62)`、浅 `rgba(15, 23, 42, 0.3)` | 无需改代码（token 自动生效），视觉验收重看遮罩通透度与底层可见度 |
| 阴影取值 | 纯投影 | 玻璃阴影（环境投影 + `inset 0 1px 0 var(--nvui-glass-highlight)`） | 无需改代码；确认静态区块不再引用阴影 token |
| 过渡取值 | `0.16s ease` / `0.25s ease` | `var(--nvui-duration-fast) var(--nvui-ease-standard)` / `var(--nvui-duration-slow) var(--nvui-ease-emphasized)` | 自定义动效改用新时长/缓动令牌 |
| 焦点环 | 各组件自带散装 `outline: 2px solid var(--nvui-accent)` | 统一 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)` + offset | 删掉复制的散装 focus 样式 |
| 弹窗圆角 | `--nvui-radius-lg`（16px） | 弹窗用新增的 `--nvui-radius-xl`（20px）；`lg` 改用于吐司/悬浮面板/窄屏弹窗 | 自定义弹窗圆角改用 `--nvui-radius-xl` |
| 动效降级范围 | 只重置 `animation-duration` / `transition-duration` | 增加 `animation-delay` 与 `animation-iteration-count` | 自定义动画同步重置 delay |

**新增能力（按需接入）**

| 新增 | 说明 | 接入方式 |
| :--- | :--- | :--- |
| 玻璃层（7 令牌） | 弹窗/遮罩/悬浮/提示/吐司/`.nvui-glass` 的统一玻璃参数 | 使用现有组件即自动生效；自建玻璃容器加 `.nvui-glass` |
| 焦点环 3 令牌 | 统一 focus-visible | 交互元素不做自定义 focus 样式即可 |
| 动效体系（13 个动效令牌 + 16 关键帧） | 统一时长、缓动、循环与入场 | 自定义过渡改用 `--nvui-duration-*` / `--nvui-ease-*` |
| 新组件 14 类 | `.nvui-glass` `.nvui-solid` `.nvui-acc-inner` `.nvui-toast` `.nvui-toast-stack` `.nvui-progress` `.nvui-progress-bar` `.nvui-skeleton` `.nvui-status-dot` 与 5 个动效工具类 | 见 §7 各小节 |
| 实心模式 `.nvui-solid` | 用户偏好 / 低性能设备的扁平降级 | 根节点加类即可全局切换 |
| 能力降级 | `@supports not` / `prefers-reduced-transparency` / `forced-colors` / 窄屏模糊降档 | `components.css` 内置，无需调用 |
| AA 安全玻璃 | 合成对比度门禁（见 §4.4） | `npm test` 自动守护 |

**升级步骤**

1. 用 v2.0.0+ 的 `tokens.css` / `components.css` 覆盖旧文件（或更新 `@import` 路径）；
2. 全局搜索 `--nvui-shadow-accent`，删除引用；
3. 给每个 `.nvui-acc-body` 正文包一层 `<div class="nvui-acc-inner">`；
4. 删除插件里复制的散装 `:focus-visible` 样式，交给 kit；
5. 检查业务里硬编码的 `0.16s` / `0.25s` 过渡，改用 `--nvui-transition` / `--nvui-transition-slow`；
6. 打开 `preview.html` 对照深/浅/实心三态确认无视觉回归；
7. 运行 `npm test`，再跑插件自身测试。

### 10.4 v2.0.0 → v2.0.1 修订说明

v2.0.1 是**补丁版本**（无 token 增删、无破坏性 DOM 变更，仅新增可选第 68 类 `.nvui-tabs-indicator`），覆盖 CSS 即可升级。

| 反馈 | v2.0.0 | v2.0.1+ |
| :--- | :--- | :--- |
| 玻璃再透一些 | 深 glass-bg 0.72 / strong 0.88；遮罩 0.55 | 深 0.64 / 0.8；遮罩加深到 0.62 补偿 AA；浅色 strong 0.88 → 0.8；模糊 18/10 → 20/12；饱和 140% → 150% |
| 浮层描边不和谐 | glass-line 深 0.14 / 浅 0.7 | line 深 0.06 / 浅 0.35；highlight 深 0.04 / 浅 0.45 |
| 动效补强 | 14 关键帧；开关仅弹簧滑钮 | 16 关键帧：新增 `nvui-tabpane-in` 与 `nvui-switch-on`；开关按住滑钮拉伸；进度条扫光 |
| 标签粘连滑动 | 仅按钮自身高亮 | 新增可选 `.nvui-tabs-indicator`（配方见 §7.7，无 JS 回退按钮高亮） |
| 数字输入框步进按钮 | 暗色下原生白色按钮突兀 | 隐藏 `::-webkit-inner/outer-spin-button`，`appearance: textfield`；键盘与滚轮仍可调值 |
| AA 政策 | popover 级同时承诺 text / text-2 | popover 级只承诺正文 `--nvui-text`；`.nvui-tooltip` 文字已改正文色 |

**升级动作**：覆盖两个 CSS；检查自建 popover 级玻璃的说明文字（改用 `--nvui-text`）；若依赖原生数字步进按钮，改为自建步进器或接受键盘/滚轮调值；运行 `npm test`。

### 10.5 v2.0.1 → v2.1.0 新增面板布局标准

v2.1.0 是**小版本**：只新增组件族与尺寸令牌，无删除 / 重命名 / 破坏性 DOM 变更。已有插件可继续使用 `.nvui-modal` 弹窗，面板布局标准是可选新能力。

| 新增 | 内容 |
| :--- | :--- |
| 尺寸令牌 2 | `--nvui-panel-width`（v2.1.0 为 `880px`，v2.5.0 起优化为 `720px`）、`--nvui-panel-max-h: 88vh` |
| 组件类 10 | `.nvui-panel` / `-header` / `-title` / `-actions` / `-body` / `-footer` / `-heading`、`.nvui-sheet-handle`、`.nvui-bottom-nav` / `-item`；**组件类总数 68 → 78** |
| 状态类 3 | `.nvui-overlay.is-panel` / `.nvui-switch-row.is-feature` / `.nvui-bottom-nav-item.is-active`（不计入组件类） |
| 响应式 | 桌面 >600px 居中面板；手机 ≤600px 底部抽屉 + 底部图标导航 + 拖拽把手 + safe-area；同一份 DOM 自动切换 |
| JS 约定 | 顶部 tabs / 手机底部导航 / tabpane 三者同步（`aria-selected` / `aria-current` / `tabindex`） |

**升级动作**：覆盖两个 CSS（无破坏性）；采用面板标准时按 [§12](#12-sillytavern-插件面板布局标准桌面--手机) 装配 DOM 并接入导航同步；不采用可继续用 `.nvui-modal`，两者可共存；运行 `npm test`。

### 10.6 v2.1.0 → v2.1.1 描边再减弱与面板固定尺寸

v2.1.1 是**补丁版本**：只调整 token 取值与滚动/尺寸行为，无新增或删除类与令牌，无破坏性变更。

| 变更 | v2.1.0 | v2.1.1 |
| :--- | :--- | :--- |
| 分隔线 / 控件边（深色） | line 0.07 / line-2 0.12 / dash 0.17 / block-line 0.06 / block-line-2 0.1 | line 0.05 / line-2 0.08 / dash 0.14 / block-line 0.04 / block-line-2 0.07 |
| 分隔线 / 控件边（浅色） | line 0.08 / line-2 0.14 / dash 0.22 / block-line 0.06 / block-line-2 0.1 | line 0.06 / line-2 0.10 / dash 0.18 / block-line 0.045 / block-line-2 0.07 |
| 玻璃边 / 内高光 | 深 0.06 / 0.04；浅 0.35 / 0.45 | 深 0.03 / 0.03；浅 0.18 / 0.30 |
| 焦点环 | 2px，输入框额外叠内圈 `inset accent-line` | **单圈 1.5px**，删除内圈 `box-shadow`（v2.2.0 起恢复为单圈 2px 整数像素） |
| 面板尺寸 | `max-height`，内容少时面板变矮 | **固定高度**（桌面 `88vh` / 手机 `92dvh`），折叠展开不跳变（固定尺寸） |
| 滚动条 | 显示系统滚动条 | `.nvui-panel-body` / `.nvui-modal-body` 隐藏滚动条（`scrollbar-width: none` + `::-webkit-scrollbar`），**滚动能力保留**；面板 body 在内容超出时按滚动位置给 `data-nvui-fade`（`top` / `bottom` / `both`） 加 `mask-image` 边缘渐隐（v2.9.0，GH-#21），下游可用 `--nvui-scroll-fade: 0px` 关闭 |

**升级动作**：覆盖两个 CSS；删掉业务自写的输入框 `box-shadow: inset ...` 叠边（只留统一焦点环）；面板高度改为固定 + 隐藏滚动条；运行 `npm test`。

### 10.7 v2.1.1 → v2.2.0 描边精致化与新增 API

v2.2.0 是**小版本**：调整描边实现方式并新增三个可选文件，无删除 / 重命名类与令牌、无破坏性 DOM 变更。

| 变更 | v2.1.1 | v2.2.0+ |
| :--- | :--- | :--- |
| 圆角玻璃外框 | 1px `--nvui-glass-line` 描边 | **移除**（modal / panel / floating / tooltip / toast / glass 共 6 处无 border），改用柔和顶部受光 `--nvui-glass-highlight` + 阴影 |
| 直线分隔 | 玻璃分隔色 0.03 / 0.18 | 深 0.06 / 浅 0.28，用于 header / footer / 导航底边等 7 处 |
| ghost 按钮 | `--nvui-line-2` 细描边 | 无描边，改 `--nvui-block-bg` 淡底（hover `block-bg-2`） |
| 空态 | 虚线圆角边 | 无虚线边，改 `--nvui-bg-3` 淡底 + 居中提示 |
| 标签指示器 | 1px 内环 | 无内环，改底部直线 `inset 0 -2px 0 var(--nvui-accent-line)` |
| 焦点环 | 单圈 1.5px | **单圈 2px 整数像素**（`--nvui-focus-ring-w: 2px`） |
| 新增文件 | 无 | `nvui-api.js`（可选运行时 API）、`tokens.json`（机器可读镜像）、`AI-GUIDE.md`（AI 协作指南） |

**升级动作**：覆盖两个 CSS（描边观感自动改善）；需要 JS 生成面板/吐司时引入 `nvui-api.js`，参考 [§13](#13-js-api-与-ai-协作指南)；其它软件/AI 协作先读 `AI-GUIDE.md`，需要结构化令牌读 `tokens.json`；运行 `npm test`。

### 10.8 v2.2.0 → v2.3.0 浮层载体层级修复（新增 --nvui-z-layer）

v2.3.0 是**小版本**：修复一个靠沙盒测试发现不了、只在真实宿主暴露的层级 bug，并新增 1 个令牌。

**bug 真相**：非模态 `dialog.show()` **不进浏览器 top layer**（top layer 只服务于 `showModal()` 的模态对话框，而它的 `inert` 会废掉宿主交互，故 kit 禁用模态）。此前载体没有 z-index，与普通 fixed div 层级平等，会被宿主任何正 z-index 表面整块盖住——酒馆 `#sheld`（聊天容器，`position:absolute; z-index:30`）在聊天非空时盖死整个 kit 面板。中性页对照实验（Edge 152）同样复现：`show()` 的 dialog 输给 `z-index:30` 的 div，`showModal()` 才赢。

| 变更 | v2.2.0 | v2.3.0 |
| :--- | :--- | :--- |
| 载体层级 | 无 z-index | `z-index: var(--nvui-z-layer)`（`1000000`） |
| 新增令牌 | 无 | `--nvui-z-layer`（令牌总数 109 → 110，浅色不覆盖） |
| 文档论断 | 曾以为「dialog 会提升渲染层级」 | 改为实测真相 + 档位机制说明（§6.6 / §8 / §13.7） |
| 测试 | 无宿主遮挡场景 | 新增「宿主 z-30 遮挡物 + `elementFromPoint` 命中」回归断言 |

**升级动作**：覆盖两个 CSS（新增 1 个令牌、载体加 1 行 z-index，无破坏性）；若业务自己写过 body 级浮层，确认它在 `dialog.nvui-tl` 载体内或自带足够高的 z-index；运行 `npm test`。

### 10.9 v2.3.0 → v2.4.0 载体完善与宿主模态让位

v2.4.0 是**小版本**：新增宿主模态共存机制与 3 个可选 API，无删除 / 重命名类与令牌、无破坏性 DOM 变更。

| 变更 | v2.3.0 | v2.4.0 |
| :--- | :--- | :--- |
| 宿主模态共存 | 无处理（kit 浮层在宿主模态期间点不动，用户不知为何） | 载体自动加 `.is-host-modal`（不可点 + 压暗 0.35 + 去色），模态关闭后自动还原 |
| 层级认知 | 曾认为 `popover="manual"` 能压过一切 | 证伪：模态靠 `inert` 禁掉整页命中，任何 z-index / top layer 手段都无效 |
| 运行时 API | 无 | `countHostModals()` / `syncHostModalState()` / `getCarrierState()`（全部为新增导出） |
| 令牌 | 110 | 110（复用 `--nvui-z-layer`，不新增） |

**升级动作**：覆盖 CSS 与 `nvui-api.js`（新 API 全部为增量，旧代码无需修改）；宿主用 `showModal()` 时 kit 自动让位，业务无需改动；运行 `npm test`。

### 10.10 v2.4.0 → v3.1.1 升级速查

从 v2.4.0 及更早版本升到当前 v3.1.1，按版本顺序做这几件事即可。**v2.4 → v2.9 全是覆盖文件即可（无破坏性变更）；v3.0.0 是 MAJOR，有四类契约变更；v3.1.0 移除了 v3.0 的尺寸过渡开关**，最小动作是「覆盖 4 资产 + 跑一次 `downstream-check`」，完整步骤见 [MIGRATION-v3.md](MIGRATION-v3.md) 与 [UPGRADING.md](UPGRADING.md)。

| 版本 | 类型 | 你需要做什么 |
| :--- | :--- | :--- |
| v2.5.0 | 小版本 | 可选：`createPanel({ persist })` 开启布局持久化（尺寸 / tab / 折叠，250ms 防抖，`localStorage` 键 `nvui_state_<id>`，可插拔 StorageAdapter）；可选 `themeToggle` 头部主题切换与 `panel.showUpdate()` 更新胶囊；面板默认宽度 880 → 720px。既有调用不加参数也正常。 |
| v2.6.0 | 小版本 | 可选：`.nvui-checkbox` 独立复选框（批量选择）；宿主表单隔离层自动生效（`dialog.nvui-tl` / `.nvui-panel` 内 7 条有界 `!important`，修复浅色「深底深字」）；`innerHTML` 注入的折叠条用 `panel.trackAccordion()` / `panel.adoptAccordions()` 接入持久化（默认不接管点击，传 `{ bind: true }` 才绑定）。 |
| v2.7.0 | 小版本 | 可选：自定义普通容器加 `.nvui-form-scope` 复用表单隔离；修复 `optgroup` 主题配色、焦点陷阱与宿主模态期间 Esc。组件类 79 → 80。 |
| v2.7.1 | 补丁 | 无需改动：只修浏览器回归测试时序（半选 checkbox 等待最终计算值），组件样式、公开 API、状态格式、token 与 DOM 契约不变。 |
| v2.7.2 | 补丁 | 覆盖 4 个运行资产即可：玻璃透明感修复（面板保持透明 + 自身 backdrop-filter 背后模糊；宿主 Fast UI 默认关模糊时改为 97% token 派生近不透明回退而不是全不透明；玻璃探测三态化并可自愈）。无需改 DOM / API / 状态；建议目检深/浅主题与 Fast UI 开关两态。 |
| v2.8.0 | 小版本 | 覆盖 4 资产；新增 `--nvui-kit-version`、`selfCheck` / `defaults`、`.nvui-actions`、`createPanel({ glass })` 与控制器 `setGlassMode/getGlassState`；相邻按钮 8px 默认间距。可选接入，见 [UPGRADING.md](UPGRADING.md)。 |
| v2.8.1 | 补丁 | 覆盖 4 资产即可，无需改调用：修 GitHub #16 —— `persist: { size: false }` 现在真的「完全不参与尺寸持久化」（不再把历史 px 高度写回内联样式，并主动清理 `size: null`）；`persist.size: true` 行为不变。 |
| v2.8.2 | 补丁 | 覆盖 4 资产；焦点陷阱修正（GH-#20）、移动端导航 40px 触控（GH-#21）、`test/host/` 实机基线入库；`createPanel` 七步拆分（1433 → 531 行，无行为变更）。v2.8.1 的 `persist.size: false` 语义保持不变。 |
| v2.8.3 | 补丁 | **无需改动**：只有测试与工程脚本变化（探针归档 `test/probe/`、`issue-16` 尺寸矩阵 8 → 12 项、`playwright-core` 进 devDependencies、新增 `npm run verify:all`）。4 资产仅版本号注释同步，运行语义零变化。 |
| v2.9.0 | 小版本 | 覆盖 4 资产（**组件类 82 → 84**，新增 `diagnostics` 导出）：`panel.getLayoutState()` / `setLayoutState()` 布局导入导出、`persist.size: 'width-only'` 只记宽、`NVUI.diagnostics()` 运行时快照、`setTheme('auto')` 双信号跟随、`createPanel({ resizable: true })` 调尺寸手柄、`inputRow` 的 `textarea` / `hint` / `error`。全部 opt-in，既有调用不加参数行为不变。 |
| **v3.0.0** | **大版本** | **必须逐条看**（见 [MIGRATION-v3.md](MIGRATION-v3.md)）：① 尺寸载体由内联 px 改为 CSS 变量 `--nvui-panel-w` / `--nvui-panel-h` —— 读 `panel.style.width` 的下游要改读变量或 `getLayoutState()`，用 CSS 覆盖面板宽度的下游**从这版起才生效**；② 布局状态升 v2（`{ version: 2, size: { w, h, mode } }`），v1 存档自动迁移、落盘写 v2；③ 四套按钮组规则归一为一条 `:where(...)`（零 specificity），`.nvui-btn-row` 在 v3.x 内是 `.nvui-actions` 的别名；④ `tokens.json` 升 schema 2（**值结构不变**，新增 `schema` / `meta` / `groupDescriptions`），遍历顶层键当 token 名的要改遍历 `dark` / `light`。另新增 `engines.node: >=18.0.0` 与 README §11.5 兼容矩阵硬门禁。**只覆盖资产、不碰上述四类的下游不用改代码。** |
| **v3.1.1** | 补丁 | 覆盖 4 资产，修复布局导入、异步存储、存储键冲突、Home 调尺寸、键盘焦点和重复销毁（GH-#23–GH-#29）。 |
| **v3.1.0** | 小版本（有 1 项已承诺的移除） | 覆盖 4 资产即可：v3.0 的 `data-nvui-legacy-size` 过渡开关**已移除**，设了属性也不再写内联 px / 不再告警。**唯一要动的下游**：还在靠这个开关回到内联 px 的，改用 `panel.style.setProperty('--nvui-panel-w', ...)` 或自己的 CSS 选择器（见 MIGRATION-v3 §1.4）。其它调用、DOM、状态格式、导出面全部不变。 |

**高频 FAQ**

- **多个插件用同一个 panel id 会冲突吗？** `createPanel` 会为 DOM ID 去重，使用同一个显式原始 ID 的面板仍共享布局记忆。请为不同插件使用不同的 ID（如 `translator_panel`）。原始 ID 无需归一化时沿用 `nvui_state_<id>`。需要归一化的 ID 使用独立编码键，旧存档可从历史键回退读取。
- **4K 大屏调大的面板换到手机会飞出屏幕吗？** 不会。v2.5.0 起有视口钳制：手机 ≤600px 强制回退到底部抽屉；桌面按视口边界（留 16px 安全边距）钳制，标题栏与关闭按钮始终可达。可用 `NVUI.clearLayoutState(id)` 或 `panel.clearLayoutState()` 重置。
- **频繁拖拽 / 切 tab 会不会狂写存储？** 不会。内部 250ms 防抖合并写入，面板关闭与 `destroy()` 时安全冲刷。

---

## 11. 版本管理

### 11.1 版本分级（SemVer）

版本号格式 `MAJOR.MINOR.PATCH`，遵循 [Semantic Versioning 2.0.0](https://semver.org/)。

| 级别 | 触发条件 | 兼容性 |
| :--- | :--- | :--- |
| MAJOR（`X.0.0`） | 删除 / 重命名令牌；重命名或删除组件类；破坏性 DOM 契约变更（父子结构、必需挂载点）；删除 / 修改公开 API 签名；重构层级契约（如 `--nvui-z-layer` 基础语义） | 向下不兼容，必须按本章迁移表改代码 |
| MINOR（`2.X.0`） | 新增令牌；新增组件族 / 子组件 / 状态修饰类；新增公开 API 或实例方法；现有 API 增加可选配置项（opt-in）；新增官方模板或离线能力 | 100% 向下兼容，覆盖文件即可升级，新能力按需引入 |
| PATCH（`2.7.X`） | 缺陷修复、健壮性加固（防御式校验、内存/定时器清理）、性能与重绘优化、可访问性细节、文档修缮与内部重构（不改变对外契约） | 零升级心智负担，覆盖文件即得修复 |

### 11.2 版本一致性清单

任何发布必须**原子更新**以下 10 处版本声明，避免漂移（`npm run verify:release` 会逐项校验）：

| # | 位置 | 形式 |
| :--- | :--- | :--- |
| 1 | `package.json` | `"version": "X.Y.Z"` |
| 2 | `tokens.json` | `"version": "X.Y.Z"` |
| 3 | `tokens.css` | 文件头注释 `版本：ui-kit vX.Y.Z`（测试按大小写敏感子串 `ui-kit vX.Y.Z` 校验） |
| 4 | `components.css` | 文件头注释 `版本：ui-kit vX.Y.Z`（同上） |
| 5 | `nvui-api.js` | `VERSION = 'X.Y.Z'`（导出为 `NVUI.version` / `NVUI.VERSION`） |
| 6 | `preview.html` | 页面标题 `UI Kit vX.Y.Z` 与页面徽标 `>vX.Y.Z<` |
| 7 | `README.md` | 文首 `版本：**vX.Y.Z**` |
| 8 | `AI-GUIDE.md` | 文首版本行 |
| 9 | `CHANGELOG.md` | 最新 `## vX.Y.Z` 条目（含日期与变更摘要） |
| 10 | `tokens.css` | `--nvui-kit-version: X.Y.Z`（纯 CSS 可读的版本信号） |

此外，`st-extension-template/ui-kit/` 下的 4 个资产文件（`nvui-api.js` / `components.css` / `tokens.css` / `tokens.json`）必须与仓库根目录保持**逐字节一致**（`npm test` 用 MD5 校验），发布前用复制覆盖而不是手改。

### 11.3 Git tag 与 GitHub Releases

1. **Tag 命名**：统一 `vX.Y.Z`（如 `v2.7.2`），禁止裸数字 `2.7.2` 或大写 `V2.7.2`。
2. **附注标签**：使用 `git tag -a vX.Y.Z -m "..."`，禁止轻量标签；发布包含版本概要。
3. **Release Notes**：每个 GitHub Release 包含版本定位、核心更新/缺陷（关联 Issue 编号）、兼容性说明与自动化验证数据。
4. **发布顺序**：`npm test` 通过 → 同步 10 处版本与模板副本（或 `npm run sync:template`）→ `npm run verify:release` → `preview.html` 目测 → 打 tag → 创建 Release。
5. **完整判据**：版本三态（开发中 / 待发布 / 已发布）、升位判定树、发布后必做的三件事，见 [`MAINTAINING.md`](MAINTAINING.md) §2。`CHANGELOG.md` 不使用 `Unreleased` 标题——「已 bump 未打 tag」就是「待发布」，是一个允许停留多天的合法状态。

### 11.4 版本时间线（摘要）

完整变更记录（含缺陷明细、实机数据、Issue 关联）见 [CHANGELOG.md](CHANGELOG.md)。下表只用于快速定位「当前版本从哪来」：

| 版本 | 日期 | 类型 | 一句话摘要 |
| :--- | :--- | :--- | :--- |
| v3.1.1 | 2026-11-17 | 补丁 | 修复面板布局持久化、调尺寸、键盘可访问性与销毁生命周期（GH-#23–GH-#29）。已有布局可从旧键读取。 |
| v3.1.0 | 2026-11-16 | 小版本 | 移除 `data-nvui-legacy-size` 过渡开关（v3.0 承诺兑现）：尺寸只走 CSS 变量一条路径，设了属性也完全无效；`v300-size-vars` V2 改为直接证明下游 CSS 接管生效、V3 改为防复活断言。token / 组件类 / 导出面 / 状态格式全不变 |
| v3.0.0 | 2026-11-16 | 大版本 | 尺寸载体换轨（内联 px → `--nvui-panel-w` / `--nvui-panel-h`）+ 状态格式 v2（`{ w, h, mode }`）+ `migrateStateV1toV2()` + `data-nvui-legacy-size` 过渡开关；四套按钮组归一为零 specificity 的一条规则；`tokens.json` schema 2（分组 / 类型 / 描述）；兼容矩阵硬门禁 + `engines.node`。顶层导出 28 → 29 |
| v2.9.0 | 2026-11-16 | 小版本 | 布局状态导入导出（`getLayoutState` / `setLayoutState`）；`persist.size: 'width-only'`；`NVUI.diagnostics()` 运行时快照；`setTheme('auto')` 双信号跟随；`createPanel({ resizable })` 键盘可达调尺寸手柄；`inputRow` 支持 `textarea` 伪类型与 `hint` / `error`。组件类 82 → 84、顶层导出 27 → 28 |
| v2.8.3 | 2026-11-16 | 补丁 | 测试基建收尾：30 个探针归档 `test/probe/`；`issue-16` 尺寸矩阵 8 → 12 项；`playwright-core` 进 devDependencies + 统一解析（`scripts/resolve-browser.js`）；新增 `npm run verify:all`（9 步 + 产物校验） |
| v2.8.2 | 2026-11-16 | 补丁 | 焦点陷阱尾项修正（GH-#20）；移动端底部导航 `min-height: 40px`（GH-#21）；宿主实机基线入库 `test/host/`；`createPanel` 七步拆分 1433 → 531 行 |
| v2.8.1 | 2026-11-05 | 补丁 | 修 GitHub #16：`persist.size: false` 彻底退出尺寸持久化（旧 `size` 存档不再写回内联高度，落盘主动清成 `null`）；新增 `test/issue-16-persist-size.js` |
| v2.8.0 | 2026-10-26 | 小版本 | 下游 DX：版本 token / selfCheck / defaults / `.nvui-actions` / 相邻按钮 8px / `glass: auto / force / solid`；token 111、组件类 81、`!important` 18 |
| v2.7.2 | 2026-10-26 | 补丁 | 玻璃透明感修复：面板保持透明 + 面板自身 backdrop-filter 背后模糊；宿主禁模糊时 97% token 派生近不透明回退（`.nvui-glass-fallback`）；探测三态化 + 可逆自愈；`setTheme()` 不再误清用户实心偏好 |
| v2.7.1 | 2026-10-23 | 补丁 | 修 GitHub #15：半选 checkbox 浏览器回归等待最终计算值；CSS / API / DOM 不变 |
| v2.7.0 | 2026-10-23 | 小版本 | 新增 opt-in `.nvui-form-scope`；修复 #12 `optgroup`、#13 焦点、#14 宿主模态 Esc；组件类 80 |
| v2.6.0 | 2026-10-21 | 小版本 | 新增 `.nvui-checkbox`、宿主表单隔离层（#9）、折叠条接管入口（#11）；`!important` 预算 14 |
| v2.5.0 | 2026-10-21 | 小版本 | 布局状态持久化、头部标准化（`themeToggle` / `showUpdate`）、面板宽 720px |
| v2.4.0 | 2026-10-21 | 小版本 | 宿主模态让位 `.is-host-modal` + 3 个载体 API；多批静态审查与实机加固 |
| v2.3.0 | 2026-10-20 | 小版本 | 载体层级修复：新增 `--nvui-z-layer`（109 → 110 令牌） |
| v2.2.0 | 2026-10-17 | 小版本 | 描边精致化 + 可选 `nvui-api.js` / `tokens.json` / `AI-GUIDE.md` |
| v2.1.1 | 2026-10-17 | 补丁 | 描边再减弱、单圈焦点环、面板固定尺寸、隐藏滚动条 |
| v2.1.0 | 2026-10-17 | 小版本 | 插件面板布局标准（桌面居中 / 手机底部抽屉）+ 10 个组件类 |
| v2.0.1 | 2026-10-17 | 补丁 | 玻璃更透、描边更柔、16 关键帧、粘连指示器 |
| v2.0.0 | 2026-10-17 | 大版本 | Flat Glass 设计语言；删除 `--nvui-shadow-accent`、折叠需 `.nvui-acc-inner` |
| v1.1.0 | 2026-10-17 | 小版本 | 独立项目化：自带元信息、许可、变更记录与测试 |
| v1.0.0 | 2026-10-17 | 初始 | 首个版本：令牌体系、组件样式、离线预览、规范文档、守护测试 |

> 兼容性约定：修 bug / 调单个 token 值 / 动效打磨 → 补丁；新增组件 / 令牌 / 可选文件 / 可选 API → 小版本；重命名或删除类与令牌、修改 DOM 契约 → 大版本，并同步迁移对照表与测试金标准。

### 11.5 兼容矩阵（硬门禁）

这张表不是说明文字，是 `npm run test:compat` 的校验对象：**当前版本那一行必须存在**，
且该行声明的宿主最低版本要与 `st-extension-template/manifest.json` 的
`minimum_client_version` 逐字一致、Node 最低版本要与 `package.json` 的 `engines.node`
一致。任一不符 CI 直接红 —— 发版时忘了补行，门禁会拦。

| Kit | 宿主最低（ST `minimum_client_version`） | Node 最低（`engines.node`） | 依据 |
| :--- | :--- | :--- | :--- |
| v3.0.0 | 1.12.0 | >=18.0.0 | `<dialog>` + `showModal()`、`:where()`、`color-mix()`、`mask-image`；尺寸走 CSS 变量（需 `Element.style.setProperty` 变量支持，即所有现代浏览器） |
| v2.0.0 | 1.12.0 | >=18.0.0 | 同上（v2 系列不含 `mask-image` 依赖） |

三条实现约定：

1. **不猜宿主版本**：`minimum_client_version` 只写「确实用到的 API 从哪个版本开始有」，
   不承诺没实测过的版本；新版本若引入更新的 API，这一行必须跟着动。
2. **运行时可自查**：下游在初始化时调 `NVUI.checkCompatibility({ min: '3.0.0' })`，
   低于该版本会返回 `compatible: false` 并给出原因，而不是等到界面错位才发现。
3. **矩阵只管「能不能跑」**：能不能用某个具体组件（例如 `resizable`）仍看该组件是否
   在当前 kit 版本里 —— 版本号和能力清单是两件事。

## 12. SillyTavern 插件面板布局标准（桌面 / 手机）

很多 SillyTavern 插件都需要一个「设置面板」。本章给出一套**跨桌面/手机共用同一份 DOM** 的排列标准：

- **电脑（>600px）**：居中玻璃面板，宽 `min(var(--nvui-panel-width), 100%)`（当前 720px）、固定高 `--nvui-panel-max-h`（88vh），顶部横向 tabs 做分区导航；
- **手机（≤600px）**：底部抽屉（bottom sheet），全宽、固定高 `92dvh`、仅上圆角，隐藏顶部 tabs，改用**底部图标导航** + 拖拽把手 + safe-area。

> 只参考排列结构，不复制他插件皮肤：视觉一律使用 Kit 的 Flat Glass（紫色强调、磨砂玻璃、扁平列表、统一焦点环）。可直接用 `NVUI.createPanel()` 生成（见 §13.1），或按 §12.5 手写 DOM。

### 12.1 设计目标

1. **同一份 DOM 自适应**：桌面顶部 tabs 与手机底部导航是同一份面板 DOM 的两种呈现，CSS 断点自动切换，不需要为两端写两套 HTML。
2. **固定尺寸、不跳变**：面板外框尺寸固定——宽 `min(var(--nvui-panel-width), 100%)`（默认 720px 上限，支持 `opts.width` 自定义与视口越界钳制）、桌面高 `var(--nvui-panel-max-h)`（88vh）、手机高 `92dvh`；折叠/展开只改变 `.nvui-panel-body` 内部滚动内容。
3. **单一滚动层、隐藏滚动条**：只有 `.nvui-panel-body` 滚动（`overflow-y: auto`），滚动条隐藏但**滚动能力保留**，避免嵌套滚动与滚动穿透。
4. **玻璃 + 扁平**：面板态玻璃 = 透明面板（`color-mix(--nvui-bg 30%)`）+ 背后强模糊（`blur(48px)`）+ token 柔光/受光 + 圆角；内部列表/折叠/开关保持扁平色阶。
5. **可访问性内建**：`role="dialog"` + `aria-modal="true"` + `aria-labelledby`；焦点管理沿用 [§2.3](#23-弹窗骨架含浮层载体)；底部导航用 `aria-current="page"`。
6. **可组合**：分区内容直接复用第 7 章组件（tabs / tabpane / switch-row / acc / badge / alert / progress / toast 等），不新增内容组件。

### 12.2 桌面布局（>600px）

| 区域 | 结构 | 说明 |
| :--- | :--- | :--- |
| 遮罩 | `.nvui-overlay.is-panel` | 全屏压暗 + 磨砂，flex 居中，`padding: var(--nvui-space-4)` |
| 面板 | `.nvui-panel` | `min(720px, 100%)` × 固定 88vh；圆角 `--nvui-radius-xl`；面板态透明玻璃（30% 底 + 48px 背后模糊）+ `--nvui-shadow-modal` |
| 标题栏 | `.nvui-panel-header` | 左标题 `.nvui-panel-title`（单行省略），右 `.nvui-panel-actions`（更多 / 关闭）；底部直线分隔 |
| 分区导航 | `.nvui-tabs` | 桌面常显的顶部 tabs（切换的是 `.nvui-tabpane`，不是页面跳转）；可用 `.nvui-tabs-indicator` 粘连指示器 |
| 内容区 | `.nvui-panel-body` | 唯一滚动层：`flex:1; min-height:0; overflow-y:auto`；顶部可放 `.nvui-panel-heading`（分区标题 + 版本徽标） |
| 底部操作 | `.nvui-panel-footer` | 可选：右对齐按钮组（取消 / 保存），顶部直线分隔 |

要点：遮罩拦截背景点击，Esc / 点遮罩关闭沿用 §2.3；面板四角均为 `--nvui-radius-xl`。

### 12.3 手机布局（≤600px）

| 区域 | 结构 | 说明 |
| :--- | :--- | :--- |
| 遮罩 | `.nvui-overlay.is-panel` | `align-items: flex-end` + `padding: 0`，从底部推入 |
| 面板 | `.nvui-panel` | 宽 100%、固定高 `92dvh`、仅上圆角（底部抽屉） |
| 拖拽把手 | `.nvui-sheet-handle` | 40×4 居中把手，`aria-hidden="true"`；真正的下滑关闭由业务按需实现 |
| 标题栏 | `.nvui-panel-header` | 减 padding、去底边 |
| 分区导航 | 顶部 `.nvui-tabs` 隐藏 | 导航交给底部 `.nvui-bottom-nav` |
| 内容区 | `.nvui-panel-body` | 唯一滚动层 |
| 底部导航 | `.nvui-bottom-nav` | 面板 flex 列的最后一个子项；图标 + 极短文字（≤2 个汉字），`padding-bottom` 自动加 `env(safe-area-inset-bottom)` |

要点：**不要**把 `.nvui-bottom-nav` 改成 `position: fixed` 覆盖 `body`——它是面板 flex 布局的最后一个子项，safe-area 由组件内 `env(safe-area-inset-bottom)` 处理。

### 12.4 面板组件类（10 个）

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-panel` | 面板本体：`display:flex; flex-direction:column`；`width: var(--nvui-panel-w, min(var(--nvui-panel-width), 100%))`；**固定高** `var(--nvui-panel-h, var(--nvui-panel-max-h))`；`min-height:0; overflow:hidden`；**玻璃态（透明 + 背后强模糊）**：`color-mix(--nvui-bg 30%)` + token 柔光 + `blur(48px) saturate(190%) brightness(1.12)`（浅色主题 62% 底；窄屏 `blur-sm*1.6`）+ `--nvui-radius-xl` + `--nvui-shadow-modal`；规则提升到 `dialog.nvui-tl` 作用域 |
| `.nvui-panel-header` | 标题栏：标题 + 右侧操作区，`justify-content:space-between`，底部直线分隔，`flex-shrink:0` |
| `.nvui-panel-title` | 面板标题：`--nvui-fs-2xl` 粗体、单行省略；`aria-labelledby` 指向它 |
| `.nvui-panel-actions` | 右侧操作区（`.nvui-icon-btn` 组，含关闭按钮），`flex-shrink:0` |
| `.nvui-panel-body` | 内容区：`flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain`；**全面板唯一滚动层**；内容溢出时自动加 `data-nvui-fade`（`top` / `bottom` / `both`）做边缘渐隐 |
| `.nvui-input-msg` | **v2.9.0 新增**：输入行的提示 / 错误消息（`is-hint` 次要色、`is-error` 语义 danger 色 + 输入框内描边）。`hint` / `error` 各生成独立 id，`input` 的 `aria-describedby` 并列指向；`error` 还会置 `aria-invalid="true"` |
| `.nvui-resize` | **v2.9.0 新增**：右下角调尺寸手柄（`role="separator"` + `aria-valuenow/valuemin/valuemax/valuetext` + `tabindex="0"`）。仅 `createPanel({ resizable: true })` 生成；拖拽走 Pointer Events，键盘走方向键 / Shift / Home，焦点环用 `--nvui-focus-ring-*`。指针拖拽与键盘最终都落内联 px 再交回 `applyClamping()`，与 `setSize()` 共用同一套钳制 / 持久化路径 |
| `.nvui-panel-footer` | 可选底部操作区：右对齐按钮组，顶部直线分隔，`flex-shrink:0` |
| `.nvui-panel-heading` | 内容区顶部「分区标题 + 版本徽标」行；内部 `.nvui-section-title` 占满剩余宽度 |
| `.nvui-sheet-handle` | 仅手机显示的拖拽把手：40×4、pill 圆角；桌面 `display:none`；加 `aria-hidden="true"` |
| `.nvui-bottom-nav` | 仅手机显示的底部图标导航：`display:flex; justify-content:space-around`，顶部发丝线，含 safe-area 内边距；桌面 `display:none` |
| `.nvui-bottom-nav-item` | 底部导航项：`<button>` + 图标 + 极短文字；未激活 `--nvui-text-2`、激活 `--nvui-text`；`:active` 缩放 0.96；`:focus-visible` 内缩焦点环 |

配套状态类（不计入组件类）：`.nvui-overlay.is-panel`（面板模式遮罩）、`.nvui-switch-row.is-feature`（高亮功能行）、`.nvui-bottom-nav-item.is-active`（当前分区，同时必须有 `aria-current="page"`）。

### 12.5 完整 DOM 示例（含 aria / roles）

```html
<dialog class="nvui-tl" id="panel_layer">
    <div class="nvui-overlay is-panel" id="panel_overlay" hidden>
        <div class="nvui-panel" role="dialog" aria-modal="true" aria-labelledby="panel_title">
            <div class="nvui-sheet-handle" aria-hidden="true"></div>

            <div class="nvui-panel-header">
                <b class="nvui-panel-title" id="panel_title">插件设置</b>
                <span class="nvui-panel-actions">
                    <button type="button" class="nvui-icon-btn" aria-label="更多操作">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>
                    <button type="button" class="nvui-icon-btn" data-close aria-label="关闭">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </span>
            </div>

            <!-- 桌面顶部导航；手机端由 CSS 隐藏 -->
            <nav class="nvui-tabs" role="tablist" aria-label="面板分区">
                <span class="nvui-tabs-indicator" aria-hidden="true"></span>
                <button type="button" class="nvui-tab is-active" role="tab" data-key="serial"
                        id="ptab_serial" aria-selected="true" aria-controls="ppane_serial">连载</button>
                <button type="button" class="nvui-tab" role="tab" data-key="filter"
                        id="ptab_filter" aria-selected="false" aria-controls="ppane_filter">过滤</button>
                <button type="button" class="nvui-tab" role="tab" data-key="export"
                        id="ptab_export" aria-selected="false" aria-controls="ppane_export">导出</button>
                <button type="button" class="nvui-tab" role="tab" data-key="about"
                        id="ptab_about" aria-selected="false" aria-controls="ppane_about">关于</button>
            </nav>

            <div class="nvui-panel-body">
                <div class="nvui-panel-heading">
                    <span class="nvui-section-title"><i class="fa-solid fa-sliders"></i>设置</span>
                    <span class="nvui-badge">v1.0.0</span>
                </div>

                <div class="nvui-tabpane is-active" id="ppane_serial" role="tabpanel" aria-labelledby="ptab_serial">
                    <label class="nvui-switch-row is-feature">
                        <input type="checkbox" checked>
                        <span>启用自动连载</span>
                    </label>
                    <div class="nvui-acc">
                        <button type="button" class="nvui-acc-head" aria-expanded="false">
                            <span class="nvui-acc-title"><i class="fa-solid fa-folder"></i>保存位置</span>
                            <span class="nvui-acc-summary">plugins/auto-save/logs</span>
                            <i class="nvui-acc-chev"></i>
                        </button>
                        <div class="nvui-acc-body">
                            <div class="nvui-acc-inner"> ... 折叠内容 ... </div>
                        </div>
                    </div>
                </div>
                <div class="nvui-tabpane" id="ppane_filter" role="tabpanel" aria-labelledby="ptab_filter" hidden> ... </div>
                <div class="nvui-tabpane" id="ppane_export" role="tabpanel" aria-labelledby="ptab_export" hidden> ... </div>
                <div class="nvui-tabpane" id="ppane_about" role="tabpanel" aria-labelledby="ptab_about" hidden> ... </div>
            </div>

            <div class="nvui-panel-footer">
                <button type="button" class="nvui-btn is-ghost" data-close>取消</button>
                <button type="button" class="nvui-btn is-primary">保存</button>
            </div>

            <!-- 手机底部图标导航；桌面端由 CSS 隐藏 -->
            <nav class="nvui-bottom-nav" aria-label="面板分区（手机）">
                <button type="button" class="nvui-bottom-nav-item is-active" data-tab="serial" aria-current="page">
                    <i class="fa-solid fa-book"></i><span>连载</span>
                </button>
                <button type="button" class="nvui-bottom-nav-item" data-tab="filter">
                    <i class="fa-solid fa-filter"></i><span>过滤</span>
                </button>
                <button type="button" class="nvui-bottom-nav-item" data-tab="export">
                    <i class="fa-solid fa-file-export"></i><span>导出</span>
                </button>
                <button type="button" class="nvui-bottom-nav-item" data-tab="about">
                    <i class="fa-solid fa-circle-info"></i><span>关于</span>
                </button>
            </nav>
        </div>
    </div>
</dialog>
```

打开 / 关闭直接复用 [§2.3](#23-弹窗骨架含浮层载体) 的 `show()` / `hidden` / `is-closing` / 焦点管理配方；`role="dialog"` 放在 `.nvui-panel` 上（不是遮罩上）。

### 12.6 响应式规则（断点统一 600px）

| 规则 | 桌面（>600px） | 手机（≤600px） |
| :--- | :--- | :--- |
| `.nvui-overlay.is-panel` | flex 居中 + `padding: var(--nvui-space-4)` | `align-items: flex-end` + `padding: 0` |
| `.nvui-panel` 宽度 | `var(--nvui-panel-w, min(var(--nvui-panel-width), 100%))`（默认 720px 上限） | `width: 100%` |
| `.nvui-panel` 高度 | 固定 `var(--nvui-panel-max-h)`（88vh） | 固定 `92dvh` |
| 圆角 | `--nvui-radius-xl`（四角） | 仅上圆角 `xl xl 0 0`（底部抽屉） |
| 顶部 tabs | 显示 | 隐藏（导航交给底部） |
| `.nvui-sheet-handle` | 隐藏 | 显示 40×4 拖拽把手 |
| `.nvui-bottom-nav` | 隐藏 | 显示 + `env(safe-area-inset-bottom)` 内边距 |
| 滚动 | 仅 `.nvui-panel-body` 滚动，滚动条隐藏 | 同左 |
| 形态 | 居中对话框 | 底部抽屉 |

> 固定尺寸意味着折叠展开、切换 tab 都不会改变面板外框（不跳变）；内容溢出交给 `.nvui-panel-body` 滚动。窄屏规则与 Kit 其它组件共用 `@media (max-width: 600px)`，不要为面板单独定义第二套断点。

### 12.7 导航同步 JS 配方（tabs ↔ 底部导航 ↔ tabpane）

桌面顶部 tabs 与手机底部导航必须**共享同一份状态**：切换任意一端，另一端的高亮、`aria-*`、面板可见性与指示器都要同步。

```js
function setupPanelNav(panelEl, controller) {
    const tabs = [...panelEl.querySelectorAll('.nvui-tab')];
    const navItems = [...panelEl.querySelectorAll('.nvui-bottom-nav-item')];
    const panes = [...panelEl.querySelectorAll('.nvui-tabpane')];
    const indicator = panelEl.querySelector('.nvui-tabs-indicator');

    // 与 §7.7 的 apply 逻辑一致：把 tab 的 offset 几何写进指示器变量
    function syncIndicator(tab) {
        if (!indicator) return;
        indicator.style.setProperty('--nvui-tab-ind-x', tab.offsetLeft + 'px');
        indicator.style.setProperty('--nvui-tab-ind-y', tab.offsetTop + 'px');
        indicator.style.setProperty('--nvui-tab-ind-w', tab.offsetWidth + 'px');
        indicator.style.setProperty('--nvui-tab-ind-h', tab.offsetHeight + 'px');
    }

    function activate(key) {
        let activeTab = null;
        tabs.forEach((t) => {
            const on = t.dataset.key === key;
            t.classList.toggle('is-active', on);
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
            if (on) activeTab = t;
        });
        navItems.forEach((n) => {
            const on = n.dataset.tab === key;
            n.classList.toggle('is-active', on);
            if (on) n.setAttribute('aria-current', 'page');
            else n.removeAttribute('aria-current');
        });
        panes.forEach((p) => {
            const on = p.id === 'ppane_' + key;
            p.classList.toggle('is-active', on);
            p.hidden = !on;                              // 与 display 切换双保险
        });
        // 用 NVUI 控制器的面板直接调 controller.syncIndicator()；手写 DOM 用本地同步
        if (controller && controller.syncIndicator) controller.syncIndicator();
        else if (indicator && activeTab) { panelEl.querySelector('.nvui-tabs')?.classList.add('is-indicator'); syncIndicator(activeTab); }
    }

    tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.key)));
    navItems.forEach((n) => n.addEventListener('click', () => activate(n.dataset.tab)));
    panelEl.querySelector('.nvui-tabs').addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const cur = tabs.findIndex((t) => t.classList.contains('is-active'));
        const next = tabs[(cur + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        activate(next.dataset.key);
        next.focus();
    });

    // 初始状态以 tabs 的 is-active 为准；字体加载/resize/横向滚动后重算指示器
    activate((tabs.find((t) => t.classList.contains('is-active')) || tabs[0]).dataset.key);
    const relayout = () => {
        if (controller && controller.syncIndicator) controller.syncIndicator();
        else {
            const current = tabs.find((t) => t.classList.contains('is-active'));
            if (current) { panelEl.querySelector('.nvui-tabs')?.classList.add('is-indicator'); syncIndicator(current); }
        }
    };
    window.addEventListener('resize', relayout);
    panelEl.querySelector('.nvui-tabs')?.addEventListener('scroll', relayout);
    if (document.fonts?.ready) document.fonts.ready.then(relayout);
}
// 用法：document.querySelectorAll('.nvui-panel').forEach((el) => setupPanelNav(el));
```

约定：`data-key`（tabs）/ `data-tab`（底部导航）与 tabpane 的 `id` 对应关系为 `ppane_<key>`，不要写死中文文案；桌面与手机是同一份状态（桌面切到「导出」后缩到手机宽度，底部导航仍高亮「导出」）；面板打开/关闭的焦点处理见 §2.3；若面板内用 `.nvui-toast-stack`，仍必须放进 `dialog.nvui-tl` 顶层载体（§8 红线）。

### 12.8 内容排列规范

- **分区标题 + 版本徽标**：`.nvui-panel-heading` 放在 `.nvui-panel-body` 顶部（可直接放在 body 内、tabpane 外），左 `.nvui-section-title`、右 `.nvui-badge` 版本号；每个分区只放一个 heading。
- **高亮功能行 `is-feature`**：用于「本分区最常用的一个开关」，左侧主色竖条 + 淡底 + 标题加粗；**每个 tabpane 最多 1 行**。
- **折叠分组列表**：设置项用 `.nvui-acc` 分组，`nvui-acc-summary` 必须显示当前值；面板内折叠列表间距由 `.nvui-panel-body > .nvui-acc` 自动收紧。
- **可选 footer**：只在需要「取消 / 保存 / 应用」等持久操作时添加 `.nvui-panel-footer`；纯浏览型面板可省略。
- **固定外框、不跳变**：不要把 `.nvui-panel` 高度设成 `auto`；内容溢出由 body 滚动处理。
- **底部导航项数量**：建议 3~5 项（与顶部 tabs 一一对应）；超过 5 项时考虑分组，不要继续塞图标。
- **不要重复导航**：同一时刻只能看到一种导航（桌面 tabs / 手机底部导航，CSS 已互斥）。

### 12.9 无障碍与焦点

- `.nvui-panel` 上 `role="dialog"` + `aria-modal="true"` + `aria-labelledby="panel_title"`（指向 `.nvui-panel-title`）。
- 关闭按钮必须是 `.nvui-icon-btn` 且带 `aria-label`（如「关闭」）；「更多操作」等图标按钮同样要有 `aria-label`。
- 桌面 tabs：`role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected` + `aria-controls` + `tabIndex=0/-1`（沿用 §7.7）。
- 手机底部导航：`<nav aria-label="面板分区（手机）">` + `<button>`；当前项 `aria-current="page"`，切换时同步增删。
- 焦点管理沿用 [§2.3](#23-弹窗骨架含浮层载体)：打开移入面板（优先主按钮 / 标题 `tabindex="-1"`）、Tab / Shift+Tab 焦点陷阱、关闭归还触发元素。
- `.nvui-sheet-handle` 是纯视觉元素：`aria-hidden="true"`，不要给它 tabindex；若实现下滑关闭，必须同时提供按钮 / Esc 等价关闭方式。
- 所有交互元素都要有 `:focus-visible` 焦点环（kit 通过 `--nvui-focus-ring-*` token 统一，当前为单圈 2px 整数像素）。
- 手机底部导航点击区域 ≥ 44px 高（组件默认 padding + 图标 + 文字已满足）；不要用 `title` 代替可见文字。

### 12.10 Do / Don't

**Do**

- 用同一份 DOM 同时适配桌面与手机，靠 600px 断点切换导航形态。
- 让 `.nvui-panel-body` 成为面板内唯一滚动层；面板本身 `overflow:hidden`；滚动条隐藏但保留滚动能力。
- 保持面板固定高度（桌面 88vh / 手机 92dvh），折叠展开与 tab 切换不改变外框。
- 桌面 tabs 与手机底部导航共用同一份激活状态与同步函数。
- 图标使用 Font Awesome 或内联 SVG；文字用中文短标签。
- 面板打开时按 §2.3 做焦点移入 / 陷阱 / 归还；关闭支持 Esc 与点遮罩。
- 面板内直接复用 Kit 现有组件（switch-row、acc、badge、alert、progress、toast 等）。

**Don't**

- 不要同时显示两套导航（不要用 JS 覆盖 CSS 的媒体查询造成双导航）。
- 不要给 `.nvui-panel` 或 `.nvui-panel-body` 再套一层 `overflow:auto` 的独立滚动层（双滚动条、滚动穿透）。
- 不要把 `.nvui-panel` 高度设成 `auto` / `fit-content`，也不要自写可见滚动条样式。
- 手机不要把 `.nvui-bottom-nav` 改成 `position: fixed` 覆盖 `body`。
- 不要把底部导航做成 `<a href="#">`：用 `<button>` + `aria-current`。
- 不要复刻参考图的青色 / 他插件皮肤：视觉只使用 Kit 的紫色 Flat Glass 令牌。
- 不要在面板里用裸 `position: fixed` 子元素：必须走 `dialog.nvui-tl` 顶层载体（§8 红线）。

---

## 13. JS API 与 AI 协作指南

三个可选的协作资产，让「用 Kit 规范做界面」从「读文档手写」变成「可调用、可机器读、可交给 AI」：

| 文件 | 作用 | 是否必须 |
| :--- | :--- | :--- |
| [`nvui-api.js`](nvui-api.js) | 零依赖运行时 API：用函数生成符合 §12 布局标准与 §7 无障碍契约的面板 / 行组件 / 吐司 | 可选（需要 JS 生成 DOM 时） |
| [`tokens.json`](tokens.json) | `tokens.css` 的机器可读镜像（dark 111 / light 47），供构建工具、其它软件、AI 读取 | 可选 |
| [`AI-GUIDE.md`](AI-GUIDE.md) | 给 AI 编码助手的操作手册：硬约束、读文件顺序、标准流程、提示词模板、验收清单 | 可选（AI 协作时强烈建议） |

不引入这三个文件不影响纯 CSS 用法；它们不改变任何既有类名、DOM 契约与 token 取值。

> 本章结构：13.1–13.2 是 API 参考；13.3–13.4 是 AI 协作与移植；13.5–13.7 是 SillyTavern 扩展模板、载体层级 P0 修复、性能实测与宿主模态的实机结论。

### 13.1 设计调用 API（nvui-api.js）

**定位**：可选运行时（UMD 包装，零依赖、无网络请求、无 emoji）；加载时不访问 DOM（Node 里 `require` 只拿到 API 对象，方便测试/静态生成）；所有 DOM 操作在函数调用时发生；只使用 `nvui-` 类与 CSS token，自动带上布局标准、a11y、焦点管理与动效降级（降级交给 CSS）。

**加载方式**

```html
<script src="./ui-kit/nvui-api.js"></script>
<script>
    NVUI.showToast({ message: '已保存', type: 'success' });
</script>
```

```js
// Node（测试 / 构建期静态生成；不触发 DOM）
const NVUI = require('./nvui-api.js');
console.log(NVUI.version);            // 与 package.json 一致（当前 3.1.1）
console.log(typeof NVUI.createPanel); // 'function'
```

**顶层 API 一览**

| API | 说明 | 返回 |
| :--- | :--- | :--- |
| `NVUI.version` / `NVUI.VERSION` | 版本号字符串（与 `package.json` 一致） | `string` |
| `NVUI.PANEL_CLASS` | 面板根类名常量 `'nvui-panel'` | `string` |
| `NVUI.config` | 运行时配置：`{ debug, logger }`；`debug` 打开详细日志，`logger` 可替换为宿主日志总线 | `object` |
| `NVUI.classes` | 常用类名映射（`panel` / `overlayPanel` / `tabs` / `tab` / `tabpane` / `bottomNav` / `bottomNavItem` / `accordion` / `switchRow` / `inputRow` / `toast`） | `object` |
| `NVUI.defaultStorageAdapter` | 默认 `localStorage` 适配器（键前缀 `nvui_state_<id>`），可替换为自定义 StorageAdapter | `object` |
| `NVUI.getToken(name, scope?)` | 读取当前作用域的 CSS 变量值（如 `getToken('--nvui-accent')`）；内置缓存，宿主的 class / 内联样式一变即自动重算 | `string` |
| `NVUI.invalidateTokenCache()` | 手动让令牌缓存失效；宿主在 kit 之外改样式表且未触发 class / 内联样式变化时调用（`setTheme()` 内部已自动调用） | `void` |
| `NVUI.setTheme(theme, options?)` | 切换主题 / 实心模式（`theme: 'light'` / `'dark'` / **`'auto'`（v2.9.0）**、`options.solid: true/false`；只切类名，不写颜色）。v2.7.2 起不再无条件清除 `.nvui-solid`：不传 `options.solid` 时保留用户实心偏好。`'auto'` 双信号取并集 —— `prefers-color-scheme` **或** 切到 auto 时宿主已有的 `.nvui-theme-light`（宿主浅色皮肤），`matchMedia` 变更在同一 change 事件内生效；显式 `'light'` / `'dark'` 会摘掉监听，主权交回调用方 | `void` |
| `NVUI.selfCheck(options?)` | v2.8.0：运行时自检（`kitVersion/cssLoaded/glass/carrierZ/hostModalCount/tokens/issues`）；`expect` 不匹配、CSS 未加载、自动回退会进 `issues`；Node 无 DOM 返回 `no-dom` | `object` |
| `NVUI.checkCompatibility({ min, max })` | v2.8.0：semver 区间判断（按 major/minor/patch 数值比较）。v3.0.0 起与 README §11.5 兼容矩阵同源，下游初始化时自查一次 | `{ compatible, actual, reason }` |
| `NVUI.migrateStateV1toV2(state)` | **v3.0.0 新增**：布局状态迁移器，`{ version:1, size:{ width, height, isMaximized } }` → `{ version:2, size:{ w, h, mode } }`。幂等（已是 v2 原样返回）、不改入参、非对象返回 `null`；存档读取与 `setLayoutState()` 已内置调用 | `object`（无输入时为 `null`） |
| `NVUI.defaults` | v2.8.0：冻结的组件官方默认值（`switchRow/inputRow/accordion/progress/createPanel/showToast/actions`） | `object` |
| `NVUI.detectGlassSupport(options?)` | 探测宿主是否**实际**禁用了 `backdrop-filter`（读渲染后的计算值，不猜宿主类名）。内部为 supported / unsupported / unknown 三态；kit CSS 未就绪时返回 `true` 并自动重探（不落回退） | `boolean` |
| `NVUI.syncGlassFallback(options?)` | 探测并同步自动回退：模糊不可用时给根节点加 `.nvui-glass-fallback`（token 派生 97% 近不透明档，**不再整块 `.nvui-solid`**），恢复后自动移除；`createPanel()` / `showToast()` / `openLayer()` 已内置 | `boolean` |
| `NVUI.countHostModals()` | 统计处于模态状态的**宿主**原生 `<dialog>` 数量（用 `:modal` 伪类，自动排除 kit 自身载体） | `number` |
| `NVUI.syncHostModalState()` | 同步宿主模态降级态（加 / 移 `.is-host-modal`），返回当前宿主模态数 | `number` |
| `NVUI.getCarrierState()` | 查询载体与宿主模态的层级快照（诊断 / 宿主集成用） | `object` |
| `NVUI.diagnostics()` | **v2.9.0 新增**：一次性诊断快照，可直接贴进 issue。8 个字段：`status` / `version` / `assets`（三个资产的 `loaded` + `kitVersion`，`md5` 只在发布产物的 `manifest.json` 里，运行时为 `null`）/ `glass` / `hostModals` / `escapeStackDepth` / `persistKeys` / `listenerCounts`（只统计挂在 window / document / `documentElement` / body / `MediaQueryList` 上的活体监听）。纯只读，不建 DOM、不写存储；Node 等无 DOM 环境返回 `{ status: 'no-dom', version, assets: null }` | `object` |
| `NVUI.openLayer(dialogEl, overlayEl)` | 打开浮层载体（非模态 `dialog.show()`，避免 `inert`） | `void` |
| `NVUI.closeLayer(dialogEl, overlayEl, done?)` | 关闭载体（`is-closing` 退场 → `animationend` 或约 260ms 兜底 → `hidden` + `close()`） | `void` |
| `NVUI.clearLayoutState(id, storageAdapter?)` | 清除指定面板的布局记忆（StorageAdapter 或默认 localStorage） | `void` |
| `NVUI.clampPanelLayout(savedSize, savedPos, options?)` | 跨分辨率视口越界钳制计算（保证桌面与移动端安全贴边） | `object` |
| `NVUI.switchRow(options)` | 生成胶囊开关行（`label` / `value` / `disabled` / `feature` / `onChange`） | `HTMLElement` |
| `NVUI.inputRow(options)` | 生成输入行（`label` / `type` / `value` / `placeholder` / `min` / `max` / `step` / `disabled` / `onChange` / `rows` / `hint` / `error`；`type: 'path'`、`'textarea'` 为伪类型） | `HTMLElement`（`row.input` 指向 input / textarea） |
| `NVUI.accordion(options)` | 生成折叠分组（`title` / `summary` / `open` / `content[]`） | `HTMLElement`（带 `setOpen` / `setSummary`） |
| `NVUI.progress(options)` | 生成进度条（`value` / `label` / `variant` / `indeterminate` / `showLabel` / `showValue`） | `HTMLElement`（带 `setValue`）；开启 `showLabel` / `showValue` 时返回 `.nvui-progress-field` 容器，容器同样带 `setValue`，轨道在 `container.track` |
| `NVUI.createPanel(options)` | 生成完整插件面板（标题栏 + 顶部 tabs + 内容区 + 可选 footer + 手机底部导航） | 控制器对象（见下） |
| `NVUI.showToast(options)` | 生成吐司（`message` / `type` / `duration` / `icon` / `dismissible`；自动创建吐司顶层载体） | `{ element, dismiss }` |

**`createPanel(options)` 参数**

| 参数 | 说明 |
| :--- | :--- |
| `id` | 根 id 前缀（默认自动生成；会派生 `-layer` / `-overlay` / `-title` / `-tab-*` / `-pane-*`） |
| `title` | 面板标题（`aria-labelledby` 指向它） |
| `version` | 标题旁版本徽标文字（可选；业务版本，不是 kit 版本） |
| `tabs` | `[{ key, label, icon }]`；为空时无导航（单页面板） |
| `active` | 初始 tab key（默认第一个） |
| `glass` | v2.8.0：`'auto'`（默认，尊重 Fast UI）/ `'force'`（仅本面板强制真玻璃）/ `'solid'`（实心）；无效值 warn + 回退 auto |
| `actions` | 标题栏右侧额外图标按钮 `[{ icon, label, onClick }]` |
| `footer` | 底部按钮 `[{ label, variant, onClick, close }]` |
| `mount` | 挂载节点（默认 `document.body`；无效则回退 body，仍无效则中止创建） |
| `onClose` | 关闭后回调 |
| `destroy` | `destroy()` 时执行的清理回调（解绑自有监听、清理定时器等） |
| `persist` | `true` 或 `{ size, tab, accordion, storage }`：布局状态持久化（尺寸 / tab / 折叠），可插拔 StorageAdapter；读写入口见控制器方法 `getLayoutState()` / `setLayoutState()` |
| `persist.size` | **三态**（v2.9.0）：`true` 宽高 + 最大化全量记忆；`false` 完全不参与（#16 语义）；`'width-only'` 只记宽 —— `height` 恒为 `null`、最大化不记（最大化本质是二维状态），适合「定宽 + 高度交给下游 CSS」 |
| `width` | 初始自定义宽度（number，单位 px，默认 720；经 Viewport Clamping 钳制） |
| `update` | 静态更新胶囊 `{ version, label, url, onClick, hidden }` |
| `themeToggle` | `true` 或 `{ onThemeChange, initial: 'dark' 或 'light' }`：头部主题切换按钮 |
| `focusFallback` | 焦点归还兜底：CSS 选择器或元素。触发元素不可聚焦时（如 ST 的 wand 菜单点击后自动收起）焦点落到它 |
| `resizable` | **v2.9.0 新增**，默认 `false`。`true` 时右下角出现 `.nvui-resize` 手柄：可拖拽，也可键盘操作（方向键 ±8px、Shift ±32px、Home 复位到默认宽 + 高度自适应）。所有尺寸写入都经 `applyClamping()`，钳制 / 移动端回退 / 持久化（含 `size: 'width-only'`）语义与 `setSize()` 完全一致 |

**控制器方法**：`id` / `dialog` / `overlay` / `panel` / `body` / `tabs` / `bottomNav` 节点，以及
`open()` / `close()` / `destroy()` / `setTab(key)` / `syncIndicator()` / `addNode(key, node)` /
`addSwitch(key, opts)` / `addInput(key, opts)` / `addAccordion(key, opts)` / `addProgress(key, opts)` / `addSectionTitle(key, text)` /
`showUpdate(updateConfig)` / `trackAccordion(node, id?, options?)` / `adoptAccordions(root, options?)` /
`clearLayoutState()` / `getLayoutState()` / `setLayoutState(state, { silent })` / `flushPersistSave()` /
`setSize(width, height)` / `setMaximized(boolean)` / `setGlassMode(mode)` / `getGlassState()`，以及只读 getter `activeTab`。

**布局状态导入导出（v2.9.0，GH-#18 B1；v3.0.0 升 v2 形状）**

`getLayoutState()` 返回 `{ version: 2, size: { w, h, mode }, tab, accordion }` 的**游离副本**（不含
`timestamp` —— 时间戳是存储记录元数据，带上会让两次调用天然不等）。`setLayoutState(state, { silent })`
只写内存 + 调度一次落盘，**不会**让面板当场跳尺寸或换标签 —— 导入是数据操作，真正生效在下一次 `open()`。

`size.mode` 取 `normal` / `maximized` / `width-only` / `off`（`persist.size: false` 时 `size` 整体为 `null`）。
`mode` 合并了 v1 的 `isMaximized`：最大化本质是二维状态，留一个独立布尔会让「w / h 还有没有意义」
取决于另一个字段，迟早写出 `{ w: 400, h: 800, mode: 'maximized' }` 这种自相矛盾的存档。

```js
const snapshot = panel.getLayoutState();          // → 可存进 extension_settings
await saveToHostSettings(panel.id, snapshot);     // 宿主自己的存储
panel.setLayoutState(snapshot);                   // 导入：只写内存 + 一次落盘
panel.setLayoutState(snapshot, { silent: true }); // 预览：不写存储，仅内存态

// 下游存过 v1 形状（{ size: { width, height, isMaximized } }）时，写入前跑一次迁移器：
settings.layoutState = NVUI.migrateStateV1toV2(old) || old;
```

- 未提供的键落回当前 DOM 事实，显式传 `null` 视为清空该项；`persist` 关掉的维度（如 `size: false`）一律写 `null`，
  不会绕过 #16 的尺寸隔离；`persist.size: 'width-only'` 时导入的 `height` 恒为 `null`、`mode` 强制 `'width-only'`；
- 连续多次调用合并成一次落盘（250ms 防抖）；`silent: true` 完全不写存储；
- 未启用 `persist` 时 `getLayoutState()` 仍返回只读快照（便于一次性迁移到自己的存储），`setLayoutState()` 返回 `null`；
- **v1 存档自动可读**：`applyLoadedState()` 读到旧格式会先过 `NVUI.migrateStateV1toV2()`，落盘一律写 v2。
  该迁移器幂等、不改入参，`setLayoutState()` 也接受 v1 / v2 两种入参。

**组件默认值（`NVUI.defaults`）**

| 组件 | 默认值 |
| :--- | :--- |
| `switchRow` | `label=''`、`value=false`、`disabled=false`、`feature=false` |
| `inputRow` | `label=''`、`type='text'`、`placeholder=''`；`value/min/max/step` 不设置 |
| `accordion` | `title=''`、`summary=''`、`open=false`、`content=[]` |
| `progress` | `value=0`（归一化 0–100）、`indeterminate=false`、`label=''` |
| `createPanel` | `id='nvui-panel'`、`title='面板'`、`tabs=[]`、`active` 首 tab、`actions=[]`、`footer` 无、`persist=false`、`glass='auto'` |
| `showToast` | `message=''`、`icon='fa-solid fa-circle-info'`、`duration=3200`（0=不消失）、`dismissible=true` |
| `.nvui-actions` | `display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end` |

> `destroy()`：销毁面板并从 DOM 移除其 dialog/overlay、注销全局 Esc 监听、触发 `destroy` 回调。长生命周期插件（可反复打开的设置页）建议在卸载 / 重复初始化前调用，避免 DOM 与监听器累积。

**最小示例**

```js
const panel = NVUI.createPanel({
    id: 'my_plugin_panel',
    title: '我的插件设置',
    version: 'v1.0.0',
    focusFallback: '#extensionsMenuButton',   // ST 扩展菜单场景：触发按钮收起后焦点落到这里
    tabs: [
        { key: 'basic', label: '基本设置', icon: 'fa-solid fa-sliders' },
        { key: 'advanced', label: '高级', icon: 'fa-solid fa-wrench' }
    ],
    footer: [
        { label: '取消', variant: 'ghost', close: true },
        { label: '保存', variant: 'primary', onClick: () => NVUI.showToast({ message: '已保存', type: 'success' }) }
    ]
});
panel.addSwitch('basic', { label: '启用自动连载', value: true, feature: true, onChange: (v) => console.log(v) });
panel.addProgress('advanced', { value: 42, label: '准备进度' });
panel.open();
```

**API 自动保证的行为**（与手写 DOM 一致，无需重复实现）：结构为 `dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel`；`role="dialog"` + `aria-modal="true"` + `aria-labelledby`；桌面 tabs 与手机底部导航同一份状态（`aria-selected` / `aria-current` / `tabindex` / tabpane 切换）；关闭按钮 `aria-label`、Esc、点遮罩；关闭后焦点归还（三级兜底）；Tab / Shift+Tab 焦点陷阱；进出场动画与全部降级交给 CSS。

> API 只负责 DOM 与状态，不写样式；品牌化仍然只改 `tokens.css`（或整体替换同名 token）。不要在 API 之上再叠一层 `!important` 或第二套组件样式。

### 13.2 tokens.json（机器可读令牌镜像）

`tokens.json` 是 `tokens.css` 的机器可读镜像（**由 `tokens.css` 生成，勿手改**）：

```json
{
  "schema": 2,
  "name": "sillytavern-nvui-kit-tokens",
  "version": "3.1.1",
  "description": "SillyTavern UI Kit 设计令牌机器可读镜像（由 tokens.css 生成，勿手改）。dark = 深色默认，light = .nvui-theme-light 覆盖。",
  "generatedFrom": "tokens.css",
  "meta": { "--nvui-bg": { "group": "表面 / 背景", "type": "color", "description": "面板底色" } },
  "groupDescriptions": { "表面 / 背景": "三层表面：bg → bg-2 → bg-3，越靠内越亮" },
  "dark": { "--nvui-bg": "#161a24", "--nvui-accent": "#8b6dff", "...": "共 111 个令牌" },
  "light": { "--nvui-bg": "#f7f8fc", "--nvui-accent": "#6d4df2", "...": "共 47 个覆盖" }
}
```

| 字段 | 说明 |
| :--- | :--- |
| `schema` | `2`（v3.0.0 起）。值结构未变，只新增元信息；没有这个键的是 v1 |
| `name` / `version` | 包名与 kit 版本（与 `package.json` 一致） |
| `generatedFrom` | 固定为 `tokens.css`（唯一事实来源） |
| `meta` | 每令牌一条 `{ group, type, description }`。`type` 取 `color` / `length` / `duration` / `easing` / `number` / `font` / `shadow` / `alias` / `keyword` / `other`；**75 个令牌在 CSS 里没有单独注释，`description` 是空字符串**（不编造），说明见 `groupDescriptions` |
| `groupDescriptions` | 每个分组（16 组中有散文说明的 9 组）的一段说明 |
| `dark` | 深色默认令牌全集（111 个），键为 `--nvui-*`，值为 CSS 文本 |
| `light` | `.nvui-theme-light` 覆盖（47 个）；未覆盖的令牌继承 `dark` |

用途：构建工具生成工具类 / 主题、其它软件导入设计变量、AI 不必解析 CSS 就能知道有哪些令牌、设计工具做令牌映射。

```js
const tokens = require('./ui-kit/tokens.json');
const darkBg = tokens.dark['--nvui-bg'];              // '#161a24'
const isColor = tokens.meta['--nvui-bg'].type;        // 'color'
```

> **注意**：v3.0.0 起顶层多了 `schema` / `meta` / `groupDescriptions` 等键，**不要遍历顶层键当令牌名**，
> 遍历 `tokens.dark` / `tokens.light`。
>
> `tokens.json` 与 `tokens.css` 必须逐值一致（测试守护）；新增/修改令牌时先改 `tokens.css`，
> 再 `npm run tokens:migrate` 重新生成（`npm run tokens:check` 只校验），不要反向手改。

### 13.3 AI-GUIDE 使用方式

[`AI-GUIDE.md`](AI-GUIDE.md) 是给 AI 编码助手的操作手册，覆盖：**硬约束 → 读文件顺序 → 插件面板标准流程 → 其它软件移植 → 提示词模板 → API 速查 → 验收清单**。派任务时建议直接附上该文件（或让其先读）。

**推荐阅读顺序**：`tokens.json` → `tokens.css` 注释 → `components.css` 契约 → README §12 + §7 → `nvui-api.js` → `AI-GUIDE.md` → 本章。

**给 AI 的硬约束（违反即不合格）**

1. 只用 Kit 的类名与令牌：`nvui-` 前缀 / `is-` 状态类，颜色等一律 `var(--nvui-*)`，**禁止 `#hex` / `rgb()` / `hsl()` 字面量**；
2. 不污染宿主：禁止裸元素选择器、全局重置、清单外的 `!important`；
3. SillyTavern 浮层必须进 `<dialog class="nvui-tl">` 载体并用非模态 `show()`，禁止 `showModal()`、禁止裸 `position: fixed` 挂 body；
4. 无障碍内建：`role="dialog"` / `aria-modal` / `aria-labelledby`、tabs 语义、`aria-expanded`、关闭按钮 `aria-label`、焦点移入与归还；
5. 尊重系统偏好：动效可被 `prefers-reduced-motion` 降级；玻璃可被减少透明度 / 不支持 `backdrop-filter` / `.nvui-solid` 降级；
6. 无 emoji：图标用 Font Awesome `<i>` 或纯 CSS/SVG 图形；
7. 不改 Kit 契约：不重命名类 / token、不加第二套皮肤；品牌化只整体替换同名 token；
8. 改完必须验证：`npm test` 0 失败，并同步 `preview.html` 与文档。

**提示词模板（可直接复制）**

```text
按 SillyTavern NVUI Kit 规范，为我的插件生成一个设置面板：
- 先读 AI-GUIDE.md 与 README 第 12 章；
- 优先用 nvui-api.js 的 NVUI.createPanel() 生成，不要自写一套 DOM；
- 面板 3 个 tabs：基本 / 高级 / 关于；基本页 1 个 is-feature 开关 + 2 个折叠分组；
- 所有颜色、间距、动效使用 var(--nvui-*) token，禁止硬编码颜色；
- 输出完整 JS 与必要 CSS，并说明如何接入插件；
- 最后按 AI-GUIDE 的验收清单自查，并运行 node test/test-ui-kit.js。
```

**验收清单**：只用 kit 类与 token；无硬编码颜色；无裸选择器 / 预算外 `!important`；浮层进 `dialog.nvui-tl`；`role` / `aria` 齐全；焦点移入与归还；`prefers-reduced-motion` 与降级可用；preview 与 README 同步；`npm test` 0 失败。

> README 是规范本体，AI-GUIDE 是面向 AI 的操作化摘要；两者冲突时以 `tokens.css` / `components.css` 与 README 为准。

### 13.4 移植到其它软件

本目录可整目录复制（`tokens.css` / `components.css` / `nvui-api.js` / `tokens.json` / `AI-GUIDE.md` / `preview.html` / `test/`）到其它项目。

**必须保留**：令牌名称、语义与对比度（品牌化时整体替换同名 token 的值）；组件类名与 DOM 契约、`is-` 状态类；无障碍语义（dialog 角色、tabs 语义、`aria-current`、焦点管理）；降级行为（`prefers-reduced-motion` / `prefers-reduced-transparency` / `forced-colors` / 不支持 `backdrop-filter` / `.nvui-solid`）；规范测试（复制后先跑一遍，确保文件齐全、版本一致）。

**需要按宿主替换**：`<dialog class="nvui-tl">` 浮层载体与「宿主 `html` 有 transform」规避（非模态 `show()` + 载体自身 z-index 档位双机制；其它框架可映射到自己的 modal / portal 根节点，但必须保持等价层级语义，不依赖浏览器 top layer）；图标字库（Font Awesome 可换成项目方案，保持 `<i>` / SVG 的可访问写法）；构建体系（`nvui-api.js` 是 UMD 零依赖文件，可直接 `<script>` 或打包；`tokens.json` 可在构建期生成框架变量）。

**不要做**：重命名 `nvui-` 类与 `--nvui-*` token；删除降级块；把组件塞进目标软件的全局重置；给组件加第二套皮肤。

### 13.5 SillyTavern 扩展模板（st-extension-template/）

`st-extension-template/` 是一份**可直接使用的 ST 扩展骨架**，已在本机真实 SillyTavern 宿主中完成实机验证。

```text
st-extension-template/
├── manifest.json      # ST 扩展清单：display_name / loading_order / js / css / hooks.activate
├── index.js           # ES Module 入口：导入宿主上下文 + 内嵌 Kit 运行时
├── style.css          # 业务样式（顶部 @import 内嵌 ui-kit/tokens.css 与 components.css）
└── ui-kit/            # 内嵌 Kit 运行时（tokens.css / components.css / nvui-api.js / tokens.json）
```

**用法**：整个目录复制到 `public/scripts/extensions/third-party/<你的插件名>/`，改 `manifest.json` 的 `display_name` / `author` / `version` 与 `index.js` 的 `EXTENSION_NAME`，即可在扩展列表里加载。

**模板已经踩平的 ST 宿主陷阱**

| 陷阱 | 正确做法 |
| :--- | :--- |
| `extension_settings` 不是 `window` 全局 | `import { extension_settings as extensionSettings } from '../../../extensions.js'`，且**每次实时读取**，不要缓存 `getContext()` 快照 |
| `getContext()` 拿到的 `ctx.extension_settings` 是初始化时刻快照 | 同上，用模块级导出对象 |
| ST 的扩展菜单是 Popper 浮层，点击菜单项后自动收起 | 触发按钮随之不可聚焦，焦点归还要用 `focusFallback: '#extensionsMenuButton'` 兜底 |
| 扩展菜单 DOM 由 `addExtensionsButtonAndMenu()` 动态创建 | 挂载点用 `#extensionsMenu` / `#extensionsMenuButton` |
| `manifest.json` 的 `hooks.activate` 指向入口模块导出的函数名 | 入口必须 `export function init()` |

**入口骨架**（完整可运行样例见 `st-extension-template/index.js`）：

```js
import { extension_settings as extensionSettings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';
import './ui-kit/nvui-api.js';

const EXTENSION_NAME = 'my_plugin';

function getSettings() {
    const all = extensionSettings || {};   // 实时读模块导出，不要走 window 兜底
    if (!all[EXTENSION_NAME]) all[EXTENSION_NAME] = { enabled: true };
    return all[EXTENSION_NAME];
}

export function init() { /* 注册菜单按钮、事件监听、创建 panel */ }
```

> 面板本体直接用 `NVUI.createPanel({ id: 'my_plugin_panel', focusFallback: '#extensionsMenuButton', ... })`，不要再自写一套 DOM。

#### 13.5.1 层级 P0 修复（浮层被酒馆内容压住）

这是 v2.3.0 修掉的最严重问题，也是实机测试中由用户截图直接报障的一条。

**现象**：真实 ST 宿主里打开面板，NVUI 面板整体**被酒馆聊天区压在后面**——面板可见但点不到。

**根因**（两条，缺一不可）：

1. 非模态 `dialog.show()` 并不会进入浏览器 top layer；只有 `showModal()` 会，但它的 `inert` 会让酒馆宿主完全不可交互——这条路被排除。
2. 载体因此必须靠**自身 z-index** 参与常规层叠。`position: fixed` 总是创建层叠上下文：载体内部子元素 z-index 再大也只在载体内部生效。修复前载体是 `z-index: auto`，整体只相当于 z-index 0，而 ST 的 `#sheld`（聊天列）是 `z-index: 30` 的 absolute 元素——宿主内容稳赢。

**修复**（新增 `--nvui-z-layer` 载体档，令牌总数 109 → 110）：

```css
/* 载体层级：必须高于宿主常规层叠（酒馆最高约 30000） */
dialog.nvui-tl {
    position: fixed;
    inset: 0;
    z-index: var(--nvui-z-layer);
}

/* 吐司载体：常驻且需始终盖过面板，故比面板载体再高一级 */
dialog.nvui-tl.nvui-tl-toast {
    z-index: var(--nvui-z-tooltip);
}
```

`NVUI.showToast()` 内部创建的吐司载体已带 `.nvui-tl-toast`；自建吐司载体必须手动加这个类，否则吐司会被面板压住。

**方案对照实验**（真实 ST 宿主内实测）：`dialog` + `z-index: auto` 三个采样点只赢 1/3（修复前状态）；`dialog` + 极大 z-index 赢 3/3（硬编码魔法值，最终用 token 表达）；`popover="manual"` 对常规内容 3/3，但压不过 `showModal()` 模态（§13.7 已证伪「popover 能压过一切」）。最终选 `--nvui-z-layer: 1000000`，同时满足：不加 `inert`、不改宿主、层级可被 token 统一调参、与现有层级体系一致。

**回归**：规范测试全绿（含层级断言）；实机 `test/st-layer-check.js` 修复后 5 个采样点全部 `oursOnTop: true`，关闭面板后层级正确还原，控制台零错误。

> 移植提醒：把 kit 用到别的宿主时，请把 `--nvui-z-layer` 调到高于宿主最高 z-index，不要假设浏览器 top layer 会兜底。

### 13.6 性能实测结论

本节记录若干「疑似性能问题」的实机测量结论。方法：Chrome DevTools Protocol 的 `Performance.getMetrics`（布局次数 / 布局耗时 / 样式重算）+ `requestAnimationFrame` 帧间隔分布，全部在真实酒馆页面中跑。

| 疑点 | 实测数据 | 结论 |
| :--- | :--- | :--- |
| 进度条 `transition: width` 逐帧重排 | width 过渡与 transform 缩放布局次数相同（2.0 次/动画），布局耗时 14.3ms vs 16.2ms，width 反而略快 | 不修 |
| 折叠面板 `transition: grid-template-rows` | 5 次展开共 16.37ms（3.27ms/次），布局次数仅 10 次 | 不修 |
| 桌面端双层 `backdrop-filter` | 双层 p95 帧间隔 16.80ms = 单层 = 无浮层基线 | 不修 |
| tabs 指示器 `transition: width/height` | 累计布局 10.5 次/切换、21.89ms，但帧间隔与无动画基线完全一致（p95 16.80ms） | 不修（无可感知卡顿） |
| 宿主 `showModal()` 模态压住 kit 浮层 | 层级事实成立，但宿主模态已用 `inert` 禁用整页交互，关闭后立即还原 | 不修（模态语义的正确表现） |

**关键方法论**：累计布局耗时 ≠ 卡顿。tabs 指示器的 21.89ms 是跨整个过渡期（约 18 帧）累计，摊到每帧约 1.2ms，远在 16.7ms 的 60fps 帧预算内。判定性能问题必须看帧间隔，不能只看布局次数。方案选型也做了实测：`contain: layout` / `contain: strict` / `will-change: transform` 三种零契约变更的隔离手段收益均为 0；唯一有效的 transform 缩放需改写 §7.7 的变量契约，属于为不存在的卡顿付出破坏性代价，故不采纳。

**复现脚本**（需 `playwright-core` + 本机 Chrome）：

| 脚本 | 覆盖 |
| :--- | :--- |
| `test/st-perf-probe.js` | 总探针：布局次数 / 布局耗时 / 双层 blur 帧间隔对照 |
| `test/st-perf-tabs-fine.js` | 分离「创建 DOM」与「纯动画」成本 |
| `test/st-perf-tabs-options.js` | 四种修复方案选型（`contain` / `will-change` / transform） |
| `test/st-perf-tabs-frames.js` | 帧间隔判定：过渡期间 vs 无动画基线 |
| `test/st-modal-layer-check.js` | 宿主模态与 kit 浮层的层级 / 焦点 / 还原三态 |
| `test/st-carrier-host-modal-check.js` | 载体让位机制：宿主模态下自动降级 / 不可点 / 压暗 / 关闭后还原 |

> 适用边界：以上数据来自本机（Chrome + 硬件加速）桌面环境。无 GPU 加速的低端设备上 `backdrop-filter` 代价可能显著不同，此时建议用 `.nvui-solid` 或调低 `--nvui-glass-blur` 手动降档。

### 13.7 载体与宿主模态（主动让位，而非硬压）

§13.5.1 解决了「kit 浮层被宿主**常规内容**压住」；本节解决另一类、性质不同的问题：宿主自己打开**模态弹窗**时 kit 浮层该怎么办。

**实测真相**（真实 ST 宿主 + 实机脚本）：

| 问题 | 实测结论 |
| :--- | :--- |
| `dialog.showModal()` 会进浏览器 top layer 吗？ | 会。模态在 top layer 内优先级最高，任何 z-index 都压不过 |
| `popover="manual"` 能压过模态吗？ | 不能。无论 show 先后，模态恒胜 |
| 根因是什么？ | 不是 z-index。`showModal()` 会给整个文档加 `inert`，`inert` 元素不参与命中测试（`elementsFromPoint` 不返回），也无法获得焦点 |
| kit 浮层在宿主模态期间能被点到吗？ | 不能。整页交互已被禁用（kit 按钮 `focus()` 失败） |
| 宿主模态关闭后 kit 浮层会恢复吗？ | 会，立即还原 |
| 宿主模态期间按 Esc 会关闭底层 Kit 面板吗？ | 不会。Esc 先交给宿主模态；宿主关闭后 Kit 的 Esc 功能恢复 |

**设计决策：不硬压，改为主动让位。** 既然宿主模态期间 kit 浮层物理上不可能既压过它又保持可交互，正确行为不是「继续硬压导致用户点了没反应」，而是明确让位并给出视觉反馈：

```css
/* 宿主模态降级态 */
dialog.nvui-tl.is-host-modal {
    pointer-events: none;      /* 让位：不可交互 */
    opacity: 0.35;             /* 压暗：视觉上退居其次 */
    filter: grayscale(0.6);
    transition: opacity var(--nvui-duration-base) var(--nvui-ease-standard),
        filter var(--nvui-duration-base) var(--nvui-ease-standard);
}

/* 降级态下的子浮层同样不可点 */
dialog.nvui-tl.is-host-modal > .nvui-overlay,
dialog.nvui-tl.is-host-modal > .nvui-floating,
dialog.nvui-tl.is-host-modal > .nvui-toast-stack {
    pointer-events: none;
}
```

**运行时维护**：`NVUI.countHostModals()`（用 `dialog:modal` 统计宿主模态数，自动排除 kit 自身载体，避免自我降级）、`NVUI.syncHostModalState()`（同步 `.is-host-modal`）、`NVUI.getCarrierState()`（返回 `{ carrierZ, hostModalCount, degraded, carriers }` 快照）。触发时机：`createPanel()` / `showToast()` / `openLayer()` 各调用一次；此外运行时装了幂等监听（`MutationObserver` 监听 `<dialog>` 的 `open` 属性 + 捕获阶段 `close` 事件），因此**宿主模态在面板打开之后才弹出**时也会自动降级，关闭后自动还原，无需宿主配合。

**宿主集成建议**：宿主自己的模态用标准 `dialog.showModal()` 即可，kit 自动让位；若宿主需要「模态期间仍允许操作 kit 浮层」，不要用 `showModal()`（改用非模态 + 自绘遮罩）；排查层级问题时先调 `NVUI.getCarrierState()` 看 `carrierZ` / `hostModalCount` / `degraded`，不要凭肉眼判断。

**实机回归**：`test/st-carrier-host-modal-check.js` 共 18 项断言全绿（正常态无降级 / 模态打开后自动降级 + 不可点 + 压暗 / 快照正确 / 关闭后还原 / `countHostModals()` 不自我降级），控制台零错误。本节不引入新 token：复用 `--nvui-z-layer`，110 令牌契约保持。

---

## 14. 许可

MIT，见同目录 [LICENSE](LICENSE)。本目录是独立项目，可整体移动或复制到任意位置；复制到其它插件时请保留本目录与版本号，便于后续同步上游修复。
