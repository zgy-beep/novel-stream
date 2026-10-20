# AI 协作设计指南 · 用 SillyTavern NVUI Kit 规范设计面板

> 版本：**v2.2.0** · 适用对象：SillyTavern 插件开发者、其它软件项目、以及被要求「按规范生成/修改界面」的 AI 编码助手。
> 配套文件：[tokens.css](tokens.css)（设计令牌）、[components.css](components.css)（组件样式）、[README.md](README.md)（完整规范）、[nvui-api.js](nvui-api.js)（零依赖运行时 API）、[tokens.json](tokens.json)（令牌机器可读镜像）、[test/test-ui-kit.js](test/test-ui-kit.js)（规范守护测试）。

本文档回答两个问题：

1. **SillyTavern 插件**应该怎么规范设计面板（可直接照抄的 DOM/API 配方与验收清单）；
2. **其它软件**要复用这套设计时，必须保留什么、可以替换什么。

---

## 0. 给 AI 的硬约束（先读，违反即不合格）

1. **只用 Kit 的类名与令牌**：所有类名 `nvui-` 前缀、状态类 `is-` 前缀；颜色/圆角/间距/动效一律用 `var(--nvui-*)`，禁止 `#hex`、`rgb()`、`hsl()` 字面量。
2. **不污染宿主**：禁止裸元素选择器（`button {}`、`input {}`）、禁止全局重置、禁止 `!important`（Kit 只在宿主 checkbox 隔离与 reduced-motion 降级里使用）。
3. **SillyTavern 浮层必须进 `<dialog class="nvui-tl">` 载体**：非模态 `dialog.show()`（禁止 `showModal()`——会给文档加 `inert`；也**不要**以为非模态能靠浏览器 top layer 提层——实测它不进 top layer，层级由载体自身 `z-index: var(--nvui-z-layer)` 保证，酒馆 `#sheld`（z-index:30）会盖住无档位容器）、禁止裸 `position: fixed` 挂 body（部分宿主版本 `html` 有 transform，fixed 包含块会错位）。
4. **无障碍内建**：面板 `role="dialog" aria-modal="true" aria-labelledby`；标签页 `role="tablist"/"tab"/"tabpanel"` + `aria-selected` + `aria-controls`；折叠 `aria-expanded`；关闭按钮 `aria-label`；打开时焦点移入、关闭后归还触发元素（README §2.3 配方）。
5. **尊重系统偏好**：动效必须可被 `prefers-reduced-motion` 降级（Kit 已内置）；玻璃必须可被 `prefers-reduced-transparency` / 不支持 `backdrop-filter` / `.nvui-solid` 降级。
6. **无 emoji 图标**：用 Font Awesome `<i class="fa-solid ...">` 或纯 CSS 图形；README/CSS/JS 文案中也不要写 emoji。
7. **不要改 Kit 的契约**：不要重命名类/token、不要给组件加第二套皮肤；品牌化只允许整体替换同名 token。
8. **改完必须跑测试**：`node test/test-ui-kit.js`（或 `npm test`）必须 0 失败；新增/修改组件要同步更新 `preview.html` 与 README。

---

## 1. 读文件顺序（AI 开工前）

1. `tokens.json` —— 机器可读的 110 个令牌（深色 110 / `.nvui-theme-light` 47 个覆盖），快速知道有哪些颜色/尺寸/动效变量；
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
| 设置页、图库、请求历史等多分区功能 | **面板布局标准**：`dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel`（电脑居中 880×88vh / 手机底部抽屉 100%×92dvh + 底部导航） |
| 轻量确认、单表单 | `.nvui-modal`（弹窗骨架，README §2.3） |
| 操作反馈 | `NVUI.showToast` / `.nvui-toast`（放在 top-layer 载体内） |
| 常驻入口/小工具窗 | `.nvui-floating`（drag 逻辑业务侧实现） |
| 表单设置项 | `.nvui-switch-row` / `.nvui-input-row` / `.nvui-acc` 折叠分组 |

**一个面板只允许一套分区导航**：电脑显示顶部 `.nvui-tabs`、手机显示 `.nvui-bottom-nav`（CSS 断点 600px 自动互斥）。不要用 JS 让两套同时显示，也不要把底部导航改成 `position: fixed`。

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

API 会自动完成：面板/遮罩/标题栏/关闭按钮/顶部 tabs + 底部导航/`aria-*` 同步/粘连指示器/进出场动画/Esc 与点遮罩关闭/焦点移入与归还。

> **单文件 / 酒馆助手脚本提示**：若是单文件用户脚本（不能拷贝本地文件夹），可通过 CDN 动态加载样式与 JS API（`https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v2.2.0/nvui-api.js`，完整配方见 `README.md` §2.1.3），然后同样使用 `NVUI.createPanel` 生成，全自动满足规范。

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

- **没有 SillyTavern 的 html transform** 时：仍推荐「浮层 + 遮罩」的同一套结构；若你的宿主不允许 `<dialog>`，可把 `.nvui-overlay` 直接放进 `body`（会失去 top-layer，但视觉/组件规则不变），并在文档里注明差异；
- 宿主自带全局 `input`/`button` 样式时：沿用 Kit 的作用域与「对抗宿主样式」的隔离写法（只加必要规则，不要全局重置）；
- 移动端：保留 600px 断点（面板 → 底部抽屉）、`env(safe-area-inset-bottom)`、`100dvh`；
- 品牌色：整体替换 `--nvui-accent*` 与语义色，重新跑对比度（README §4.4 的验算方法）。

### 3.4 验收清单（复制到 PR / CI）

- [ ] `node test/test-ui-kit.js` 0 失败（若整目录复制，测试也应一起复制）；
- [ ] `preview.html` 在深/浅、桌面 1440/手机 390 下无横向溢出，面板外框在折叠展开前后一致；
- [ ] 面板/弹窗可用键盘完整操作：Tab 循环、Esc 关闭、关闭后焦点归还；
- [ ] 颜色全部走 token，无 `#hex`/`rgb()`；无 emoji；无外链资源；
- [ ] 动效在系统「减少动态效果」下自动降级（不丢失信息）；
- [ ] 玻璃在 `--nvui-solid` / 减少透明度 / 不支持 `backdrop-filter` 时回退为不透明表面。

---

## 4. 提示词模板（可直接交给 AI）

### 4.1 生成一个 SillyTavern 插件设置面板

```text
你是熟悉 SillyTavern 插件与「SillyTavern NVUI Kit」的前端工程师。
请只使用该 Kit 的 nvui- 类名与 --nvui-* 令牌（可读 tokens.json / nvui-api.js），为插件「<插件名>」实现设置面板。

要求：
1. 形态：面板布局标准（dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel）；
   电脑居中（宽 min(880px,100%)、高 88vh），手机（<=600px）自动底部抽屉 + 底部图标导航 + safe-area；
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
请按「SillyTavern NVUI Kit v2.2.0」规范审查下面的插件界面代码：
- 列出违反项（类名/token/宿主红线/a11y/动效降级/布局标准），按 README 章节标注依据；
- 给出最小 diff 修复（不要整体重写），保持既有功能；
- 特别检查：是否用了 showModal/裸 fixed、是否双导航/双滚动层、是否有硬编码颜色或 emoji、折叠展开是否改变面板外框、标签页是否重建 DOM；
- 最后给出验收命令与检查项。
```

### 4.3 迁移其它软件

```text
把项目 X 的界面迁移到 SillyTavern NVUI Kit v2.2.0：
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
| `NVUI.version` | Kit/API 版本（2.2.0） |
| `NVUI.getToken(name)` | 读取当前作用域的设计令牌值 |
| `NVUI.setTheme('light'|'dark', { solid })` | 切换浅色 / 实心扁平模式（只切类名） |
| `NVUI.openLayer(dialog, overlay)` / `closeLayer(dialog, overlay, cb)` | 非模态 top-layer 浮层开合（含退场动画收尾） |
| `NVUI.switchRow({ label, value, feature, onChange })` | 胶囊开关行 |
| `NVUI.inputRow({ label, type, value, min, max, step, onChange })` | 输入行（number 默认隐藏原生步进按钮） |
| `NVUI.accordion({ title, summary, open, content })` | 折叠分组 |
| `NVUI.progress({ value, variant, indeterminate })` | 进度条（返回元素带 `setValue`） |
| `NVUI.createPanel(options)` | 完整面板（见 §2.2），返回 `{ open, close, setTab, addSwitch, addInput, addAccordion, addProgress, addNode, addSectionTitle }` |
| `NVUI.showToast({ message, type, duration, icon })` | 吐司通知（自动进 top-layer、自动清理） |

> API 是**可选**的：不用 JS 时，手写 DOM + CSS 同样有效；API 只是把布局标准与无障碍细节固化成可复用函数。

---

## 6. 版本与反馈

- 当前：**v2.2.0**（描边精致化 + JS API / tokens.json / 本指南；无破坏性变更）。
- Kit 变更遵循语义化版本；升级前先跑 `node test/test-ui-kit.js`，并对照 README §10.3–§10.7 的迁移说明。
- 发现规范缺口：优先补测试与文档，再改 CSS；不要用「看起来能跑」代替规范检查。
