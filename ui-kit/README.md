# SillyTavern 插件 UI Kit · 设计规范

> 版本：**v2.3.0**（语义化版本；破坏性改名/删 token 升大版本，新增组件/新增 token 升小版本，调 token 取值/动效打磨/反馈修复升补丁版本）
> 来源：从 novel-stream 扩展（另一个 SillyTavern 插件）的浮动 UI（设置弹窗 / 悬浮入口 / 图片预览 / 提示层）中提炼，已在实际酒馆宿主（深/浅主题、桌面/手机）上验证；**v2.0.0 起升级为「Flat Glass（扁平玻璃）」设计语言**（扁平化 + 玻璃拟态 + 动效体系 + 能力降级）；**v2.0.1 玻璃更透、浮层描边更柔和、动效补强（16 关键帧）**；**v2.1.0 新增「SillyTavern 插件面板布局标准（桌面 / 手机）」（第 12 章）**；**v2.1.1 描边再减弱、焦点环单圈 1.5px、面板固定尺寸、隐藏滚动条**；**v2.2.0 描边精致化（圆角玻璃去外框 1px 描边，改柔光+阴影成形；ghost/空态/指示器去圆角描边；焦点环回到单圈 2px 整数像素）并新增可选 `nvui-api.js` 设计调用 API、`tokens.json` 机器可读令牌镜像与 `AI-GUIDE.md` AI 协作指南（第 13 章）**；**v2.3.0 修复浮层载体层级 bug——非模态 `dialog.show()` 实测不进浏览器 top layer，新增 `--nvui-z-layer: 1000000` 载体档位，否则会被宿主正 z-index 表面（酒馆 `#sheld` z-index:30）整块盖住**。
> 定位：**独立项目 + SillyTavern 插件自有的 body 级浮动 UI**。本目录自带 `package.json` / `LICENSE` / `CHANGELOG` / `test/`，**不依赖任何外部仓库或父目录，可整目录复制/移动到任意文件夹或仓库**。不接管聊天区、原生抽屉等宿主区域（那些区域必须沿用酒馆主题变量）。
> 演示：**[在线组件预览（GitHub Pages）](https://zgy-beep.github.io/ui-kit/preview.html)**（免下载直接体验；可切换深/浅主题与实心/玻璃模式、演示面板布局）。

| 文件 | 作用 |
| :--- | :--- |
| [`tokens.css`](tokens.css) | 设计令牌：表面/玻璃/焦点环/配色、字号、间距、圆角、阴影、动效、层级、组件尺寸、面板尺寸；含深色默认值（110 个）与 `.nvui-theme-light` 浅色覆盖（47 个） |
| [`components.css`](components.css) | 通用组件样式（v2：扁平区块 + 浮层玻璃 + 动效系统 + 能力降级）；全部 `nvui-` 前缀，颜色只引用 token |
| [`nvui-api.js`](nvui-api.js) | **可选**的零依赖运行时 JS API（v2.2.0 新增）：`createPanel` / `showToast` / `switchRow` / `inputRow` / `accordion` / `progress` 等，生成符合面板布局标准与无障碍契约的 DOM；Node 下 require 不访问 DOM |
| [`tokens.json`](tokens.json) | `tokens.css` 的机器可读镜像（v2.2.0 新增）：`dark` 110 个 / `light` 47 个覆盖，供其它软件、构建工具与 AI 读取 |
| [`AI-GUIDE.md`](AI-GUIDE.md) | 给 AI 的协作指南（v2.2.0 新增）：硬约束、读文件顺序、SillyTavern 插件面板标准流程、其它软件移植规范、提示词模板、API 速查、验收清单 |
| [`preview.html`](preview.html) | 离线组件预览页（双击即可打开；可切换深/浅主题与实心/玻璃模式，支持 URL 参数 `?theme=light`、`?solid=1`；在线版见上方演示） |
| [`test/test-ui-kit.js`](test/test-ui-kit.js) | 规范守护测试（token 完整性 / 三方覆盖 / 无硬编码颜色 / WCAG AA 与玻璃合成对比度 / 宿主兼容红线 / 金标准取值 / 动效与降级红线）；`npm test` 或 `node test/test-ui-kit.js` |
| [`AUDIT.md`](AUDIT.md) | 架构审核报告：v1.1.0 界面架构评估、问题清单（P0/P1/P2/P3）、v2.0.0 升级方案映射与独立复核结论、v2.0.1 修订复核 |
| [`package.json`](package.json) | 独立项目元信息与 `npm test` 入口（零依赖，无需 `npm install`） |
| [`LICENSE`](LICENSE) | MIT 许可 |
| [`CHANGELOG.md`](CHANGELOG.md) | 变更记录（遵循语义化版本） |
| `README.md` | 本规范（配色语义、组件用法、宿主兼容红线、命名约定、迁移对照） |

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

---

## 1. 它是什么 / 不是什么

**是什么**

- 一套**自包含、主题可切换的浮动 UI 设计系统**：弹窗、标签页、折叠分组、胶囊开关、按钮、输入行、提示/告警、状态行、徽标、空态、骨架屏、进度条、吐司、悬浮面板等。
- 一套 **Flat Glass（扁平玻璃）设计系统**：静态区块只用色阶与间距表达层级（不描边、不投影、不渐变），浮层（弹窗 / 遮罩 / 悬浮面板 / 工具提示 / 吐司 / `.nvui-glass`）用半透明磨砂玻璃 + 受光边 + 内高光；**无 JS 运行时、纯 CSS**，组件 + 动画 + 降级都在 CSS 内完成，交互由业务用少量原生 JS 按约定的 DOM/状态类驱动。
- 一套 **SillyTavern 插件面板布局标准**（v2.1.0 新增）：电脑居中玻璃面板 / 手机底部抽屉 + 底部图标导航，同一份 DOM 随 600px 断点自动切换；只参考常见插件面板的排列结构，视觉沿用 Kit 的紫色 Flat Glass（见第 12 章）。
- 一套**可调用的设计接口与 AI 协作资产**（v2.2.0 新增）：可选 `nvui-api.js`（零依赖 JS API，自动生成合规 DOM 与 a11y）、`tokens.json`（110/47 机器可读令牌镜像）、`AI-GUIDE.md`（给 AI 的硬约束 / 读文件顺序 / 提示词模板 / 验收清单），见第 13 章。
- 一套**可复制的实现**：下一个插件把本目录整个拷过去，`@import` 两个 CSS 即可用；无需构建工具、无第三方依赖。
- 一个**独立项目**：目录内自带元信息、许可、变更记录、预览页、架构审核报告与测试，可整体移动到任意文件夹/仓库；`cd` 进目录后 `npm test` 即可独立验证。
- 一套**有守护的规范**：`test/test-ui-kit.js` 自动检查 token 是否齐全、组件是否被预览/文档覆盖、是否泄漏裸选择器、是否硬编码颜色、对比度是否达标（含玻璃层最坏宿主背景下的合成对比度）、核心取值是否与金标准一致、16 个关键帧是否都被引用、110 个令牌与 78 个组件类是否全覆盖、降级块是否在位。
- 一套**可降级的动效体系**：动效只表达层级/方向/因果，全部尊重 `prefers-reduced-motion`；玻璃能力缺失、用户减少透明度、强制颜色模式、窄屏低性能设备均有明确回退。

**不是什么**

- 不是通用组件框架：**没有 JS 运行时**，交互（标签切换、折叠开合、拖拽、Esc/遮罩关闭、弹窗进出场收尾）由各插件用少量原生 JS 实现，规范只约定 DOM 结构、状态类与动画收尾时序。
- 不是酒馆主题的替代品：**不要**把 `.nvui-*` 组件塞进聊天消息流里；聊天区必须使用宿主主题变量。
- 不提供图标字体：图标沿用宿主的 Font Awesome（`<i class="fa-solid fa-...">`），kit 内只有纯 CSS 的箭头/滑钮/加载环/状态点/骨架屏。
- 不是动效库：只提供入场/反馈/循环三类基础动效与工具类，不做编排复杂的页面转场；跨视图转场（View Transitions 等）不在本版本范围。
- 不是玻璃滤镜包装器：玻璃只允许用在浮层上，静态区块不允许用 `backdrop-filter`；玻璃承担的是"浮在内容之上"的空间语义。

---

## 2. 快速开始

### 2.0 本目录是独立项目

本目录可以直接作为独立项目/仓库使用，不依赖任何外部文件：

```text
ui-kit/                  <- 可整目录移动到任意位置或仓库
  tokens.css
  components.css
  nvui-api.js            <- 可选运行时 JS API（零依赖，v2.2.0）
  tokens.json            <- 令牌机器可读镜像（v2.2.0）
  AI-GUIDE.md            <- AI 协作指南（v2.2.0）
  preview.html
  README.md              <- 本规范
  AUDIT.md               <- 架构审核报告（v1.1.0 审核 + v2.0.0/v2.0.1 复核）
  package.json           <- 元信息 + npm test
  LICENSE
  CHANGELOG.md
  .gitignore
  test/
    test-ui-kit.js       <- 规范守护测试（零依赖）
```

- **独立验证**：`cd ui-kit` 后运行 `npm test`（等价于 `node test/test-ui-kit.js`），无需 `npm install`；
- **独立预览**：双击 `preview.html` 即可（离线可用），或直接访问 [GitHub Pages 在线预览](https://zgy-beep.github.io/ui-kit/preview.html)；
- **移动/复用**：整个目录复制到新插件里，或作为独立仓库单独维护；
- Node.js 要求：>= 16（仅测试需要；`tokens.css` / `components.css` 在浏览器/酒馆中使用，无 Node 依赖）。

### 2.1 引入

#### 2.1.1 方式 A：本地目录引入（常规酒馆插件）

新插件的 `style.css` 顶部（`@import` 必须在所有规则之前）：

```css
@import url('./ui-kit/tokens.css');
@import url('./ui-kit/components.css');
```

集成到插件时的目录结构建议：

```text
your-plugin/
  manifest.json
  style.css          <- @import ./ui-kit/...
  index.js
  ui-kit/            <- 本目录（可整目录拷入）
    tokens.css
    components.css
    nvui-api.js      <- 可选：<script src="./ui-kit/nvui-api.js"></script>
    tokens.json      <- 可选：机器可读令牌镜像
    AI-GUIDE.md      <- 可选：给 AI 的协作指南
    preview.html
    README.md
    AUDIT.md
    package.json
    LICENSE
    CHANGELOG.md
    test/
```

**可选：引入零依赖运行时 API（需要 JS 生成面板 / 吐司时）**

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

- `nvui-api.js` 是**可选**运行时（零依赖、不引入框架）；不引入也不影响纯 CSS 用法。
- 用 API 生成的 DOM 自动符合第 12 章面板布局标准与 §7 无障碍契约（`role`/`aria`、桌面 tabs 与手机底部导航同步、焦点管理、Esc / 点遮罩关闭；动效降级交给 CSS）。
- 完整函数表、渲染控制器与更多示例见 [第 13 章](#13-js-api-与-ai-协作指南)；给 AI 的逐步指南见 [`AI-GUIDE.md`](AI-GUIDE.md)；令牌的机器可读镜像见 [`tokens.json`](tokens.json)。

#### 2.1.2 方式 B：在线 CDN 引入（网页 / 外部项目）

无需下载文件，直接通过公共 CDN（jsDelivr）引入：

```html
<!-- 设计令牌与组件样式 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v2.2.0/tokens.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v2.2.0/components.css">

<!-- 可选运行时 API -->
<script src="https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v2.2.0/nvui-api.js"></script>
```

#### 2.1.3 方式 C：酒馆助手（Tavern Helper）单文件脚本引入

在「酒馆助手」（Tavern Helper / JS-Slash-Runner）等单文件用户脚本中，可以在脚本初始化时动态拉取 CDN 资源，自动处理 `window.parent` 顶层文档挂载：

```javascript
// 酒馆助手脚本：按需动态加载 NVUI Kit
async function ensureNVUI() {
    const W = window.parent || window, D = W.document;
    if (W.NVUI) return W.NVUI;
    const CDN = 'https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v2.2.0';
    if (!D.getElementById('nvui-css-tokens')) {
        const link = D.createElement('link'); link.id = 'nvui-css-tokens'; link.rel = 'stylesheet'; link.href = `${CDN}/tokens.css`; D.head.appendChild(link);
    }
    if (!D.getElementById('nvui-css-components')) {
        const link = D.createElement('link'); link.id = 'nvui-css-components'; link.rel = 'stylesheet'; link.href = `${CDN}/components.css`; D.head.appendChild(link);
    }
    if (!W.NVUI) {
        await new Promise((res, rej) => {
            const s = D.createElement('script'); s.id = 'nvui-js-api'; s.src = `${CDN}/nvui-api.js`; s.onload = res; s.onerror = rej; D.head.appendChild(s);
        });
    }
    return W.NVUI;
}

// 业务调用
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

### 2.2 作用域

给浮层根节点加 `nvui-scope`；需要浅色主题时叠加 `nvui-theme-light`；需要实心扁平（关闭玻璃）时叠加 `nvui-solid`：

```html
<div class="nvui-scope"> ... 深色玻璃（默认） ... </div>
<div class="nvui-scope nvui-theme-light"> ... 浅色玻璃 ... </div>
<div class="nvui-scope nvui-solid"> ... 深色实心扁平（无玻璃） ... </div>
<div class="nvui-scope nvui-theme-light nvui-solid"> ... 浅色实心扁平 ... </div>
```

三种根开关互相独立，可任意组合：

| 根类 | 作用 |
| :--- | :--- |
| `.nvui-scope` | 组件作用域 + 基础排版（`box-sizing` / `color` / 字号 / 行高）；必加 |
| `.nvui-theme-light` | 切换浅色令牌覆盖（定义在 `tokens.css` 末尾） |
| `.nvui-solid` | 实心扁平模式：全部玻璃表面回退为不透明 `--nvui-bg` / `--nvui-bg-2`，`backdrop-filter: none` |

### 2.3 弹窗骨架（含 top-layer 载体）

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
// 非模态 show()：不产生 inert，悬浮入口/其它弹窗仍可点击
const layer = document.getElementById('your_modal_layer');
const overlay = document.getElementById('your_overlay');
function openModal() {
    try { layer.show(); } catch (e) { layer.setAttribute('open', ''); } // 旧内核兜底
    overlay.hidden = false;            // 触发 .nvui-overlay 入场（nvui-overlay-in / nvui-modal-in）
}
function closeModal() {
    if (overlay.hidden || overlay.classList.contains('is-closing')) return;
    overlay.classList.add('is-closing'); // 触发退场（nvui-overlay-out / nvui-modal-out）
    const done = () => {
        overlay.hidden = true;
        overlay.classList.remove('is-closing');
        try { layer.close(); } catch (e) { layer.removeAttribute('open'); }
    };
    overlay.addEventListener('animationend', done, { once: true });
    setTimeout(done, 250);             // 兜底：动画被降级/中断时也能收尾
}
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });
```

弹窗的「焦点管理」是 `aria-modal="true"` 的必要配套（否则键盘用户仍能 Tab 到背景内容，读屏会失去上下文）：

```js
// 打开：记录触发元素，显示后把焦点移入弹窗（优先 [data-autofocus]，其次主按钮，再次标题）
let lastTrigger = null;
function focusIntoModal(modal) {
    const target = modal.querySelector('[data-autofocus], .nvui-btn.is-primary, .nvui-modal-title');
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus();
}

// Tab / Shift+Tab 焦点陷阱：在弹窗内可见控件之间循环，不逃逸到背景
function trapFocus(modal, e) {
    if (e.key !== 'Tab') return;
    const items = [...modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// 业务接入：
// openModal 中：lastTrigger = document.activeElement; ...显示后 focusIntoModal(modal);
//               modal.addEventListener('keydown', (e) => trapFocus(modal, e));
// closeModal 中：...隐藏后 lastTrigger?.focus(); lastTrigger = null;
```

> 仅写 `aria-modal="true"` 而不做焦点陷阱与焦点归还，等于把无障碍停留在标记层。完整的进出场时序与 CSS 对应关系见 [7.3 遮罩与弹窗](#73-遮罩与弹窗玻璃--进出场)。

> 为什么必须用 `<dialog>` 载体、为什么不能用 `showModal()`：见 [第 8 节](#8-sillytavern-宿主兼容红线) 第 1 条。

### 2.4 玻璃与降级说明

- 玻璃只用于浮层：`.nvui-overlay` / `.nvui-modal` / `.nvui-panel` / `.nvui-floating` / `.nvui-tooltip` / `.nvui-toast` / `.nvui-glass`。
- 弹窗级用 `--nvui-glass-bg`（`rgba(22, 26, 36, 0.64)`，背后有遮罩压暗，正文与次要文字双 AA）；直接叠在宿主上的 popover 级用 `--nvui-glass-bg-strong`（`rgba(22, 26, 36, 0.8)`，**只承诺正文 `--nvui-text` 的 AA**——popover 玻璃上的说明文字也用正文色，不要用 `--nvui-text-2`，见 [4.4](#44-aa-安全玻璃与合成对比度验算)）。
- **v2.2.0 描边精致化**：圆角玻璃表面（弹窗 / 面板 / 悬浮面板 / 工具提示 / 吐司 / `.nvui-glass`）**不再画 1px 外框描边**——圆角处的 1px 半透明描边在缩放/圆角边缘会出现亚像素锯齿；改用「柔和顶部受光（`--nvui-glass-highlight` 深 `rgba(255, 255, 255, 0.05)` / 浅 `rgba(255, 255, 255, 0.4)`）+ 阴影」成形。直线分隔（header / footer / 导航底边）保留 1px，改用 `--nvui-glass-line`（深 `rgba(255, 255, 255, 0.06)` / 浅 `rgba(255, 255, 255, 0.28)`）。
- 四层降级链（CSS 已内置，业务无需处理）：
  1. 浏览器不支持 `backdrop-filter`：`@supports not (...)` 回退为不透明表面；
  2. 用户系统开启"减少透明度"：`prefers-reduced-transparency: reduce` 回退为不透明表面；
  3. 强制颜色/高对比模式：`forced-colors: active` 用系统色 `CanvasText` 描边，去掉阴影与模糊；
  4. 用户不想要透明（或低性能设备）：给根节点加 `.nvui-solid` 实心模式。
- 窄屏（`max-width: 600px`）弹窗自动降档为 `--nvui-glass-blur-sm`（12px）降低移动端 GPU 开销，保留 `92dvh` 与安全区规则。

### 2.5 折叠面板新 DOM 骨架（v2 破坏性变更）

v2 的高度动画靠 `grid-template-rows: 0fr` 与 `1fr` 之间的过渡实现，因此 `nvui-acc-body` 内部**必须**再包一层 `.nvui-acc-inner`（负责 `min-height: 0`、`overflow: hidden` 与左右内边距；上下留白用内部伪元素实现，避免 padding 撑开 0fr 轨道）：

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

业务 JS 只切 `.nvui-acc.is-open` 与 `aria-expanded`，不要手写高度：

```js
head.addEventListener('click', () => {
    const open = acc.classList.toggle('is-open');
    head.setAttribute('aria-expanded', String(open));
});
```

> 从 v1.1.0 升级的插件必须把正文加一层 `<div class="nvui-acc-inner">`，否则展开内容会被 `0fr` 裁切成 0 高度。见 [10.3 迁移对照](#103-v110--v200-迁移对照)。

### 2.6 动效降级与「强制播放动效」演示开关

- `components.css` 全局尊重系统偏好：当操作系统/浏览器开启「减少动态效果」（`prefers-reduced-motion: reduce`）时，所有动画与过渡会被统一降级为 `0.01ms`（含 `animation-delay: 0.01ms`、`animation-iteration-count: 1`、`transition-duration: 0.01ms`）。**这是无障碍红线，不是 bug**：kit 必须优先尊重用户偏好，不能为了"好看"绕过它。
- 若本机长期处于「减少动态效果」设置（例如部分 Windows 系统），直接用浏览器打开 `preview.html` 会几乎看不到任何动效——标签粘连滑动、折叠高度过渡、弹窗/遮罩进出场、开关回弹、进度条扫光都会被系统降级。这是预期行为。
- 为便于演示与截图，`preview.html` 顶部提供「强制播放动效」开关（**仅演示用途，不属于 kit**）：
  - 开关会给 `<body>` 加 `pv-force-motion` 类；preview 的局部 CSS 在 `@media (prefers-reduced-motion: reduce)` 下对 `body.pv-force-motion` 覆盖 `animation-duration` / `animation-delay` / `animation-iteration-count` 与 `transition-duration`（spinner / skeleton / progress / status-dot 等循环动画恢复 `infinite`），只对演示生效；
  - 也支持 URL 参数 `?motion=1` 直接以强制模式打开（便于无头截图/录屏），可与 `?theme=light`、`?solid=1` 叠加，例如 `preview.html?theme=light&motion=1`；
  - 默认关闭；生产环境请保持系统偏好，不要把这个开关复制进插件。`pv-` 前缀样式只存在于预览页。

---

## 3. 设计原则

1. **扁平优先（Flat First）**：静态区块（按钮、折叠、徽标、输入、标签页、卡片）只靠色阶与间距表达层级，**不加 1px 描边、不加投影、不用渐变**。视觉边界靠 `--nvui-block-bg` / `--nvui-block-bg-2` 的填空表达，而不是给每个盒子画边。
2. **玻璃只用于浮层（Glass for Overlays Only）**：弹窗、遮罩、悬浮面板、工具提示、吐司、`.nvui-glass` 任意玻璃容器才允许用「半透明底 + `backdrop-filter` 模糊/饱和 + 柔和顶部受光 + 阴影」。**v2.2.0 起圆角玻璃不再画 1px 外框描边**（圆角处 1px 描边会有亚像素锯齿），靠背景 + 模糊 + 阴影 + 顶部内高光成形；弹窗级背后有遮罩压暗，popover 级直接叠宿主时必须用更强档（`--nvui-glass-bg-strong`）保证可读性。
3. **动效只表达层级/方向/因果（Meaningful Motion）**：动效只用来表达「从哪来、到哪去、谁包含谁」；所有动效必须可降级（尊重 `prefers-reduced-motion`，含 `animation-delay` 的清除），不能把关键信息只放在动画里。
4. **AA 安全玻璃**：玻璃不是装饰而是承载文字的表面。合成对比度按 sRGB 逐通道叠加计算，**最坏宿主背景**（深色主题宿主纯白 / 浅色主题宿主纯黑）下：**弹窗级玻璃**的正文 `--nvui-text` 与次要文字 `--nvui-text-2` 均必须 >= 4.5:1；**popover 级玻璃**只承诺正文 `--nvui-text` >= 4.5:1（v2.0.1 起强玻璃更透，0.80 档下 `text-2` 仅 3.53:1，故 popover 玻璃上的说明文字必须用正文色）；`--nvui-text-3` 只用于非关键提示。详见 [4.4](#44-aa-安全玻璃与合成对比度验算)。
5. **浮层自包含、主题可切换**：自有浮层用 kit 的深色令牌（或浅色覆盖），不依赖宿主主题变量；这样浅色/深色酒馆下观感一致、可预期。
6. **组件样式里出现 `#hex` / `rgb()` 视为缺陷（禁止硬编码颜色）**：颜色一律走 token；换色只改 token，不改组件。测试会扫描组件样式中的颜色字面量。
7. **唯一强调色 + 语义色各司其职**：紫罗兰是"可交互/当前选中"的唯一强调色；成功/注意/错误/进行中只用语义色，不用主色表达状态。
8. **层级靠表面与间距，不靠描边堆盒子**：`bg` → `bg-2` → `bg-3` → `block-bg` → `block-bg-2` 由深到浅分层；需要表达"浮起"时才用玻璃与阴影，静态区块一律扁平。
9. **可点区域要大方**：开关整行 label 可点；按钮最小高度 `--nvui-control-h`；图标按钮 28×28；触屏留足间距；动效不能挤占可点区域。
10. **收起态必须给摘要**：折叠分组右侧 `nvui-acc-summary` 是用户唯一线索，必须显示当前值。
11. **可访问性内建**：对比度达标（含玻璃合成对比度）、`focus-visible` 焦点环统一走 token（v2.2.0 起为**单圈 2px 整数像素**）、`aria-*` 语义、尊重 `prefers-reduced-motion` / `prefers-reduced-transparency` / `forced-colors`、读屏隐藏文本用 `.nvui-sr-only`。
12. **不污染宿主**：全部 `nvui-` 前缀、无裸元素选择器、无全局重置；`!important` 只用于对抗酒馆全局 checkbox 样式与动效降级。
13. **描边精致化（v2.2.0）**：描边只出现在必要处，且避免圆角锯齿——
    - **圆角玻璃一律无外框描边**（modal / panel / floating / tooltip / toast / glass 共 6 处不画 1px border），改用柔和顶部受光（`--nvui-glass-highlight`）+ 阴影成形；
    - **直线分隔保留 1px** 并改用玻璃分隔色 `--nvui-glass-line`（header / footer / 导航底边），直线不会产生圆角锯齿；
    - **ghost 按钮无描边**（改淡底 `--nvui-block-bg`）、**空态无虚线圆角边**（改淡底）、**标签指示器无 1px 内环**（改底部直线 `inset 0 -2px 0 var(--nvui-accent-line)`）；
    - **焦点环单圈 2px 整数像素**（`--nvui-focus-ring-w`），不叠内圈描边——既清晰可见，也避免"双描边"与亚像素虚边。
    其余 token 取值不变（分隔线 / 控件边仍为 v2.1.1 的最低对比）；滚动条隐藏但滚动能力保留（§12 面板标准）。

---

## 4. 配色规范

> `tokens.css` 共定义 **110 个** `--nvui-*` 令牌（深色默认，含 v2.0.x 新增的玻璃 7 / 焦点环 3 / 动效 12 / 骨架屏 2 / `--nvui-radius-xl` / `--nvui-on-accent`，v2.1.0 新增的面板尺寸 2：`--nvui-panel-width` / `--nvui-panel-max-h`，以及 v2.3.0 新增的层级 1：`--nvui-z-layer`），`.nvui-theme-light` 覆盖其中 **47 个**（含必须覆盖的 `--nvui-focus-ring-color`）。深/浅主题的玻璃、遮罩、阴影取值都经过合成对比度验算。

### 4.1 深色主题令牌（默认，`:root` / `.nvui-scope`）

**表面 / 背景**

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-bg` | `#161a24` | 弹窗 / 浮层本体表面（实心降级时的不透明底） |
| `--nvui-bg-2` | `#1c2130` | 次级面板、工具提示、悬浮面板（实心降级时的 popover 底） |
| `--nvui-bg-3` | `#232939` | 再深一档的分组底（少用） |
| `--nvui-block-bg` | `rgba(255, 255, 255, 0.05)` | 可点区块底（折叠分组、次级按钮） |
| `--nvui-block-bg-2` | `rgba(255, 255, 255, 0.078)` | 区块悬停 / 展开态 |
| `--nvui-input-bg` | `rgba(0, 0, 0, 0.22)` | 输入框底 |
| `--nvui-code-bg` | `rgba(0, 0, 0, 0.3)` | 行内代码底 |
| `--nvui-overlay-bg` | `rgba(6, 8, 14, 0.62)` | 弹窗遮罩（v2.0.1：玻璃更透，遮罩加深补偿 AA；纯白最坏宿主下弹窗级 10.33/4.70） |
| `--nvui-switch-off-bg` | `rgba(255, 255, 255, 0.34)` | 开关关闭态轨道（与页面背景非文本对比度 >= 3:1，WCAG 1.4.11） |
| `--nvui-knob` | `#ffffff` | 开关开启态滑钮 |
| `--nvui-knob-off` | `var(--nvui-text)` | 开关关闭态滑钮（浅灰，与轨道对比度 >= 3:1） |

**玻璃层（v2.0.0 新增 / v2.0.1 更透 / v2.1.1 减弱 / v2.2.0 圆角外框无描边）**

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-glass-bg` | `rgba(22, 26, 36, 0.64)` | 弹窗级玻璃（背后有遮罩压暗；纯白最坏宿主下 text 10.33 / text-2 4.70） |
| `--nvui-glass-bg-strong` | `rgba(22, 26, 36, 0.8)` | popover 级玻璃（直接叠在任意宿主上；纯白最坏只承诺正文 text 7.76，text-2 不承诺） |
| `--nvui-glass-line` | `rgba(255, 255, 255, 0.06)` | **玻璃表面内的直线分隔**（v2.2.0 起不再用于圆角外框；header/footer/导航底边等直线处使用，避免 1px 圆角锯齿） |
| `--nvui-glass-highlight` | `rgba(255, 255, 255, 0.05)` | 顶部柔和受光（被玻璃阴影 token 引用；替代 1px 外框，更平滑） |
| `--nvui-glass-blur` | `20px` | 弹窗级模糊半径 |
| `--nvui-glass-blur-sm` | `12px` | popover 级 / 窄屏降档模糊半径 |
| `--nvui-glass-saturate` | `150%` | 玻璃背后色彩的饱和度提升 |

**焦点环（v2.0.0 新增，统一 `:focus-visible`）**

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-focus-ring-color` | `var(--nvui-accent)` | 焦点环颜色（浅色主题必须覆盖，否则会继承深色 accent） |
| `--nvui-focus-ring-w` | `2px` | 焦点环宽度（v2.2.0：1.5px → **2px 整数像素**单圈，缩放更清晰，不再叠加内圈描边） |
| `--nvui-focus-ring-offset` | `2px` | 焦点环外扩距离（折叠标题用负值内缩，避免被裁） |

**分隔线**

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-line` | `rgba(255, 255, 255, 0.05)` | 常规分隔 / 头部底边（v2.1.1 再减弱） |
| `--nvui-line-2` | `rgba(255, 255, 255, 0.08)` | 强调边界（扁平化后仅用于 ghost 按钮等极少数场景；v2.1.1 再减弱） |
| `--nvui-dash` | `rgba(255, 255, 255, 0.14)` | 虚线空态 / 检查中（v2.1.1 再减弱） |
| `--nvui-block-line` | `rgba(255, 255, 255, 0.04)` | 区块内发丝线（v2.1.1 再减弱） |
| `--nvui-block-line-2` | `rgba(255, 255, 255, 0.07)` | 控件内嵌描边（输入框 inset 阴影；v2.1.1 再减弱） |

**文字**

| Token | 值 | 对比度（on `--nvui-bg`） | 用途 |
| :--- | :--- | :--- | :--- |
| `--nvui-text` | `#e9ecf3` | 14.71:1 | 正文、标题 |
| `--nvui-text-2` | `#98a1b3` | 6.70:1 | 次要说明、开关行标题、状态行 |
| `--nvui-text-3` | `#7d879b` | 4.81:1 | 提示性小字、摘要、占位符（仅非关键信息） |

> `--nvui-text-3` 相对 novel-stream v1.17.x 的实现值 `#6c7487`（3.72:1）**提亮一档**以满足 WCAG AA；旧插件若要完全还原可覆盖该 token，但**规范推荐用新值**。

**主色（唯一强调色）**

| Token | 值 | 对比度 | 用途 |
| :--- | :--- | :--- | :--- |
| `--nvui-accent` | `#8b6dff` | 4.75:1（on bg） | 开关轨道、选中填充、焦点环颜色 |
| `--nvui-accent-2` | `#a997ff` | 7.09:1（on bg） | 图标、强调文字 |
| `--nvui-accent-strong` | `#6d4df2` | **白字 5.26:1** | **填充按钮底**（满足 AA） |
| `--nvui-accent-strong-hover` | `#5b3fd6` | 白字 6.72:1 | 填充按钮悬停（纯色加深，v2 不再发光） |
| `--nvui-on-accent` | `#ffffff` | 白字 5.26:1（on `--nvui-accent-strong`） | 主色填充上的文字/图标色（v2 独立 token：主按钮不再借用开关滑钮 `--nvui-knob`，消除语义耦合） |
| `--nvui-accent-bg` | `rgba(139, 109, 255, 0.14)` | - | 主色淡底（选中的标签页、次级按钮） |
| `--nvui-accent-bg-hover` | `rgba(139, 109, 255, 0.24)` | - | 主色淡底悬停 |
| `--nvui-accent-line` | `rgba(139, 109, 255, 0.4)` | - | 主色描边（徽标/输入焦点内边框） |

> 注意：旧实现主按钮用 `--nvui-accent` + 白字（3.67:1）不达 AA；规范改为 `--nvui-accent-strong`。视觉仍是同一紫罗兰色系。v2 主按钮的 hover 只加深底色 + 内高光，不再使用 `--nvui-shadow-accent`（已删除）。

**语义色（每个都配 bg/line 派生，组件不得自行调透明度）**

| Token | 值 | 对比度（on bg） | 语义 |
| :--- | :--- | :--- | :--- |
| `--nvui-ok` | `#4ade80` | 9.98:1 | 成功 / 已就绪 |
| `--nvui-ok-bg` | `rgba(74, 222, 128, 0.12)` | - | 成功淡底 |
| `--nvui-ok-line` | `rgba(74, 222, 128, 0.35)` | - | 成功描边 |
| `--nvui-warn` | `#fbbf24` | 10.42:1 | 需要注意 / 超限提示 |
| `--nvui-warn-bg` | `rgba(251, 191, 36, 0.12)` | - | 注意淡底 |
| `--nvui-warn-line` | `rgba(251, 191, 36, 0.35)` | - | 注意描边 |
| `--nvui-danger` | `#f87171` | 6.29:1 | 错误 / 危险操作 |
| `--nvui-danger-bg` | `rgba(248, 113, 113, 0.12)` | - | 错误淡底 |
| `--nvui-danger-line` | `rgba(248, 113, 113, 0.35)` | - | 错误描边 |
| `--nvui-info` | `#3498db` | 5.52:1 | 进行中 / 信息 |
| `--nvui-info-bg` | `rgba(52, 152, 219, 0.12)` | - | 信息淡底 |
| `--nvui-info-line` | `rgba(52, 152, 219, 0.35)` | - | 信息描边 |

### 4.2 浅色主题（`.nvui-theme-light`，47 个覆盖）

在容器上叠加 `.nvui-theme-light` 即可整体切换。所有组件只消费 token，因此**不需要为浅色写第二套组件样式**。

**表面 / 玻璃（15 个）**

| Token | 浅色值 | 说明 |
| :--- | :--- | :--- |
| `--nvui-bg` | `#f7f8fc` | 弹窗/浮层表面 |
| `--nvui-bg-2` | `#eef1f8` | 次级面板 |
| `--nvui-bg-3` | `#e5e9f3` | 分组底 |
| `--nvui-block-bg` | `rgba(15, 23, 42, 0.035)` | 可点区块底 |
| `--nvui-block-bg-2` | `rgba(15, 23, 42, 0.06)` | 悬停/展开态 |
| `--nvui-input-bg` | `rgba(255, 255, 255, 0.9)` | 输入框底 |
| `--nvui-code-bg` | `rgba(15, 23, 42, 0.06)` | 行内代码底 |
| `--nvui-overlay-bg` | `rgba(15, 23, 42, 0.3)` | 遮罩（v2 新值） |
| `--nvui-switch-off-bg` | `rgba(15, 23, 42, 0.47)` | 开关关闭态轨道（与页面背景非文本对比度 >= 3:1，WCAG 1.4.11） |
| `--nvui-knob` | `#ffffff` | 开关开启态滑钮 |
| `--nvui-knob-off` | `#ffffff` | 开关关闭态滑钮（浅色下也是白，靠轨道底色区分） |
| `--nvui-glass-bg` | `rgba(255, 255, 255, 0.78)` | 弹窗级玻璃（纯黑最坏 9.31/4.64，双 AA） |
| `--nvui-glass-bg-strong` | `rgba(255, 255, 255, 0.8)` | popover 级玻璃（纯黑最坏 9.66/4.81，双 AA；v2.0.1 从 0.88 下调更透） |
| `--nvui-glass-line` | `rgba(255, 255, 255, 0.28)` | 玻璃表面内的直线分隔（v2.2.0：不再用于圆角外框） |
| `--nvui-glass-highlight` | `rgba(255, 255, 255, 0.4)` | 顶部柔和受光（v2.2.0 替代 1px 外框） |

**分隔线 / 文字 / 主色 / 语义（5 + 3 + 7 + 12 = 27 个）**

| Token | 浅色值 | 对比度 / 说明 |
| :--- | :--- | :--- |
| `--nvui-line` | `rgba(15, 23, 42, 0.06)` | 常规分隔（v2.1.1 再减弱） |
| `--nvui-line-2` | `rgba(15, 23, 42, 0.10)` | 强调边界（v2.1.1 再减弱） |
| `--nvui-dash` | `rgba(15, 23, 42, 0.18)` | 虚线空态（v2.1.1 再减弱） |
| `--nvui-block-line` | `rgba(15, 23, 42, 0.045)` | 区块发丝线（v2.1.1 再减弱） |
| `--nvui-block-line-2` | `rgba(15, 23, 42, 0.07)` | 控件内嵌描边（v2.1.1 再减弱） |
| `--nvui-text` | `#1f2430` | 14.62:1 |
| `--nvui-text-2` | `#4a5365` | 7.28:1 |
| `--nvui-text-3` | `#5f6879` | 5.29:1 |
| `--nvui-accent` | `#6d4df2` | 4.95:1 |
| `--nvui-accent-2` | `#5b3fd6` | 6.33:1 |
| `--nvui-accent-strong` | `#6d4df2` | 白字 5.26:1 |
| `--nvui-accent-strong-hover` | `#5b3fd6` | 白字 6.72:1 |
| `--nvui-accent-bg` | `rgba(109, 77, 242, 0.12)` | 主色淡底 |
| `--nvui-accent-bg-hover` | `rgba(109, 77, 242, 0.2)` | 主色淡底悬停 |
| `--nvui-accent-line` | `rgba(109, 77, 242, 0.4)` | 主色描边 |
| `--nvui-ok` | `#15803d` | 4.73:1 |
| `--nvui-ok-bg` | `rgba(21, 128, 61, 0.1)` | 成功淡底 |
| `--nvui-ok-line` | `rgba(21, 128, 61, 0.32)` | 成功描边 |
| `--nvui-warn` | `#b45309` | 4.73:1 |
| `--nvui-warn-bg` | `rgba(180, 83, 9, 0.1)` | 注意淡底 |
| `--nvui-warn-line` | `rgba(180, 83, 9, 0.32)` | 注意描边 |
| `--nvui-danger` | `#dc2626` | 4.55:1 |
| `--nvui-danger-bg` | `rgba(220, 38, 38, 0.09)` | 错误淡底 |
| `--nvui-danger-line` | `rgba(220, 38, 38, 0.3)` | 错误描边 |
| `--nvui-info` | `#1d4ed8` | 6.31:1 |
| `--nvui-info-bg` | `rgba(29, 78, 216, 0.09)` | 信息淡底 |
| `--nvui-info-line` | `rgba(29, 78, 216, 0.3)` | 信息描边 |

**焦点环 / 骨架屏 / 阴影（1 + 2 + 2 = 5 个）**

| Token | 浅色值 | 说明 |
| :--- | :--- | :--- |
| `--nvui-focus-ring-color` | `var(--nvui-accent)` | **必须覆盖**，否则会继承深色主题的 accent 值 |
| `--nvui-skeleton-bg` | `rgba(15, 23, 42, 0.05)` | 骨架屏底 |
| `--nvui-skeleton-shine` | `rgba(15, 23, 42, 0.1)` | 骨架屏扫光 |
| `--nvui-shadow-modal` | `0 16px 40px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.1), inset 0 1px 0 var(--nvui-glass-highlight)` | 弹窗玻璃阴影（浅色环境投影） |
| `--nvui-shadow-pop` | `0 10px 26px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.08), inset 0 1px 0 var(--nvui-glass-highlight)` | popover 玻璃阴影 |

> `--nvui-on-accent` 是两主题共用值（`#ffffff`），浅色主题不重复覆盖、直接继承深色声明，因此浅色覆盖数保持 47 个；`--nvui-knob-off` 在浅色下同为白色滑钮，靠 `--nvui-switch-off-bg` 的轨道底色区分（白滑钮与轨道对比度 >= 3:1）。

### 4.3 配色使用规则

- **Do**：正文/标题用 `--nvui-text`；解释性文字用 `--nvui-text-2`；提示小字用 `--nvui-text-3`（不要用它承载关键信息）。
- **Do**：未选中控件用 `text-2` / `block-bg`；选中/激活统一用主色系（accent / accent-bg / accent-line）；主色即"可交互、当前"。
- **Do**：语义色只做语义：ok=成功、warn=注意/超限、danger=错误/破坏性操作、info=进行中。语义色的淡底/描边用配套 `-bg` / `-line` token，不要自己写透明度。
- **Do**：玻璃表面上的正文/次要文字一律用 `--nvui-text` / `--nvui-text-2`；`--nvui-text-3` 只用于非关键提示（玻璃合成后的对比度不保证达标）。
- **Do**：非文本对比度按 WCAG 1.4.11 保证：开关关闭态轨道与页面背景 >= 3:1、滑钮与轨道 >= 3:1、焦点环与相邻背景 >= 3:1、玻璃受光边只做装饰不承担信息表达。
- **Don't**：用主色表示错误或警告（用户会误以为可点）；用 danger 做装饰。
- **Don't**：在一个视图里同时出现两种强调色；需要更多区分时用表面层级 / 字号 / 图标，而不是加色。
- **Don't**：在组件样式里硬编码颜色；也不要直接引用酒馆的 `--SmartTheme*` 变量（kit 浮层要跨主题一致）。**禁止硬编码颜色**是测试守护的硬红线。

### 4.4 AA 安全玻璃与合成对比度验算

玻璃是半透明表面，实际可读性取决于「下层是什么」。规范按**最坏情况**验算：合成颜色按 sRGB 逐通道 alpha 叠加（`result = fg * a + bg * (1 - a)`），再按 WCAG 2.1 相对亮度公式计算对比度。

**深色主题**（文字 `--nvui-text` `#e9ecf3` / `--nvui-text-2` `#98a1b3`）：

| 层级 | 合成路径（宿主最坏情况） | text 对比度 | text-2 对比度 | 结论 |
| :--- | :--- | :--- | :--- | :--- |
| 弹窗级 | 纯白 `#ffffff` → `--nvui-overlay-bg` `rgba(6, 8, 14, 0.62)` → `--nvui-glass-bg` `rgba(22, 26, 36, 0.64)` | 10.33:1 | 4.70:1 | 双 AA 达标 |
| popover 级 | 纯白 `#ffffff` → `--nvui-glass-bg-strong` `rgba(22, 26, 36, 0.8)` | 7.76:1 | 3.53:1 | 只承诺正文 AA；次要文字改用 `--nvui-text` |

**浅色主题**（文字 `--nvui-text` `#1f2430` / `--nvui-text-2` `#4a5365`）：

| 层级 | 合成路径（宿主最坏情况） | text 对比度 | text-2 对比度 | 结论 |
| :--- | :--- | :--- | :--- | :--- |
| 弹窗级 | 纯黑 `#000000` → `--nvui-overlay-bg` `rgba(15, 23, 42, 0.3)` → `--nvui-glass-bg` `rgba(255, 255, 255, 0.78)` | 9.31:1 | 4.64:1 | 双 AA 达标 |
| popover 级 | 纯黑 `#000000` → `--nvui-glass-bg-strong` `rgba(255, 255, 255, 0.8)` | 9.66:1 | 4.81:1 | 双 AA 达标 |

> 口径说明：表格按「深色主题宿主纯白 / 浅色主题宿主纯黑」的最坏情况计算；若宿主是典型深色（`#161a24`），浅色弹窗级为 9.70/4.83（更宽松，仅作参考）。

**v2.0.1 AA 政策（相对 v2.0.0 的重要变化）**

1. **弹窗级玻璃**（`.nvui-modal`，背后有遮罩压暗）：正文 `--nvui-text` 与次要文字 `--nvui-text-2` 都承诺 >= 4.5:1，可正常用 `text-2` 写说明。
2. **popover 级玻璃**（`.nvui-floating` / `.nvui-tooltip` / `.nvui-toast` / `.nvui-glass`，直接用 `--nvui-glass-bg-strong`）：v2.0.1 起玻璃更透（0.80），**只承诺正文 `--nvui-text` >= 4.5:1**；`--nvui-text-2` 仅 3.53:1 不达标。因此 popover 玻璃组件上的文字（含次要说明）一律用 `--nvui-text`——kit 已把 `.nvui-tooltip` 的 `color` 从 `text-2` 改为 `text`；业务自建 popover 玻璃也照此处理。需要正文+次要说明都 AA 时，请把内容放进弹窗（遮罩后）或改用实心底。
3. `--nvui-text-3` 只用于非关键装饰提示，任何玻璃表面都不用它承载信息。
4. 修改任何玻璃/遮罩/文字取值，必须重跑 `test/test-ui-kit.js` 的「玻璃 AA 合成对比度」检查，并同步更新本表与 `CHANGELOG.md`。
5. 不支持玻璃的降级路径回退到不透明 `--nvui-bg` / `--nvui-bg-2`，这些表面的对比度在 4.1 已逐项验算，不再重复。

---

## 5. 文字与排版

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-fs-2xs` | `10px` | 计数角标（chip count） |
| `--nvui-fs-xs` | `11px` | 版本号、状态时间、次要元信息 |
| `--nvui-fs-sm` | `12px` | 说明、提示、状态行、默认按钮、吐司 |
| `--nvui-fs-md` | `13px` | 设置面板默认正文、折叠标题、标签页 |
| `--nvui-fs-lg` | `14px` | 弹窗正文（桌面） |
| `--nvui-fs-xl` | `15px` | 弹窗正文（窄屏） |
| `--nvui-fs-2xl` | `16px` | 大标题（弹窗标题变体、结果页） |
| `--nvui-fw-regular` | `400` | 摘要、普通说明 |
| `--nvui-fw-medium` | `500` | 按钮 |
| `--nvui-fw-semibold` | `600` | 折叠标题、选中标签页 |
| `--nvui-fw-bold` | `700` | 区块标题、弹窗标题 |
| `--nvui-lh-tight` | `1.4` | 按钮、标签、输入框 |
| `--nvui-lh-normal` | `1.5` | 正文、状态行、吐司 |
| `--nvui-lh-relaxed` | `1.6` | 说明小字、告警、工具提示 |
| `--nvui-lh-loose` | `1.8` | 弹窗正文（长文阅读） |

规则：

- 字体一律 `font-family: inherit`，沿用酒馆主题字体，kit 不自带字体。
- 中文正文不做字间距（`letter-spacing`），仅区块标题可用 `0.5px` 拉开层级。
- 一屏内字号层级不超过 3 档；数字（计数、上限）右对齐。
- 长文本用 `word-break: break-word`；文件名/路径用 `.nvui-code` 或等宽栈。
- 玻璃/告警/吐司上的文字对比度必须满足 [4.4](#44-aa-安全玻璃与合成对比度验算) 的 AA 结论。

---

## 6. 尺寸、间距、圆角、阴影、动效、层级

### 6.1 间距（4px 基准）

| Token | 值 | Token | 值 |
| :--- | :--- | :--- | :--- |
| `--nvui-space-05` | `2px` | `--nvui-space-25` | `10px` |
| `--nvui-space-1` | `4px` | `--nvui-space-3` | `12px` |
| `--nvui-space-15` | `6px` | `--nvui-space-4` | `16px` |
| `--nvui-space-2` | `8px` | `--nvui-space-5` | `20px` |
| | | `--nvui-space-6` | `24px` |

### 6.2 圆角

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-radius-xs` | `6px` | 行内代码、小提示、徽标内元素 |
| `--nvui-radius-sm` | `8px` | 输入框、按钮、工具提示 |
| `--nvui-radius` | `12px` | 折叠分组、空态、卡片 |
| `--nvui-radius-lg` | `16px` | 悬浮面板、吐司、`.nvui-glass`、窄屏弹窗 |
| `--nvui-radius-xl` | `20px` | **弹窗**（v2 新增：更大圆角让玻璃边缘更柔和） |
| `--nvui-radius-pill` | `999px` | 胶囊：开关、徽标、标签页、悬浮药丸、进度条 |

### 6.3 阴影（v2：只服务浮层，玻璃阴影 = 环境投影 + 内高光）

v2.0.0 起，阴影只允许出现在浮层（弹窗 / 悬浮面板 / 工具提示 / 吐司 / `.nvui-glass`），静态区块不允许加投影。阴影统一由「环境投影 + 顶部 1px 内高光」组成，内高光引用 `--nvui-glass-highlight`，让玻璃边缘看起来受光。

| Token | 深色值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-shadow-modal` | `0 16px 48px rgba(0, 0, 0, 0.42), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 var(--nvui-glass-highlight)` | 弹窗 |
| `--nvui-shadow-pop` | `0 10px 30px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.25), inset 0 1px 0 var(--nvui-glass-highlight)` | 悬浮面板、工具提示、吐司、`.nvui-glass` |

> **已删除 `--nvui-shadow-accent`**（v1.1.0 的主按钮悬停光晕）。原因：投影发光与「扁平优先」目标冲突——静态按钮不应产生"浮起"错觉；v2 主按钮 hover 改为纯色加深（`--nvui-accent-strong-hover`）+ 内高光。旧插件若仍引用该 token，升级到 v2 后引用会失效（声明整体被删除，不是置空），需一并删掉相关声明，详见 [10.3 迁移对照](#103-v110--v200-迁移对照)。

### 6.4 动效（v2 体系：时长 / 缓动 / 组合 / 循环 / 位移）

#### 6.4.1 时长

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-duration-fast` | `120ms` | 颜色、背景、transform 按压缩放等微反馈（默认） |
| `--nvui-duration-base` | `200ms` | 淡入、遮罩进出、吐司退场、标签页激活 |
| `--nvui-duration-slow` | `320ms` | 弹窗入场、折叠高度、吐司入场、位移入场 |

#### 6.4.2 缓动

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 通用过渡：颜色、透明度、遮罩 |
| `--nvui-ease-emphasized` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | 位移/高度/进出场（有明确方向感） |
| `--nvui-ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 需要回弹的反馈：开关滑钮、吐司、pop-in、标签页 |

#### 6.4.3 组合 / 循环 / 位移

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-transition` | `var(--nvui-duration-fast) var(--nvui-ease-standard)` | 兼容 v1 的组合过渡令牌（v2 改为引用上面的时长/缓动） |
| `--nvui-transition-slow` | `var(--nvui-duration-slow) var(--nvui-ease-emphasized)` | 折叠背景、箭头旋转等慢过渡 |
| `--nvui-spin-duration` | `0.8s` | 加载环旋转周期 |
| `--nvui-shimmer-duration` | `1.4s` | 骨架屏扫光 / 不确定进度条循环周期 |
| `--nvui-pulse-duration` | `1.8s` | 状态点呼吸周期 |
| `--nvui-stagger-step` | `45ms` | `.nvui-stagger` 子项延迟步长 |
| `--nvui-enter-distance` | `10px` | 入场位移距离（slide-up 的 translateY 起点） |

#### 6.4.4 关键帧清单（16 个，全部 `nvui-` 前缀且必须被引用）

| 关键帧 | 使用方 | 变化属性 | 说明 |
| :--- | :--- | :--- | :--- |
| `nvui-spin` | `.nvui-spinner` | `transform` | 加载环旋转（保留 v1） |
| `nvui-fade-in` | `.nvui-fade-in`、`.nvui-tooltip` | `opacity` | 纯淡入 |
| `nvui-slide-up` | `.nvui-slide-up`、`.nvui-stagger > *` | `opacity` + `transform` | 淡入 + 上移 `--nvui-enter-distance` |
| `nvui-pop-in` | `.nvui-pop-in` | `opacity` + `transform` | 缩放 0.94 → 1 淡入 |
| `nvui-overlay-in` | `.nvui-overlay` | `opacity` | 遮罩入场 |
| `nvui-overlay-out` | `.nvui-overlay.is-closing` | `opacity` | 遮罩退场 |
| `nvui-modal-in` | `.nvui-overlay:not([hidden]) .nvui-modal` | `opacity` + `transform` | 弹窗入场（上移 14px + 0.97 缩放 + 淡入） |
| `nvui-modal-out` | `.nvui-overlay.is-closing .nvui-modal` | `opacity` + `transform` | 弹窗退场（下沉 8px + 0.98 缩放 + 淡出） |
| `nvui-toast-in` | `.nvui-toast` | `opacity` + `transform` | 吐司入场（上移 16px + 0.98 缩放） |
| `nvui-toast-out` | `.nvui-toast.is-closing` | `opacity` + `transform` | 吐司退场（下沉 10px + 0.98 缩放） |
| `nvui-tab-select` | `.nvui-tab.is-active` | `opacity` + `transform` | 标签页激活弹跳（0.94 → 1） |
| `nvui-tabpane-in` | `.nvui-tabpane.is-active` | `opacity` + `transform` | **v2.0.1 新增**：标签面板入场（淡入 + 上移 6px） |
| `nvui-switch-on` | `.nvui-switch-row input[type="checkbox"]:checked` | `transform` | **v2.0.1 新增**：开关勾选轨道回弹（0.92 → 1.04 → 1） |
| `nvui-shimmer` | `.nvui-skeleton::after`、`.nvui-progress-bar::after` | `transform` | 骨架屏 / 进度条扫光（`translateX(-100%)` → `100%`） |
| `nvui-progress-indeterminate` | `.nvui-progress.is-indeterminate .nvui-progress-bar` | `transform` | 不确定进度循环平移 + `scaleX` 呼吸（0.6 → 1 → 0.8） |
| `nvui-pulse` | `.nvui-pulse`、`.nvui-status-dot.is-live` | `opacity` + `transform` | 呼吸（1 → 0.55 / 0.72 → 1） |

#### 6.4.5 「只做合成友好动画」规则

- 动画只允许改 `opacity` / `transform` / `filter` 等合成友好属性；**不改 `width` / `height` / `top` / `left` / `margin`**，避免触发布局与重绘。
- 例外：折叠面板用 `grid-template-rows` 过渡（需要真实高度动画），进度条宽度用 `width` 过渡（业务驱动、低频、非循环）；骨架屏扫光与不确定进度条一律用 `transform` 平移，不改宽。
- 所有循环动画时长必须走 token（`--nvui-shimmer-duration` / `--nvui-pulse-duration` / `--nvui-spin-duration`）。
- 颜色过渡用 `--nvui-transition`；方向性动画用 `--nvui-ease-emphasized`；回弹用 `--nvui-ease-spring`，不要所有地方都上弹簧。
- 同一屏同时运行的循环动画不超过 2 个；`stagger` 只给列表入场用，不用于循环。
- 所有动效必须在 `prefers-reduced-motion: reduce` 下降级（`components.css` 末尾统一处理，含 `animation-delay`）。

### 6.5 组件尺寸

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-control-h` | `32px` | 按钮 / 输入框统一最小高度 |
| `--nvui-switch-w` | `36px` | 胶囊开关轨道宽 |
| `--nvui-switch-h` | `21px` | 胶囊开关轨道高 |
| `--nvui-switch-knob` | `15px` | 滑钮直径 |
| `--nvui-switch-knob-offset` | `2px` | 滑钮距轨道内边 |
| `--nvui-switch-knob-on` | `15px` | 勾选态滑钮右移距离 |
| `--nvui-modal-width` | `680px` | 弹窗最大宽度 |
| `--nvui-modal-max-h` | `80vh` | 弹窗最大高度（窄屏为 `92dvh`） |
| `--nvui-panel-width` | `880px` | 插件面板最大宽度（`min(--nvui-panel-width, 100%)`；v2.1.0 新增） |
| `--nvui-panel-max-h` | `88vh` | 插件面板最大高度（桌面；手机底部抽屉为 `92dvh`；v2.1.0 新增） |

### 6.6 层级

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--nvui-z-layer` | `1000000` | **top-layer 载体档**（`dialog.nvui-tl` 自身）。非模态 `show()` 不进浏览器 top layer，层级完全由本档位保证；必须高于宿主一切正 z-index 表面（酒馆竞争上限约 29999） |
| `--nvui-z-floating` | `1000010` | 悬浮入口 / 悬浮面板 |
| `--nvui-z-overlay` | `1000020` | 弹窗遮罩 |
| `--nvui-z-tooltip` | `1000030` | 工具提示、吐司堆栈（最上层） |

> **实测真相（勿凭直觉改）**：非模态 `dialog.show()` 不进浏览器 top layer——top layer 只服务于 `showModal()` 的模态对话框（其 `inert` 会废掉宿主交互，故 kit 禁用）。载体的实际层级由它自身的 `z-index: var(--nvui-z-layer)` 决定，与普通 fixed div 平等；酒馆 `#sheld`（`position:absolute; z-index:30`）会整块盖住没有档位的载体。吐司堆栈使用 `--nvui-z-tooltip`，放进 `dialog.nvui-tl` 载体（见 [7.14](#714-吐司)）。

---

## 7. 组件规范

> 每个组件都可在 [`preview.html`](preview.html) 中看到实际效果（含深/浅主题、玻璃/实心模式）。以下只列结构、状态与规则，样式细节以 `components.css` 为准。
> 面板级排列标准（电脑居中面板 / 手机底部抽屉 + 底部图标导航）见 [第 12 章](#12-sillytavern-插件面板布局标准桌面--手机)。

### 7.1 作用域与基础

- `.nvui-scope`：浮层根节点必加。设置 `box-sizing`、`color`、基础字号/行高；其所有后代统一 `border-box`。
- `.nvui-sr-only`：读屏专用隐藏文本（不要用 `display:none`）。
- `.nvui-theme-light`：浅色主题覆盖类（与 `.nvui-scope` 叠加使用）。

### 7.2 玻璃工具类 `.nvui-glass` 与实心模式 `.nvui-solid`

**`.nvui-glass`**：给任意容器套一层 popover 级玻璃（默认 strong 档 + `--nvui-radius-lg` + 内边距）。

```html
<div class="nvui-glass">普通玻璃面板（strong 档 0.80；popover 级只承诺正文 text 的 AA）</div>
<div class="nvui-glass is-subtle">轻玻璃面板（弹窗级 0.64 + 小档模糊，需保证底下有压暗层）</div>
```

| 类名 / 状态 | 说明 |
| :--- | :--- |
| `.nvui-glass` | 默认使用 `--nvui-glass-bg-strong`（0.80）+ `--nvui-glass-blur` + `--nvui-shadow-pop`；**v2.2.0 起无外框 1px 描边**（柔和顶部受光 + 阴影成形，避免圆角锯齿）；文字用 `--nvui-text` |
| `.nvui-glass.is-subtle` | 使用 `--nvui-glass-bg`（0.64）+ `--nvui-glass-blur-sm`，去掉阴影（适合叠在已有遮罩/深色画布上的次级面板） |

**`.nvui-solid`**：根节点开关（加在 `<body class="nvui-scope nvui-solid">` 或浮层根上），把**全部**玻璃表面回退为不透明表面：

| 表面 | 实心模式下的表现 |
| :--- | :--- |
| `.nvui-overlay` | `backdrop-filter: none`（保留遮罩底色） |
| `.nvui-modal` | 背景改 `--nvui-bg`，`backdrop-filter: none` |
| `.nvui-floating` / `.nvui-tooltip` / `.nvui-toast` / `.nvui-glass` | 背景改 `--nvui-bg-2`，`backdrop-filter: none` |

**能力降级（`components.css` 已内置，业务无需处理）**

| 降级条件 | 行为 |
| :--- | :--- |
| 不支持 `backdrop-filter` | `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))`：玻璃表面回退不透明（弹窗 `--nvui-bg`，popover 级 `--nvui-bg-2`） |
| 用户减少透明度 | `@media (prefers-reduced-transparency: reduce)`：同上回退不透明 + `backdrop-filter: none` |
| 强制颜色模式 | `@media (forced-colors: active)`：玻璃表面加 `border: 1px solid CanvasText`，去阴影、去模糊 |
| 窄屏（`max-width: 600px`） | 弹窗模糊降档为 `--nvui-glass-blur-sm`，保留 `92dvh` 安全区规则 |
| 用户主动关闭玻璃 | 根节点加 `.nvui-solid` |

> 使用 `.nvui-glass` 时，若容器直接叠在任意宿主背景上，**必须**用默认 strong 档；只有确认底下已有遮罩/深色画布时才能用 `.is-subtle`，否则无法保证正文 AA。无论哪种档位，popover 玻璃上的次要说明都用 `--nvui-text`（见 [4.4](#44-aa-安全玻璃与合成对比度验算)）。

### 7.3 遮罩与弹窗（玻璃 + 进出场）

结构：`dialog.nvui-tl > .nvui-overlay > .nvui-modal > (.nvui-modal-header + .nvui-modal-body + .nvui-modal-footer)`

| 类名 | 说明 |
| :--- | :--- |
| `dialog.nvui-tl` | top-layer 载体：fixed 铺满视口（`100dvh`）、`z-index: var(--nvui-z-layer)`（非模态无 top layer 提升，档位即生命线）、`pointer-events: none`、未 `show()` 时 `display:none`；子浮层恢复 `pointer-events: auto` |
| `.nvui-overlay` | 全屏遮罩：flex 居中、`--nvui-overlay-bg` 底 + 磨砂模糊（`--nvui-glass-blur-sm`）；`hidden` 属性即可隐藏 |
| `.nvui-modal` | 弹窗本体：`--nvui-glass-bg` 玻璃、`--nvui-radius-xl` 圆角、`--nvui-shadow-modal`；**v2.2.0 起移除圆角外框 1px 描边**（改用柔和顶部受光 + 阴影成形，避免锯齿） |
| `.nvui-modal-header` | 头部：标题 + 右侧操作区，底部**直线分隔**（`--nvui-glass-line`，1px 直线不生锯齿），不可被压缩 |
| `.nvui-modal-title` | 标题（内联 flex）；`.is-lg` 为大标题变体；内嵌图标用主色 2 |
| `.nvui-modal-ver` | 版本号胶囊（`fs-xs`、淡底） |
| `.nvui-modal-actions` | 头部右侧操作区（图标按钮组） |
| `.nvui-modal-body` | 正文区：可滚动、`overscroll-behavior: contain`、长文行高 1.8；窄屏字号升到 `--nvui-fs-xl`；**v2.1.1 起隐藏滚动条但保留滚动能力**（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`） |
| `.nvui-modal-footer` | 底部操作区：右对齐按钮组，顶部**直线分隔**（`--nvui-glass-line`） |
| `.nvui-icon-btn` | 28×28 方形图标按钮（关闭、更多）；hover 加底色、`active` 缩放 0.92、带 focus-visible 焦点环 |

**进出场 CSS 与 JS 配方（必须成对使用）**

| 阶段 | CSS 事实 | JS 动作 |
| :--- | :--- | :--- |
| 打开 | `.nvui-overlay` 自身播放 `nvui-overlay-in`；`.nvui-overlay:not([hidden]) .nvui-modal` 播放 `nvui-modal-in`（上移 14px + 0.97 缩放 + 淡入） | `dialog.show()`（兜底 `setAttribute('open','')`）→ `overlay.hidden = false` |
| 关闭 | `.nvui-overlay.is-closing` 播放 `nvui-overlay-out`；`.nvui-overlay.is-closing .nvui-modal` 播放 `nvui-modal-out` | `overlay.classList.add('is-closing')` → 等 `overlay` 的 `animationend`（或 250ms 兜底）→ `overlay.hidden = true` → 移除 `is-closing` → `dialog.close()` |

- 关闭规则必须同时支持 Esc 与点遮罩（点遮罩判定 `e.target === overlay`）。
- 不要用 `showModal()`：会给文档加 `inert`，悬浮入口/其它弹窗全部点不到（见第 8 节第 1 条）。
- 业务 JS 不要自己写 `display:none` 收尾，否则退场动画会被跳过。
- **焦点管理（v2 可访问性配套）**：打开时记录 `document.activeElement` 作为归还目标，把焦点移入弹窗（优先 `[data-autofocus]`，其次主按钮，再次 `.nvui-modal-title`，后者临时 `tabindex="-1"`）；Tab / Shift+Tab 在弹窗内可见控件之间循环（焦点陷阱）；关闭后把焦点归还触发元素。最小实现见 [2.3 弹窗骨架](#23-弹窗骨架含-top-layer-载体)。

无障碍：`.nvui-modal` 上 `role="dialog"` + `aria-modal="true"` + `aria-labelledby` 指向标题；关闭按钮必须有 `aria-label`；`aria-modal="true"` 必须配合焦点陷阱与焦点归还（见上条），否则标记与实际键盘行为不一致；不要在打开瞬间自动聚焦到破坏性按钮。

### 7.4 按钮

扁平规则：按钮**没有可见描边与投影**，层级只靠底色；hover 加一档底色，`:active` 缩放到 0.97 给「按下去」的物理反馈（`transform` 只影响合成层）。

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-btn` | 默认中性按钮：`--nvui-block-bg` 底、无描边，悬停 `--nvui-block-bg-2` |
| `.nvui-btn.is-primary` | 主操作（`--nvui-accent-strong` 实心 + `--nvui-on-accent` 文字 + 顶部内高光；hover 纯色加深） |
| `.nvui-btn.is-secondary` | 次级操作（主色淡底 + 主色文字） |
| `.nvui-btn.is-ghost` | 弱操作：**v2.2.0 起无描边**，改用淡底 `--nvui-block-bg`（hover `--nvui-block-bg-2`），与整体扁平风格一致 |
| `.nvui-btn.is-danger` | 破坏性操作（语义红淡底） |
| `.nvui-btn.is-sm` | 小尺寸 |
| `.nvui-btn.is-block` | 通栏 |
| `.nvui-btn-row` | 按钮组：等宽（`flex: 1 1 140px`）并自动换行；窄屏单列 |
| `.nvui-btn:disabled` | 禁用态：降透明度 + not-allowed |
| `.nvui-btn:active` | 按压缩放 0.97（图标按钮 0.92） |

规则：同一区块主按钮最多 1 个；破坏性操作必须用 `is-danger` 且二次确认；按钮文字 2~6 个汉字，图标在前、文字在后；hover 不允许加投影/发光。

### 7.5 胶囊开关行（弹簧回弹）

```html
<label class="nvui-switch-row">
    <input type="checkbox" checked>
    <span>导出时嵌入图片</span>
</label>
```

| 部分 / 状态 | 规则 |
| :--- | :--- |
| `.nvui-switch-row` | 整行 label 可点；`row-reverse` 实现左标题右开关；底部发丝线（`:last-child` 去掉） |
| `input[type="checkbox"]` | 36×21 胶囊；`appearance: none`；清掉宿主 `::before` 对勾；`::after` 为 15px 滑钮 |
| `:checked` | 轨道变 `--nvui-accent`，滑钮右移 `--nvui-switch-knob-on` 并变白；轨道同时播放 `nvui-switch-on` 回弹（0.92 → 1.04 → 1，`--nvui-ease-spring`） |
| 滑钮过渡 | `transform` 用 `--nvui-duration-base` + `--nvui-ease-spring`，有轻微回弹但不能过冲太多；`transform-origin` 随方向切换（关闭左、开启右） |
| `:active::after` | **v2.0.1 新增**：按住时滑钮沿运动方向 `scaleX(1.12)` 拉伸（iOS 风格），松手弹簧回位；勾选态按住同时保留 `translateX` |
| `:active` | 轨道整体 `scale(0.96)` |
| `:focus-visible` | `--nvui-focus-ring-w` 主色焦点环；`:disabled` 降透明度 |

对比度（WCAG 1.4.11 非文本对比度）：关闭态轨道 `--nvui-switch-off-bg` 与页面背景 >= 3:1（深色 `rgba(255, 255, 255, 0.34)` / 浅色 `rgba(15, 23, 42, 0.47)`）；滑钮 `--nvui-knob-off` / `--nvui-knob` 与轨道 >= 3:1；开启态白滑钮叠在主色轨道上同样 >= 3:1。

无障碍：label 包裹 input，点击文字即可切换；业务侧用 `change` 事件同步设置并刷新摘要/说明。

### 7.6 输入行

```html
<label class="nvui-input-row">
    <input class="nvui-input is-number" type="number" value="5">
    <span>单图上限 (MB)</span>
</label>
```

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-input-row` | 左标题 + 右控件（`row-reverse`），底部发丝线 |
| `.nvui-input` | 输入框：`--nvui-input-bg` 扁平底 + `--nvui-control-h` 高；hover 底色微提亮；**基础态不加描边/投影**，聚焦态由统一焦点环表达 |
| `.nvui-input.is-number` | 数值框：定宽 96px、右对齐 |
| `.nvui-input[type="number"]` | **v2.0.1 新增**：隐藏浏览器原生步进按钮（`::-webkit-inner-spin-button` / `::-webkit-outer-spin-button` 置 `-webkit-appearance: none; margin: 0`，并 `appearance: textfield`）；键盘 ↑/↓ 与滚轮仍可调值 |
| `.nvui-input.is-path` | 路径框：200px、最大 60% 行宽 |
| `.nvui-input:focus-visible` | **单圈 2px 焦点环**（v2.2.0：`outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)`；整数像素更清晰）；**不再叠加内圈 `inset accent-line` 描边**，避免"双描边" |

规则：所有可编辑控件必须有可见 label（`label` 包裹即可）；失焦/回车触发保存；数值用 `min/max/step` 限制；输入框基础态不加描边/投影，聚焦态只出现**单圈 2px 焦点环**（v2.2.0，不再叠加内圈描边）。原生数字步进按钮在暗色主题下是亮白色、非常突兀，v2.0.1 已在 kit 内隐藏；**如需可见步进器，请业务侧自建按钮并复用 `.nvui-icon-btn`**，不要依赖原生控件。

### 7.7 标签页（激活弹跳 / 粘连指示器）

```html
<nav class="nvui-tabs" role="tablist" aria-label="设置分区">
    <!-- 可选：标签「粘连」滑动指示器（v2.0.1 新增；v2.1.0 起组件类总数 78） -->
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
| `.nvui-tab` | 胶囊标签页：透明底、`text-2`；`position:relative; z-index:1`（叠在指示器之上）；hover 加 `block-bg`；`:active` 缩放 0.97 |
| `.nvui-tab.is-active` | 主色淡底 + 加粗 + **播放 `nvui-tab-select` 弹跳**（弹簧缓动）；启用指示器模式后改为透明（高亮交给指示器） |
| `.nvui-tabs-indicator` | **v2.0.1 新增**（v2.1.0 起组件类总数 78）：可选「粘连」滑动指示器。`position:absolute; z-index:0`；位置/尺寸由 CSS 变量 `--nvui-tab-ind-x` / `--nvui-tab-ind-y` / `--nvui-tab-ind-w` / `--nvui-tab-ind-h` 驱动；`transform` 过渡用 `--nvui-duration-slow` + `--nvui-ease-spring`，宽高过渡用 `--nvui-duration-base` + `--nvui-ease-emphasized`；**v2.2.0 起去掉 1px 内环**，改底部直线强调 `box-shadow: inset 0 -2px 0 var(--nvui-accent-line)`；默认 `opacity:0`（未启用时完全不可见）；`pointer-events:none` |
| `.nvui-tabs.is-indicator` | 启用指示器模式：指示器 `opacity:1`；`.nvui-tab.is-active` 背景透明且 `animation:none`（避免与 `nvui-tab-select` 双重动画） |
| `.nvui-tabpane` | 面板默认 `display:none`，`.is-active` 时 `display:block` 并播放 `nvui-tabpane-in` 入场（淡入 + 上移 6px，v2.0.1 补强） |

**无 JS 回退**：不插入 `.nvui-tabs-indicator`、或不执行下面的配方即可——`.nvui-tab.is-active` 会保持主色淡底与 `nvui-tab-select` 弹跳，行为与旧版完全一致。指示器是**可选增强**，kit 没有 JS 运行时不强依赖它。

**JS 配方（stretch-then-settle「粘连」滑动）**：切换时先把指示器拉长到「旧位置 ∪ 新位置」，`requestAnimationFrame` 两帧后再收缩到目标位置，配合 spring 缓动呈现标签之间「粘连滑过去」的质感。

```js
function setupTabsIndicator(nav) {
    const ind = nav.querySelector('.nvui-tabs-indicator');
    const tabs = [...nav.querySelectorAll('.nvui-tab')];
    if (!ind || !tabs.length) return;

    let current = nav.querySelector('.nvui-tab.is-active') || tabs[0];
    const box = (el) => ({ l: el.offsetLeft, t: el.offsetTop, r: el.offsetLeft + el.offsetWidth, b: el.offsetTop + el.offsetHeight });
    const apply = (r) => {
        ind.style.setProperty('--nvui-tab-ind-x', r.l + 'px');
        ind.style.setProperty('--nvui-tab-ind-y', r.t + 'px');
        ind.style.setProperty('--nvui-tab-ind-w', (r.r - r.l) + 'px');
        ind.style.setProperty('--nvui-tab-ind-h', (r.b - r.t) + 'px');
    };

    function activate(tab) {
        if (tab === current) return;
        const from = box(current);
        const to = box(tab);
        tabs.forEach((t) => {
            const on = t === tab;
            t.classList.toggle('is-active', on);
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
        });
        current = tab;
        // 1) 拉长到「旧位置 ∪ 新位置」；2) 两帧后收缩到目标 → 「粘连」滑动
        apply({ l: Math.min(from.l, to.l), t: Math.min(from.t, to.t), r: Math.max(from.r, to.r), b: Math.max(from.b, to.b) });
        requestAnimationFrame(() => requestAnimationFrame(() => apply(to)));
    }

    apply(box(current));                 // 初始同步 --nvui-tab-ind-*
    nav.classList.add('is-indicator');   // 启用指示器模式

    nav.addEventListener('click', (e) => {
        const tab = e.target.closest('.nvui-tab');
        if (tab) activate(tab);
    });
    nav.addEventListener('keydown', (e) => {           // 键盘左右切换也要同步
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const i = tabs.indexOf(current);
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        next.focus();
        activate(next);
    });

    const relayout = () => apply(box(current));        // resize / 字体加载后重算
    window.addEventListener('resize', relayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
}

// 用法：document.querySelectorAll('.nvui-tabs').forEach(setupTabsIndicator);
```

注意事项：

- 坐标基于 `offsetLeft` / `offsetTop`（相对 `.nvui-tabs`，kit 已设 `position: relative`）；**不要用 `getBoundingClientRect`**，滚动容器内会引入页面滚动偏移。
- 面板切换本身仍只切 `display`（不重建 DOM）；指示器只负责视觉，两者互不耦合。
- 横向滚动容器里若目标标签被滚出可视区，先 `tab.scrollIntoView({ block: 'nearest', inline: 'nearest' })` 再同步指示器。
- `resize`、字体加载完成、语言切换（文字宽度变化）后必须重算，否则指示器会错位。
- 指示器是可选增强：未加 `is-indicator` 时完全走按钮自身高亮（无 JS 回退）。

规则：**只切 `display`，绝不重建面板 DOM**（否则丢输入焦点与异步结果）；每次切换把滚动位置复位；只有当前标签可 Tab 聚焦（`tabIndex=0/-1`），左右方向键切换由 JS 实现并调用指示器同步。指示器为可选增强：不执行配方时自动回退为按钮自身高亮；启用时由 `.nvui-tabs-indicator` 承担选中底色（按钮 `.is-active` 保持透明）。

### 7.8 折叠面板（新 DOM + 高度动画）

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
| `.nvui-acc` | 分组容器：`block-bg` 扁平底 + 12px 圆角（**无描边**）；`.is-open` 底色升到 `block-bg-2` |
| `.nvui-acc-head` | 整行标题按钮；维护 `aria-expanded`；hover 加深；焦点环用负 offset 内缩 |
| `.nvui-acc-title` | 左侧标题（可带图标） |
| `.nvui-acc-summary` | 右侧当前值摘要：单行省略；**收起态唯一线索，必须维护** |
| `.nvui-acc-chev` | 纯 CSS 箭头，展开时旋转 225° |
| `.nvui-acc-body` | 高度动画容器：`display: grid; grid-template-rows: 0fr; overflow: hidden`，`.is-open` 时 `1fr`；过渡 `--nvui-duration-slow` + `--nvui-ease-emphasized` |
| `.nvui-acc-inner` | **v2 新增裁切层**：`min-height: 0; overflow: hidden` + 左右内边距；上下留白用内部伪元素（`::before` / `::after`）在收起时一起被裁掉；正文必须包在这一层里 |

规则：开合只切 `.is-open` 与 `aria-expanded`、不重建 DOM；开合偏好可持久化；默认建议全部收起；**不要手写 `height`/`max-height`**，高度动画由 grid 过渡完成。从 v1 升级时漏掉 `.nvui-acc-inner` 会导致展开内容被裁成 0 高（见 [10.3](#103-v110--v200-迁移对照)）。

### 7.9 区块标题 / 提示 / 告警

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-section-title` | 区块标题（图标 + 13px 粗体 + 0.5px 字距） |
| `.nvui-hint` | 说明小字（12px，`text-3`）；`.is-warn` 变注意色 |
| `.nvui-alert` | 告警条：左侧 2px 竖线 + 淡底（**扁平规则：不要满框描边/投影**）；语义变体 `.is-checking` / `.is-success` / `.is-warning` / `.is-error` / `.is-info` |

规则：告警不要铺满深底色（用竖线 + 淡底即可，保持"扁平"）；同一屏告警不超过 2 条；告警条上的文字用 `text-2`，语义靠左侧竖线与图标传达。

### 7.10 状态行与状态点

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-status-line` | 状态行：`is-updating` / `is-success` / `is-skipped` / `is-error` 颜色即状态 |
| `.nvui-status-time` | 右侧时间戳（`margin-left:auto`、`--nvui-text-2`；v2 不再用 opacity，避免 11px 小字在玻璃/浅色下对比度不足） |
| `.nvui-status-file` | 状态行内的文件路径（独占一行、等宽换行、`--nvui-text-2`，同样不使用 opacity） |
| `.nvui-status-dot` | **v2 新增**状态点：7px 圆点 + 接触光晕；变体 `.is-ok` / `.is-warn` / `.is-danger` / `.is-info`；`.is-live` 播放 `nvui-pulse` 呼吸 |

```html
<div class="nvui-status-line is-updating">
    <span class="nvui-status-dot is-info is-live"></span>
    <span>正在同步</span>
    <span class="nvui-status-time">21:54</span>
    <span class="nvui-status-file">plugins/auto-save/logs/2026-10-17.txt</span>
</div>
```

规则：只用颜色表达状态的地方必须同时有文字或图标；状态点只是辅助视觉，不承载唯一信息；`.is-live` 只用于"进行中/在线"，不要给静态状态加循环动画。

### 7.11 徽标 / 标签块 / 空态 / 加载

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-badge` | 胶囊徽标（扁平：仅淡底，无描边；语义变体通过 `-bg` / `-line` 取色） |
| `.nvui-badge.is-accent` / `.is-success` / `.is-warn` / `.is-danger` / `.is-info` | 语义徽标变体 |
| `.nvui-chip` | 内容标签块（方角小圆角、`block-bg` 底） |
| `.nvui-chip-count` | 标签后的计数角标（10px 降透明度） |
| `.nvui-empty` | 空态：**v2.2.0 起去虚线圆角边**，改 `--nvui-bg-3` 淡底 + 居中提示（虚线圆角在缩放下同样有锯齿） |
| `.nvui-spinner` | 纯 CSS 加载环（`nvui-spin` 循环；也可用 Font Awesome `fa-spin`） |

规则：徽标/标签块是静态区块，**不加投影、不用玻璃**；一屏徽标不超过 5 个；计数角标只放数字，不放单位。

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
| `.nvui-skeleton.is-text` | 文本行变体：高 10px |
| `.nvui-skeleton.is-title` | 标题变体：高 14px、宽 40% |
| `.nvui-skeleton.is-block` | 区块变体：高 48px |
| `.nvui-skeleton.is-circle` | 头像/图标变体：28px 圆 |

规则：骨架屏只表示"内容加载中"，不表示"操作进行中"（后者用进度条/加载环）；扫光用 `transform` 平移，不改宽度；减少动效偏好下扫光自动停止；**不要在骨架屏上放真实文字**；加载完成后用真实内容替换整个骨架节点，不做交叉淡入（避免布局跳动）。

### 7.13 进度条

```html
<div class="nvui-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="42">
    <span class="nvui-progress-bar" style="width: 42%"></span>
</div>
<div class="nvui-progress is-indeterminate" role="progressbar" aria-label="正在准备">
    <span class="nvui-progress-bar"></span>
</div>
```

| 类名 / 状态 | 说明 |
| :--- | :--- |
| `.nvui-progress` | 轨道：高 4px、胶囊圆角、`--nvui-block-bg` 底、`overflow:hidden` |
| `.nvui-progress-bar` | 条本体：`display:block; height:100%; width:0`；宽度由业务 JS 用内联 `style` 或 CSS 变量设置；`width` 过渡用 `--nvui-duration-slow` + `--nvui-ease-emphasized`；**v2.0.1 新增** `::after` 渐变扫光（`nvui-shimmer` 循环），让进度变化更有流动感 |
| `.nvui-progress.is-indeterminate` | 不确定进度：条宽 40%，循环播放 `nvui-progress-indeterminate`（平移 + `scaleX` 呼吸：0.6 → 1 → 0.8） |
| `.nvui-progress.is-ok` / `.is-warn` / `.is-danger` | 语义变体：改条色为 ok / warn / danger |

规则：确定进度必须带 `role="progressbar"` + `aria-valuemin` / `aria-valuemax` / `aria-valuenow`；不确定进度至少给 `aria-label`；进度条**不放在玻璃上**（它是静态信息容器的一部分，保持扁平）；数值更新频率高于 10Hz 时不要做宽度过渡（会抖动）；扫光与呼吸是循环装饰动画，`prefers-reduced-motion: reduce` 下自动停止，不要用扫光表达真实进度值。

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
| `.nvui-toast` | 吐司：玻璃（`--nvui-glass-bg-strong`）+ `--nvui-radius-lg` + `--nvui-shadow-pop`；**v2.2.0 起无外框 1px 描边**（柔和顶部受光 + 阴影成形，静态形态不再有边缘锯齿）；文字用 `--nvui-text`；插入即播放 `nvui-toast-in`；`role="status"` 让读屏播报 |
| `.nvui-toast.is-closing` | 退场态：播放 `nvui-toast-out` 并 `pointer-events:none`；JS 在 `animationend` 后移除节点 |
| `.nvui-toast.is-success` / `.is-warn` / `.is-danger` | 改图标颜色（语义） |
| `.nvui-toast-stack` | 堆栈容器：`position:fixed` 右下、`z-index: var(--nvui-z-tooltip)`、`pointer-events:none`（子吐司恢复 `auto`）、`bottom: calc(var(--nvui-space-4) + env(safe-area-inset-bottom))` |

**放 top-layer 载体的要求**：`.nvui-toast-stack` 是 `position:fixed`，**必须放进 `dialog.nvui-tl` 载体里**（与弹窗共用一个载体或单独一个常驻载体均可，但同一时刻只 `show()` 必要的载体）。原因有二：① 部分酒馆版本 `html` 带 `transform`，fixed 包含块会变成文档盒子，直接挂 body 位置错乱（实测当前版本为 `none`，但不依赖宿主版本）；② 非模态 dialog 无 top layer 提升，宿主正 z-index 表面（如 `#sheld` z-index:30）会盖住无档位容器——载体自带 `--nvui-z-layer` 档位，堆栈在载体的层叠上下文内再用 `--nvui-z-tooltip` 排位。窄屏时堆栈贴右下更近（space-2 + 安全区）。

业务 JS 建议配方：

```js
function showToast(text, kind = 'success') {
    const t = document.createElement('div');
    t.className = `nvui-toast is-${kind}`;
    t.setAttribute('role', 'status');
    t.innerHTML = '<i class="fa-solid fa-circle-check"></i><span></span>';
    t.querySelector('span').textContent = text;   // 文本用 textContent，避免注入
    stack.appendChild(t);
    setTimeout(() => {
        t.classList.add('is-closing');
        t.addEventListener('animationend', () => t.remove(), { once: true });
        setTimeout(() => t.remove(), 400);         // 兜底
    }, 3200);
}
```

规则：同一时刻吐司不超过 3 条；文案控制在 24 个汉字内；吐司不是唯一反馈（重要结果仍要在页面上可查）；不要用 emoji 或裸露图标表达状态（图标 + 文案一起用）。

### 7.15 悬浮面板 / 工具提示（玻璃）

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-floating` | 悬浮面板外观（胶囊默认形态；`.is-panel` 为竖向面板 + `--nvui-radius-lg`）；popover 级玻璃（0.80，文字用 `--nvui-text`）；**v2.2.0 起无外框 1px 描边**（柔和顶光 + 阴影成形） |
| `.nvui-floating-handle` | 拖拽把手（`cursor: grab`、`touch-action: none`） |
| `.nvui-floating.is-dragging` | 拖拽中（`cursor: grabbing`、禁选中） |
| `.nvui-tooltip` | 轻量工具提示（`position:fixed`、最大 340px，由 JS 定位；`pointer-events: none`；入场播放 `nvui-fade-in`）；**v2.0.1 起文字色从 `text-2` 改为 `--nvui-text`**（popover 级玻璃只承诺正文 AA） |

规则：**没有 JS 运行时的定位逻辑**——拖拽/位置记忆/点击判定由各插件实现（建议 pointer 事件 + 阈值区分点击与拖动；悬浮入口必须可键盘操作）；悬浮面板必须放进 `dialog.nvui-tl` 载体（同 fixed 包含块问题）；工具提示只做说明，不承载可点内容；popover 玻璃上的说明文字一律用正文色（见 [4.4](#44-aa-安全玻璃与合成对比度验算)）。

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

规则：文字色工具类**只允许用于文字**，不要拿来改背景；`.nvui-grow` 的父级必须是 flex 容器；分割线不要替代间距（优先用 `gap`）。

### 7.17 动效工具类与关键帧

| 类名 | 效果 | 时长 / 缓动 |
| :--- | :--- | :--- |
| `.nvui-fade-in` | 淡入 | `--nvui-duration-base` + standard |
| `.nvui-slide-up` | 淡入 + 上移 `--nvui-enter-distance` | `--nvui-duration-slow` + emphasized |
| `.nvui-pop-in` | 缩放 0.94 → 1 淡入 | `--nvui-duration-slow` + spring |
| `.nvui-stagger` | 容器：直接子项按 `nth-child` 递增 `animation-delay: calc(var(--nvui-stagger-step) * n)`（1~10，>10 不延迟），子项播放 `nvui-slide-up` | 同上 |
| `.nvui-pulse` | 循环呼吸缩放 | `--nvui-pulse-duration` |

规则：工具类只负责「入场」，元素渲染/插入时播放一次；需要重播时先移除类、强制 reflow（`void el.offsetWidth`）再加回；`stagger` 只用于列表首屏入场，不要给表单控件用；循环动画（`pulse`）同一屏不超过 2 个；关键帧完整清单见 [6.4.4](#644-关键帧清单16-个全部-nvui-前缀且必须被引用)。

```js
// 重播动效工具类（preview 页与业务通用）
function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
}
```

### 7.18 无障碍速查

- 弹窗：`role="dialog"`、`aria-modal="true"`、`aria-labelledby`；关闭按钮 `aria-label`；打开/关闭时焦点管理由业务 JS 负责。
- 标签页：`role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected` + `aria-controls`。
- 折叠：`aria-expanded` 随开合更新；标题就是 `<button>`。
- 开关：`label` 包裹 `input`；说明文字用 `<span>` 而不是 `title`（移动端 title 不可见）。
- 吐司：`role="status"`；重要信息不能只靠吐司（会消失）。
- 进度条：`role="progressbar"` + `aria-value*`；不确定进度要有 `aria-label`。
- 所有交互元素都要有 `:focus-visible` 焦点环（kit 已内建，统一走 `--nvui-focus-ring-*` token）。
- 只用颜色表达状态的地方，必须同时有文字或图标（例如状态行已有文案、告警有语义图标）。
- 尊重 `prefers-reduced-motion` / `prefers-reduced-transparency` / `forced-colors`（kit 已内置对应媒体查询）。

---

## 8. SillyTavern 宿主兼容红线

以下每条都来自 novel-stream 在真实酒馆（桌面 / 手机 / Docker / 浅色主题）上踩过的坑，**下个插件请直接照做**：

1. **body 级浮层必须进 `<dialog class="nvui-tl">` 载体，并用非模态 `show()`。**
   - 部分酒馆版本 `html` 上有 `transform`，`position:fixed` 的包含块会变成文档盒子，手机端浮层被顶出屏幕（实测当前版本为 `none`，但不依赖宿主版本）；
   - `showModal()` 会给文档加 `inert`，悬浮入口/其它弹窗全部点不到；
   - **非模态 `show()` 不进浏览器 top layer**，层级完全由载体自身 `z-index: var(--nvui-z-layer)`（1000000，压过宿主竞争上限约 29999）保证——酒馆 `#sheld`（z-index:30）会整块盖住没有档位的载体，这是 2026-10 实机冒烟测出的真 bug；
   - 载体 `pointer-events:none`，子浮层（`.nvui-overlay` / `.nvui-floating` / `.nvui-toast-stack`）恢复 `auto`；
   - 未 `show()` 的 dialog 是 `display:none`，关闭时用 `close()` 或切 `hidden`。
2. **所有 checkbox 必须隔离宿主样式。** 酒馆给每个 `input[type=checkbox]` 挂了 `appearance:none; display:grid` + `::before` 对勾（clip-path + inset box-shadow）。自定义开关必须 `appearance:none` + 显式宽高 + 压掉 `::before`（`content:none !important; display:none !important`），否则会出现"蓝色尖角/勾选态不可见"。kit 的 `.nvui-switch-row` 已内置。
3. **不要用裸元素选择器写样式。** 一律 `.nvui-*` / `dialog.nvui-tl` 前缀；ID 级作用域仅用于对抗宿主既有全局样式（例如 `#your_panel input[type=checkbox]`）。
4. **颜色只用 token。** 浮层自带深色主题（或 `.nvui-theme-light`），不要引用酒馆 `--SmartTheme*` 变量——否则浅色主题下观感不可控；聊天区内联组件除外。
5. **移动端三件事**：`100dvh` / `safe-area-inset-bottom`；弹窗正文 `-webkit-overflow-scrolling: touch`；打开弹窗时若键盘弹起，位置/滚动要复算（监听 `visualViewport`）。
6. **不要用 emoji 当图标。** 用 Font Awesome（`<i class="fa-solid fa-...">`）或纯 CSS 图形；仓库历史上统一清理过 emoji。
7. **动效可降级。** 必须尊重 `prefers-reduced-motion`（kit 已内置全局降级，且会清掉 `animation-delay`，避免 stagger 子项延迟残留）；不要把关键信息只放在动画里。**若本机/系统开启了「减少动态效果」，你会看到所有动效都被降级为 0.01ms（这是无障碍红线，不是 bug）**；`preview.html` 顶部的「强制播放动效」开关（`body.pv-force-motion` / URL 参数 `?motion=1`）只用于演示，生产环境请尊重系统偏好（见 [2.6](#26-动效降级与强制播放动效演示开关)）。
8. **同一时刻只 `show()` 一个载体。** 多个 dialog 载体可共存，但同一时刻只显示必要的；浮层之间用 `hidden` 切换而不是重复创建 DOM。
9. **`backdrop-filter` 玻璃的兼容、性能与降级（v2 新增红线）。**
   - **前缀**：每个 `backdrop-filter` 声明必须同时写 `-webkit-backdrop-filter`（Safari / 旧 WebKit 内核），两者顺序不能反；
   - **性能**：`backdrop-filter` 是合成阶段的高开销效果，只用于小面积浮层；不要给全屏静态区块用；弹窗/遮罩同时叠玻璃时窄屏自动降档到 `--nvui-glass-blur-sm`；避免在动画中改变 `blur` 半径（会导致每帧重采样），改透明度/位移即可；
   - **能力回退**：`@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` 必须回退为不透明表面（弹窗 `--nvui-bg`，popover 级 `--nvui-bg-2`）；
   - **用户偏好回退**：`@media (prefers-reduced-transparency: reduce)` 回退不透明 + `backdrop-filter: none`；
   - **强制颜色**：`@media (forced-colors: active)` 用系统色 `CanvasText` 描边 + 去阴影 + 去模糊；
   - **手动回退**：提供 `.nvui-solid` 实心模式（根节点开关），并保证回退后 `pointer-events` 行为不变（浮层仍可点、遮罩仍拦截）；
   - **降级后对比度**：回退表面的文字对比度必须继续满足 AA（`--nvui-bg` / `--nvui-bg-2` 已验算，见 4.1）；
   - **不要用玻璃表达状态**：状态色必须是实色文字/图标/圆点，不能只靠"玻璃色调"。

---

## 9. 命名与工程约定

- **前缀**：全部组件 `nvui-`；HTML 类名 kebab-case；状态类统一 `is-` 前缀（`is-active` / `is-open` / `is-primary` / `is-closing` / `is-live` ...）。
- **Token 命名**：`--nvui-<类别>-<档位>`；类别固定为 `bg` / `block-bg` / `glass` / `line` / `text` / `accent` / `on-accent` / `focus-ring` / `ok|warn|danger|info` / `radius` / `space` / `fs` / `fw` / `lh` / `shadow` / `duration` / `ease` / `transition` / `skeleton` / `z` 等；**新增 token 必须同步更新本 README 的 token 表与 `test/test-ui-kit.js` 的必填清单**（tokens.css 定义的每个 `--nvui-*` 都必须进入测试的 CORE_TOKENS 显式数组，防漏登记）。
- **关键帧命名**：所有 `@keyframes` 必须以 `nvui-` 前缀命名，且必须被至少一处 `animation:` 引用；新增关键帧必须同时登记到 [6.4.4 清单](#644-关键帧清单16-个全部-nvui-前缀且必须被引用)与 CHANGELOG。
- **动效令牌命名**：时长用 `--nvui-duration-<fast|base|slow>`，缓动用 `--nvui-ease-<standard|emphasized|spring>`，循环周期用 `--nvui-<效果>-duration`（`spin` / `shimmer` / `pulse`），序列参数用 `--nvui-stagger-step` / `--nvui-enter-distance`；组件内不允许硬编码毫秒数（循环/序列动画一律走 token）。
- **`@supports` 政策**：能力检测只用于"渐进增强的回退"，不用于区分主题；每个玻璃/模糊特性必须有对应的 `@supports not` 或媒体查询回退，且回退后视觉效果必须仍然可用（不透明表面）。允许的媒体查询：`prefers-reduced-motion`、`prefers-reduced-transparency`、`forced-colors`、`max-width: 600px`。
- **焦点环统一走 token**：组件只允许 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color);` + `outline-offset: var(--nvui-focus-ring-offset)`，不得各写各的像素值或直接写 `outline: 2px solid var(--nvui-accent)` 这类硬编码（测试会数统一形式出现次数）。
- **玻璃 AA 红线**：新增玻璃表面必须复用 `--nvui-glass-bg` / `--nvui-glass-bg-strong`，不得自造 alpha 值；玻璃上的文字只能用 `--nvui-text` / `--nvui-text-2`；改动玻璃/遮罩/文字取值必须重跑合成对比度测试并同步文档与 CHANGELOG。
- **颜色**：`components.css` 内禁止 `#hex` / `rgb()` / `hsl()` 字面量；只能用 `var(--nvui-*)`（`transparent` / `inherit` / `currentColor` 除外）。测试会扫描。这条即「禁止硬编码颜色」。
- **`!important` 预算**：总数 **<= 8**，只允许两类：① 对抗宿主 checkbox `::before` 的隔离规则；② `prefers-reduced-motion` 降级块（含 `animation-delay` 重置）。其它地方不得使用。
- **选择器**：不得出现裸元素选择器（如 `input { ... }`、`button { ... }`）与全局重置；所有规则必须在 `.nvui-` / `dialog.nvui-tl` 作用域下。
- **图标**：Font Awesome `<i>`；纯 CSS 图形只用于箭头/滑钮/加载环/状态点/骨架扫光。
- **无 emoji**：README、CSS、HTML、JS 文案中不使用 emoji。
- **文件结构**：本目录是自包含独立项目（`package.json` / `LICENSE` / `CHANGELOG.md` / `test/` 齐全），可直接整目录复制或移动；`preview.html` 必须保持离线可打开（无 CDN、无网络请求）；文档内部链接一律用同目录相对路径，不引用父目录。
- **版本**：kit 版本同时写在 `package.json`、`tokens.css` / `components.css` 文件头、本 README 标题、`CHANGELOG.md` 最新条目与 `preview.html`（含页面徽标）；对外暴露的插件版本由各插件自己的 manifest 独立管理（不要求与 kit 版本一致）。
- **测试**：新增/修改组件后，在本目录运行 `npm test`（或 `node test/test-ui-kit.js`）；该测试同时守护「token 完整」「组件被预览与文档覆盖」「无硬编码颜色」「WCAG 对比度 + 玻璃合成对比度」「核心 token 金标准取值」「动效/降级红线」「独立项目结构与版本自洽」。

---

## 10. 从 novel-stream 迁移对照表

> novel-stream 当前 `style.css` 是 kit 的"参考实现"（历史演进，含个别未收敛的取值）。新插件直接用 kit；旧插件按需逐步迁移，不要一次性重写。
> 本节同时保留两段迁移历史：10.1 / 10.2 是 **novel-stream → kit** 的映射；10.3 是 **kit v1.1.0 → kit v2.0.0** 的升级对照。

### 10.1 Token 映射

| novel-stream 旧 token | UI Kit token | 说明 |
| :--- | :--- | :--- |
| `--nv-bg` | `--nvui-bg` | 同名同值 |
| `--nv-bg-2` / `--nv-bg-3` | `--nvui-bg-2` / `--nvui-bg-3` | 同名同值 |
| `--nv-line` / `--nv-line-2` / `--nv-dash` | `--nvui-line` / `--nvui-line-2` / `--nvui-dash` | 同名同值 |
| `--nv-block-bg` / `--nv-block-bg-2` | `--nvui-block-bg` / `--nvui-block-bg-2` | 同名同值 |
| `--nv-block-line` / `--nv-block-line-2` | `--nvui-block-line` / `--nvui-block-line-2` | 同名同值 |
| `--nv-text` / `--nv-text-2` | `--nvui-text` / `--nvui-text-2` | 同名同值 |
| `--nv-text-3` | `--nvui-text-3` | **值提亮一档**（AA 对比度） |
| `--nv-accent` / `--nv-accent-2` | `--nvui-accent` / `--nvui-accent-2` | 同名同值 |
| `--nv-accent-bg` / `--nv-accent-line` | `--nvui-accent-bg` / `--nvui-accent-line` | 同名同值 |
| `--nv-ok` / `--nv-warn` / `--nv-danger` | `--nvui-ok` / `--nvui-warn` / `--nvui-danger` | 同名同值；新增配套 `-bg` / `-line` |
| `--nv-radius` | `--nvui-radius` | 同名同值；kit 扩展 xs/sm/lg/xl/pill |
| （无） | `--nvui-accent-strong` / `--nvui-accent-strong-hover` | 新增：填充按钮底（白字 AA） |
| （无） | `--nvui-info` / `--nvui-info-bg` / `--nvui-info-line` | 新增：进行中/信息（旧实现借用了宿主主题色） |
| （无） | 玻璃 7 令牌（`--nvui-glass-*`） | v2 新增：浮层磨砂玻璃 |
| （无） | 焦点环 3 令牌（`--nvui-focus-ring-*`） | v2 新增：统一 focus-visible |
| （无） | 动效体系令牌（`--nvui-duration-*` / `--nvui-ease-*` / `--nvui-transition*` / `--nvui-shimmer-duration` / `--nvui-pulse-duration` / `--nvui-stagger-step` / `--nvui-enter-distance`） | v2 新增：把散落的时长/缓动收敛成体系 |
| （无） | 骨架屏 2 令牌（`--nvui-skeleton-bg` / `--nvui-skeleton-shine`） | v2 新增 |
| （无） | 字号/间距/阴影/动效/尺寸/z-index 令牌 | 新增：把散落的具体数值收敛成 token |

### 10.2 组件类名映射

| novel-stream 旧类名 | UI Kit 类名 | 说明 |
| :--- | :--- | :--- |
| `.novel-modal-overlay` | `.nvui-overlay` | 遮罩 |
| `.novel-modal` / `.novel-modal-header` / `.novel-modal-title` / `.novel-modal-body` | `.nvui-modal` / `.nvui-modal-header` / `.nvui-modal-title` / `.nvui-modal-body` | 弹窗骨架；kit 新增 `.nvui-modal-ver` / `.nvui-modal-actions` / `.nvui-modal-footer` |
| `.novel-icon-btn` | `.nvui-icon-btn` | 图标按钮 |
| `.novel-btn` + `.btn-export` / `.btn-sync` / `.btn-test` / `.btn-download` | `.nvui-btn` + `.is-primary` / `.is-secondary` / `.is-ghost` | 按语义选变体，不再按业务命名 |
| `.novel-btn-row` | `.nvui-btn-row` | 按钮组 |
| `.checkbox_label`（借用宿主类）+ `.novel-switch-row` | `.nvui-switch-row` | kit 自己实现胶囊开关与宿主样式隔离 |
| `.novel-row` | `.nvui-input-row` + `.nvui-input` | 输入行 |
| `.novel-tabs` / `.novel-tab` / `.novel-tabpane` | `.nvui-tabs` / `.nvui-tab` / `.nvui-tabpane` | 标签页 |
| `.novel-acc` / `.novel-acc-head` / `.novel-acc-title` / `.novel-acc-summary` / `.novel-acc-chev` / `.novel-acc-body` | `.nvui-acc` / `.nvui-acc-head` / `.nvui-acc-title` / `.nvui-acc-summary` / `.nvui-acc-chev` / `.nvui-acc-body` | 折叠面板；v2 起正文需再包 `.nvui-acc-inner` |
| `.novel-section-title` | `.nvui-section-title` | 区块标题 |
| `.novel-mv-hint` | `.nvui-hint` | 说明小字 |
| `.novel-alert` | `.nvui-alert` | 告警条 |
| `.novel-status-line` / `.novel-status-time` / `.novel-status-file` | `.nvui-status-line` / `.nvui-status-time` / `.nvui-status-file` | 状态行 |
| `.novel-mv-badge` / `.novel-chip-count` | `.nvui-badge` / `.nvui-chip-count` | 徽标与计数 |
| `.novel-tag-chip` | `.nvui-chip` | 标签块 |
| `.novel-floating-window` | `.nvui-floating` | 悬浮面板（拖拽逻辑各插件自实现） |
| `.novel-chip-tooltip` | `.nvui-tooltip` | 工具提示 |
| `.novel-modal-overlay` 外层 `<dialog class="novel-tl">` | `<dialog class="nvui-tl">` | top-layer 载体 |
| `.novel-tag-badge` 等业务徽标 | `.nvui-badge` + `is-accent` / `is-success` / `is-warn` / `is-danger` / `is-info` | 语义变体取代业务命名 |
| （无） | `.nvui-glass` / `.nvui-solid` / `.nvui-toast` / `.nvui-toast-stack` / `.nvui-progress` / `.nvui-progress-bar` / `.nvui-skeleton` / `.nvui-status-dot` / `.nvui-acc-inner` / `.nvui-fade-in` / `.nvui-slide-up` / `.nvui-pop-in` / `.nvui-stagger` / `.nvui-pulse` | v2 新增 14 类；v2.0.1 追加第 68 类可选 `.nvui-tabs-indicator`（标签粘连指示器，见 §7.7）；v2.1.0 追加 10 类面板布局（`.nvui-panel` 等，见第 12 章）；旧实现需按需接入 |

### 10.3 v1.1.0 → v2.0.0 迁移对照

本表是 kit 自身的大版本升级（**破坏性**）。旧插件从 v1.1.0 升级时按下面顺序处理。

#### 10.3.1 破坏性变更（必须处理）

| 变更 | v1.1.0 | v2.0.0 | 升级动作 |
| :--- | :--- | :--- | :--- |
| 删除 `--nvui-shadow-accent` | 存在（主按钮悬停发光） | **已删除**（投影发光与扁平化冲突） | 删掉所有对该 token 的引用；主按钮 hover 现在由 `--nvui-accent-strong-hover` 纯色加深 + 内高光承担 |
| 折叠面板 DOM | `.nvui-acc-body` 直接放内容，展开靠 `display:none` 切换 | `.nvui-acc-body > div.nvui-acc-inner > 内容`；靠 `grid-template-rows: 0fr ↔ 1fr` 过渡 | 给每个折叠面板正文包一层 `<div class="nvui-acc-inner">`，否则展开内容高度被裁成 0 |
| 遮罩取值 | `--nvui-overlay-bg` 深 `rgba(6,8,14,0.72)` | 深 `rgba(6, 8, 14, 0.62)`（v2.0.0 为 0.55，v2.0.1 因玻璃更透加深补偿 AA）、浅 `rgba(15, 23, 42, 0.3)` | 无需改代码（token 自动生效），但视觉验收要重看一眼遮罩通透度与底层可见度 |
| 阴影取值 | `--nvui-shadow-modal` / `--nvui-shadow-pop` 为纯投影 | 改为玻璃阴影（环境投影 + `inset 0 1px 0 var(--nvui-glass-highlight)`） | 无需改代码，确认静态区块不再引用阴影 token |
| 过渡取值 | `--nvui-transition: 0.16s ease`、`--nvui-transition-slow: 0.25s ease` | 改为组合引用 `var(--nvui-duration-fast) var(--nvui-ease-standard)` / `var(--nvui-duration-slow) var(--nvui-ease-emphasized)` | 无需改代码；自定义动效请改用新时长/缓动令牌 |
| 焦点环 | 各组件自带 `outline: 2px solid var(--nvui-accent)` 等散装写法 | 统一 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)` + `outline-offset: var(--nvui-focus-ring-offset)` | 删掉插件里复制的散装 focus 样式，改为统一 token |
| 弹窗圆角 | `--nvui-radius-lg`（16px） | 弹窗用新增的 `--nvui-radius-xl`（20px）；`--nvui-radius-lg` 改用于吐司/悬浮面板/窄屏弹窗 | 无需改代码；若自定义弹窗圆角，改用 `--nvui-radius-xl` |
| 动效降级范围 | 只重置 `animation-duration` / `transition-duration` | 增加 `animation-delay: 0.01ms !important` 与 `animation-iteration-count: 1 !important` | 无需改代码；业务自定义动画也应同步重置 delay |

#### 10.3.2 新增能力（按需接入）

| 新增 | 说明 | 接入方式 |
| :--- | :--- | :--- |
| 玻璃层（7 token，`--nvui-glass-*`） | 弹窗/遮罩/悬浮面板/工具提示/吐司/`.nvui-glass` 的统一玻璃参数（v2.0.1 更透：0.64 / 0.80，blur 20/12，saturate 150%，受光边更淡） | 使用现有组件即自动生效；自建玻璃容器加 `.nvui-glass` |
| 焦点环（3 token） | 统一 focus-visible 样式 | 交互元素不做自定义 focus 样式即可 |
| 动效体系（时长/缓动/循环/位移/stagger，12 token） | 统一时长与缓动 | 自定义过渡改用 `--nvui-duration-*` / `--nvui-ease-*` |
| 关键帧 16 个 | spin、fade、slide、pop、overlay、modal、toast、tab-select、**tabpane-in**、**switch-on**、shimmer、progress-indeterminate、pulse 等（v2.0.1 新增后 2 个） | 组件内部已消费；自定义动画可复用 |
| 新组件 14 类 | `.nvui-glass` `.nvui-solid` `.nvui-acc-inner` `.nvui-toast` `.nvui-toast-stack` `.nvui-progress` `.nvui-progress-bar` `.nvui-skeleton` `.nvui-status-dot` `.nvui-fade-in` `.nvui-slide-up` `.nvui-pop-in` `.nvui-stagger` `.nvui-pulse` | 见第 7 节各小节 |
| 实心模式 `.nvui-solid` | 用户偏好/低性能设备的扁平降级 | 根节点加类即可全局切换 |
| 能力降级 | `@supports not` / `prefers-reduced-transparency` / `forced-colors` / 窄屏 blur 降档 | components.css 内置，无需调用 |
| AA 安全玻璃 | 合成对比度门禁（深色弹窗级 10.33/4.70；深色 popover 级只承诺正文 7.76；浅色弹窗级 9.31/4.64；浅色 popover 级 9.66/4.81；典型深色宿主 `#161a24` 弹窗级 9.70/4.83） | `test/test-ui-kit.js` 自动守护 |
| 测试门禁 | 玻璃 AA、16 关键帧引用、focus ring 统一、折叠 grid 动画、降级块、!important 预算 | 升级后跑 `npm test` |

#### 10.3.3 升级步骤

1. 用 v2.0.0 的 `tokens.css` / `components.css` 覆盖旧文件（或更新 `@import` 路径）；
2. 全局搜索 `--nvui-shadow-accent`，删除引用（主按钮效果已由组件内置）；
3. 给每个 `.nvui-acc-body` 的正文包一层 `<div class="nvui-acc-inner">`（破坏性 DOM 变更）；
4. 删除插件里复制的散装 `:focus-visible { outline: ... }` 样式，交给 kit；
5. 检查业务里是否有硬编码的 `0.16s` / `0.25s` 过渡，改用 `--nvui-transition` / `--nvui-transition-slow`；
6. 打开 `preview.html` 对照深/浅/实心三态确认视觉无回归；
7. 在 kit 目录运行 `npm test`，再跑插件自身的测试；
8. 按需接入吐司/骨架屏/进度条/状态点/动效工具类（先看第 7 节，再决定是否值得加）。

### 10.4 v2.0.0 → v2.0.1 修订说明

v2.0.1 是**补丁版本**（无 token 增删、无破坏性 DOM 契约变化；仅新增可选第 68 类 `.nvui-tabs-indicator`），由用户反馈驱动，覆盖 CSS 即可完成升级，业务代码通常无需改动。

#### 10.4.1 修订内容（按反馈）

| 反馈 | v2.0.0 | v2.0.1 | 影响 / 说明 |
| :--- | :--- | :--- | :--- |
| 玻璃再透一些 | 深 glass-bg 0.72 / strong 0.88；遮罩 0.55 | 深 glass-bg 0.64 / strong 0.8；遮罩加深到 0.62 补偿 AA；浅色 strong 0.88 → 0.8；模糊 18/10 → 20/12；饱和 140% → 150% | 观感更通透，AA 口径见 [4.4](#44-aa-安全玻璃与合成对比度验算) |
| 吐司静态 / 悬浮面板 / 工具提示描边不和谐 | glass-line 深 0.14 / 浅 0.7；glass-highlight 深 0.1 / 浅 0.9 | glass-line 深 0.06 / 浅 0.35；glass-highlight 深 0.04 / 浅 0.45 | 浮层只剩几乎不可见的受光边，静态形态不再突兀 |
| 动效补强（标签页 / 开关 / 进度条） | 14 关键帧；开关仅弹簧滑钮；标签面板无入场；进度条无扫光 | 16 关键帧：新增 `nvui-tabpane-in`（面板入场）与 `nvui-switch-on`（勾选回弹）；开关按住滑钮拉伸（iOS 风格）；标签页面板淡入上移；进度条 `::after` 扫光 + 不确定进度 `scaleX` 呼吸 | 纯 CSS 自动生效，业务无需改 JS |
| 标签「粘连」滑动 + 减少动态效果 | 标签仅按钮自身高亮；系统开启 reduce 时所有动效被降级（本机即如此） | 新增第 68 类 `.nvui-tabs-indicator`（stretch-then-settle 粘连指示器 + spring 过渡，无 JS 回退按钮高亮，配方见 [7.7](#77-标签页激活弹跳--粘连指示器)）；`preview.html` 新增「强制播放动效」演示开关（`body.pv-force-motion` + URL `?motion=1`，仅演示、不进 kit） | 指示器为可选增强，需按配方接入 JS；生产环境仍尊重系统偏好，不复制预览开关 |
| 数字输入框原生白色步进按钮 | 原生步进按钮在暗色下突兀 | 隐藏 `::-webkit-inner/outer-spin-button`，`appearance: textfield`；键盘 ↑/↓ 与滚轮仍可调 | 需要可见步进器时业务侧自建 `.nvui-icon-btn` 按钮 |
| AA 政策（popover 级） | popover 级同时承诺 text / text-2 | popover 级（0.80）只承诺正文 `--nvui-text` 7.76；`.nvui-tooltip` 文字已改正文色 | popover 玻璃上的次要说明改用 `--nvui-text`；否则放进弹窗 |

#### 10.4.2 升级动作

1. 用 v2.0.1 的 `tokens.css` / `components.css` 覆盖旧文件（无 token 增删、无破坏性 DOM 变化，业务代码通常无需改动）；
2. 检查业务自建的 **popover 级玻璃**容器（或直接使用 `.nvui-glass` 的地方）：若正文/说明用了 `--nvui-text-2`，改为 `--nvui-text`，或把内容放进弹窗级玻璃；
3. 若业务依赖数字输入框的原生步进按钮，改为自建 `.nvui-icon-btn` 步进器，或接受键盘 ↑/↓ 与滚轮调值；
4. 标签页如需「粘连」滑动效果：插入 `<span class="nvui-tabs-indicator" aria-hidden="true"></span>` 并接入 [7.7 配方](#77-标签页激活弹跳--粘连指示器)（点击/键盘/resize 同步）；不需要则保持默认按钮自身高亮（无 JS 回退，零迁移成本）；
5. 打开 `preview.html` 复核玻璃通透度、描边观感与新增动效（本机 reduce 时打开「强制播放动效」开关），运行 `npm test`（测试已同步为 16 关键帧、68 类与新 AA 口径）。

### 10.5 v2.0.1 → v2.1.0 新增面板布局标准

v2.1.0 是**小版本**：只新增组件族与尺寸令牌，**无删除 / 重命名 / 破坏性 DOM 变更**；已有插件可继续使用原 `.nvui-modal` 弹窗，面板布局标准是可选的新能力。

| 新增 | 内容 | 接入方式 |
| :--- | :--- | :--- |
| 尺寸令牌 2 | `--nvui-panel-width: 880px`、`--nvui-panel-max-h: 88vh` | 覆盖 token 即可自定义面板宽高（tokens 总数 107 → 109） |
| 组件类 10 | `.nvui-panel` / `.nvui-panel-header` / `.nvui-panel-title` / `.nvui-panel-actions` / `.nvui-panel-body` / `.nvui-panel-footer` / `.nvui-panel-heading` / `.nvui-sheet-handle` / `.nvui-bottom-nav` / `.nvui-bottom-nav-item` | 组件类总数 68 → 78；完整 DOM 与规则见 [第 12 章](#12-sillytavern-插件面板布局标准桌面--手机) |
| 状态类 3 | `.nvui-overlay.is-panel` / `.nvui-switch-row.is-feature` / `.nvui-bottom-nav-item.is-active` | 按需添加；不进入组件类清单 |
| 响应式 | 桌面 >600px 居中面板；手机 ≤600px 底部抽屉 + 底部图标导航 + 拖拽把手 + safe-area | 同一份 DOM 自动切换，无需 JS 分支 |
| JS 约定 | 顶部 tabs / 手机底部导航 / tabpane 三者同步（`aria-selected` / `aria-current` / `tabindex`） | 使用第 12 章同步配方；有 JS 时桌面与手机状态一致 |

升级动作：

1. 用 v2.1.0 的 `tokens.css` / `components.css` 覆盖旧文件（无破坏性变更，原有弹窗/组件不受影响）；
2. 若采用面板布局标准：按 [第 12 章](#12-sillytavern-插件面板布局标准桌面--手机) 的 DOM 装配面板（`dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel`），接入 tab ↔ 底部导航同步 JS；
3. 不采用面板标准也可继续用 `.nvui-modal` 弹窗，两者可共存；
4. 打开 `preview.html` 对照桌面（>600px）与手机（≤600px）两种宽度，运行 `npm test`（测试已同步为 109 令牌 / 78 类 / 面板响应式红线）。

### 10.6 v2.1.0 → v2.1.1 描边再减弱 + 单圈焦点环 + 固定面板尺寸 + 隐藏滚动条

v2.1.1 是**补丁版本**：只调整 token 取值与滚动 / 尺寸行为，**无新增或删除类与 token**（仍为 109 令牌 / 47 浅色 / 78 类 / 16 关键帧），无破坏性变更；覆盖 CSS 即可升级，业务代码通常无需改动（若业务自写了叠边焦点样式或可见滚动条样式，删掉以保持一致）。

| 变更 | v2.1.0 | v2.1.1 | 影响 / 说明 |
| :--- | :--- | :--- | :--- |
| 分隔线 / 控件边（深色） | line 0.07 / line-2 0.12 / dash 0.17 / block-line 0.06 / block-line-2 0.1 | line **0.05** / line-2 **0.08** / dash **0.14** / block-line **0.04** / block-line-2 **0.07** | 分隔更弱，界面更"无边框" |
| 分隔线 / 控件边（浅色） | line 0.08 / line-2 0.14 / dash 0.22 / block-line 0.06 / block-line-2 0.1 | line **0.06** / line-2 **0.10** / dash **0.18** / block-line **0.045** / block-line-2 **0.07** | 同上 |
| 玻璃边 / 内高光 | 深 0.06 / 0.04；浅 0.35 / 0.45 | 深 **0.03 / 0.03**；浅 **0.18 / 0.30** | 浮层边缘接近无边框，结构仍可辨（玻璃 bg / AA 数值与政策不变） |
| 焦点环 | `--nvui-focus-ring-w: 2px`；输入框额外叠内圈 `inset accent-line` | **单圈 1.5px**；`.nvui-input:focus-visible` 删除内圈 `box-shadow` | 修复输入框"双描边"；焦点仍清晰可见 |
| 面板尺寸 | 最大高度（`max-height`，内容少时面板会变矮） | **固定高度**（桌面 `height: var(--nvui-panel-max-h)` 88vh / 手机 `height: 92dvh`） | 折叠 / 展开不改变外框，不跳变 |
| 滚动条 | 面板 / 弹窗内容区显示系统滚动条 | `.nvui-panel-body` / `.nvui-modal-body` 隐藏滚动条（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`），**滚动能力保留** | 与扁平玻璃风格一致；内容仍可滚动 |

升级动作：

1. 用 v2.1.1 的 `tokens.css` / `components.css` 覆盖旧文件（token 数量与类名不变，无破坏性）；
2. 如果业务自己给输入框 / 按钮写过 `:focus-visible` 的 `box-shadow: inset ...` 叠边，删掉内圈，只保留 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)`；
3. 如果业务给面板高度写了 `height:auto` / `max-height` 或自定义可见滚动条，改为固定高度 + 隐藏滚动条（参考 [第 12 章](#12-sillytavern-插件面板布局标准桌面--手机)）；
4. 打开 `preview.html` 复核描边强度、输入框聚焦单圈、面板折叠展开不跳变与滚动条隐藏，运行 `npm test`（测试已同步为 2.1.1 新值）。

### 10.7 v2.1.1 → v2.2.0 描边精致化 + 新增 JS API / tokens.json / AI 指南

v2.2.0 是**小版本**：调整描边 token 与描边实现方式，并新增三个可选文件；**无删除 / 重命名类与 token、无破坏性 DOM 变更**（109 令牌 / 47 浅色 / 78 类 / 16 关键帧不变），覆盖 CSS 即可升级，JS API 按需引入。

| 变更 | v2.1.1 | v2.2.0 | 影响 / 说明 |
| :--- | :--- | :--- | :--- |
| 圆角玻璃外框 | 1px `--nvui-glass-line` 描边（0.03 / 0.18） | **移除**（modal / panel / floating / tooltip / toast / glass 共 6 处无 border），改用柔和顶部受光 `--nvui-glass-highlight`（深 0.05 / 浅 0.40）+ 阴影 | 消除圆角处 1px 亚像素锯齿，边缘更精致 |
| 直线分隔 | `--nvui-glass-line` 0.03 / 0.18 | `--nvui-glass-line` 深 0.06 / 浅 0.28，用于 header / footer / 导航底边共 7 处 | 直线不产生圆角锯齿，分隔仍清晰 |
| ghost 按钮 | `--nvui-line-2` 细描边 | 无描边，改 `--nvui-block-bg` 淡底（hover `block-bg-2`） | 与扁平风格一致 |
| 空态 | 虚线圆角边 | 无虚线边，改 `--nvui-bg-3` 淡底 + 居中提示 | 去锯齿 |
| 标签指示器 | 1px 内环 | 无内环，改底部直线 `inset 0 -2px 0 var(--nvui-accent-line)` | 更利落，与标签底边对齐 |
| 焦点环 | 单圈 1.5px | **单圈 2px 整数像素**（`--nvui-focus-ring-w: 2px`） | 缩放更清晰，无双环 / 虚边 |
| 新增文件 | 无 | `nvui-api.js`（可选运行时 API）、`tokens.json`（109/47 机器可读镜像）、`AI-GUIDE.md`（AI 协作指南） | 不计入 token / 组件类数量；见第 13 章 |

升级动作：

1. 覆盖 `tokens.css` / `components.css`（token 数量与类名不变，无破坏性；描边观感自动改善）；
2. 如需用 JS 生成面板 / 吐司：引入 `<script src="./ui-kit/nvui-api.js"></script>`（或 Node 侧 `require`），参考 [第 13 章](#13-js-api-与-ai-协作指南)；不引入也不影响纯 CSS 用法；
3. 其它软件 / AI 协作：先读 [`AI-GUIDE.md`](AI-GUIDE.md)，需要结构化令牌数据读 [`tokens.json`](tokens.json)（勿手改，源是 `tokens.css`）；
4. 运行 `npm test`（测试已同步 2.2.0：新增文件门禁 + 描边无锯齿断言）。

### 10.8 v2.2.0 → v2.3.0 浮层载体层级修复（新增 `--nvui-z-layer`）

v2.3.0 是**小版本**：修复一个靠沙盒测试发现不了、只在真实宿主暴露的层级 bug，并新增 1 个令牌；**无删除 / 重命名类与 token、无破坏性 DOM 变更**（109 → 110 令牌 / 47 浅色 / 78 类 / 16 关键帧），覆盖 CSS 即可升级。

**bug 真相（2026-10 novel-stream 实机冒烟测试定位）**

- 非模态 `dialog.show()` **不进浏览器 top layer**——top layer 只服务于 `showModal()` 的模态对话框（其 `inert` 会废掉宿主交互，故 kit 禁用模态）。此前 README / 注释宣称载体「借 dialog 提升渲染层级」「实际层级由 top layer 决定」，均为想当然的错误论断；
- 载体与普通 fixed div 层级平等，会被宿主任何正 z-index 表面整块盖住：酒馆 `#sheld`（聊天容器，`position:absolute; z-index:30`）在聊天非空时盖死整个 kit 面板（沙盒测试无宿主层级竞争，集体失明）；
- 中性页对照实验（Edge 152）：`show()` 的 dialog 输给 `z-index:30` 的 div，`showModal()` 才赢——进一步印证模态才进 top layer。

| 变更 | v2.2.0 | v2.3.0 | 影响 / 说明 |
| :--- | :--- | :--- | :--- |
| 载体层级 | 无 z-index（错误地依赖「dialog 提升层级」） | `z-index: var(--nvui-z-layer)`（`1000000`） | 压过宿主竞争上限（约 29999）；子浮层仍在载体的层叠上下文内按 floating / overlay / tooltip 排位 |
| 新增令牌 | 无 | `--nvui-z-layer: 1000000`（载体档，低于 floating 1000010） | 令牌总数 109 → 110；浅色主题不覆盖（层级与主题无关） |
| 文档论断 | 「top layer 决定层级」「酒馆 html 有 transform 所致」 | 改为实测真相 + 档位机制说明（§6.6 / §7.3 / §8 红线 1 / AI-GUIDE 硬约束 3） | 防止后续消费者重复踩坑 |
| 测试 | 无宿主遮挡场景 | 新增「宿主 z-30 遮挡物 + 面板 elementFromPoint 命中」回归断言 | 沙盒里复刻 `#sheld` 竞争 |

升级动作：

1. 覆盖 `tokens.css` / `components.css`（新增 1 个 token、载体加 1 行 z-index，无破坏性）；
2. 若业务自己写过 body 级浮层：确认它在 `dialog.nvui-tl` 载体内，或自带 ≥ 30000 的 z-index；
3. 运行 `npm test`（测试已同步 2.3.0：token 110 + 载体层级回归断言）。

---

## 11. 版本管理

- 当前 **v2.3.0**（2026-10-20）：**浮层载体层级修复**——非模态 `dialog.show()` 实测不进浏览器 top layer（只有 `showModal()` 进，但其 `inert` 会废掉宿主交互），载体此前无 z-index，会被宿主正 z-index 表面（酒馆 `#sheld` z-index:30，聊天非空时）整块盖住；新增 `--nvui-z-layer: 1000000` 载体档位并修正文档中「dialog 提升渲染层级」的错误论断；110 令牌 / 47 浅色 / 78 类 / 16 关键帧，无破坏性变更（小版本）。
- 变更记录（倒序）：
  - **v2.3.0**：新增 `--nvui-z-layer: 1000000`（`dialog.nvui-tl` 载体档位，非模态无 top layer 提升、档位即生命线）；修正 §6.6 / §7.3 / §8 红线 1 / §10.8 / AI-GUIDE 中「dialog 提升层级 / top layer 决定层级 / html transform」等错误论断为实测真相；测试新增宿主 z-30 遮挡 + elementFromPoint 命中回归断言（共 229 条）；README 新增 §10.8；CHANGELOG / package.json / tokens.json 升 2.3.0。
  - **v2.2.0**：描边精致化（6 处分圆角玻璃去外框 1px、7 处直线分隔改玻璃分隔色、ghost/空态/指示器去圆角描边、焦点环 1.5px → 2px 单圈）；新增可选 JS API（`nvui-api.js`，`createPanel` / `showToast` 等）、`tokens.json`（109/47）、`AI-GUIDE.md`；README 新增第 13 章「JS API 与 AI 协作指南」（原许可顺延第 14 章）、§10.7 修订说明；无破坏性变更。
  - **v2.1.1**：补丁迭代——描边 token 再降一档（line / line-2 / dash / block-line / block-line-2 / glass-line / glass-highlight）、`--nvui-focus-ring-w` 2px → 1.5px 且单圈不叠边、`.nvui-panel` 固定高度（折叠展开不跳变）、`.nvui-panel-body` / `.nvui-modal-body` 隐藏滚动条（保留滚动）；README §10.6 记录修订，第 12 章补固定尺寸与滚动条说明；无破坏性变更。
  - **v2.1.0**：新增面板布局标准组件族（`.nvui-panel` 及 header/title/actions/body/footer/heading、`.nvui-sheet-handle`、`.nvui-bottom-nav` + item）与 2 个尺寸令牌；桌面/手机同一 DOM 响应式切换；tab ↔ 底部导航同步 JS 约定；新增第 12 章规范、§10.5 接入说明；无破坏性变更。
  - **v2.0.1**：反馈驱动补丁（玻璃更透 + 浮层描边更柔和 + 16 关键帧动效补强 + 标签粘连指示器 + 数字步进按钮隐藏 + popover AA 政策调整）；`--nvui-glass-*` / `--nvui-overlay-bg` 取值更新，`.nvui-tooltip` 文字改正文色；新增可选第 68 类 `.nvui-tabs-indicator`；preview 加「强制播放动效」演示开关；README §2.6 动效降级说明、§4.4 政策重写、§7.7 指示器配方、§10.4 记录修订。
  - **v2.0.0**：Flat Glass 扁平玻璃设计语言；破坏性变更（删除 `--nvui-shadow-accent`、折叠需包 `.nvui-acc-inner`、overlay/阴影/过渡取值升级、焦点环统一 token）；新增玻璃 7/焦点 3/动效 12/骨架屏 2 令牌与 `--nvui-radius-xl`、`--nvui-on-accent`（共 107 个）；新增 14 个类（玻璃/实心/吐司/进度条/骨架屏/状态点/动效工具类/折叠裁切层）；能力降级（`@supports` / `prefers-reduced-transparency` / `forced-colors` / 窄屏模糊降档）；AA 安全玻璃与玻璃合成对比度测试；开关非文本对比度与状态行对比度修复；`!important` 预算与测试门禁。
  - **v1.1.0**：独立项目化封装；README 去除对来源仓库的相对链接；守护测试改为项目内自洽（内置核心 token 金标准 + 多处版本一致性），不再读取外部仓库文件。
  - **v1.0.0**：首个版本。token 体系、组件样式、预览页、规范文档、`test/test-ui-kit.js`。
- 兼容性约定：
  - 修 bug / 调整单个 token 值 / 动效打磨 / 反馈修复：补丁版本（2.1.x）；
  - 新增组件 / 新增 token / 新增可选文件（不破坏既有 DOM 与取值）：小版本（2.x.0）；当前 **2.3.0** 即小版本迭代（载体层级修复 + 新增 `--nvui-z-layer`），无破坏性变更，覆盖 CSS 即可升级；
  - 重命名类/token、删除 token、修改 DOM 契约：大版本（x.0.0），并同步更新本文件的迁移对照表与 `test/test-ui-kit.js` 的金标准/必填清单。
- 升级步骤：用新版本目录覆盖 `tokens.css` / `components.css` → 打开 `preview.html` 确认视觉无回归 → 在本目录运行 `npm test` →（若集成在插件中）再跑该插件的测试。v2.0.1 的升级细节见 [10.4](#104-v200--v201-修订说明)，v2.1.0 面板布局接入见 [10.5](#105-v201--v210-新增面板布局标准) 与 [第 12 章](#12-sillytavern-插件面板布局标准桌面--手机)，v2.1.1 描边 / 尺寸 / 滚动条调整见 [10.6](#106-v210--v211-描边再减弱--单圈焦点环--固定面板尺寸--隐藏滚动条)，v2.2.0 描边精致化与 API 接入见 [10.7](#107-v211--v220-描边精致化--新增-js-api--tokensjson--ai-指南) 与 [第 13 章](#13-js-api-与-ai-协作指南)，v2.3.0 浮层载体层级修复见 [10.8](#108-v220--v230-浮层载体层级修复新增---nvui-z-layer)。

> 备注：`ui-kit/` 作为独立项目时，版本号只看本目录内的 `package.json` / `CHANGELOG.md`；它不代表任何宿主插件的版本。

---

## 12. SillyTavern 插件面板布局标准（桌面 / 手机）

很多 SillyTavern 插件都需要一个「设置面板」。本章给出一套**跨桌面/手机共用同一份 DOM** 的排列标准（v2.1.0 新增）：

- **电脑（>600px）**：居中玻璃面板，宽 `--nvui-panel-width`（880px，`min(…, 100%)`）、固定高 `--nvui-panel-max-h`（88vh），顶部横向 tabs 做分区导航；
- **手机（≤600px）**：底部抽屉（bottom sheet），全宽、固定高 `92dvh`、仅上圆角，隐藏顶部 tabs，改用**底部图标导航** + 拖拽把手 + safe-area。

> **只参考排列结构，不复制皮肤**：本章的层次（标题栏 → 分区导航 → 内容列表 → 可选底部操作）来自常见插件面板的截图结构，但视觉一律使用 Kit 的 **Flat Glass**（紫色强调、磨砂玻璃、扁平列表、统一焦点环），不引入参考图的青色/他插件配色。组件实现见 `components.css`，`preview.html` 第 18 节有可打开的真实面板 demo（`?panel=1`）。

### 12.1 设计目标

1. **同一份 DOM 自适应**：桌面顶部 tabs 与手机底部导航是同一份面板 DOM 的两种呈现，CSS 断点自动切换；不需要为两端写两套 HTML。
2. **固定尺寸、不跳变（v2.1.1）**：面板外框尺寸固定——宽 `min(var(--nvui-panel-width), 100%)`（默认 880px 上限）、桌面高 `var(--nvui-panel-max-h)`（88vh）、手机高 `92dvh`；折叠/展开内容只改变 `.nvui-panel-body` 内部滚动内容，**不改变面板外框**。
3. **单一滚动层、隐藏滚动条（v2.1.1）**：只有 `.nvui-panel-body` 滚动（`overflow-y:auto`），且滚动条隐藏（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`），**滚动能力保留**；避免嵌套滚动与滚动穿透。
4. **玻璃 + 扁平**：面板本体用玻璃（`--nvui-glass-bg` + 模糊 + 最低对比受光边 + 圆角），内部列表/折叠/开关保持扁平色阶（不描边、不投影）。
5. **可访问性内建**：`role="dialog"` + `aria-modal="true"` + `aria-labelledby`；焦点管理沿用 [2.3 弹窗骨架](#23-弹窗骨架含-top-layer-载体) 配方；底部导航用 `aria-current="page"`。
6. **可组合**：分区内容直接复用第 7 章组件（tabs/tabpane、switch-row、acc、badge、alert、progress、toast 等），不新增内容组件。

### 12.2 桌面装配图（>600px）

```text
+------------------------------------------------------------------------------------------+
|  .nvui-overlay.is-panel（flex 居中 + padding: space-4）                                   |
|   +------------------------- .nvui-panel（min(880px,100%) / 固定高 88vh）---------------+  |
|   |  .nvui-panel-header    插件标题（fs-2xl 粗体，单行省略）      [更多]  [关闭]       |  |
|   +------------------------------------------------------------------------------------+  |
|   |  .nvui-tabs（桌面顶部导航，常显）  [连载] [过滤] [导出] [同步] [关于]             |  |
|   +------------------------------------------------------------------------------------+  |
|   |  .nvui-panel-body（flex:1 / min-height:0 / overflow-y:auto —— 唯一滚动层）         |  |
|   |    .nvui-panel-heading   分区标题「设置」                       [v1.0.0 徽标]      |  |
|   |    .nvui-switch-row.is-feature   高亮功能开关行（左侧主色竖条 + 淡底）             |  |
|   |    .nvui-acc   折叠分组 1（右侧摘要 = 当前值）                                     |  |
|   |    .nvui-acc   折叠分组 2                                                          |  |
|   |    .nvui-acc   折叠分组 3                                                          |  |
|   +------------------------------------------------------------------------------------+  |
|   |  .nvui-panel-footer（可选）                                       [取消]  [保存]   |  |
|   +------------------------------------------------------------------------------------+  |
+------------------------------------------------------------------------------------------+
```

要点：电脑端顶部 tabs 是**分区导航**（切换的是 `.nvui-tabpane`），不是页面跳转；面板四角均为 `--nvui-radius-xl`；遮罩仍拦截背景点击，Esc / 点遮罩关闭沿用 §2.3。

### 12.3 手机装配图（≤600px）

```text
+--------------------------------- 手机（<=600px）--------------------------------+
|  .nvui-overlay.is-panel（align-items: flex-end + padding: 0）                     |
|   +---------------- .nvui-panel（宽 100% / 固定高 92dvh / 仅上圆角）-------------+  |
|   |            .nvui-sheet-handle（40x4 拖拽把手，居中，aria-hidden）           |  |
|   |  .nvui-panel-header    插件标题                                [关闭]       |  |
|   |  （桌面用的 .nvui-tabs 在手机端 display:none）                              |  |
|   |  .nvui-panel-body（唯一滚动层）                                             |  |
|   |    .nvui-panel-heading   分区标题「设置」                    [v1.0.0 徽标]  |  |
|   |    .nvui-switch-row.is-feature   高亮功能开关行                             |  |
|   |    .nvui-acc   折叠分组 1                                                   |  |
|   |    .nvui-acc   折叠分组 2                                                   |  |
|   +----------------------------------------------------------------------------+  |
|   |  .nvui-bottom-nav（底部图标导航，常显；padding-bottom 自动加 safe-area）    |  |
|   |    [连载] [过滤] [导出] [同步] [关于]   （图标 + 极短文字 / sr-only 文字）   |  |
|   +----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

要点：手机端**不要**把 `.nvui-bottom-nav` 改成 `position:fixed` 覆盖 `body`——它就是面板 flex 布局的最后一个子项，safe-area 由 `env(safe-area-inset-bottom)` 自动内边距处理；拖拽把手只是视觉把手（真正的拖拽/下滑关闭由业务 JS 按需实现，非必须）。

### 12.4 新增组件类（10 个，v2.1.0）

| 类名 | 说明 |
| :--- | :--- |
| `.nvui-panel` | 面板本体：`display:flex; flex-direction:column`；`width: min(var(--nvui-panel-width), 100%)`；**`height: var(--nvui-panel-max-h)`（固定高度，折叠展开不跳变）**；`min-height:0; overflow:hidden`；玻璃（`--nvui-glass-bg` + `--nvui-glass-blur` + `--nvui-glass-saturate`）+ `--nvui-radius-xl` + `--nvui-shadow-modal`；**v2.2.0 起无外框 1px 描边**（柔和顶部受光 + 阴影成形） |
| `.nvui-panel-header` | 标题栏：标题 + 右侧操作区，`justify-content:space-between`，底部**直线分隔**（`--nvui-glass-line`），`flex-shrink:0`；手机减 padding、去底边 |
| `.nvui-panel-title` | 面板标题：`--nvui-fs-2xl` 粗体、单行省略；`aria-labelledby` 指向它 |
| `.nvui-panel-actions` | 右侧操作区（`.nvui-icon-btn` 组，含关闭按钮）；`flex-shrink:0` |
| `.nvui-panel-body` | 内容区：`flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain`；**全面板唯一滚动层**；手机 padding 收窄 |
| `.nvui-panel-footer` | 可选底部操作区：右对齐按钮组，顶部**直线分隔**（`--nvui-glass-line`），`flex-shrink:0` |
| `.nvui-panel-heading` | 内容区顶部的「分区标题 + 版本徽标」行（`display:flex; justify-content:space-between`）；内部 `.nvui-section-title` 占满剩余宽度 |
| `.nvui-sheet-handle` | **仅手机显示**的拖拽把手：40×4、pill 圆角、`--nvui-block-line-2` 底；桌面 `display:none`；加 `aria-hidden="true"` |
| `.nvui-bottom-nav` | **仅手机显示**的底部图标导航：`display:flex; justify-content:space-around`，顶部发丝线，`padding-bottom` 含 `env(safe-area-inset-bottom)`；桌面 `display:none` |
| `.nvui-bottom-nav-item` | 底部导航项：`<button>` + 图标 `<i>`（或内联 SVG）+ 极短文字 / `.nvui-sr-only` 文字；未激活用 `--nvui-text-2`、激活用 `--nvui-text`（玻璃上保证 AA，勿用 `text-3` 承载导航信息）；`:active` 缩放 0.96；`:focus-visible` 内缩焦点环；`:disabled` 降透明 |

配套状态类（不新增组件类）：

| 状态类 | 说明 |
| :--- | :--- |
| `.nvui-overlay.is-panel` | 面板模式遮罩：桌面 flex 居中 + `padding: space-4`；手机改为底部对齐 + `padding:0` |
| `.nvui-switch-row.is-feature` | 高亮功能行：左侧 2px 主色竖条 + `block-bg` 淡底 + 标题 `semibold`；用于「最常用/首个功能开关」 |
| `.nvui-bottom-nav-item.is-active` | 手机导航当前项：主色淡底 + **正文色文字**（`--nvui-text`；玻璃最坏宿主下 AA，勿用主色文字）；同时必须有 `aria-current="page"` |

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
                <button type="button" class="nvui-tab" role="tab" data-key="sync"
                        id="ptab_sync" aria-selected="false" aria-controls="ppane_sync">同步</button>
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
                <div class="nvui-tabpane" id="ppane_sync" role="tabpanel" aria-labelledby="ptab_sync" hidden> ... </div>
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
                <button type="button" class="nvui-bottom-nav-item" data-tab="sync">
                    <i class="fa-solid fa-rotate"></i><span>同步</span>
                </button>
                <button type="button" class="nvui-bottom-nav-item" data-tab="about">
                    <i class="fa-solid fa-circle-info"></i><span>关于</span>
                </button>
            </nav>
        </div>
    </div>
</dialog>
```

打开 / 关闭面板直接复用 [2.3 弹窗骨架](#23-弹窗骨架含-top-layer-载体) 的 `show()`/`hidden`/`is-closing`/焦点管理配方；`role="dialog"` 放在 `.nvui-panel` 上（不是遮罩上）。

### 12.6 响应式规则（断点统一为 600px）

| 规则 | 桌面（>600px） | 手机（≤600px） |
| :--- | :--- | :--- |
| `.nvui-overlay.is-panel` | flex 居中 + `padding: --nvui-space-4` | `align-items: flex-end` + `padding: 0` |
| `.nvui-panel` 宽度 | `min(var(--nvui-panel-width), 100%)`（默认 880px 上限） | `width: 100%` |
| `.nvui-panel` 高度（**固定**） | `height: var(--nvui-panel-max-h)`（默认 88vh；不随内容变化） | `height: 92dvh`（固定；不随内容变化） |
| 圆角 | `--nvui-radius-xl`（四角） | 仅上圆角 `xl xl 0 0`（底部抽屉） |
| 顶部 tabs | 显示 | 隐藏（导航交给底部） |
| `.nvui-sheet-handle` | 隐藏 | 显示 40×4 拖拽把手 |
| `.nvui-bottom-nav` | 隐藏 | 显示 + `env(safe-area-inset-bottom)` 内边距 |
| 滚动 | 仅 `.nvui-panel-body` 滚动，**滚动条隐藏**（仍可滚动） | 同左 |
| 折叠/展开 | 只改变 body 内滚动内容，面板外框尺寸不变 | 同左 |
| 形态 | 居中对话框（dialog） | 底部抽屉（bottom sheet） |

> **固定尺寸（v2.1.1）**：`.nvui-panel` 使用固定 `height`（桌面 `--nvui-panel-max-h` / 手机 `92dvh`），因此折叠展开、切换 tab 都不会改变面板外框，不会"跳变"；内容溢出交给 `.nvui-panel-body` 滚动，滚动条通过 `scrollbar-width: none` 与 `::-webkit-scrollbar { display: none }` 隐藏。窄屏规则与 Kit 其它组件共用 `@media (max-width: 600px)`；不要为面板单独定义第二套断点。

### 12.7 导航同步 JS 配方（tabs ↔ 底部导航 ↔ tabpane）

桌面顶部 tabs 与手机底部导航必须**共享同一份状态**：切换任意一端，另一端的高亮、`aria-*`、面板可见性都要同步。

```js
function setupPanelNav(panel) {
    const tabs = [...panel.querySelectorAll('.nvui-tab')];
    const navItems = [...panel.querySelectorAll('.nvui-bottom-nav-item')];
    const panes = [...panel.querySelectorAll('.nvui-tabpane')];
    const indicator = panel.querySelector('.nvui-tabs-indicator');

    function activate(key) {
        tabs.forEach((t) => {
            const on = t.dataset.key === key;
            t.classList.toggle('is-active', on);
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
            if (on && indicator) syncIndicator(t);        // 复用 §7.7 的指示器同步
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
    }

    // 桌面 tabs：点击切换
    tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.key)));
    // 手机底部导航：点击切换（同一份状态）
    navItems.forEach((n) => n.addEventListener('click', () => activate(n.dataset.tab)));
    // 键盘 ←/→ 在 tabs 内切换（焦点跟随）
    panel.querySelector('.nvui-tabs').addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const cur = tabs.findIndex((t) => t.classList.contains('is-active'));
        const next = tabs[(cur + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        activate(next.dataset.key);
        next.focus();
    });

    // 初始状态以 tabs 的 is-active 为准
    activate((tabs.find((t) => t.classList.contains('is-active')) || tabs[0]).dataset.key);
}
// 用法：document.querySelectorAll('.nvui-panel').forEach(setupPanelNav);
```

约定与注意：

- `data-key`（tabs）/ `data-tab`（底部导航）与 `tabpane` 的 `id` 对应关系：`ppane_<key>`；不写死中文文案。
- 桌面与手机是同一份状态：在桌面切到「导出」后把窗口缩到手机宽度，底部导航应仍是「导出」高亮（因为状态只有一份）。
- 指示器同步可直接复用 [7.7 标签页](#77-标签页激活弹跳--粘连指示器) 的 `setupTabsIndicator`；面板内 tabs 同时要处理横向滚动。
- 面板打开/关闭后把焦点移入面板、关闭后归还触发元素（见 §2.3）；`aria-modal="true"` 必须配合焦点陷阱。
- 若面板内容里用到 `.nvui-toast-stack`，仍必须放进 `dialog.nvui-tl` 顶层载体（宿主层级红线，见第 8 节）。

### 12.8 内容排列规范

- **分区标题 + 版本徽标**：`.nvui-panel-heading` 固定放在 `.nvui-panel-body` 顶部（可直接放在 body 内、tabpane 外），左边 `.nvui-section-title`、右边 `.nvui-badge` 版本号；每个分区只放一个 heading。
- **高亮功能行 `is-feature`**：用于「本分区最常用的一个开关」，左侧主色竖条 + 淡底 + 标题加粗；**每个 tabpane 最多 1 行**，不要把所有开关都标成 feature。
- **折叠分组列表**：设置项用 `.nvui-acc` 分组，`nvui-acc-summary` 必须显示当前值；面板内折叠列表由 `.nvui-panel-body > .nvui-acc` 自动收紧间距（与参考图一致）。
- **可选 footer**：只在需要「取消 / 保存 / 应用」等持久操作时添加 `.nvui-panel-footer`；纯浏览型面板可省略，把操作放进内容区。
- **固定外框、不跳变（v2.1.1）**：面板高度固定（桌面 88vh / 手机 92dvh），折叠展开、切换 tab 只改 `.nvui-panel-body` 内部滚动内容，**不允许把 `.nvui-panel` 高度设成 auto**；内容溢出由 body 滚动处理，滚动条隐藏但滚动能力保留。
- **底部导航项数量**：建议 3~5 项（与顶部 tabs 一一对应），超过 5 项时考虑分组而不是继续塞图标；图标 + 极短文字（≤2 个汉字）。
- **不要重复导航**：同一时刻只能看到一种导航（桌面 tabs / 手机底部导航，CSS 已互斥），不要用 JS 强行让两套同时显示。

### 12.9 无障碍与焦点

- `.nvui-panel` 上 `role="dialog"` + `aria-modal="true"` + `aria-labelledby="panel_title"`（指向 `.nvui-panel-title`）。
- 关闭按钮必须是 `.nvui-icon-btn` 且带 `aria-label`（如「关闭」）；「更多操作」等图标按钮同样要有 `aria-label`。
- 桌面 tabs：`role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected` + `aria-controls` + `tabIndex=0/-1`（沿用 §7.7）。
- 手机底部导航：`<nav aria-label="面板分区（手机）">` + `<button>`；当前项 `aria-current="page"`，切换时同步增删。
- 焦点管理沿用 [2.3 弹窗骨架](#23-弹窗骨架含-top-layer-载体)：打开移入面板（优先主按钮/标题 `tabindex="-1"`）、Tab/Shift+Tab 焦点陷阱、关闭归还触发元素。
- 拖拽把手 `.nvui-sheet-handle` 是纯视觉元素：`aria-hidden="true"`，不要给它 tabindex；若实现下滑关闭，必须同时提供按钮/Esc 等价关闭方式。
- 所有交互元素都要有 `:focus-visible` 焦点环（kit 已通过 `--nvui-focus-ring-*` token 统一；v2.1.1 起为**单圈 1.5px**，不再叠加内圈描边）。
- 手机底部导航的点击区域 ≥ 44px 高（kit 默认 `padding: space-15 0` + 图标 + 文字，已满足）；不要在图标上再加 `title` 代替可见文字。

### 12.10 Do / Don't

**Do**

- 用同一份 DOM 同时适配桌面与手机，靠 600px 断点切换导航形态。
- 让 `.nvui-panel-body` 成为面板内唯一滚动层；面板本身 `overflow:hidden`；滚动条隐藏但保留滚动能力。
- 保持面板**固定高度**（桌面 88vh / 手机 92dvh），折叠展开与 tab 切换不改变外框。
- 桌面 tabs 与手机底部导航共用同一份激活状态与 JS 同步函数。
- 图标使用 Font Awesome（`<i class="fa-solid fa-...">`）或内联 SVG；文字用中文短标签。
- 面板打开时按 §2.3 做焦点移入/陷阱/归还；关闭支持 Esc 与点遮罩。
- 面板内直接复用 Kit 现有组件（switch-row、acc、badge、alert、progress、toast 等），保持视觉一致。

**Don't**

- **不要同时显示两套导航**：桌面顶部 tabs 与手机底部导航靠媒体查询互斥；不要用 JS `display` 覆盖 CSS 造成双导航。
- **不要给 `.nvui-panel` 或 `.nvui-panel-body` 再套一层 `overflow:auto` 的独立滚动层**：会出现双滚动条、滚动穿透与高度计算问题。
- **不要把 `.nvui-panel` 高度设成 `auto` / `fit-content`**：折叠展开时外框会跳变，违背固定尺寸标准；也不要给滚动区自写可见滚动条样式。
- **手机不要把 `.nvui-bottom-nav` 改成 `position:fixed` 覆盖 `body`**：它是面板 flex 列的最后一项，`env(safe-area-inset-bottom)` 已在组件内处理。
- **不要把底部导航做成 `<a href="#">`**：用 `<button>` + `aria-current`，避免页面跳动与语义错误。
- **不要复刻参考图的青色/他插件皮肤**：视觉只使用 Kit 的紫色 Flat Glass token，换色只改 `tokens.css`。
- **不要在面板里用裸 `position:fixed` 子元素**（弹窗/吐司/工具提示同理）：必须走 `dialog.nvui-tl` 顶层载体——非模态 dialog 无 top layer 提升，载体自带 `--nvui-z-layer` 档位压过宿主竞争（第 8 节红线）。
- **不要把滚动容器设成面板本身**：`.nvui-panel` 一旦滚动，底部导航会跟着内容滚走。

---

## 13. JS API 与 AI 协作指南

v2.2.0 新增三个可选的协作资产，让「用 Kit 规范做界面」从"读文档手写"变成"可调用、可机器读、可交给 AI"：

| 文件 | 作用 | 是否必须 |
| :--- | :--- | :--- |
| [`nvui-api.js`](nvui-api.js) | 零依赖运行时 API：用函数生成符合第 12 章布局标准与 §7 无障碍契约的面板 / 行组件 / 吐司 | 可选（需要 JS 生成 DOM 时） |
| [`tokens.json`](tokens.json) | `tokens.css` 的机器可读镜像（dark 110 / light 47），供构建工具、其它软件、AI 读取 | 可选 |
| [`AI-GUIDE.md`](AI-GUIDE.md) | 给 AI 编码助手的操作手册：硬约束、读文件顺序、标准流程、提示词模板、验收清单 | 可选（AI 协作时强烈建议） |

不引入这三个文件不影响纯 CSS 用法；它们不改变任何既有类名、DOM 契约与 token 取值。

### 13.1 设计调用 API（`nvui-api.js`）

**定位**：可选运行时（UMD 包装，零依赖、无网络请求、无 emoji）；加载时不访问 DOM（Node 里 `require` 只拿到 API 对象，方便测试/静态生成）；所有 DOM 操作在函数调用时发生；只使用 `nvui-` 类与 CSS token，自动带上布局标准、a11y、焦点管理与动效降级（降级交给 CSS）。

**加载方式**

```html
<!-- 浏览器：插件内相对路径引入 -->
<script src="./ui-kit/nvui-api.js"></script>
<script>
    // 之后可直接使用全局 NVUI
    NVUI.showToast({ message: '已保存', type: 'success' });
</script>
```

```js
// Node（测试 / 构建期静态生成；不触发 DOM）
const NVUI = require('./nvui-api.js');
console.log(NVUI.version);        // '2.2.0'
console.log(typeof NVUI.createPanel); // 'function'
```

**函数表**

| API | 说明 | 返回 |
| :--- | :--- | :--- |
| `NVUI.version` / `NVUI.VERSION` | 版本号字符串（与 package.json / tokens.css 一致） | `string` |
| `NVUI.PANEL_CLASS` | 面板根类名常量 `'nvui-panel'` | `string` |
| `NVUI.classes` | 常用类名映射（`panel` / `overlayPanel` / `tabs` / `tab` / `tabpane` / `bottomNav` / `bottomNavItem` / `accordion` / `switchRow` / `inputRow` / `toast`） | `object` |
| `NVUI.getToken(name, scope?)` | 读取当前作用域的 CSS 变量值（如 `getToken('--nvui-accent')`） | `string` |
| `NVUI.setTheme(theme, options?)` | 切换主题 / 实心模式（`theme: 'light'`、`options.solid: true`；只切类名，不写颜色） | `void` |
| `NVUI.openLayer(dialogEl, overlayEl)` | 打开 top-layer 载体（非模态 `dialog.show()`，避免 `inert`） | `void` |
| `NVUI.closeLayer(dialogEl, overlayEl, done?)` | 关闭载体（`is-closing` 退场 → `animationend` 或 260ms 兜底 → `hidden` + `close()`） | `void` |
| `NVUI.switchRow(options)` | 生成胶囊开关行（`label`/`value`/`disabled`/`feature`/`onChange`） | `HTMLElement` |
| `NVUI.inputRow(options)` | 生成输入行（`label`/`type`/`value`/`placeholder`/`min`/`max`/`step`/`disabled`/`onChange`） | `HTMLElement`（`row.input` 指向 input） |
| `NVUI.accordion(options)` | 生成折叠分组（`title`/`summary`/`open`/`content[]`） | `HTMLElement`（带 `setOpen` / `setSummary`） |
| `NVUI.progress(options)` | 生成进度条（`value`/`variant`/`indeterminate`） | `HTMLElement`（带 `setValue`） |
| `NVUI.createPanel(options)` | 生成完整插件面板（标题栏 + 顶部 tabs + 内容区 + 可选 footer + 手机底部导航） | 控制器对象（见下） |
| `NVUI.showToast(options)` | 生成吐司（`message`/`type`/`duration`/`icon`/`dismissible`；自动创建 toast 顶层载体） | `{ element, dismiss }` |

**`createPanel(options)` 参数与返回控制器**

| 参数 | 说明 |
| :--- | :--- |
| `id` | 根 id 前缀（默认自动生成） |
| `title` | 面板标题（`aria-labelledby` 指向它） |
| `version` | 右上角版本徽标文字（可选） |
| `tabs` | `[{ key, label, icon }]`；为空时无导航（单页面板） |
| `active` | 初始 tab key（默认第一个） |
| `actions` | 标题栏右侧额外图标按钮 `[{ icon, label, onClick }]` |
| `footer` | 底部按钮 `[{ label, variant, onClick, close }]` |
| `mount` | 挂载节点（默认 `document.body`） |
| `onClose` | 关闭后回调 |

控制器提供：`id` / `dialog` / `overlay` / `panel` / `body` / `tabs` / `bottomNav` 节点，以及
`open()` / `close()` / `setTab(key)` / `syncIndicator()` / `addNode(key, node)` /
`addSwitch(key, opts)` / `addInput(key, opts)` / `addAccordion(key, opts)` / `addProgress(key, opts)` / `addSectionTitle(key, text)`。

**最小示例**

```js
const panel = NVUI.createPanel({
    id: 'my_plugin_panel',
    title: '我的插件设置',
    version: 'v1.0.0',
    tabs: [
        { key: 'basic', label: '基本设置', icon: 'fa-solid fa-sliders' },
        { key: 'advanced', label: '高级', icon: 'fa-solid fa-wrench' }
    ],
    footer: [
        { label: '取消', variant: 'ghost', onClick: () => {} },
        { label: '保存', variant: 'primary', onClick: () => NVUI.showToast({ message: '已保存', type: 'success' }) }
    ]
});
panel.addSwitch('basic', { label: '启用自动连载', value: true, feature: true, onChange: (v) => console.log(v) });
panel.addAccordion('basic', {
    title: '保存位置',
    summary: 'plugins/auto-save/logs',
    content: [panel.addInput('basic', { label: '上限 (MB)', type: 'number', value: 80, min: 1, max: 500 })]
});
panel.addProgress('advanced', { value: 42 });
panel.open();
```

**API 自动保证的行为**（与手写 DOM 一致，无需重复实现）：

- 结构：`dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel`，`role="dialog"` + `aria-modal="true"` + `aria-labelledby`；
- 导航：桌面顶部 `role="tablist"` + 手机底部 `<nav>` 同一份状态（`aria-selected` / `aria-current` / `tabindex` / tabpane 切换）；
- 关闭：关闭按钮 `aria-label`、Esc、点遮罩；关闭后焦点归还触发元素；
- 动效与降级：进出场动画、`prefers-reduced-motion` / `prefers-reduced-transparency` / `forced-colors` / `.nvui-solid` 全部由 CSS 处理。

> API 只负责 DOM 与状态，不写样式；品牌化仍然只改 `tokens.css`（或整体替换同名 token）。不要在 API 之上再叠一层 `!important` 或第二套组件样式。

### 13.2 tokens.json（机器可读令牌镜像）

`tokens.json` 是 `tokens.css` 的机器可读镜像（**由 tokens.css 生成，勿手改**），结构与数量：

```json
{
  "name": "sillytavern-nvui-kit-tokens",
  "version": "2.3.0",
  "description": "SillyTavern UI Kit 设计令牌机器可读镜像（由 tokens.css 生成，勿手改）。dark = 深色默认，light = .nvui-theme-light 覆盖。",
  "generatedFrom": "tokens.css",
  "dark": { "--nvui-bg": "#161a24", "--nvui-accent": "#8b6dff", "...": "共 110 个令牌" },
  "light": { "--nvui-bg": "#f7f8fc", "--nvui-accent": "#6d4df2", "...": "共 47 个覆盖" }
}
```

| 字段 | 说明 |
| :--- | :--- |
| `name` / `version` | 包名与 kit 版本（与 `package.json` 一致） |
| `generatedFrom` | 固定为 `tokens.css`（唯一事实来源） |
| `dark` | 深色默认令牌全集（110 个），键为 `--nvui-*`，值为 CSS 文本 |
| `light` | `.nvui-theme-light` 覆盖（47 个）；未覆盖的 token 继承 `dark` |

**用途**：构建工具生成工具类 / 主题；其它软件导入设计变量；AI 不必解析 CSS 就能知道有哪些 token；设计工具做令牌映射。

```js
// 构建期（Node）
const tokens = require('./ui-kit/tokens.json');
const darkBg = tokens.dark['--nvui-bg'];      // '#161a24'

// 浏览器（离线时也可直接用 script 标签之外的 fetch，或在构建期打包）
const res = await fetch('./ui-kit/tokens.json');
const tokens = await res.json();
```

> `tokens.json` 与 `tokens.css` 必须逐值一致（测试守护）；新增 / 修改 token 时先改 `tokens.css`，再重新生成 JSON，不要反向手改。

### 13.3 AI-GUIDE 使用方式（给 AI 读什么）

[`AI-GUIDE.md`](AI-GUIDE.md) 是给 AI 编码助手的操作手册，覆盖：**硬约束 → 读文件顺序 → SillyTavern 插件面板标准流程 → 其它软件移植 → 提示词模板 → API 速查 → 验收清单**。给 AI 派任务时建议直接附上该文件（或让其先读）。

**推荐阅读顺序（AI 开工前）**：`tokens.json` → `tokens.css` 注释 → `components.css` 契约 → README 第 12 章 + 第 7 章 → `nvui-api.js` → `AI-GUIDE.md` → 本第 13 章。

**给 AI 的硬约束（AI-GUIDE §0 摘要，违反即不合格）**

1. 只用 Kit 的类名与令牌：全部 `nvui-` 前缀 / `is-` 状态类，颜色等一律 `var(--nvui-*)`，**禁止 `#hex` / `rgb()` / `hsl()` 字面量**；
2. 不污染宿主：禁止裸元素选择器、全局重置、`!important`；
3. SillyTavern 浮层必须进 `<dialog class="nvui-tl">` 载体并用非模态 `show()`，禁止 `showModal()`、禁止裸 `position: fixed` 挂 body；
4. 无障碍内建：`role="dialog"` / `aria-modal` / `aria-labelledby`、tabs 语义、`aria-expanded`、关闭按钮 `aria-label`、焦点移入与归还；
5. 尊重系统偏好：动效可被 `prefers-reduced-motion` 降级；玻璃可被减少透明度 / 不支持 `backdrop-filter` / `.nvui-solid` 降级；
6. 无 emoji：图标用 Font Awesome `<i>` 或纯 CSS/SVG 图形；
7. 不改 Kit 契约：不重命名类 / token、不加第二套皮肤；品牌化只整体替换同名 token；
8. 改完必须跑测试：`node test/test-ui-kit.js` 0 失败，并同步 preview 与 README。

**提示词模板（可直接复制给 AI，完整版见 AI-GUIDE §4）**

```text
按 SillyTavern NVUI Kit 规范，为我的插件生成一个设置面板：
- 先读 AI-GUIDE.md 与 README 第 12 章；
- 优先用 nvui-api.js 的 NVUI.createPanel() 生成，不要自写一套 DOM；
- 面板 3 个 tabs：基本 / 高级 / 关于；基本页 1 个 is-feature 开关 + 2 个折叠分组；
- 所有颜色、间距、动效使用 var(--nvui-*) token，禁止硬编码颜色；
- 输出完整 JS 与必要 CSS，并说明如何接入插件；
- 最后按 AI-GUIDE 的验收清单自查，并运行 node test/test-ui-kit.js。
```

**验收清单（AI-GUIDE §3.4 摘要）**：只用 kit 类与 token；无硬编码颜色；无裸选择器 / `!important`；浮层进 `dialog.nvui-tl`；`role`/`aria` 齐全；焦点移入与归还；`prefers-reduced-motion` / 降级可用；preview 与 README 同步；`npm test` 0 FAIL。

> README 是规范本体，AI-GUIDE 是面向 AI 的操作化摘要；两者冲突时以 `tokens.css` / `components.css` 与 README 为准。

### 13.4 移植到其它软件

本目录可整目录复制（`tokens.css` / `components.css` / `nvui-api.js` / `tokens.json` / `AI-GUIDE.md` / `preview.html` / `test/`）到其它项目：

**必须保留**

- token 的名称、语义与对比度（表面层级、玻璃、焦点环、动效体系、面板尺寸）——品牌化时整体替换**同名** token 的值，不要逐个组件改色；
- 组件类名（`nvui-` 前缀）与 DOM 契约、状态类（`is-` 前缀）；
- 无障碍语义：dialog 角色、tabs 语义、`aria-current`、焦点管理；
- 降级行为：`prefers-reduced-motion` / `prefers-reduced-transparency` / `forced-colors` / 不支持 `backdrop-filter` / `.nvui-solid`；
- 规范测试 `test/test-ui-kit.js`（复制后先跑一遍，确保文件齐全、版本一致）。

**需要按宿主替换**

- SillyTavern 专属的 `<dialog class="nvui-tl">` 载体：非模态 `show()` + 载体自身 z-index 档位（`--nvui-z-layer`）双机制——前者避开 `inert`，后者压过宿主层级竞争（酒馆 `#sheld` z-index:30 会盖住无档位容器）；其它框架可映射到自己的 modal / portal 根节点，但必须保持等价的层级语义、`role="dialog"`、焦点移入/归还；
- 图标字库：Font Awesome 可换成你项目使用的图标方案（保持 `<i>` / SVG 的可访问写法）；
- 宿主主题变量：不要混用目标软件的全局 CSS 变量，Kit 浮层继续用 `--nvui-*` 自包含配色；
- 构建体系：`nvui-api.js` 是 UMD 零依赖文件，可直接 `<script>` 或打包引用；`tokens.json` 可在构建期生成为你框架的变量文件。

**不要做**：重命名 `nvui-` 类与 `--nvui-*` token；删除降级块；把组件塞进目标软件的全局重置里；给组件加第二套皮肤。

---

## 14. 许可

MIT，见同目录 [LICENSE](LICENSE)。本目录是独立项目，可整体移动/复制到任意位置；复制到其它插件时请保留本目录与版本号，便于后续同步上游修复。
