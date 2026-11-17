# novel-stream v2.0.0 MVP · UI 适配设计（SillyTavern NVUI Kit v2.2.0）

> 设计师：颜好看 · 日期：2026-10-20 · 状态：Phase 1 交付，待总监 Spec 锁定
> 设计寄存器：**Product 寄存器**（设计服务产品——工具面板，标杆是「赢得熟悉感」：Linear / Notion / Raycast 的可信感）
> 三轴刻度：`DESIGN_VARIANCE=3`（可预测，对称栅格）/ `MOTION_INTENSITY=3`（功能动效，全部由 Kit 内置）/ `VISUAL_DENSITY=5`（日常应用密度）
> 硬约束来源：ui-kit `AI-GUIDE.md` §0 八条硬约束、`README.md` §12 面板布局标准、`README.md` §4.4 AA 验算方法；本团 P0 三红线（无 emoji 图标 / 无紫粉渐变 / 无空洞占位与硬编码颜色）

---

## 0. 设计决策摘要

v2.0.0 面板整体采用 ui-kit「插件面板布局标准」：`NVUI.createPanel` 一次生成 `dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel`，桌面居中 880px / 手机底部抽屉同一份 DOM。分区收敛为 **3 个 tab：连载 / 过滤 / 文件**；每个分区按 Kit 内容规范排布（分区标题+版本徽标 → 状态行 → 最多 1 条 `is-feature` 开关 → 折叠分组列表）。章节格式（4 选 1）与文件命名（2 选 1）用 `panel.addNode` 插入**自定义分段控件**（DOM 只用 `nvui-` 类与 token，行为补 roving tabindex + 方向键）；白/黑名单因取值较长，用「标签 + 全宽 `.nvui-input` + `.nvui-hint`」自定义字段行。**品牌色结论：不覆盖任何 token**——旧产品牌紫罗兰 `#8b6dff` 与 Kit 默认深色 `--nvui-accent` 完全同值（Kit 本就从 novel-stream 提炼，README §10.1 映射表载明同名同值），直接继承即可获得全套已验算的 accent 派生值与测试守护；紫罗兰为**纯色**使用，不构成渐变，符合 P0-2。深浅色策略：面板恒用 Kit 深色令牌（Kit 设计原则第 5 条：浮层自包含、跨宿主主题一致），不镜像宿主主题；玻璃降级（`prefers-reduced-transparency` / 无 `backdrop-filter` / `forced-colors`）由 Kit CSS 全量处理。图标全部用宿主 Font Awesome 6 自由版 solid，零 emoji。UI 资产建议 **vendor 进仓库 `ui-kit/` 子目录**（离线可用 + 版本锁定 + 一键安装随仓库分发）。

---

## 1. 面板结构

### 1.1 形态与载体

- 形态：**面板布局标准**（设置面板属多分区功能，不用 `.nvui-modal`）。
- 载体：`<dialog class="nvui-tl">` + `<div class="nvui-overlay is-panel">` + `<div class="nvui-panel" role="dialog" aria-modal="true" aria-labelledby="...">`。
- 生成方式：`NVUI.createPanel(options)`（nvui-api.js 自动完成标题栏 / 关闭钮 / 顶部 tabs / 手机底部导航 / aria 同步 / 指示器 / Esc 与遮罩关闭 / 焦点移入与归还 / 退场动画收尾）。
- 尺寸：Kit 默认（桌面 `min(880px, 100%)` × 固定高 `88vh`；手机 `100%` × `92dvh`），**不自定义**，保证折叠展开不外框跳变。
- 面板标题：`小说连载阅读`（不带版本徽标；版本徽标按 Kit §12.8 放在每个分区的 heading 行，见 1.3）。
- 创建时机：插件初始化后**预构建一次**，之后全程复用；切换 tab 只切 `is-active`，绝不重建 DOM（v1.x 踩坑红线：重建即丢输入焦点与异步状态）。

### 1.2 桌面装配图（>600px，文字版）

```text
+------------------------------------------------------------------------------------+
| .nvui-overlay.is-panel（flex 居中 + padding: space-4；遮罩拦截背景点击）            |
|  +----------------- .nvui-panel（min(880px,100%) / 固定高 88vh / 四角 xl 圆角）----+ |
|  | .nvui-panel-header   小说连载阅读                        [导出图标钮] [关闭]   | |
|  +------------------------------------------------------------------------------------+
|  | .nvui-tabs（role=tablist）  [连载]  [过滤]  [文件]        <- 同一份状态驱动      | |
|  +------------------------------------------------------------------------------------+
|  | .nvui-panel-body（flex:1 / min-height:0 / overflow-y:auto —— 全板唯一滚动层）   | |
|  |                                                                                  | |
|  |  .nvui-tabpane.is-active「连载」                                                  | |
|  |    .nvui-panel-heading    连载设置                              [v2.0.0]         | |
|  |    .nvui-status-line      当前书稿《艾莉丝 - 远征探索》            第 12 章      | |
|  |    .nvui-switch-row.is-feature   开启小说自动连载（左侧主色竖条 + 淡底）         | |
|  |    .nvui-acc   章节格式        摘要：第 X 章 · 角色名 (原楼层: Y)                | |
|  |    .nvui-acc   主角对白        摘要：已融入                                       | |
|  |    .nvui-acc   内置智能机制    摘要：延迟入书 · 末尾替换 · 章节计数               | |
|  |                                                                                  | |
|  |  .nvui-tabpane「过滤」 / .nvui-tabpane「文件」（同构，见 1.3）                    | |
|  +------------------------------------------------------------------------------------+
|  | .nvui-panel-footer                        [关闭(is-ghost)] [导出整本 TXT(主)]  | |
|  +------------------------------------------------------------------------------------+
+------------------------------------------------------------------------------------+
```

### 1.3 手机装配图（≤600px，文字版）

```text
+---------------------------- 手机（<=600px）----------------------------+
| .nvui-overlay.is-panel（align-items:flex-end + padding:0）               |
|  +-------------- .nvui-panel（宽 100% / 固定高 92dvh / 仅上圆角）------+ |
|  | .nvui-sheet-handle（40x4 拖拽把手，aria-hidden，纯视觉）            | |
|  | .nvui-panel-header   小说连载阅读                          [关闭]  | |
|  | （桌面 .nvui-tabs 在手机端 display:none）                           | |
|  | .nvui-panel-body（唯一滚动层；同桌面内容排布）                      | |
|  |   .nvui-panel-heading / .nvui-status-line / is-feature / .nvui-acc   | |
|  +--------------------------------------------------------------------+ |
|  | .nvui-panel-footer                    [关闭] [导出整本 TXT]         | |
|  +--------------------------------------------------------------------+ |
|  | .nvui-bottom-nav（图标 + 2 字短标签，safe-area 自动内边距）          | |
|  |      [fa-book-bookmark 连载] [fa-filter 过滤] [fa-file-lines 文件]   | |
|  +--------------------------------------------------------------------+ |
+----------------------------------------------------------------------------+
```

### 1.4 三分区内容排布（顺序严格遵循 Kit §2.4 / §12.8）

**Pane A · 连载（key: `serial`，图标 `fa-solid fa-book-bookmark`）**

| 序 | 组件 | 说明 |
| --- | --- | --- |
| 1 | `.nvui-panel-heading`：`fa-solid fa-book-bookmark` + 「连载设置」+ `.nvui-badge`「v2.0.0」 | 分区标题 + 版本徽标 |
| 2 | `.nvui-status-line`（自定义节点，只读） | 当前书稿与章节计数，三态文案见 7.5 |
| 3 | `.nvui-switch-row.is-feature`：开启小说自动连载 | 本分区唯一高亮功能行（`settings.enabled`） |
| 4 | `.nvui-acc`「章节格式」 | 摘要 = 当前风格短标签；内容 = 分段控件（4 选 1）+ 缩进开关 + 提示 |
| 5 | `.nvui-acc`「主角对白」 | 摘要 = 已融入 / 未融入；内容 = 开关（`include_user_dialogue`）+ 提示 |
| 6 | `.nvui-acc`「内置智能机制」 | 摘要 = 延迟入书 · 末尾替换 · 章节计数；内容 = 3 条只读状态行（无控件） |

**Pane B · 过滤（key: `filter`，图标 `fa-solid fa-filter`）**

| 序 | 组件 | 说明 |
| --- | --- | --- |
| 1 | `.nvui-panel-heading`：`fa-solid fa-filter` + 「过滤设置」+ `v2.0.0` | |
| 2 | `.nvui-acc`「正文白名单」 | 摘要 = 未设置（保留全文）/ 当前标签；内容 = 全宽输入字段 + 提示 |
| 3 | `.nvui-acc`「排除黑名单」 | 摘要 = N 个标签 / 未设置；内容 = 全宽输入字段 + 默认值提示 + 「恢复默认」小按钮 |

> 过滤区不设 `is-feature` 行（Kit 规定「最多 1 条」而非「必须 1 条」）；全局总开关常驻连载区，任何分区下都一眼可见。

**Pane C · 文件（key: `file`，图标 `fa-solid fa-file-lines`）**

| 序 | 组件 | 说明 |
| --- | --- | --- |
| 1 | `.nvui-panel-heading`：`fa-solid fa-file-lines` + 「文件与导出」+ `v2.0.0` | |
| 2 | `.nvui-acc`「文件命名规则」 | 摘要 = 角色名 - 对话名 / 仅角色名；内容 = 分段控件（2 选 1）+ 示例文件名提示 |
| 3 | `.nvui-acc`「导出整本 TXT」 | 摘要 = 尚未导出 / 今天 21:04 · 第 12 章；内容 = 导出状态行（`.nvui-status-line.is-success` + `.nvui-status-file`）+ 提示（纯前端 / BOM / 阅读器目录） |

**底部操作区（`.nvui-panel-footer`，全 tab 常显）**：`关闭`（`.nvui-btn.is-ghost`）+ `导出整本 TXT`（`.nvui-btn.is-primary`）。设置全部**即改即存**（change 事件落盘，沿用 v1.x `saveSettingsDebounced`），因此不需要「保存 / 取消」语义；ghost 钮只承担「关闭」，服务移动端拇指可达。标题栏右侧另有 1 个导出图标钮（`.nvui-icon-btn`，`fa-solid fa-file-arrow-down`）作为桌面端快入口——与底部主按钮同一动作，不构成第二主操作。

### 1.5 面板装配草图（createPanel，供前端直接落地）

```js
import './ui-kit/nvui-api.js';                       // UMD：执行后挂 globalThis.NVUI
const panel = NVUI.createPanel({
    id: 'novel_stream_panel',
    title: '小说连载阅读',
    tabs: [
        { key: 'serial', label: '连载', icon: 'fa-solid fa-book-bookmark' },
        { key: 'filter', label: '过滤', icon: 'fa-solid fa-filter' },
        { key: 'file',   label: '文件', icon: 'fa-solid fa-file-lines' }
    ],
    actions: [{ icon: 'fa-solid fa-file-arrow-down', label: '导出整本 TXT', onClick: exportNovel }],
    footer: [
        { label: '关闭', variant: 'ghost', onClick: () => panel.close() },
        { label: '导出整本 TXT', variant: 'primary', onClick: exportNovel }
    ],
    mount: document.body,
    onClose: persistAccOpen
});
panel.dialog.classList.add('nvui-scope');             // Kit §7.1：浮层根节点必加作用域类
// 之后用 panel.addNode / addSwitch / addAccordion 装配各 pane 内容（见第 3 节骨架）
```

---

## 2. 组件映射表（MVP 功能 → nvui 类 / NVUI API）

| MVP 功能 | 控件 | Kit 类 / API | 状态与备注 |
| --- | --- | --- | --- |
| 面板载体与开合 | 面板布局标准 | `NVUI.createPanel` → `dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel` | 非模态 `show()`；Esc / 遮罩 / 关闭钮三路关闭；焦点归还 |
| 三分区导航 | 顶部 tabs + 手机底部导航 | `.nvui-tabs` / `.nvui-tab` / `.nvui-tabs-indicator` / `.nvui-tabpane` / `.nvui-bottom-nav` / `.nvui-bottom-nav-item` | 同一份状态：`is-active` + `aria-selected` + `aria-current` + `tabindex` 同步 |
| 分区标题 + 版本徽标 | heading 行 | `.nvui-panel-heading > .nvui-section-title + .nvui-badge` | 自定义节点（`addNode`），每 pane 一个 |
| 章节计数 / 书稿状态 | 只读状态行 | `.nvui-status-line` + `.nvui-status-time`（+ `fa-solid fa-book-open`） | 三态文案，颜色不承载唯一信息 |
| 连载总开关 | 高亮开关行 | `panel.addSwitch('serial', { feature: true })` → `.nvui-switch-row.is-feature` | label 包裹 input，整行可点 |
| 章节格式 4 选 1 | 分段控件（自定义） | `.novel-seg`（token 组装，见 3.1） | API 无分段/select；`addNode` 插入 |
| 段落首行缩进 | 开关行 | `NVUI.switchRow`（放入 acc content） | 沿用 v1.x `indent_paragraphs` |
| 主角对白融入 | 开关行 | `NVUI.switchRow`（放入 acc content） | `include_user_dialogue` |
| 内置机制（延迟入书 / 末尾替换 / 章节计数） | 只读状态行 ×3 | `.nvui-status-line` | 无控件，纯告知 |
| 白 / 黑名单编辑 | 全宽输入字段（自定义） | `.nvui-input` + `.nvui-hint` + `.novel-field`（见 3.2） | `addNode` 插入；label 关联 input |
| 恢复默认黑名单 | 小按钮 | `.nvui-btn.is-sm`（acc 内） | `fa-solid fa-rotate-left` |
| 文件命名 2 选 1 | 分段控件（复用 3.1） | `.novel-seg` | 同一组件两种数据 |
| 导出状态反馈 | 状态行 + 文件行 | `.nvui-status-line.is-success` + `.nvui-status-file` | 替代被砍掉的 Toast（见 12 章问题 3） |
| 导出整本 TXT | 主按钮 + 图标钮 | `.nvui-btn.is-primary`（footer）+ `.nvui-icon-btn`（标题栏） | 纯前端下载 |
| 关闭面板 | ghost 钮 + 图标钮 + Esc + 遮罩 | `.nvui-btn.is-ghost` / `.nvui-icon-btn` | 关闭钮 `aria-label` 由 API 保证 |
| 折叠分组 | 折叠面板 | `panel.addAccordion` → `.nvui-acc / -head / -title / -summary / -chev / -body / -inner` | 每组必须有右侧 summary；开合态持久化 |
| 魔法棒菜单入口 | 宿主菜单项 | 宿主类 + `extensionsMenuExtensionButton`（见第 9 节） | 宿主 DOM，只换强调色 |
| 悬浮药丸 / 楼层工具条 / 会话标签检测器 / 过滤预览弹窗 / 同步历史 / 试写一章 / 服务端探针 | — | **砍除，无 UI 映射** | 验收清单第 15 项 |

---

## 3. 自定义节点 DOM 骨架（API 不支持的控件）

> 原则：Kit 没有分段控件与「长值全宽输入」组件；按 AI-GUIDE §0.1，自定义节点仍**只用 `nvui-` 类与 `var(--nvui-*)` 令牌**，插件自有类统一 `novel-` 前缀（绝不碰 `nvui-` 前缀，不造第二套组件体系）。以下骨架经 `panel.addNode(key, node)` 插入对应 pane。

### 3.1 分段控件（章节格式 / 文件命名）

```html
<div class="novel-seg" role="radiogroup" aria-label="章节目录风格" id="novel-chapter-style">
    <button type="button" class="novel-seg-item is-active" role="radio" aria-checked="true"  tabindex="0"  data-value="numbered_floor">
        <span class="novel-seg-text">第 X 章 · 角色名 (原楼层: Y)</span>
        <span class="nvui-badge is-accent">推荐</span>
    </button>
    <button type="button" class="novel-seg-item" role="radio" aria-checked="false" tabindex="-1" data-value="numbered">
        <span class="novel-seg-text">第 X 节 · 角色名</span>
    </button>
    <button type="button" class="novel-seg-item" role="radio" aria-checked="false" tabindex="-1" data-value="separator">
        <span class="novel-seg-text">优雅分割线 (* * *)</span>
    </button>
    <button type="button" class="novel-seg-item" role="radio" aria-checked="false" tabindex="-1" data-value="dialogue">
        <span class="novel-seg-text">纯净戏剧体 (【角色名】)</span>
    </button>
</div>
```

```css
/* 插件 style.css；全部取值走令牌，无字面量 */
.novel-seg { display: flex; flex-direction: column; gap: var(--nvui-space-2); }
.novel-seg-item {
    display: flex; align-items: center; gap: var(--nvui-space-2);
    min-height: var(--nvui-control-h);
    padding: var(--nvui-space-2) var(--nvui-space-3);
    border: none; border-radius: var(--nvui-radius-sm);
    background: var(--nvui-block-bg); color: var(--nvui-text-2);
    font-family: inherit; font-size: var(--nvui-fs-md); line-height: var(--nvui-lh-tight);
    text-align: left; cursor: pointer;
    transition: background-color var(--nvui-transition), color var(--nvui-transition),
                transform var(--nvui-duration-fast) var(--nvui-ease-standard);
}
.novel-seg-item:hover { background: var(--nvui-block-bg-2); color: var(--nvui-text); }
.novel-seg-item.is-active { background: var(--nvui-accent-bg); color: var(--nvui-text); font-weight: var(--nvui-fw-medium); }
.novel-seg-item:active { transform: scale(0.97); }
.novel-seg-item:focus-visible {
    outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color);
    outline-offset: var(--nvui-focus-ring-offset);
}
.novel-seg-text { flex: 1 1 auto; min-width: 0; }
```

交互语义：`radiogroup` + `radio` + `aria-checked`；roving tabindex（仅选中项 `tabindex=0`）；`ArrowUp/ArrowLeft`、`ArrowDown/ArrowRight` 移动并选中（README §7.7 同款方向键约定）；点击即改即存并刷新所属 acc 的 summary。选中态用 `accent-bg` 淡底 + 正文色（玻璃上 AA 口径同 bottom-nav 激活项，不用主色文字）。

### 3.2 标签字段（白 / 黑名单）

```html
<div class="novel-field">
    <label class="novel-field-label" for="novel-include-tags">正文白名单</label>
    <input class="nvui-input" id="novel-include-tags" type="text" placeholder="留空 = 保留全部正文">
    <span class="nvui-hint">填入如 story 后，仅提取 &lt;story&gt;...&lt;/story&gt; 内部内容，其余全部丢弃；不确定预设是否有正文标签时，请留空。</span>
</div>
```

```css
.novel-field { display: flex; flex-direction: column; gap: var(--nvui-space-2); }
.novel-field-label { color: var(--nvui-text-2); font-size: var(--nvui-fs-md); }
.novel-field .nvui-input { width: 100%; }
```

> 不用 `.nvui-input-row` 的原因：该行式布局输入框为定宽（`flex: 0 0 auto`），放不下 10 个标签组成的默认黑名单长串；全宽字段 + 下方 `.nvui-hint` 说明，长串可完整查看与编辑。`label for` + `input id` 保证读屏关联；失焦 / 回车触发保存（`change` 事件）。

### 3.3 分区 heading 与状态行（同样经 addNode 插入）

```html
<div class="nvui-panel-heading">
    <span class="nvui-section-title"><i class="fa-solid fa-book-bookmark" aria-hidden="true"></i>连载设置</span>
    <span class="nvui-badge">v2.0.0</span>
</div>
<div class="nvui-status-line" id="novel-serial-status">
    <i class="fa-solid fa-book-open" aria-hidden="true"></i>
    <span id="novel-serial-status-text">尚未开始：发出第一句消息后，角色问候语将作为第 1 章入书</span>
    <span class="nvui-status-time" id="novel-serial-status-meta"></span>
</div>
```

---

## 4. Token 映射与品牌色验算

### 4.1 旧 token → Kit token（精选，完整表见 ui-kit README §10.1）

| novel-stream 旧 token | UI Kit token | 关系 |
| --- | --- | --- |
| `--nv-bg / --nv-bg-2 / --nv-bg-3` | `--nvui-bg / --nvui-bg-2 / --nvui-bg-3` | 同名同值 |
| `--nv-text / --nv-text-2` | `--nvui-text / --nvui-text-2` | 同名同值 |
| `--nv-text-3`（`#6c7487`，3.72:1） | `--nvui-text-3`（`#7d879b`，4.81:1） | **提亮一档达 AA**，直接继承新值 |
| `--nv-accent`（`#8b6dff`） | `--nvui-accent`（`#8b6dff`） | **同名同值，零映射成本** |
| `--nv-accent-2`（`#a997ff`） | `--nvui-accent-2`（`#a997ff`） | 同名同值 |
| `--nv-accent-bg / --nv-accent-line` | `--nvui-accent-bg / --nvui-accent-line` | 同名同值 |
| （无） | `--nvui-accent-strong / -strong-hover` | 新增：填充按钮底（白字 AA），替换旧「accent + 白字 3.67:1」的不达标做法 |
| （无） | 玻璃 7 / 焦点环 3 / 动效 12 / 骨架屏 2 / 面板尺寸 2 等 | v2 体系化新增，直接可用 |

### 4.2 品牌色决策：**不覆盖，采用 Kit 默认强调色系**

- 事实一：旧产品牌紫罗兰 `#8b6dff` 与 Kit 深色 `--nvui-accent` **完全同值**；Kit 文档自述从 novel-stream 浮动 UI 提炼，README §10.1 映射表载明 `--nv-accent → --nvui-accent` 同名同值。品牌延续不需要任何覆盖。
- 事实二：Kit 的 accent 派生链（`--nvui-accent-2` / `--nvui-accent-strong` / `--nvui-accent-strong-hover` / `-bg` / `-bg-hover` / `-line` / 浅色主题 47 项覆盖）已按 README §4.4 方法逐项验算，并由 `test/test-ui-kit.js` 的「核心 token 金标准取值」守护；自行覆盖等于放弃守护、引入未验算值。
- 事实三：P0-2 禁止的是「Indigo→Pink 渐变 + 发光边框 + 毛玻璃」三位一体套路；本方案中紫罗兰仅作**纯色**（开关轨道、选中淡底、焦点环、填充按钮），全板无任何渐变主视觉，属纯色豁免。
- 结论：插件 CSS 中**不存在**品牌色十六进制定义；连魔法棒菜单项（宿主 DOM）也直接引用 `var(--nvui-accent)`（tokens.css 挂 `:root`，全局可达）。全项目唯一色源 = `ui-kit/tokens.css`。

### 4.3 对比度验算（按 README §4.4 方法：sRGB 逐通道叠加 + WCAG 2.1 相对亮度）

> 说明：下表为设计层验算记录；因不修改任何 token，Kit 测试守护的结论继续有效。验算涉及的色值仅出现在本节（品牌映射/验算语境），组件样式一律 `var(--nvui-*)`。

| 验算项 | 路径 / 组合 | 结果 | 结论 |
| --- | --- | --- | --- |
| 强调色作文字/图标（深色） | `#8b6dff` on `--nvui-bg #161a24` | 4.75:1（重算 4.746） | AA 达标（正文级） |
| 强调亮变体（深色） | `#a997ff` on `#161a24` | 7.09:1 | AA 达标（tab 选中图标等） |
| 主按钮白字（深色） | `#ffffff` on `--nvui-accent-strong #6d4df2` | 5.26:1（重算 5.258） | AA 达标 |
| 主按钮悬停白字（深色） | `#ffffff` on `#5b3fd6` | 6.72:1（重算 6.718） | AA 达标 |
| 浅色主题强调色 | `#6d4df2` on `#f7f8fc` | 4.95:1（Kit 表值） | AA 达标（本面板不使用浅色主题，备用） |
| 面板玻璃合成（深色，最坏宿主纯白） | `#ffffff` → overlay `rgba(6,8,14,.62)` → glass `rgba(22,26,36,.64)` | text 10.33:1 / text-2 4.70:1 | 双 AA（Kit 表值，面板即弹窗级玻璃） |
| 开关关闭态轨道（非文本，WCAG 1.4.11） | `rgba(255,255,255,.34)` on `#161a24` | ≥ 3:1（Kit 验算） | 达标 |

推论（设计使用规则，全部来自 Kit 4.3 配色使用规则）：

1. 面板玻璃上的正文/次要文字用 `--nvui-text` / `--nvui-text-2`；`--nvui-text-3` 只用于非关键提示——本设计的 `.nvui-hint`（过滤说明、命名示例）正属此类，不承载关键信息。
2. 底部导航激活项用 `--nvui-text` 正文色 + `--nvui-accent-bg` 淡底（不用主色文字，玻璃最坏宿主下 AA）；分段控件选中态沿用同一口径。
3. 语义色各司其职：导出成功状态行用 `--nvui-ok` 系；不存在用 accent 表达错误的场景。

---

## 5. 深浅色与降级策略

- **默认主题：Kit 深色（`.nvui-scope` 默认令牌），不镜像宿主酒馆主题。** 依据 Kit 设计原则第 5 条「浮层自包含、主题可切换：自有浮层用 kit 的深色令牌，不依赖宿主主题变量；这样浅色/深色酒馆下观感一致、可预期」。v1.x 亦为自包含深色，用户无认知迁移成本。
- `.nvui-theme-light` 存在但**不接入**：不为浅色宿主写第二套皮肤，也不做主题同步代码（零维护成本）。若未来要提供，仅在面板根类上叠加即可，组件无需改动。
- 玻璃降级四层链（`@supports not backdrop-filter` / `prefers-reduced-transparency: reduce` / `forced-colors: active` / `.nvui-solid` 手动实心）全部由 Kit CSS 内置，**业务侧零处理**；本设计只负责「选默认值 = 深色 + 玻璃开」。
- 动效降级：`prefers-reduced-motion` 全局降级由 Kit 末尾统一块处理（含 `animation-delay` 清零）；业务不自定义任何动画。
- 验收提示：用 DevTools Rendering 面板模拟 `prefers-reduced-transparency: reduce` 与 `forced-colors: active`，确认面板回退为不透明表面且文字对比度仍 AA（Kit §8.9 红线）。

---

## 6. 图标清单（Font Awesome 6 自由版 solid，宿主自带，零外链）

| 位置 | FA 类名 | 尺寸口径 |
| --- | --- | --- |
| 魔法棒菜单项图标 | `fa-solid fa-book-bookmark` | 宿主 `extensionsMenuExtensionButton` 类决定（沿用 v1.x，用户已熟悉） |
| 面板关闭钮 | `fa-solid fa-xmark` | `.nvui-icon-btn` 28×28 内 14px（Kit 默认） |
| 标题栏导出图标钮 | `fa-solid fa-file-arrow-down` | 同上 |
| tab「连载」/ 底部导航 | `fa-solid fa-book-bookmark` | tab 内继承 13px / 底部导航 14px（Kit 默认） |
| tab「过滤」/ 底部导航 | `fa-solid fa-filter` | 同上 |
| tab「文件」/ 底部导航 | `fa-solid fa-file-lines` | 同上 |
| heading「连载设置」 | `fa-solid fa-book-bookmark` | `.nvui-section-title > i` 继承 13px，色 `--nvui-accent-2`（Kit 默认） |
| heading「过滤设置」 | `fa-solid fa-filter` | 同上 |
| heading「文件与导出」 | `fa-solid fa-file-lines` | 同上 |
| 状态行（书稿） | `fa-solid fa-book-open` | 状态行内继承 12px |
| acc「章节格式」 | `fa-solid fa-heading` | acc 标题内继承 13px |
| acc「主角对白」 | `fa-solid fa-comment-dots` | 同上 |
| acc「内置智能机制」 | `fa-solid fa-wand-magic-sparkles` | 同上 |
| acc「正文白名单」 | `fa-solid fa-tag` | 同上 |
| acc「排除黑名单」 | `fa-solid fa-ban` | 同上 |
| acc「文件命名规则」 | `fa-solid fa-file-signature` | 同上 |
| acc「导出整本 TXT」 | `fa-solid fa-file-arrow-down` | 同上 |
| 机制行：问候语延迟入书 | `fa-solid fa-hourglass-start` | 状态行内 12px |
| 机制行：重 roll / 划动替换末尾章 | `fa-solid fa-arrows-rotate` | 同上 |
| 机制行：章节计数 | `fa-solid fa-list-ol` | 同上 |
| 「恢复默认」小按钮 | `fa-solid fa-rotate-left` | `.nvui-btn.is-sm` 内约 11px |

规则：图标一律 `<i class="fa-solid fa-..." aria-hidden="true"></i>`（纯装饰，语义由文字承担）；**尺寸不自定义**，遵循 Kit 组件既有口径（tab 13px / 底部导航 14px / 图标钮 14px / 状态行 12px）——Kit 是锁定的设计基底，不在其上叠加第二套尺寸体系；插件自有表面（分段控件、标签字段）不含图标，故无自有尺寸需要声明。全清单零 emoji。

---

## 7. 交互与无障碍规格

### 7.1 打开 / 关闭

- 打开：魔法棒菜单项 click（或 Enter/Space）→ `panel.open()`。API 内部：记录 `opener = document.activeElement` → 非模态 `dialog.show()`（禁 `showModal()`，避免文档 inert）→ `overlay.hidden = false` → 焦点移入（默认优先 `.nvui-btn.is-primary`）→ 指示器同步。打开后强制 `panel.setTab('serial')`：每次打开落在「连载」，行为可预期（与 v1.x 一致）。
- 关闭四路：Esc（API 全局 keydown）/ 点击遮罩（`e.target === overlay`）/ 标题栏关闭图标钮 / footer ghost「关闭」。统一走 `is-closing` 退场 → `animationend` 或 260ms 兜底 → `hidden` + `close()` → **焦点归还触发元素**（API 已内置）。
- 防误触：v1.x 的「触摸打开后 400ms 内遮罩点击忽略」守卫保留（移动端同一次触摸会补发 click 落到遮罩）。

### 7.2 焦点管理（API 之上必须补的两块）

1. **焦点循环**：NVUI Kit v3.1.1 负责 Tab / Shift+Tab 循环。关闭时如果触发项已隐藏，Kit 将焦点归还到魔法棒按钮 `#extensionsMenuButton`。
2. **打开焦点**：Kit 优先聚焦激活分区内的可操作控件。

### 7.3 tabs / 底部导航 / tabpane 同步

- 状态只有一份：`panel.setTab(key)` 同步 tabs（`is-active` / `aria-selected` / `tabindex`）、底部导航（`is-active` / `aria-current="page"`）、tabpane（`is-active` 切 display）。桌面切到「导出」后缩窗到手机宽度，底部导航仍高亮「文件」。
- 键盘：Kit 负责桌面标签的方向键、Home 和 End。扩展为手机底部导航提供左右方向键，切换后焦点跟随。
- `resize` / 字体加载后调 `panel.syncIndicator()` 重算粘连指示器（API 未绑 resize，业务补）。
- **只切 display，绝不重建 DOM**（保输入焦点与折叠状态）。

### 7.4 折叠分组

- `aria-expanded` 随开合更新（API accordion 已内置）；开合偏好写入 `settings.acc_open`，打开面板时恢复（沿用 v1.x `applyNovelAccOpen` 逻辑）；默认全部收起。
- 收起态 summary 是唯一线索，必须实时反映当前值（各 acc 的 summary 文案见 1.4）。

### 7.5 状态刷新（业务事件 → UI）

| 事件 | 刷新 |
| --- | --- |
| `settings.enabled` change | 连载状态行、魔法棒副标、wand `is-on` |
| 新章节入书（MESSAGE_RECEIVED 等） | 状态行 meta「第 N 章」+1 |
| 切换聊天（chat 变化） | 重算书名 / 章节数，刷新状态行 |
| 任一设置 change | 相关 acc summary（分段标签、N 个标签、已融入/未融入、上次导出时间） |
| 导出完成 | 导出 acc 的 status-line 切 `is-success` + `.nvui-status-file` 显示文件名与章节数；如总监批准则加 1 次性 toast |

连载状态行三态文案（文字承载状态，不靠颜色）：

- 开启且有章节：`当前书稿《{书名}》` + 右侧 `第 {N} 章`；
- 开启无章节：`尚未开始：发出第一句消息后，角色问候语将作为第 1 章入书`；
- 关闭：`连载状态已关闭，仍可导出当前会话。`。

### 7.6 无障碍清单（Panel 级）

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` 指向 `.nvui-panel-title`（API 保证）；关闭钮 `aria-label="关闭面板"`（API 保证）。
- 分段控件：`radiogroup` / `radio` / `aria-checked` + roving tabindex + 方向键。
- 输入字段：`label for` 关联；占位符不当 label 用（本设计 label 恒可见）。
- 开关：label 包裹 input（API 保证），点击文字可切换。
- 所有交互元素 `:focus-visible` 走 Kit 令牌（组件内置；自定义 `.novel-seg-item` 已按统一形式写）。
- 只读信息（章节计数、机制说明）不进 `aria-live`，避免逐章刷屏。
- 尊重 `prefers-reduced-motion` / `prefers-reduced-transparency` / `forced-colors`（Kit 内置，验收时模拟验证）。

---

## 8. 移动端适配（≤600px）

- 底部抽屉、仅上圆角、拖拽把手、`92dvh`、`env(safe-area-inset-bottom)`、窄屏模糊降档：全部 Kit CSS 自动，业务零分支。
- 底部导航 3 项与顶部 tabs 一一对应：连载（`fa-book-bookmark`）/ 过滤（`fa-filter`）/ 文件（`fa-file-lines`），2 字短标签；点击区高度由 Kit padding 保证（≥44px）。
- 内容排布确认：分段控件本就是 `flex-direction: column` 竖排，无需移动端特调；footer 常驻底部导航上方，导出主按钮拇指可达；`.nvui-panel-body` 单滚动层 + 隐藏滚动条（滚动能力保留）。
- 不做：双导航、底部导航 `position:fixed` 覆盖、面板高度 `auto`、二次滚动层（Kit §12.10 Don't 全项遵守）。

---

## 9. 魔法棒菜单项规格（宿主 DOM）

DOM（结构沿用 v1.x，注册进 `#extensionsMenu`，幂等补回 + 短轮询兜底宿主重绘的逻辑原样沿用）：

```html
<div id="novel-wand-menu-item" class="list-group-item flex-container flexGap5"
     role="button" tabindex="0" title="小说连载阅读：打开设置面板（章节格式 / 过滤配置 / 导出整本 TXT）">
    <div class="fa-solid fa-book-bookmark extensionsMenuExtensionButton"></div>
    <span class="novel-wand-item-label">小说连载阅读</span>
    <span class="novel-wand-item-state" id="novel_wand_menu_state">已关闭</span>
</div>
```

```css
/* 宿主 DOM 内的唯一样式；色源 = Kit 令牌（var(--nvui-accent)）+ 宿主主题变量，零字面量 */
#novel-wand-menu-item .extensionsMenuExtensionButton { color: var(--nvui-accent); }   /* 品牌强调：非文本 3:1（深/浅宿主均达标） */
.novel-wand-item-label { flex: 1 1 auto; }
.novel-wand-item-state {
    margin-left: auto; align-self: center; white-space: nowrap;
    padding: 1px 7px; border-radius: var(--nvui-radius-pill);
    border: 1px solid transparent;                      /* 常驻透明边：状态切换不抖布局 */
    font-size: var(--nvui-fs-2xs); color: var(--SmartThemeEmColor);
}
.novel-wand-item-state.is-on {
    background: var(--nvui-accent-bg); border-color: var(--nvui-accent-line);
    color: var(--SmartThemeBodyColor);                   /* 文字用宿主色，紫罗兰只做淡底/描边，深浅宿主均 AA */
}
#novel-wand-menu-item:focus-visible {
    outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color);
    outline-offset: calc(var(--nvui-focus-ring-offset) * -1);
}
```

- 文案：`小说连载阅读` + 副标 `连载中` / `已关闭`（`settings.enabled` 驱动，`is-on` 类同步；副标文字本身承载状态，不靠颜色单独传达）。
- 行为：click / Enter / Space → `panel.open()`；**不** `stopPropagation`（宿主靠 body 点击收起下拉）；关闭面板后刷新副标。
- 说明：副标底色用 Kit 的 `--nvui-accent-bg`（已是紫罗兰 14% 淡底）而非自造透明度；宿主菜单被重绘后按 id 幂等补回。

---

## 10. UI 资产引入方案

**结论：vendor 进仓库 `ui-kit/` 子目录，随扩展分发（关闭 OPEN-DECISIONS 第 1 条，倾向项即最终建议）。**

| 维度 | vendor 进 `ui-kit/`（采纳） | CDN 动态加载（不采纳） |
| --- | --- | --- |
| 离线 / 内网 | 完全可用（酒馆大量用户自托管 NAS / Docker / 内网） | 断网、CN 网络波动即样式全丢，面板裸奔 |
| 版本锁定 | 锁定 v2.2.0，升级由插件发版控制 | 上游静默变更即可能破坏面板 |
| 安装路径 | GitHub 一键安装即整仓库下发，零额外步骤 | 需额外网络请求，多一种失败模式与 FOUC |
| 依赖 | Kit 零依赖、MIT、自包含（README §2.0） | 引入外部运行时依赖 |
| 可验证性 | `node test/test-ui-kit.js` 可进插件 CI，规范有守护 | 无 |

落地方式：

```css
/* style.css 顶部（@import 必须在所有规则之前；v2.0.0 整文件重写，天然满足） */
@import url('./ui-kit/tokens.css');
@import url('./ui-kit/components.css');
```

```js
// index.js（ESM；nvui-api.js 为 UMD，import 执行后自动挂 globalThis.NVUI）
import './ui-kit/nvui-api.js';
// 之后直接用全局 NVUI.createPanel / NVUI.showToast（showToast 是否启用见第 12 节问题 3）
```

- 随仓库下发文件：运行时四件套 `tokens.css` / `components.css` / `nvui-api.js` / `tokens.json`，连同 `README.md` / `AI-GUIDE.md` / `LICENSE` / `CHANGELOG.md` / `test/` 一并保留（Kit 设计为可整目录复制；保留测试意味着插件仓库里可直接验证 Kit 规范未被改坏）。
- 升级策略：整目录覆盖 → 打开 `preview.html` 深/浅/实心三态 + 桌面/手机两宽自查 → `node test/test-ui-kit.js` 0 失败 → 在插件 `docs/decisions/` 记录升级原因。

---

## 11. 验收清单（Phase 3 逐项打勾）

**P0 三红线**

1. 全仓库（含设计文档、DOM 骨架、文案）正则扫描 `[\x{1F300}-\x{1F9FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]` 零命中；图标全部来自第 6 节 FA 清单。
2. 无紫→粉渐变（`#7C3AED/#A855F7/#9333EA/#EC4899` 任意渐变组合）；紫罗兰仅纯色出现。
3. 无 "Welcome to" / Lorem ipsum / 空洞占位；示例数据用真实感内容（书名《艾莉丝 - 远征探索》、时间「今天 21:04」）。

**面板结构（Kit §12）**

4. 载体为 `dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel`；非模态 `show()`；无 `showModal()`、无裸 `position:fixed` 挂 body；面板根带 `nvui-scope`。
5. 3 个 tab；tabs / 底部导航 / tabpane 状态同步（`is-active` / `aria-selected` / `aria-current` / `tabindex`）；方向键可切；resize 后指示器不错位；切 tab 不重建 DOM。
6. 每 pane 至多 1 条 `is-feature`；每个 `.nvui-acc` 有且实时维护 summary；heading = 分区标题 + 版本徽标。
7. 唯一滚动层 `.nvui-panel-body`；面板固定高度（88vh / 92dvh），折叠展开外框不跳变；无双滚动条。

**交互与无障碍**

8. Esc / 遮罩 / 关闭钮 / ghost 关闭四路可关；打开焦点移入面板，关闭归还魔法棒项；Tab 陷阱生效。
9. 折叠 `aria-expanded` 正确；开关 label 包裹 input；输入有可见 label；焦点环全走 Kit 令牌。
10. 状态不靠颜色单独传达（状态行 / 副标 / 徽标均有文字）。
11. 模拟 `prefers-reduced-motion` / `prefers-reduced-transparency` / `forced-colors`，面板降级后仍可用且文字 AA。

**色彩与资产**

12. 组件样式零 `#hex` / `rgb()` / `hsl()` 字面量（Kit 红线，测试守护）；品牌色零 token 覆盖；唯一色源 `ui-kit/tokens.css`。
13. `ui-kit/` 四件套（+文档/测试）在仓库内；`node test/test-ui-kit.js` 0 失败；style.css 顶部两行 `@import` 就位。

**功能与范围**

14. 导出纯前端下载；文件名遵循命名规则；UTF-8 BOM；导出状态行刷新；章节计数随聊天切换重算。
15. v1.x 遗留物清零：悬浮药丸、楼层工具条、Toast（待总监裁断的导出反馈除外）、会话标签检测器、过滤预览弹窗、群聊专属聚合、同步历史、试写一章、install.ps1 / install.sh、`plugins/auto-save` 服务端、`save_dir` / `show_toast` / `show_floating_window` 等设置键。

---

## 12. 待总监在 Spec 锁定的问题

| # | 问题 | 设计师建议 |
| --- | --- | --- |
| 1 | `buffer_latest_message`（草稿缓冲：最后一楼延迟定稿）是否保留 UI 与机制？ | 砍掉 UI；机制按「即时入书 + 重 roll 替换末尾章」固化，减少一个时序变量 |
| 2 | `indent_paragraphs`（段落首行缩进）是否保留开关？ | 保留，归入「章节格式」折叠组（章节排版一部分，成本一行 switch） |
| 3 | 导出成功/失败反馈是否允许 1 次性 `NVUI.showToast`？（OPEN-DECISIONS 第 3 条：被砍的「Toast」指连载更新提示） | 允许一次性导出结果 toast（`type: success/danger`，`role="status"`），与「文件」页持久状态行并存；toast 不是唯一反馈 |
| 4 | `enabled` 默认值？ | 默认 `true`（装上即用；纯前端无服务端探针、无 404 场景） |
| 5 | 设置键迁移口径？ | 沿用键：`enabled` / `include_user_dialogue` / `chapter_style` / `naming_rule` / `indent_paragraphs` / `include_tags` / `exclude_tags` / `acc_open`；其余旧键读取时忽略，不做迁移代码 |
| 6 | 章节计数口径？ | 运行时计数器（入书 +1，切换聊天按历史重算）；面板只读展示「第 N 章」 |
| 7 | 魔法棒图标是否沿用 `fa-book-bookmark`？ | 沿用（v1.x 已建立的心智） |

---

## 附：本设计文档引用的 Kit 依据索引

- 面板布局标准：ui-kit `README.md` §12（§12.2/12.3 装配图、§12.4 组件类、§12.6 响应式、§12.7 导航同步配方、§12.8 内容排列、§12.9 无障碍、§12.10 Do/Don't）
- AI 硬约束与流程：`AI-GUIDE.md` §0（八条）、§2.4（内容排列）、§2.5（常见错误）
- 配色与 AA 验算：`README.md` §4.1–§4.4；`tokens.json`（109/47 令牌镜像）
- 组件契约：`components.css` §4–§9、§19（面板）、§20–§21（响应式 / 降级）
- API 签名：`nvui-api.js`（`createPanel` / `addSwitch` / `addAccordion` / `addNode` / `setTab` / `syncIndicator` / `showToast`）
- 迁移对照：`README.md` §10.1（token 同名同值）、§10.5–§10.7（面板标准引入史）
