# AI 协作设计指南 · 用 SillyTavern NVUI Kit 规范设计面板

> 版本：**v3.1.1** · 适用对象：SillyTavern 插件开发者、其它软件项目、以及被要求「按规范生成/修改界面」的 AI 编码助手。
> 配套文件：[tokens.css](tokens.css)（设计令牌）、[components.css](components.css)（组件样式）、[README.md](README.md)（完整规范）、[nvui-api.js](nvui-api.js)（零依赖运行时 API）、[tokens.json](tokens.json)（令牌机器可读镜像）、[test/test-ui-kit.js](test/test-ui-kit.js)（规范守护测试）。

本文档回答两个问题：

1. **SillyTavern 插件**应该怎么规范设计面板（可直接照抄的 DOM/API 配方与验收清单）；
2. **其它软件**要复用这套设计时，必须保留什么、可以替换什么。

---

## 0. 给 AI 的硬约束（先读，违反即不合格）

1. **只用 Kit 的类名与令牌**：所有类名 `nvui-` 前缀、状态类 `is-` 前缀；颜色/圆角/间距/动效一律用 `var(--nvui-*)`，禁止 `#hex`、`rgb()`、`hsl()` 字面量。
2. **不污染宿主**：禁止裸元素选择器（`button {}`、`input {}`）、禁止全局重置、禁止 `!important`。Kit 只在四类**有界**规则里使用（合计 18 条）：① 宿主 checkbox `::before` 压制（2 条，`.nvui-checkbox` / `.nvui-switch-row` 共用）；② `prefers-reduced-motion` 降级（5 条）；③ 宿主表单控件隔离（7 条，作用域为 `dialog.nvui-tl` + `.nvui-panel` 两个默认载体，以及显式加 `.nvui-form-scope` 的自定义普通容器；值只能是指定 token 或 `border: none` / `margin: 0` 这类明确 reset）。**不要**把 `background` / `color` / `margin` 当通用放行证；`.nvui-form-scope` 只接管容器内 `.nvui-input`，不接管非 kit 控件，也不创建定位 / 遮罩 / 模态。
3. **SillyTavern 浮层必须进 `<dialog class="nvui-tl">` 载体**：非模态 `dialog.show()`（禁止 `showModal()`——会给文档加 `inert`；也**不要**以为非模态能靠浏览器 top layer 提层——实测它不进 top layer）、禁止裸 `position: fixed` 挂 body（宿主 `html` 有 transform，手机端会被顶出屏幕）。
   - **载体必须自带 z-index**（Kit 已内置 `z-index: var(--nvui-z-layer)`）。实测：非模态 `dialog.show()` 不会进入浏览器 top layer（只有 `showModal()` 会，而它会加 `inert`）。载体是 `position:fixed`，会创建层叠上下文，内部子元素的 z-index 只在载体内部生效 —— 载体自身若为 `z-index:auto`，浮层整体只相当于 z-index 0，会被酒馆 `#sheld`（z-index:30）压住，表现为「面板被酒馆窗口压在后面」。
   - 吐司载体请加 `.nvui-tl-toast`（`NVUI.showToast` 已内置），使其层级（`--nvui-z-tooltip`）高于面板载体（`--nvui-z-layer`）。
   - **宿主模态期间 kit 浮层必须主动让位（v2.4.0）**：宿主用 `dialog.showModal()` 打开模态时会给**整页**加 `inert`，而 `inert` 元素**不参与命中测试** —— 此时 kit 浮层**物理上不可能**既压过模态又保持可交互（**任何** z-index / top layer 手段都无效，`popover="manual"` 亦然，实测证伪）。正确行为是让位：kit 载体自动加 `.is-host-modal`（`pointer-events:none` + `opacity:0.35` + `grayscale(0.6)`），宿主模态关闭后**自动还原**。宿主**无需任何配合**；若你是在写宿主端代码且希望「模态期间仍能操作 kit 浮层」，请改用**非模态** `<dialog>` + 自绘遮罩，不要用 `showModal()`。详见 README §13.7。
4. **无障碍内建**：面板 `role="dialog" aria-modal="true" aria-labelledby`；标签页 `role="tablist"/"tab"/"tabpanel"` + `aria-selected` + `aria-controls`；折叠 `aria-expanded`；关闭按钮 `aria-label`；打开时焦点移入、关闭后归还触发元素（README §2.3 配方）。
5. **尊重系统偏好**：动效必须可被 `prefers-reduced-motion` 降级（Kit 已内置）；玻璃必须可被 `prefers-reduced-transparency` / 不支持 `backdrop-filter` / `.nvui-solid`（用户主动实心）/ `.nvui-glass-fallback`（宿主禁模糊时的 97% 近不透明自动回退）降级，不要自己写一套回退。
6. **无 emoji 图标**：用 Font Awesome `<i class="fa-solid ...">` 或纯 CSS 图形；README/CSS/JS 文案中也不要写 emoji。
7. **不要改 Kit 的契约**：不要重命名类/token、不要给组件加第二套皮肤；品牌化只允许整体替换同名 token。
8. **改完必须跑测试**：`node test/test-ui-kit.js`（或 `npm test`）必须 0 失败；新增/修改组件要同步更新 `preview.html` 与 README。

---

## 1. 读文件顺序（AI 开工前）

1. `tokens.json` —— 机器可读的 111 个令牌（深色 111 / `.nvui-theme-light` 47 个覆盖），快速知道有哪些颜色/尺寸/动效变量；
2. `tokens.css` —— 令牌注释与语义（表面层级、玻璃、焦点环、动效体系、面板尺寸）；
3. `components.css` —— 组件 DOM 契约（尤其第 19 节「插件面板布局标准」与玻璃/降级规则）；
4. `README.md` §12「SillyTavern 插件面板布局标准」 + §7 组件规范；
5. `nvui-api.js` —— 可选运行时；能用 API 就不要手写 DOM；
6. 本文件 —— 生成/验收清单。

---

## 2. SillyTavern 插件面板：标准设计流程

### 2.1 先选形态

| 场景 | 推荐形态 |
| :--- | :--- |
| 设置页、图库、请求历史等多分区功能 | **面板布局标准**：`dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel`（电脑居中 720×88vh / 手机底部抽屉 100%×92dvh + 底部导航） |
| 轻量确认、单表单 | `.nvui-modal`（弹窗骨架，README §2.3） |
| 操作反馈 | `NVUI.showToast` / `.nvui-toast`（放在 `dialog.nvui-tl` 载体内） |
| 常驻入口/小工具窗 | `.nvui-floating`（drag 逻辑业务侧实现） |
| 表单设置项 | `.nvui-switch-row` / `.nvui-input-row` / `.nvui-acc` 折叠分组 |
| 自定义普通容器表单 | 容器显式加 `.nvui-form-scope`（v2.7.0 opt-in），内部继续用 `.nvui-input`；不加类则默认行为不变 |

**一个面板只允许一套分区导航**：电脑显示顶部 `.nvui-tabs`、手机显示 `.nvui-bottom-nav`（CSS 断点 600px 自动互斥）。不要用 JS 让两套同时显示，也不要把底部导航改成 `position: fixed`。

**自定义普通容器的表单（v2.7.0 opt-in）**：只有显式给容器加 `.nvui-form-scope`，容器内既有 `.nvui-input` 的 input / select / textarea / option 才共享既有的 7 条宿主表单隔离；不加类时行为完全不变。该标记不会接管容器内非 kit 控件，也不会创建定位、遮罩或模态，不能替代 `.nvui-scope` 的排版与主题职责。

### 2.2 推荐：用 API 生成（少写 DOM、自动满足规范）

```html
<script src="./ui-kit/nvui-api.js"></script>
<script>
(function () {
    'use strict';
    var panel = NVUI.createPanel({
        id: 'my_plugin_panel',
        title: '我的插件设置',
        version: 'v1.0.0',
        tabs: [
            { key: 'basic', label: '基本设置', icon: 'fa-solid fa-sliders' },
            { key: 'api', label: '副 API', icon: 'fa-solid fa-plug' },
            { key: 'history', label: '请求历史', icon: 'fa-solid fa-clock-rotate-left' }
        ],
        actions: [
            { icon: 'fa-solid fa-wand-magic-sparkles', label: '一键推荐', onClick: recommend }
        ],
        footer: [
            { label: '取消', variant: 'ghost', onClick: function () { panel.close(); } },
            { label: '保存', variant: 'primary', onClick: save, close: true }
        ]
    });

    panel.addSwitch('basic', {
        label: '启用自动生成',
        value: true,
        feature: true,
        onChange: function (v) { settings.enabled = v; }
    });
    panel.addInput('basic', { label: '单图上限 (MB)', type: 'number', value: 80, min: 1, max: 500, onChange: save });
    panel.addAccordion('basic', {
        title: '基本设置',
        summary: '默认渠道 · 中文',
        open: true,
        content: [
            NVUI.switchRow({ label: '生成时保持角色语气', value: true }),
            NVUI.inputRow({ label: '每轮最多生成条数', type: 'number', value: 3 })
        ]
    });
    panel.addProgress('history', { value: 42 });
    panel.addSectionTitle('history', '请求历史');

    document.getElementById('open_my_plugin').addEventListener('click', panel.open);
})();
</script>
```

API 会自动完成：面板/遮罩/标题栏/关闭按钮/顶部 tabs + 底部导航/`aria-*` 同步/粘连指示器/进出场动画/Esc 与点遮罩关闭/焦点移入与归还/Tab 焦点陷阱。

**ST 扩展场景的两个必填选项**：

```js
var panel = NVUI.createPanel({
    id: 'my_plugin_panel',
    title: '我的插件设置',
    focusFallback: '#extensionsMenuButton',   // 触发按钮不可聚焦时的兜底（ST 菜单点击后会自动收起）
    destroy: function () { /* 解绑自有监听 */ }
});
```

- `focusFallback`：接受 CSS 选择器或元素。关闭面板时按「触发元素 → `focusFallback` → 面板本身」三级兜底归还焦点；
  不传时若触发元素已消失，焦点会掉到 `body`（键盘用户会「丢失位置」）。
- `destroy`：面板销毁时的清理回调（解绑业务监听、清理定时器）。
- 面板需彻底移除时调用 `panel.destroy()`：移除 DOM、注销全局 Esc 监听、触发 `destroy` 回调。

> **单文件 / 酒馆助手脚本提示**：若是单文件用户脚本（不能拷贝本地文件夹），可通过 CDN 动态加载样式与 JS API（`https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v3.1.1/nvui-api.js`，完整配方见 `README.md` §2.1.3），然后同样使用 `NVUI.createPanel` 生成。令牌、样式与运行时应锁定同一个 `v3.1.1` tag。

> **ST 扩展直接开箱用**：`st-extension-template/` 是一份已在本机真实 ST 宿主验证过的扩展骨架
> （`manifest.json` / `index.js` / `style.css` + `ui-kit/`）。复制到
> `public/scripts/extensions/third-party/<插件名>/` 改名字即可加载，宿主陷阱清单见 `README.md` §13.5。

### 2.3 手写 DOM 时的最小骨架

```html
<dialog class="nvui-tl" id="my_plugin_layer" aria-label="我的插件浮层">
    <div class="nvui-overlay is-panel" id="my_plugin_overlay" hidden>
        <div class="nvui-panel" role="dialog" aria-modal="true" aria-labelledby="my_plugin_title">
            <div class="nvui-sheet-handle" aria-hidden="true"></div>
            <div class="nvui-panel-header">
                <b class="nvui-panel-title" id="my_plugin_title">我的插件设置<span class="nvui-badge">v1.0.0</span></b>
                <span class="nvui-panel-actions">
                    <button type="button" class="nvui-icon-btn" aria-label="更多操作"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                    <button type="button" class="nvui-icon-btn" data-close aria-label="关闭面板"><i class="fa-solid fa-xmark"></i></button>
                </span>
            </div>
            <nav class="nvui-tabs" role="tablist" aria-label="面板分区">
                <span class="nvui-tabs-indicator" aria-hidden="true"></span>
                <button type="button" class="nvui-tab is-active" role="tab" id="tab_basic" aria-selected="true" aria-controls="pane_basic">基本设置</button>
                <button type="button" class="nvui-tab" role="tab" id="tab_history" aria-selected="false" aria-controls="pane_history" tabindex="-1">请求历史</button>
            </nav>
            <div class="nvui-panel-body">
                <div class="nvui-panel-heading">
                    <span class="nvui-section-title">设置</span>
                    <span class="nvui-badge">v1.0.0</span>
                </div>
                <label class="nvui-switch-row is-feature">
                    <input type="checkbox" checked>
                    <span>启用自动生成（推荐）</span>
                </label>
                <div class="nvui-acc">
                    <button type="button" class="nvui-acc-head" aria-expanded="false">
                        <span class="nvui-acc-title">高级选项</span>
                        <span class="nvui-acc-summary">默认</span>
                        <i class="nvui-acc-chev"></i>
                    </button>
                    <div class="nvui-acc-body"><div class="nvui-acc-inner"> ... </div></div>
                </div>
                <div class="nvui-tabpane is-active" id="pane_basic" role="tabpanel" aria-labelledby="tab_basic"> ... </div>
                <div class="nvui-tabpane" id="pane_history" role="tabpanel" aria-labelledby="tab_history"> ... </div>
            </div>
            <div class="nvui-panel-footer">
                <button type="button" class="nvui-btn is-ghost" data-close>取消</button>
                <button type="button" class="nvui-btn is-primary">保存</button>
            </div>
            <nav class="nvui-bottom-nav" aria-label="面板分区（手机）">
                <button type="button" class="nvui-bottom-nav-item is-active" aria-current="page" aria-label="基本设置">
                    <i class="fa-solid fa-sliders" aria-hidden="true"></i><span>基本</span>
                </button>
                <button type="button" class="nvui-bottom-nav-item" aria-label="请求历史">
                    <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><span>历史</span>
                </button>
            </nav>
        </div>
    </div>
</dialog>
```

JS 只需三件事：非模态 `show()`/关闭收尾（README §2.3）、tabs 与底部导航共享状态的 `activate(key)`、焦点陷阱（README §2.3 配方）。完整示例见 README §12.7。

### 2.4 内容排列规范（参考面板布局标准）

1. 标题栏：左标题（+ 版本徽标可选），右侧最多 2 个图标操作 + 关闭；
2. 分区导航：3~5 个分区（超过 5 个用分组，不要继续塞）；
3. 内容区：分区标题 + 版本徽标 → 最多 1 条 `is-feature` 高亮功能行（最常用开关）→ 折叠分组列表（每组必须有右侧 summary）→ 可选说明文字；
4. 底部操作区：主操作 1 个（`is-primary`），取消用 `is-ghost`；
5. 只有一个滚动层：`.nvui-panel-body`；面板高度固定，折叠展开不改变外框。

### 2.5 常见错误（AI 最常犯）

- 用 `showModal()` 或裸 `position:fixed` 挂 body → 手机端浮层飞出屏幕；
- 电脑/手机两套导航同时显示，或底部导航改成 `position:fixed` 覆盖内容；
- 面板高度写 `auto`/`fit-content` → 折叠展开时界面跳变；
- 给面板/弹窗再套一层 `overflow:auto` → 双滚动条；
- 硬编码颜色/圆角/时长，或使用参考插件（青色）的皮肤色；
- 用 emoji 当图标、用 `title` 代替可见 label；
- 标签页切换时重建面板 DOM（丢输入焦点与异步结果）——只切 `is-active`/`aria-*`；
- 忘记 `aria-selected`/`aria-current`/`aria-expanded` 同步；
- 关闭按钮没有 `aria-label`、关闭后不归还焦点。

### 2.6 v2.5.0 核心能力与即抄即用模板

v2.5.0 引入了三大核心生产力能力：
1. **表现层布局持久化（R1）**：声明式 `persist: true` 或精细化对象，记忆面板尺寸、位置、当前激活 Tab 及折叠状态，内置 250ms 防抖与多屏幕视口越界安全钳制（Viewport Clamping）；
2. **面板头部标准化（R2）**：右上角预置主题切换按钮（`themeToggle: true`，平滑太阳/月亮图标过渡，直连 `NVUI.setTheme`），标题区预置版本更新胶囊与 `panel.showUpdate()` 动态点亮接口；
3. **720px 黄金面板宽度**：电脑端面板默认宽度优化为 720px（`--nvui-panel-width: 720px`），大幅改善阅读视野，支持 `opts.width` 自定义。

#### 模板 A：SillyTavern 标准模块化扩展（ESM，即抄即用）

适用于 SillyTavern 官方标准扩展开发（`public/scripts/extensions/third-party/<name>/index.js`），无缝整合宿主 `extension_settings`、防抖写盘与异步更新检测：

```javascript
/**
 * SillyTavern 标准扩展规范模板（v2.5.0）
 */
import { getContext, extension_settings as extensionSettings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';
import './ui-kit/nvui-api.js';

const EXTENSION_NAME = 'my_awesome_plugin';

// 1. 读取或初始化扩展设置（必须实时读取，严禁缓存快照）
function getSettings() {
    const all = extensionSettings || {};
    if (!all[EXTENSION_NAME]) {
        all[EXTENSION_NAME] = {
            version: '2.5.0',
            theme: 'dark',
            enabled: true,
            layoutState: {}
        };
    }
    return all[EXTENSION_NAME];
}

let panel = null;

export function getPanel() {
    if (panel) return panel;
    if (typeof NVUI === 'undefined' || typeof NVUI.createPanel !== 'function') {
        console.error(`[${EXTENSION_NAME}] NVUI 运行时未就绪`);
        return null;
    }

    const settings = getSettings();

    // 2. 构造适配 SillyTavern 宿主的 StorageAdapter
    const stStorageAdapter = {
        get: (key) => settings.layoutState?.[key] || null,
        set: (key, val) => {
            if (!settings.layoutState) settings.layoutState = {};
            settings.layoutState[key] = val;
            saveSettingsDebounced(); // 触发宿主安全防抖写盘
        },
        delete: (key) => {
            if (settings.layoutState && key in settings.layoutState) {
                delete settings.layoutState[key];
                saveSettingsDebounced();
            }
        }
    };

    // 3. 声明式装配面板（720px 默认宽度，开启持久化与主题切换）
    panel = NVUI.createPanel({
        id: 'my_awesome_panel',
        title: '高级插件设置',
        version: 'v2.5.0',
        focusFallback: '#extensionsMenuButton', // 焦点归还兜底

        // R1: 状态持久化（绑定宿主 StorageAdapter）
        persist: {
            size: true,
            tab: true,
            accordion: true,
            storage: stStorageAdapter
        },

        // R2: 标准化头部控制流（预置日/月平滑主题切换）
        themeToggle: true,
        onThemeChange: (theme) => {
            settings.theme = theme;
            saveSettingsDebounced();
        },

        tabs: [
            { key: 'general', label: '通用设置', icon: 'fa-solid fa-sliders' },
            { key: 'advanced', label: '核心配置', icon: 'fa-solid fa-gear' }
        ],
        footer: [
            { label: '关闭', variant: 'ghost', close: true }
        ]
    });

    // 装配内容分区
    panel.addSwitch('general', {
        label: '启用插件主特性',
        value: !!settings.enabled,
        feature: true,
        onChange: (v) => { settings.enabled = v; saveSettingsDebounced(); }
    });

    panel.addAccordion('advanced', {
        title: '性能调优',
        summary: '默认参数',
        content: [
            panel.addInput('advanced', { label: '并发任务上限', type: 'number', value: 4 })
        ]
    });

    // 4. 异步检查 GitHub Release 并动态点亮更新胶囊
    checkGitHubRelease().then(releaseInfo => {
        if (releaseInfo && releaseInfo.hasUpdate) {
            panel.showUpdate({
                version: releaseInfo.version,
                label: `新版本 ${releaseInfo.version} 可用`,
                url: releaseInfo.url
            });
        }
    });

    return panel;
}

// 异步探测远端版本
async function checkGitHubRelease() {
    try {
        const res = await fetch('https://api.github.com/repos/my-org/my-plugin/releases/latest');
        if (!res.ok) return null;
        const data = await res.json();
        const latestTag = data.tag_name || '';
        return {
            hasUpdate: latestTag !== 'v2.5.0',
            version: latestTag,
            url: data.html_url
        };
    } catch {
        return null;
    }
}
```

#### 模板 B：酒馆助手单文件用户脚本（Tavern Helper / 纯 IIFE 零构建，即抄即用）

适用于 Tampermonkey、油猴脚本或单文件免构建场景，通过 CDN 加载 Kit，极简一行开启持久化与主题切换：

```javascript
// ==UserScript==
// @name         SillyTavern Helper Tool
// @match        http://127.0.0.1:8000/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 1. 动态载入 Flat Glass 样式与运行时（国内高速 CDN）
    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v3.1.1';
    const appendCss = (href) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = href;
        document.head.appendChild(link);
    };
    appendCss(`${CDN_BASE}/tokens.css`);
    appendCss(`${CDN_BASE}/components.css`);

    const script = document.createElement('script');
    script.src = `${CDN_BASE}/nvui-api.js`;
    script.onload = () => {
        // 2. 一键开启 persist: true 与 themeToggle: true
        const panel = NVUI.createPanel({
            id: 'tavern_helper_panel',
            title: '酒馆助手工具箱',
            version: 'v2.5.0',
            persist: true,     // 默认使用 localStorage (键名: nvui_state_tavern_helper_panel)
            themeToggle: true, // 预置主题切换按钮
            tabs: [
                { key: 'quick', label: '快捷指令', icon: 'fa-solid fa-bolt' },
                { key: 'about', label: '关于助手', icon: 'fa-solid fa-circle-info' }
            ]
        });

        panel.addSwitch('quick', { label: '启用快捷连吹模式', value: true, feature: true });
        panel.addSectionTitle('about', 'SillyTavern Helper v2.5.0');

        // 3. 悬浮触发按钮
        const trigger = document.createElement('button');
        trigger.className = 'nvui-btn is-primary';
        trigger.textContent = '工具箱';
        trigger.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;box-shadow:var(--nvui-shadow-floating);';
        trigger.onclick = () => panel.open();
        document.body.appendChild(trigger);
    };
    document.head.appendChild(script);
})();
```

#### 720px 黄金尺寸令牌与宽度选项说明
- `--nvui-panel-width: 720px`（定义在 `tokens.css` 与 `tokens.json`）：经过人体工学与真实酒馆界面视线分布测试，720px 比原 880px 更加紧凑舒适，彻底杜绝大屏幕两侧空旷无内容的割裂感。
- `createPanel(opts)` 支持传入 `opts.width`（如 `width: 640` 或 `width: 760`）：运行时引擎会基于 Viewport Clamping 将自定义宽度钳制在屏幕可用安全区内；手机端（<=600px）强制回退为 100% 抽屉模式。

### 2.7 面板尺寸：写变量，别写内联 px（v3.0.0）

`createPanel` 不再往面板上写内联 `style.width/height`，改成写两个 CSS 变量：

| 变量 | 含义 |
| :--- | :--- |
| `--nvui-panel-w` | 面板宽度（`px` 或 `calc(...)`） |
| `--nvui-panel-h` | 面板高度（同上） |

`.nvui-panel` 的规则是 `width: var(--nvui-panel-w, min(var(--nvui-panel-width), 100%))` —— 变量留空就回落到 kit 默认值，所以「没设变量」与 v2.x「没有内联宽高」视觉完全一致。带来两个直接后果：

- **下游终于能接管尺寸**：你的 `.nvui-panel { width: 500px }` 现在真的生效（v2.x 里它一定被内联 px 压住，只能靠 `!important`）；
- **想显式设尺寸**：`panel.style.setProperty('--nvui-panel-w', '640px')`。直接写内联 `style.width` 也仍然有效（内联比类规则强），kit 读状态时会先读变量、读不到再回退读内联，不会读漏。

布局状态格式同步升到 **v2**：`{ version: 2, size: { w, h, mode } }`，`mode` 取 `normal` / `maximized` / `width-only` / `off`。旧格式 `{ version: 1, size: { width, height, isMaximized } }` 由 `NVUI.migrateStateV1toV2()` 自动读入，**落盘一律写 v2**，下游不需要自己判断版本。完整迁移步骤见 [MIGRATION-v3.md](MIGRATION-v3.md)。

**v3.1 起不再有内联 px 写入路径**：v3.0.0 曾有 `data-nvui-legacy-size` 过渡开关，现已移除。若宿主 CSS 硬依赖 `style.width`，改用自己的选择器（`panel.style.setProperty('--nvui-panel-w', '640px')` 或
`#my_layer .nvui-panel { width: 500px }`），不要找开关。

---

## 3. 其它软件如何规范复用

### 3.1 可以整目录复制

本 Kit 无构建、无依赖、无网络请求：把 `tokens.css`、`components.css`、`nvui-api.js`、`tokens.json` 复制进你的项目，页面根节点加 `class="nvui-scope"` 即可。品牌换色**只替换同名 token**（`tokens.css` 或运行时覆盖 `--nvui-*`），不要改组件规则。

### 3.2 必须保留的语义

| 内容 | 说明 |
| :--- | :--- |
| 令牌命名与语义 | `--nvui-bg/-bg-2/-bg-3` 三层表面、`--nvui-text/-text-2/-text-3` 三档文字、`--nvui-accent*` 唯一强调色、语义色 `ok/warn/danger/info` 各配 `-bg/-line` |
| 扁平 + 玻璃分工 | 静态区块用扁平色阶（无描边/投影）；只有浮层用玻璃（`--nvui-glass-*`） |
| 焦点环契约 | 单圈 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)`，不要自写像素值 |
| 动效可降级 | 所有动画尊重 `prefers-reduced-motion`；只做合成友好动画（opacity/transform） |
| 无障碍语义 | 面板 role/aria、标签页 tablist、折叠 aria-expanded、开关 label 包裹 |
| AA 约束 | 玻璃上的文字用 `--nvui-text` / `--nvui-text-2`（弹窗级双 AA；popover 级只承诺正文），`--nvui-text-3` 不承载关键信息 |
| 无 emoji / 无外链 | 图标用项目自己的图标库（FA/SVG），离线可用 |

### 3.3 需要替换的宿主约束

- **没有 SillyTavern 的 html transform** 时：仍推荐「浮层 + 遮罩」的同一套结构；若你的宿主不允许 `<dialog>`，可把 `.nvui-overlay` 直接放进 `body`（需自行保证足够的 z-index，视觉/组件规则不变），并在文档里注明差异；
- 宿主自带全局 `input`/`button` 样式时：沿用 Kit 的作用域与「对抗宿主样式」的隔离写法（只加必要规则，不要全局重置）；
- 移动端：保留 600px 断点（面板 → 底部抽屉）、`env(safe-area-inset-bottom)`、`100dvh`；
- 品牌色：整体替换 `--nvui-accent*` 与语义色，重新跑对比度（README §4.4 的验算方法）。

### 3.4 验收清单（复制到 PR / CI）

- [ ] `node test/test-ui-kit.js` 0 失败（若整目录复制，测试也应一起复制）；
- [ ] `preview.html` 在深/浅、桌面 1440/手机 390 下无横向溢出，面板外框在折叠展开前后一致；
- [ ] 面板/弹窗可用键盘完整操作：Tab 循环、Esc 关闭、关闭后焦点归还；
- [ ] 颜色全部走 token，无 `#hex`/`rgb()`；无 emoji；无外链资源；
- [ ] 动效在系统「减少动态效果」下自动降级（不丢失信息）；
- [ ] 玻璃在 `.nvui-solid` / 减少透明度 / 不支持 `backdrop-filter` / 宿主禁用模糊（自动 `.nvui-glass-fallback`）时降级为可用表面（半透明或实心）。
- [ ] 自定义普通容器只有需要宿主表单隔离时才显式加 `.nvui-form-scope`；作用域内只接管 `.nvui-input`，不接管非 kit 控件，不新增定位 / 遮罩 / 模态。

---

## 4. 提示词模板（可直接交给 AI）

### 4.1 生成一个 SillyTavern 插件设置面板

```text
你是熟悉 SillyTavern 插件与「SillyTavern NVUI Kit」的前端工程师。
请只使用该 Kit 的 nvui- 类名与 --nvui-* 令牌（可读 tokens.json / nvui-api.js），为插件「<插件名>」实现设置面板。

要求：
1. 形态：面板布局标准（dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel）；
   电脑居中（宽 min(720px,100%)、高 88vh），手机（<=600px）自动底部抽屉 + 底部图标导航 + safe-area；
2. 分区：<列出 3~5 个 tab，含每个 tab 的设置项>；
3. 内容：分区标题+版本徽标、最多 1 条 is-feature 高亮开关、其余用 .nvui-acc 折叠分组（每组带 summary）；
4. 导航：同一份状态同步顶部 tabs / 手机底部导航 / tabpane 的 is-active、aria-selected、aria-current、tabindex；
5. 交互：非模态 show() 打开；Esc/点遮罩/关闭按钮走 is-closing 退场后 hidden+close；关闭后焦点归还触发元素；
6. 无障碍与降级：role=dialog/aria-modal/aria-labelledby、焦点环走 token、尊重 prefers-reduced-motion / reduced-transparency；
7. 禁止：showModal、裸 position:fixed、emoji 图标、硬编码颜色、双导航、双滚动层、改 Kit 类名/token；
8. 输出：只给可直接运行的 HTML/JS 片段 + 说明用了哪些 nvui- 类与 token；不要重写 components.css。
```

### 4.2 审查/修改现有界面

```text
请按「SillyTavern NVUI Kit v3.1.1」规范审查下面的插件界面代码：
- 列出违反项（类名/token/宿主红线/a11y/动效降级/布局标准），按 README 章节标注依据；
- 给出最小 diff 修复（不要整体重写），保持既有功能；
- 特别检查：是否用了 showModal/裸 fixed、是否双导航/双滚动层、是否有硬编码颜色或 emoji、折叠展开是否改变面板外框、标签页是否重建 DOM；
- 最后给出验收命令与检查项。
```

### 4.3 迁移其它软件

```text
把项目 X 的界面迁移到 SillyTavern NVUI Kit v3.1.1：
- 复制 tokens.css / components.css / nvui-api.js / tokens.json；
- 将品牌色映射到 --nvui-accent*（只改 token，不改组件规则）；
- 按「面板布局标准」重组设置页（电脑居中 / 手机底部抽屉）；
- 保留 a11y 语义与降级链；列出与 Kit 规范的差异与替代方案（例如无 <dialog> 宿主时的浮层方案）；
- 输出迁移步骤 + 改动文件清单 + 验收清单。
```

---

## 5. API 速查（nvui-api.js）

| API | 说明 |
| :--- | :--- |
| `NVUI.version` | Kit/API 版本（3.1.1） |
| `NVUI.getToken(name)` | 读取当前作用域的设计令牌值 |
| `NVUI.setTheme('light'|'dark'|'auto', { solid })` | 切换浅色 / 深色 / **跟随系统**（v2.9.0）与实心扁平模式（只切类名）。`'auto'` = `prefers-color-scheme` 或宿主已有的 `.nvui-theme-light` 任一为浅即浅色，系统变更同帧生效；显式 light/dark 会摘掉 auto 监听 |
| `NVUI.selfCheck({ expect })` | 运行时自检：版本 / CSS / 玻璃 / 载体 z / 宿主模态 / issues |
| `NVUI.checkCompatibility({ min, max })` | semver 区间兼容判断 |
| `NVUI.migrateStateV1toV2(state)` | v3.0.0 布局状态迁移器：`{ version:1, size:{ width, height, isMaximized } }` → `{ version:2, size:{ w, h, mode } }`。幂等（已是 v2 原样返回）、不改入参；`setLayoutState` 与存档读取已内置调用，通常只需在下游自己存过状态时显式用 |
| `NVUI.defaults` | 冻结的组件默认值（v2.8.0） |
| `NVUI.clearLayoutState(id, storageAdapter)` | 清理指定面板在持久化存储中的尺寸/位置/状态记忆 |
| `NVUI.clampPanelLayout(savedSize, savedPos, options)` | 跨屏幕多分辨率视口越界钳制计算引擎（保证桌面与移动端安全贴边，避免关闭按钮不可达） |
| `NVUI.syncGlassFallback()` | 宿主全局禁用 `backdrop-filter` 时自动挂 `.nvui-glass-fallback`（97% token 派生近不透明回退，v2.7.2 起不再整块 `.nvui-solid`；`createPanel`/`showToast`/`openLayer` 已内置） |
| `NVUI.openLayer(dialog, overlay)` / `closeLayer(dialog, overlay, cb)` | 非模态浮层载体开合（含退场动画收尾） |
| `NVUI.countHostModals()` | 统计当前文档处于模态状态的**宿主**原生 `<dialog>` 数量（用 `:modal` 伪类，自动排除 kit 自身载体） |
| `NVUI.syncHostModalState()` | 同步宿主模态降级态：给所有 kit 载体加/移除 `.is-host-modal`；`createPanel`/`showToast`/`openLayer` 已内置调用 |
| `NVUI.diagnostics()` | v2.9.0（GH-#18 B2）诊断快照：`status` / `version` / `assets{loaded,kitVersion,md5}` / `glass` / `hostModals` / `escapeStackDepth` / `persistKeys` / `listenerCounts`。只读无副作用；Node 下返回 `status:'no-dom'`。排查「装的哪版 / 状态里有什么 / 监听有没有漏摘」先看它 |
| `NVUI.getCarrierState()` | 浮层载体层级快照（`carrierZ` / `hostModalCount` / `degraded` / `carriers[]`），排查层级问题时先看它 |
| `NVUI.switchRow({ label, value, feature, onChange })` | 胶囊开关行 |
| `NVUI.inputRow({ label, type, value, min, max, step, onChange })` | 输入行（number 默认隐藏原生步进按钮） |
| `NVUI.accordion({ title, summary, open, content })` | 折叠分组 |
| `NVUI.progress({ value, variant, indeterminate })` | 进度条（返回元素带 `setValue`） |
| `persist.size: 'width-only'` | v2.9.0（GH-#18 B3）尺寸持久化第三态：只记宽，`height` 恒 `null`、最大化不记；`true` / `false` 行为不变。非法字符串按 `true` 处理并告警 |
| `panel.getLayoutState()` / `panel.setLayoutState(state, { silent })` | v2.9.0（GH-#18 B1）布局状态读写：get 返回 `{ version: 2, size: { w, h, mode }, tab, accordion }` 游离副本（无 `timestamp`，v3.0.0 起为 v2 形状），set 只写内存 + 一次落盘（不切换当前视图）；`silent: true` 不写存储；`persist` 关掉的维度强制 `null`。set 接受 v1 / v2 两种入参 |
| `NVUI.createPanel(options)` | 完整面板（见 §2.2），支持 persist/themeToggle/onThemeChange/update/width/**glass** 等，返回 `{ open, close, destroy, setTab, syncIndicator, addSwitch, addInput, addAccordion, addProgress, addNode, addSectionTitle, showUpdate, trackAccordion, adoptAccordions, clearLayoutState, getLayoutState, setLayoutState, setSize, setMaximized, setGlassMode, getGlassState }` |
| `panel.trackAccordion(node, id?, options?)` | 接管 `innerHTML` 注入的**单个** `.nvui-acc`（v2.6.0，GitHub #11）。默认**不**绑点击，`{ bind: true }` 才由 kit 提供开合；返回实际 id，幂等；键按**原始字符串**保存（中文 / 非 ASCII 不折叠，`__proto__` 等特殊键安全）；显式 / DOM / data 键被活动节点占用时告警并返回 `null`（自动键才追加序号）；非 `.nvui-acc` / 跨面板返回 `null` |
| `panel.adoptAccordions(root, options?)` | 批量接管容器内 `.nvui-acc`（含 root 自身），返回本次新增数量；重复调用返回 `0`；拒绝 `document` / `body` |
| `NVUI.showToast({ message, type, duration, icon })` | 吐司通知（自动建独立载体、自动清理） |

> API 是**可选**的：不用 JS 时，手写 DOM + CSS 同样有效；API 只是把布局标准与无障碍细节固化成可复用函数。

---

## 6. 版本与反馈

### 6.1 SemVer 语义化版本分级准则（面向 AI 助手）

- **PATCH（补丁版本 · 2.4.X）**：仅用于向下兼容的缺陷修复（内存泄漏、未捕获异常、防御性代码加固、checkVisibility 硬件加速性能优化、高对比度微调）。**严禁**修改任何公开 API 签名或增删 Token。
- **MINOR（小版本 · 2.X.0）**：用于向下兼容的新能力（新增 Token 如 `--nvui-z-layer`、新增组件类如 `.nvui-checkbox`、新增可选 API 如 `countHostModals`、在 `createPanel` 中新增可选参数如 `persist`/`themeToggle`、新增实例方法如 `showUpdate`/`trackAccordion`）。**必须保持 100% 向后兼容**，既有插件直接覆盖无感升级。
- **MAJOR（大版本 · X.0.0）**：仅用于破坏性变更（重命名/删除 Token、修改核心 CSS 类名、改变公开 API 必需参数签名、破坏 DOM 必需层级）。必须向用户明确告知破坏性影响并提供迁移指南。
- **发版检查红线（十处对齐）**：版本变更时必须同时原子更新 10 处声明（package.json / tokens.json / tokens.css 文件头 + `--nvui-kit-version` / components.css / nvui-api.js / preview.html / README / AI-GUIDE / CHANGELOG），且 4 资产文件与 `st-extension-template/ui-kit/` 保持 MD5 逐字节一致，`npm test` 必须全绿。完整清单与格式见 README §11.2，可用 `npm run verify:release` 自动检查。
- **兼容矩阵红线**：README §11.5 那张表不是说明文字，是 `npm run test:compat` 的校验对象 —— 当前大版本线（`vX.0.0`）那一行必须存在，宿主最低版本要等于 `manifest.minimum_client_version`、Node 最低版本要等于 `package.json engines.node`。**新开一条大版本线必须当天补行**，否则 CI 直接红。

### 6.2 历史版本与兼容基准

- 当前：**v3.1.1**（PATCH：修复布局导入、异步存储、存储键隔离、Home 尺寸复位、键盘焦点和面板销毁，见 GH-#23–GH-#29）。
- 上一版：**v3.1.0**（MINOR · 线路 D：移除 `data-nvui-legacy-size` 过渡开关，尺寸只走 CSS 变量一条路径；设了属性也完全无效。token 111 / 组件类 84 / 顶层导出 29 / `!important` 18，状态格式与导出面相对 v3.0 全不变）。
- 上一版：**v3.0.0**（MAJOR · 线路 C 四项：C1 尺寸载体由内联 px 换到 CSS 变量 `--nvui-panel-w` / `--nvui-panel-h` + 状态格式 v2（`{ w, h, mode }`）+ `migrateStateV1toV2()` + `data-nvui-legacy-size` 过渡开关（已在 v3.1 移除）；C2 四套按钮组归一为一条零 specificity 规则、`.nvui-btn-row` 降为别名；C3 `tokens.json` schema 2（分组 / 类型 / 描述，值结构不变）；C4 兼容矩阵硬门禁 + `engines.node`。顶层导出 28 → 29。迁移见 [MIGRATION-v3.md](MIGRATION-v3.md)）。
- 上一版：**v2.9.0**（线路 B 六项能力：布局状态导入导出 `getLayoutState`/`setLayoutState`、`persist.size: 'width-only'`、`NVUI.diagnostics()`、`setTheme('auto')` 双信号跟随、`createPanel({ resizable })` 键盘可达调尺寸手柄、`inputRow` 的 `textarea` + `hint`/`error`；含 GH-#21 的进度可视标签与溢出边缘渐隐。全为 opt-in。顶层导出 28）。
- 上一版：**v2.8.3**（PATCH：测试基建收尾 —— 探针归档 `test/probe/`、`issue-16` 尺寸矩阵 8 → 12、`playwright-core` 进 devDependencies + `scripts/resolve-browser.js` 统一解析、新增 `npm run verify:all`。4 资产仅版本号注释同步，运行语义零变化）。
- 上一版：**v2.8.2**（PATCH：焦点陷阱修正 GH-#20、移动端底部导航 40px 触控 GH-#21、`test/host/` 实机基线入库、`createPanel` 七步拆分 1433 → 531 行，无行为变更）。
- 上一版：**v2.8.1**（PATCH：修 GitHub #16 —— `persist: { size: false }` 现在完全不参与尺寸持久化：不再把历史存档里的 px 高宽写回内联样式，`flushPersistSave()` 主动落 `size: null`；`persist.size: true` 行为不变。无 token / 组件类 / `!important` / 公开 API / 状态格式变更）。
- 上一版：**v2.8.0**（下游 DX + 组件默认值 + Fast UI 玻璃模式：新增 `--nvui-kit-version`、`selfCheck`/`checkCompatibility`/`defaults`、`.nvui-actions`、`createPanel({ glass })` 与面板控制器 `setGlassMode/getGlassState`；相邻按钮 8px 默认间距；`force` 仅面板级 opt-in。token 111 / 组件类 81 / `!important` 18）。
- 上一版：**v2.7.2**（玻璃透明感修复：面板保持透明 + 自身 `backdrop-filter` 背后模糊；宿主禁用模糊时 97% 近不透明回退；探测三态化并可自愈）。
- 上一版：**v2.7.1**（修复 GitHub #15 的半选 checkbox 浏览器回归偶发中间帧断言；组件样式、token 取值、公开 API 和 DOM 契约不变）。
- 上一版：**v2.7.0**（已打 tag；opt-in `.nvui-form-scope` 表单作用域，并修复 GitHub #12 的默认载体 `optgroup` 配色、#13 的焦点管理、#14 的宿主模态 Esc；`!important` 预算当时为 14，token 取值与公开 API 不变；组件类 80；0 破坏性变更）。
- 上一版：**v2.6.0**（独立复选框 `.nvui-checkbox` + 宿主表单控件隔离层 + 折叠条接管入口；组件类 79；0 破坏性变更，100% 向后兼容）。
- 上一版：**v2.5.0**（表现层布局持久化 + 面板头部标准化 + 720px 黄金尺寸；0 破坏性变更，100% 向后兼容）。
- 上一版：**v2.4.0**（浮层载体完善：宿主模态让位机制 `.is-host-modal` + 3 个宿主模态 API；110 令牌不变，无破坏性变更）。
- 历史版本：**v2.3.0**（浮层载体层级修复：新增 `--nvui-z-layer: 1000000` 载体档位）。
- Kit 变更遵循语义化版本；升级前先跑 `node test/test-ui-kit.js`，并对照 README §10.3–§10.10 的迁移说明。
- 发现规范缺口：优先补测试与文档，再改 CSS；不要用「看起来能跑」代替规范检查。
