# UPGRADING · v3.1.1

本文件是**常青升级指南**：当前版本是 v3.1.1。**v3.0.0 是 MAJOR，四类破坏性变更的完整对照见
[MIGRATION-v3.md](MIGRATION-v3.md)**；再往前的历史版本差异见 [MIGRATION-v2.md](MIGRATION-v2.md)。
下文各节按版本从新到旧排列，历史小节保留其**当时**的版本号，不要拿它当当前版本。

## 3.1.0 → 3.1.1

用同一个 tag 下的 `tokens.css`、`components.css`、`nvui-api.js` 和 `tokens.json` 覆盖现有资产。
现有 `createPanel()` 调用和 StorageAdapter 接口可继续使用。

- 无需归一化的面板 ID 沿用原有存储键。需要归一化的 ID 采用独立编码键，旧记录可自动回读。
- 手动清理布局请调用 `panel.clearLayoutState()` 或传入原始 ID 的 `NVUI.clearLayoutState(id, storage)`。
- 覆盖后用 `NVUI.selfCheck({ expect: '3.1.1' })` 核对版本，并确认布局导入在下次打开时生效。

## 3.0.0 → 3.1.0

v3.1.0 是 **MINOR**，但包含一项 v3.0.0 发布时就承诺的移除：`data-nvui-legacy-size` 过渡开关。

| 变了什么 | 谁必须动 | 怎么改 |
| :--- | :--- | :--- |
| `data-nvui-legacy-size`（面板元素或 `<html>`）已移除。设了属性也不再写内联 px、不再告警 | **只有**靠这个开关回到内联 px 的下游 | 改用 `panel.style.setProperty('--nvui-panel-w', '640px')`，或自己的 CSS 选择器 `#my_layer .nvui-panel { width: 500px }`。详见 MIGRATION-v3 §1.4 |

其余全部不变：token 111 / 47、组件类 84、关键帧 16、`!important` 18、顶层导出 29、
DOM 必需层级、状态格式 v2、兼容矩阵与 `engines.node`。**不依赖该开关的下游覆盖 4 资产即可，
不改任何调用代码。**

### 验收清单

1. `NVUI.version === '3.1.0'`，`NVUI.selfCheck({ expect: '3.1.0' })` 干净；
2. 面板尺寸仍是你期望的值 —— 尤其确认没有代码路径依赖开关写的内联 px；
3. 有下游 CSS 覆盖面板宽度的，确认不加 `!important` 仍能生效；
4. `node ui-kit/test/downstream-check.js` exit 0；
5. 零 pageerror。

## 2.9.0 → 3.0.0

v3.0.0 是 **MAJOR**。它改的不是能力而是**契约**：面板尺寸的载体、布局状态格式、按钮组的声明方式、
`tokens.json` 的结构。四类变更的杀伤力差别很大 —— **只覆盖 4 资产、不碰下面四类的下游不用改代码**。

| # | 变了什么 | 谁必须动 | 怎么改 |
| :--- | :--- | :--- | :--- |
| C1 | 面板尺寸由内联 `style.width/height` 改为 CSS 变量 `--nvui-panel-w` / `--nvui-panel-h`；状态格式 `{ version: 1, size: { width, height, isMaximized } }` → `{ version: 2, size: { w, h, mode } }` | 读 `panel.style.width/height` 的下游；自己解析 / 存档布局状态的下游 | 改读变量或 `panel.getLayoutState().size`；存档过 v1 的跑一次 `NVUI.migrateStateV1toV2()`（内置读取路径已自动迁移）。**用 CSS 覆盖面板宽度的下游从这版起才真的生效** |
| C2 | `.nvui-actions` / `.nvui-btn-row` / 两个 footer 的四段规则归一为一条 `:where(...)`（零 specificity） | 一般不用动 | `.nvui-btn-row` 在 v3.x 内是 `.nvui-actions` 的别名。可见差异：窄屏按钮换行而非溢出、`.nvui-btn-row` 不再被默认拉伸对齐 |
| C3 | `tokens.json` 升 schema 2：新增 `schema` / `meta{group,type,description}` / `groupDescriptions`，**`dark` / `light` 的值结构与键顺序逐字节不变** | 遍历 `tokens.json` 顶层键当令牌名的下游 | 改成遍历 `json.dark` / `json.light`。只按 key 取值的不用动 |
| C4 | 新增 `engines.node: >=18.0.0` 与 README §11.5 兼容矩阵硬门禁 | 构建 / 测试脚本还在 Node 16 的下游 | 升级 Node（只影响开发期脚本，浏览器运行时无关）；可选地在初始化时调 `NVUI.checkCompatibility({ min: '3.0.0' })` 自查 |

**过渡开关已结束**：v3.0.0 曾提供 `data-nvui-legacy-size`（按 v2 方式写内联 px），
v3.1 起已移除，设了属性也不再有任何效果。宿主 CSS / 动画硬依赖 `panel.style.width` 的下游，
改用 `panel.style.setProperty('--nvui-panel-w', ...)` 或自己的选择器，详见 MIGRATION-v3 §1.4。

### 覆盖资产

```
tokens.css
components.css
nvui-api.js
tokens.json
```

保持 `tokens.css` 在 `components.css` 之前，CSS 先于 JS；4 个必须是同一版本（`--nvui-kit-version` 与
`NVUI.version` 都应为 `3.0.0`）。CSS 与 JS **都要换**：只换 CSS 会缺 `migrateStateV1toV2`，
只换 JS 会缺新的尺寸变量回落与按钮组统一规则。

### 验收清单

1. `NVUI.version === '3.0.0'`，`NVUI.selfCheck({ expect: '3.0.0' })` 干净；
2. `NVUI.diagnostics().status === 'ok'`，`assets.tokensCss === '3.0.0'`，`assets.componentsCss === true`；
3. `node ui-kit/test/downstream-check.js` exit 0（4 资产一致性）；
4. 面板宽度仍是期望值 —— 尤其检查「以前靠内联 px 生效、现在靠 CSS 默认值」的场景；
5. 有 `nvui_state_<id>` 旧存档的机器上打开面板一次，再读存储：`size` 已是 `{ w, h, mode }`；
6. 面板能拖 / 能拉（若开了 `resizable`）、最大化与还原后宽度正确回落；
7. 零 pageerror；深 / 浅两主题目检。

## 2.8.3 → 2.9.0

v2.9.0 是 **MINOR**：**全部为 opt-in 增量**，不传新参数的既有调用行为、DOM 结构、`nvui_state_v1`
状态格式、token 取值（111 / 47）与 `!important`（18）全部不变。覆盖 4 资产即可，**不改任何调用代码也能升**。

- **组件类 81 → 84**（+`.nvui-progress-field` / `.nvui-resize` / `.nvui-input-msg`），新增均只增不删；
- **顶层导出 27 → 28**（+`diagnostics`），冻结面只允许新增；
- 控制器新增 `getLayoutState()` / `setLayoutState()`；`createPanel` 新增可选 `resizable`；
  `inputRow` 新增 `textarea` 伪类型与 `rows` / `hint` / `error`；`progress` 新增 `showLabel` / `showValue`；
  `setTheme` 新增 `'auto'`；`persist.size` 新增第三态 `'width-only'`。

按需接入（都不改默认行为，逐个 opt-in）：

| 想要什么 | 怎么开 | 备注 |
| :--- | :--- | :--- |
| 布局存档导出/导入（同步进 `extension_settings`、多设备搬运） | `panel.getLayoutState()` / `panel.setLayoutState(state)` | `get` 返回游离副本且不含 `timestamp`；`set` 只写内存 + 调度落盘，真正生效在下一次 `open()`，需要 `silent` 时加 `{ silent: true }` |
| 「定宽 + 高度自适应」的面板只记宽 | `persist: { size: 'width-only' }` | 落盘 `height` 恒 `null` 且不记 `isMaximized`；下行 `height: 94vh` 之类得以生效。原有的 `true` / `false` 两态语义不变 |
| 给用户一张「你这装的是哪版」快照 | `NVUI.diagnostics()` | 纯只读，8 个字段；无 DOM 环境返回 `{ status: 'no-dom', version, assets: null }` |
| 面板跟随系统/宿主主题 | `panel.setTheme('auto')` | 双信号取并集（`prefers-color-scheme` 或宿主 `.nvui-theme-light`）；显式 `'light'` / `'dark'` 会摘掉监听 |
| 鼠标与键盘都能调面板尺寸 | `createPanel({ resizable: true })` | 默认关闭；方向键 ±8px / Shift ±32px / `Home` 复位；写入一律走 `applyClamping()`，钳制与持久化语义不变 |
| 多行文本输入、字段说明与错误提示 | `inputRow({ type: 'textarea', rows: 4 })`、`inputRow({ hint })`、`inputRow({ error })` | `textarea` 是伪类型，`input.type` 仍是 `text`（意图在 `data-nvui-type`）；`hint` / `error` 各占一个 `aria-describedby` id |
| 进度条显示标题与百分比 | `progress({ showLabel: true, showValue: true })` | 默认关闭；开启后容器变 `.nvui-progress-field`，轨道在 `container.track`，可视文本 `aria-hidden` 防重复播报 |

### 覆盖资产

```
tokens.css
components.css
nvui-api.js
tokens.json
```

保持 `tokens.css` 在 `components.css` 之前，CSS 先于 JS；4 个必须是同一版本（`--nvui-kit-version` 与
`NVUI.version` 都应为 `2.9.0`）。CSS 与 JS **都要换**：只换 CSS 会缺 `diagnostics` / `resizable` 等 API，
只换 JS 会缺 `.nvui-resize` / `.nvui-input-msg` 的样式。

### 验收清单（v2.9.0 增量部分）

1. `NVUI.version === '2.9.0'`，`NVUI.selfCheck({ expect: '2.9.0' })` 干净；
2. `NVUI.diagnostics().status === 'ok'`，`assets.tokensCss === '2.9.0'`，`assets.componentsCss === true`；
3. 打开过面板再关掉，`diagnostics().listenerCounts` 的 `resize` / `scroll` / `change` / `keydown` 回到基线；
4. `resizable: true` 的面板用 Tab 能到右下角手柄（`role="separator"`），方向键改尺寸且不滚走页面；
5. 浅色系统 + `setTheme('auto')` 下切系统主题，面板同帧变色；
6. 存量面板（不加任何新参数）在外观与 `nvui_state_<id>` 存储结构上与 v2.8.3 逐字节一致。

## 2.8.2 → 2.8.3

v2.8.3 是 **PATCH，且只动测试与工程脚本**：探针归档进 `test/probe/`、`issue-16` 尺寸语义矩阵补到 12 项、
`playwright-core` 进 devDependencies 并统一依赖解析、新增 `npm run verify:all` 一键门禁。
公开 API / 组件类 / token 取值 / DOM 契约 / `nvui_state_v1` 状态格式 / 运行语义**全部不变**。

- **4 个资产只有版本号变化**（文件头注释与 `--nvui-kit-version`），运行代码零改动 ——
  不覆盖资产也能继续用；需要版本号自检（`NVUI.selfCheck()`）的插件再同步覆盖即可。
- **不需要改任何调用代码**，也不涉及存储迁移；v2.8.2 的焦点陷阱修正与 40px 触控照常生效。
- **下游可选的验证动作**：新机器 `npm i && npm run test:browser` 应一次通过（`playwright-core` 已是
  devDependency，缺包/缺 Chrome 会打印可执行修复命令）；发布前可只跑 `npm run verify:all`
  （无 Chrome 时浏览器段自动跳过，退出码仍为 0）。

## 2.8.1 → 2.8.2

v2.8.2 是 **PATCH**：无公开 API、类名、token 取值或 `nvui_state_v1` 状态格式变化，覆盖 4 资产即可。
v2.8.1 的 `persist.size: false` 修复（#16）语义原样保留：重构只是把实现搬进 `createPersistence(ctx)`，
`test/issue-16-persist-size.js` 12/12 仍绿。

- **焦点陷阱修正**：`tabindex="-1"` 的未激活 tab 不再计入可 Tab 项，纯文本面板按 Tab 不会逃出模态（GH-#20）。
- **触控尺寸（视觉变化）**：移动端底部导航项 `min-height: 40px`（原 26px），抽屉整体 +14px（GH-#21）。
- **测试基线**：`test/host/` 两套实机冒烟入库，入口 `npm run test:host`；不改运行时行为。
- **内部重构（无行为变更）**：`createPanel()` 拆出 7 个模块级 factory，函数体 1433 → 531 行、嵌套函数 36 → 4 个；
  导出面、DOM、CSS、状态格式全部不变。

### 覆盖资产

```
tokens.css
components.css
nvui-api.js
tokens.json
```

保持 `tokens.css` 在 `components.css` 之前，CSS 先于 JS；4 个必须是同一版本（`--nvui-kit-version` 与 `NVUI.version` 都应为 `2.8.2`）。

## 2.8.0 → 2.8.1

v2.8.1 是 **PATCH**：只修 `persist.size: false` 的尺寸隔离缺陷（GitHub #16），没有 token / 组件类 / `!important` / 公开 API / DOM 契约 / 状态格式变更。

### 1. 覆盖 4 个运行资产

```
tokens.css
components.css
nvui-api.js
tokens.json
```

保持 `tokens.css` 在 `components.css` 之前，CSS 先于 JS。4 个必须是同一版本；v2.8.1 的 `--nvui-kit-version`、`NVUI.version` 都会读成 `2.8.1`。

### 2. 本次行为变化（只影响 `persist: { size: false }`）

`persist.size: false` 现在的语义是**完全不参与尺寸持久化**：

- 不再从 `nvui_state_<id>` 恢复 `size`；
- `applyClamping()` 不再把存档里的 px 宽高写回面板内联样式（下游 `height: var(--nvui-panel-max-h)` / `94vh` 不再被旧值压掉）；
- 下一次落盘会把历史遗留的 `size` 主动写回 `null`，即「一次性自愈」，无需下游清理存储；
- **面板自身的内联 px 仍然照常受视口钳制**（拖拽、`opts.width`、`setSize()`、最大化语义不变）。

`persist.size: true`（默认）行为完全不变。下游若此前写过「开面板前手动 `delete state.size`」的绕过补丁，升级后可以直接删掉。

```js
// 升级后：不再需要这段绕行
const state = storage.get('nvui_state_wbe');
if (state && state.size) { delete state.size; storage.set('nvui_state_wbe', state); }
```

## 2.7.2 → 2.8.0

v2.8.0 是 **MINOR（additive）**：没有删除/改名 token、组件类或公开 API；主要新增「版本可观测、自检、默认值、Fast UI 玻璃模式」与发布工具。

### 1. 覆盖 4 个运行资产

```
tokens.css
components.css
nvui-api.js
tokens.json
```

保持 `tokens.css` 在 `components.css` 之前，CSS 先于 JS。**4 个必须同一版本**：v2.8.0 新增 `--nvui-kit-version`、`.nvui-actions` 与 `glass` 控制器方法；只换 CSS 会缺 API，只换 JS 会缺样式。

### 2. 版本自检

```js
const r = NVUI.selfCheck({ expect: '2.8.0' });
if (!r.ok) console.warn('[my-plugin] ui-kit', r.issues);
```

- `r.cssLoaded`：tokens.css 是否加载；
- `r.glass.state` / `r.glass.autoFallback`：玻璃能力与自动回退；
- `r.issues`：版本不匹配、CSS 未加载、自动回退等。

### 3. 下游一条命令

把 `test/downstream-check.js` 随 4 资产一起拷入（例如 `ui-kit/test/`），运行：

```bash
node ui-kit/test/downstream-check.js
# exit 0 = 升级通过
```

它只依赖 4 资产 + package.json，不读 README/CHANGELOG/AUDIT。

### 4. 新增默认值/间距

- 正文内裸相邻 `.nvui-btn` 默认 8px；
- 新增 `.nvui-actions` 按钮组容器；
- `.nvui-btn-row` / `.nvui-panel-footer` / `.nvui-modal-footer` 内不会双倍间距；
- `NVUI.defaults` 可读各组件官方默认值；缺 label/title/message 会 `warnOnce`。

如果旧布局依赖「按钮贴紧」，用普通类覆盖 `margin-inline-start` 即可（新规则是零 specificity 的 `:where()`）。

### 5. Fast UI 玻璃模式（可选）

```js
const panel = NVUI.createPanel({ glass: 'auto' }); // 默认，尊重宿主
panel.setGlassMode('force');  // 仅本面板；Fast UI 开启时也强制真玻璃
panel.getGlassState();
// { mode, effective, fastUI, browserSupports, preferenceBlocked, reason }
```

- `force` 默认关闭，必须插件显式开启，并在插件设置里给用户关闭项；
- `prefers-reduced-transparency: reduce` / `forced-colors: active` / 浏览器不支持时自动回退；
- 只影响本面板，不提供全局 `NVUI.setGlassMode`；
- 旧版 Safari 的 `force` 玻璃不保证（只使用标准 `backdrop-filter`）。

### 6. 验收清单

1. 4 资产同版本；`NVUI.version === '2.8.0'`；
2. `NVUI.selfCheck({ expect: '2.8.0' })` 无 `version-mismatch` / `css-not-loaded`；
3. `node ui-kit/test/downstream-check.js` exit 0；
4. 面板/弹窗/吐司/折叠/表单冒烟，零 pageerror；
5. 检查相邻按钮间距、`.nvui-actions`、玻璃 auto/force/solid 三态；
6. 记录 `glass` 设置项与性能提示。
