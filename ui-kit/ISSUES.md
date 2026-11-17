# ui-kit Issue 追踪

本文件是 `zgy-beep/ui-kit` 的**本地 issue 追踪表**，与 GitHub Issues 双向对应：

- **GitHub Issues**：面向使用者提问、公开讨论 → https://github.com/zgy-beep/ui-kit/issues
- **本文件**：面向维护者的工作队列（未确认的怀疑项、待验证的性能项、内部约定），**不代表已确认的公开 bug**

规则：

1. 任何在 review / 实机测试中发现的**疑似**问题，先登记到本文件「待办」区，写明**复现证据**（文件路径 + 行号 / 实机观测数据），不允许凭印象下结论。
2. 确认是真问题后：修代码 → 补回归断言（`test/test-ui-kit.js` 或实机脚本）→ 更新 CHANGELOG → 在本文件标记「已修复」并写明修复版本。
2b. 若经**实机测量**证明并非真问题（如：累计布局耗时高但帧间隔与基线一致 → 无可感知卡顿），
    则转入「已确认-不修」区，并**附上实测数据与复现脚本**。禁止仅凭推理下「不修」结论。
2c. 判定性能类问题必须看**帧间隔**，不能只看布局次数 / 累计布局耗时（详见 README §13.6）。
3. 涉及公开行为或使用体验的，**同时**在 GitHub 建 issue，编号写回本文件。
4. 状态取值：`待办` / `修复中` / `已修复` / `已确认-不修` / `已上报`。
5. 状态流转、GitHub 关闭判据、巡查节奏一律遵循 [`MAINTAINING.md`](MAINTAINING.md) §3：**只有三种合法关闭**（已发布修复 / 有证据的不修 / 重复），关闭必须留评论（版本 + commit + 验证方式）。代码落地但未发版的，GitHub 侧保持 OPEN 并打 `fixed-pending-release` 标签，本地标记 `已修复（待发布 vX.Y.Z）`——**不允许用 `Unreleased` 这种没有版本号的措辞**。

---

## 当前 GitHub 维护

> **编号约定（2026-11-16 修正）**：本文件「已修复」「待办」区的 `#N` 是**维护者序号**，与 GitHub issue 编号是两套独立序列。
> 跨文件提到 GitHub 时一律写 `GH-#N` 或完整 URL。已确认的同项映射：`#1`→GH#1、`#17`→GH#4、`#18`→GH#9、`#19`→GH#10、`#20`→GH#11、`#23`→GH#20。
> 历史上因两套编号混用，`#17`~`#23` 一度被误读为 GitHub 编号，本轮已补映射表修正。

| GitHub Issue | 问题与证据 | 状态 |
| :--- | :--- | :--- |
| [GH-#15](https://github.com/zgy-beep/ui-kit/issues/15) | v2.7.0 forms 浏览器回归一次并行运行得到 453/455，半选 checkbox 背景和横杠透明度读到过渡中间帧；串行复跑 455/455。 | **已关闭**（v2.7.1）：等待两项计算样式终值并保留最终断言；三份并行 forms 各 455/455。发布提交关联 `Fixes #15`。 |
| [GH-#17](https://github.com/zgy-beep/ui-kit/issues/17) | 线路 A · v2.8.2 / v2.8.3 工程化收尾（A1–A5）。 | **CLOSED（v2.8.3，2026-11-16）**：A1 尺寸矩阵 8 → 12（`c42f3f7`）、A2 依赖解析统一（`f68f4ce`）、A3 `verify:all` 9 步 + 产物校验（`2c763e6`）随 v2.8.3 发布；A4 `test/probe/` 30 个脚本 + 索引（`0301d68`）、A5 已在 v2.8.2 交付。tag `v2.8.3` + Release 3 产物已推，关闭评论含版本 / commit / 实测数字。 |
| [GH-#18](https://github.com/zgy-beep/ui-kit/issues/18) | 线路 B · v2.9.0 下游可维护性与可观测性（B1–B6，全 additive）。 | **CLOSED（v2.9.0，2026-11-16）**：B1 `f601260` / B3 `8b7f4be` / B2 `e200899` / B6 `98dd3b3` / B4 `9b37425` / B5 `05e3db0`，六套 spec 共 56 项全绿；组件类 81 → 84、顶层导出 27 → 28。DOM 契约条目未做（需先定破坏性检测语义，与线路 C 同源），已在关闭评论注明。tag `v2.9.0` + Release 3 产物已推。 |
| [GH-#19](https://github.com/zgy-beep/ui-kit/issues/19) | 线路 C · v3.0.0 内联尺寸停写与命名收敛（C1–C4，破坏性）。 | **CLOSED（v3.0.0，2026-11-16）**：C1 尺寸载体换轨 `5865946`（`test/v300-size-vars.spec.js` 8/8，V2 用同一段下游 CSS 双向证明「变量载体 500px / legacy 载体 860px」）、C2 按钮组归一 `e2cf4e4`、C3 tokens schema 2 `f619a77`、C4 兼容矩阵门禁 `427a50a` + 解析器修复 `f782076`；`verify:all` 9 → 10 步、顶层导出 28 → 29、`MIGRATION-v3.md` 新建。**未做项**：ST 1.20 实机（本机无环境，兼容矩阵只声明到 1.12.0，不承诺未验证版本）。tag `v3.0.0` + Release 3 产物已推，milestone 3 已 closed。 |
| [GH-#20](https://github.com/zgy-beep/ui-kit/issues/20) | 焦点陷阱尾项误判：`tabindex="-1"` 的未激活 tab 被计入可 Tab 项，纯文本面板一次 Tab 即逃出模态（对应本文件 `#23`）。 | **CLOSED（v2.8.2，2026-11-16）**：tag `v2.8.2` + [Release](https://github.com/zgy-beep/ui-kit/releases/tag/v2.8.2) 已建，关闭评论记录了版本 / commit / 验证数据；按 `MAINTAINING.md` §3.3 第 1 条关闭。 |
| [GH-#21](https://github.com/zgy-beep/ui-kit/issues/21) | UX 观察 3 条：移动端底部导航项 26px、进度条 `label` 仅 `aria-label` 无可视标签、长内容滚动边缘硬切。 | **CLOSED（v2.9.0，2026-11-16）**：触控 40px 已随 v2.8.2 交付（`7818192`）；进度可视标签与边缘渐隐随 v2.9.0 交付（`e37b446`，`test/issue-21-ux.spec.js` 11/11）。三条全部 additive，关闭评论含取舍说明（mask-image 而非内阴影、可视文本 `aria-hidden` 防重复播报）。 |
| [GH-#22](https://github.com/zgy-beep/ui-kit/issues/22) | 线路 D · v3.1.0 移除 `data-nvui-legacy-size` 过渡开关（v3.0.0 承诺兑现）。 | **CLOSED（v3.1.0，2026-11-16）**：D1 代码零残留 `d6c26cc`（删 `LEGACY_SIZE_ATTR` / `usesLegacySize` / legacy 分支 + warnOnce，载体只剩 CSS 变量一条路径）；D2 `test/v300-size-vars` 8/8，V2 改直接证明下游 CSS 接管（实测 500/860px）、V3 改防复活断言（设属性后 legacyWarns=0）；D3 文档改「已移除」+ 替代方案。附带修两个夹具：`7e655f4`（v280 的 `max:'3.0.0'` 升位当天失效）、`384835f`（AI-GUIDE 漏 bump 导致 e2e T1-R3-04 红）。tag `v3.1.0` + Release 3 产物已推，milestone 4 closed。 |
| [GH-#23](https://github.com/zgy-beep/ui-kit/issues/23) | setLayoutState 导入后重新打开同一面板未应用布局 | **已修复（本地验证）**（P1） |
| [GH-#24](https://github.com/zgy-beep/ui-kit/issues/24) | 异步存储的迟到读写会恢复旧布局 | **已修复（本地验证）**（P2） |
| [GH-#25](https://github.com/zgy-beep/ui-kit/issues/25) | 归一化后相同的面板 ID 共用存储键 | **已修复（本地验证）**（P2） |
| [GH-#26](https://github.com/zgy-beep/ui-kit/issues/26) | Home 复位后旧存档高度被立即回填 | **已修复（本地验证）**（P2） |
| [GH-#27](https://github.com/zgy-beep/ui-kit/issues/27) | 面板 ID 为 -1 时方向键切换标签抛出选择器异常 | **已修复（本地验证）**（P3） |
| [GH-#28](https://github.com/zgy-beep/ui-kit/issues/28) | 退场期间重开会丢失原触发按钮的焦点归还 | **已修复（本地验证）**（P3） |
| [GH-#29](https://github.com/zgy-beep/ui-kit/issues/29) | 重复 destroy 触发两次回调，销毁后 open 重挂监听 | **已修复（本地验证）**（P3） |

> `ROADMAP.md` 于 2026-11-16 补建：此前三个 open issue 均引用该文件，但仓库从未提交过（`git log --all -- ROADMAP.md` 为空），属**死链**，现已修复。

## 已修复

| # | 问题 | 严重度 | 状态 | 证据 | 修复 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| G16（GitHub #16） | `persist: { size: false }` 关闭尺寸持久化后，面板仍被历史存档的 px 宽高钳回，压掉下游 `height: var(--nvui-panel-max-h)`；且旧 `size` 每次落盘被原样回存，永远清不掉 | **P1 持久化** | 已修复（v2.8.1） | `nvui-api.js` v2.8.0：`applyClamping()` 的 `loadedState.size` 分支无 `persistConfig.size` 门禁；`flushPersistSave()` 写 `persistConfig.size ? {...} : loadedState.size`。下游 ST-Worldbook-Editor 实测 1440×900 下 567px（期望 94vh = 846px） | ① `applyClamping()` 增加 `useSavedSize` 门禁（存档 size 完全不读，内联 px 仍照常视口钳制）；② `applyLoadedState()` 在 `size === false` 时把存档 `size` 摘成 `null`（同步/异步 adapter 同路径）；③ `flushPersistSave()` 改为落 `size: null`，历史遗留值一次性自愈。回归入口 `node test/issue-16-persist-size.js`（Chromium 8/8；还原 v2.8.0 时 T1/T2/T7 全红），已并入 `npm run test:browser` |
| 1 | `nvui-api.js` 的 `el()` 支持 `html` 属性直写 `innerHTML`，构成 XSS 汇聚点 | P0 安全 | 已修复 | `nvui-api.js` 原 L73 `else if (k === 'html') node.innerHTML = String(v);` | 删除该分支，只保留 `text` → `textContent`，其余走 `setAttribute`。GitHub Issue #1 |
| 2 | `animationend` 冒泡截断退场动画：面板内子动画（如 `.nvui-tabpane-in`）结束会冒泡到 overlay，导致 overlay 自身退场被提前截断 | P0 正确性 | 已修复 | 实机对照实验：A 组（切 tab 后 30ms 关闭）overlay 退场在 207ms 被 hidden（截断）；B/C 组正常 | `closeLayer` / 吐司 `dismiss()` 的 `onAnimEnd` 增加 `event.target` 校验（+ 吐司校验 `animationName`） |
| 3 | 每次 `createPanel` 都在 `document` 上挂 `keydown` 监听且从不注销 → 监听器泄漏 | P1 正确性 | 已修复 | `nvui-api.js` 原 `on(document, 'keydown', ...)`；实机：第 3 个面板新增 document 监听数 = 1 | 引入全局单例 Esc 调度器 `escapeStack`，只由最上层可见浮层响应；面板销毁时自动注销 |
| 4 | 同名面板产生重复 `id`（含 `-layer` / `-overlay` / `-title` 派生 id），`aria-labelledby` 指向错乱 | P1 可访问性 | 已修复 | 实机：两个 `same_base` 面板得到相同 id | 新增 `uniqueId()` + `idTaken()`（同时检测四个派生 id），冲突时才加后缀 |
| 5 | `aria-modal="true"` 但无焦点陷阱，Tab 会跑到面板外 | P1 可访问性 | 已修复 | `nvui-api.js` `createPanel` 仅有 `aria-modal` 声明 | 面板内实现 focus trap（Tab / Shift+Tab 循环） |
| 6 | 焦点归还失败，焦点掉到 `body` | P1 可访问性 | 已修复 | 实机：Esc 关闭后 `activeId: ""`。根因：ST wand 菜单点击菜单项后自动收起，触发按钮不可聚焦，`opener.focus()` 静默失败 | 新增 `isFocusable()` 校验 + `focusFallback` 三级兜底（触发元素 → focusFallback → 面板本身） |
| 7 | 面板 / 吐司**被酒馆内容压在后面**（用户截图报障） | **P0 层级** | 已修复 | 实机命中栈：面板中心点 `elementsFromPoint` 顶层是宿主 `fa-solid fa-address-card`，kit 元素排在第 5 位。根因：载体 `dialog.nvui-tl` 是 `position:fixed` + `z-index:auto` → 创建层叠上下文，整体只相当于 z-index 0，而 ST `#sheld` 是 `z-index:30` 的 absolute 元素 | 载体显式 `z-index: var(--nvui-z-layer)`（1000000，专属载体档）；吐司载体加 `.nvui-tl-toast`（`--nvui-z-tooltip`）。实测 5 个采样点全部 `oursOnTop: true` |
| 11 | `.nvui-progress-bar::after` 的 shimmer 无限动画常驻（0% / 100% 时也在跑） | P2 性能 | 已修复 | `components.css` `.nvui-progress-bar::after`。扫光是「进行中」的语义装饰，0% 尚未开始、100% 已结束，此时跑无限循环动画纯属浪费合成层资源 | 新增**可选**状态类 `.nvui-progress.is-idle`（0%）/ `.is-complete`（100%），CSS 侧 `animation: none` 停掉扫光；`NVUI.progress()` 的 `setValue()` 自动维护这两个类（`syncActivity`）。**不确定进度（`is-indeterminate`）永远保持扫光**。未新增 token、未改既有 DOM 契约（手写 DOM 不加类时行为与旧版一致） |
| 13 | `prefers-reduced-motion` 门禁只覆盖 `.nvui-scope *` / `dialog.nvui-tl *`，宿主容器内未加 `.nvui-scope` 时组件动画不会降级（无障碍红线被绕过） | P2 无障碍 | 已修复 | `components.css` reduced-motion 块（原 L2069-2072）。宿主把 kit 组件挂进自己的容器却没加 `.nvui-scope` → 层 1 通配不生效 → 组件动画照常播放 | 降级块改为**两层**：层 1 保留 `.nvui-scope *` / `dialog.nvui-tl *` 通配（覆盖作用域内的自定义子元素），层 2 用 `:is(...)` **逐个点名 27 个自身带 animation/transition 的 kit 类**（含 `::before`/`::after` 变体 + `.nvui-stagger > *` + 开关 checkbox）。**未新增 `!important`**（仍 5 个，预算 ≤ 8 保持不变）。回归断言：扫描 `components.css` 里所有带 `animation:`/`transition:` 的规则，提取其 kit 基类，逐一断言出现在降级块选择器中 |
| 14 | `preview.html` 的 `replayMotion` 逐节点读 `offsetWidth` 强制回流（N 节点 = N 次同步布局）；滚动监听（`capture: true`）未节流，一次滚动触发数十次回调 | P3 性能 | 已修复 | `preview.html` 原 `replayMotion` 内 `void node.offsetWidth`（逐节点）+ `window.addEventListener('scroll', repositionTip, true)` 直接调用 | `replayMotion` 改为「批量摘类 → 全局只读一次 `document.body.offsetWidth` → 批量挂回」，并对 stagger 子项单独触发回流（子项数远小于摘类节点数）；`repositionTip` 用 `requestAnimationFrame` 合并为每帧至多一次。回归断言：断言重播函数不含 `void node.offsetWidth` 且含 `void document.body.offsetWidth`；断言滚动处理含 `requestAnimationFrame` + `repositionRaf` |
| 15 | 宿主 `body.no-blur` 全局禁用 `backdrop-filter` 时，kit 玻璃只剩半透明底色，下层文字透出重影 | P2 视觉 | 已修复 | 宿主规则实为 `body.no-blur * { backdrop-filter: unset !important }`（`public/css/toggle-dependent.css` L368）。浏览器**仍支持** backdrop-filter，故 `@supports not` 降级块不触发 → 玻璃底色半透明 → 下层文字直接透出 | `nvui-api.js` 新增 `detectGlassSupport()` / `syncGlassFallback()`：**造隐藏 `.nvui-glass` 探针读渲染后的实际计算值**（`getComputedStyle().backdropFilter`），为 `none` 即判定被外部禁用 → 自动给根节点挂 `.nvui-solid` 实心回退。不猜宿主类名（避免耦合）。`createPanel()` / `showToast()` 已内置调用。实机 `test/probe/st-glass-fallback-check.js` **9/9 全绿**：宿主 no-blur 下探测值 = `none`、面板背景 = `rgb(22,26,36)`（不透明）、移除 no-blur 后探测值恢复 `blur(20px) saturate(1.5)`、全程零控制台错误（v2.7.2 起改为 `.nvui-glass-fallback` 97% 近不透明回退，见 #21/#22） |
| 17 | 宿主 `showModal()` 模态期间，kit 浮层被压住且**完全无法交互**（用户点了没反应，无任何视觉提示）；且 v2.3.0 README §13.5.1 对照表 F 行「`popover=manual` 能压过一切」为**错误论断** | P1 交互 / P1 文档 | 已修复 | 实机探针（`/tmp/probe-carrier*.js`，真实 ST 宿主）：① `popover="manual"` 无论 show 先后**都压不过** `showModal()` 模态；② 普通 div + `z-index:2147483647` 同样不行；③ 根因**不是 z-index**，而是 `showModal()` 给**整页**加 `inert`，`inert` 元素不参与命中测试（`elementsFromPoint` 不返回），也无法获得焦点 | **改为「主动让位」而非硬压**：① `components.css` 新增降级态 `dialog.nvui-tl.is-host-modal`（`pointer-events:none` + `opacity:0.35` + `grayscale(0.6)`，子浮层一并让位）；② `nvui-api.js` 新增 `countHostModals()` / `syncHostModalState()` / `getCarrierState()`；③ 装幂等 watcher（`MutationObserver` 监听 `dialog[open]` + 捕获 `close`），宿主模态**动态开关**时自动降级/还原；④ README §13.5.1 F 行更正 + 新增 §13.7。实机 `test/probe/st-carrier-host-modal-check.js` **18/18 全绿**。GitHub Issue #4 |
| 18 | 宿主主题以「元素选择器 + `!important`」重写全局表单控件，浅色主题下 `.nvui-input` 呈「深底深字」不可读 | P1 宿主兼容 | 已修复（v2.6.0） | GitHub Issue #9 附 Chromium 实测：`input.nvui-input` 背景 `rgb(46,46,52)`（宿主深色）/ 文字 `rgb(31,36,48)`（kit 深色），同刻 `--nvui-input-bg` 本身正确。本地静态核对：`.nvui-input` 为裸类（0,1,0）、无隔离层、`select option` 无皮肤，`nvui-api.js` 中 `nvui-scope` 出现 0 次 | `components.css` 新增 §7.1 宿主表单隔离：仅 `dialog.nvui-tl` + `.nvui-panel` 双载体、7 条 `!important`（基础 `background`/`color`/`border` 3、`select margin` 1、`:hover background` 1、`option background`/`color` 2），值全走 token 或明确 reset；`:hover` 同作用域还原。`test/test-ui-kit.js` 预算 8 → 14，并新增分类计数 / 双载体选择器 / 精确属性值断言。验证入口：`node test/test-issues-9-10-forms.js`。**GitHub：随 v2.6.0 发布提交关闭（`Fixes #9`）** |
| 19 | 缺少独立 checkbox 组件：批量选择场景每个下游插件都要自绘宿主隔离 | P2 组件缺失 | 已修复（v2.6.0） | GitHub Issue #10 附下游插件自绘 CSS（`appearance:none` + 显式宽高 + 压 `::before`）。本地核对：`components.css` 无 `.nvui-checkbox`，宿主隔离只覆盖 `.nvui-switch-row` | 新增 `.nvui-checkbox[type="checkbox"]`：16×16、`:checked` / `:indeterminate`、焦点环走 token、`::after` 纯 CSS 对勾；**复用既有 `::before` 压制、不新增 `!important`**；组件类 78 → 79；`preview.html` 补全选 / 半选 / 禁用示例；README §7.5.1 补文档。验证入口：`node test/test-issues-9-10-forms.js`（16px 几何 / `::before` 抑制 / 半选 / 焦点与 Space / disabled）。**GitHub：随 v2.6.0 发布提交关闭（`Fixes #10`）** |
| 20 | `innerHTML` 注入的 `.nvui-acc` 无法进入 `accList`，`persist.accordion` 静默存成 `{}`（重开面板状态丢失） | P1 持久化 | 已修复（v2.6.0） | GitHub Issue #11 附浏览器实测 storage 内容（`accordion: {}` 而同份 `size`/`tab` 正常）。本地复核：原 `addNode` 注册门槛要求节点自带 `setOpen`（仅工厂产物满足），`trackAccordion` 为闭包私有、控制器无公开入口 | 新增 `panel.trackAccordion(node, id?, options?)` 与 `panel.adoptAccordions(root, options?)`：键按**原始字符串**保存（中文 / 非 ASCII 键不再折叠，`__proto__` 等特殊键安全存取）；**显式 / DOM / data 键被活动节点占用时告警并返回 `null`**，自动键与工厂标题兜底键才追加序号；同键旧节点已脱离面板时由新节点替换；注册幂等；**默认不接管点击**（`{ bind: true }` opt-in）；跨面板 / `document` / `body` 边界拒绝；`destroy()` 解绑并停止落盘；沿用既有 `nvui_state_*` 状态格式。验证入口：`node test/test-issue-11-accordion.js`（真实 Chromium）。**GitHub：随 v2.6.0 发布提交关闭（`Fixes #11`）** |
| 21 | 面板「没有玻璃透明感」：面板虽然半透明，但透明度不足且背后模糊不够，视觉上不像玻璃 | P2 视觉 | 已修复（v2.7.2） | 真实 ST 实机对照：玻璃态 = 透明面板 + 面板背后强模糊。面板态单独采用更透的玻璃：遮罩 `color-mix(--nvui-bg 20%)` + `blur(24px)`，面板 `color-mix(--nvui-bg 30%)` + token 柔光 + `blur(48px) saturate(190%) brightness(1.12)`；浅色 62% 底；窄屏降档。面板/遮罩规则提升到 `dialog.nvui-tl` 作用域，压过真实 ST 中其它扩展内嵌的旧版 kit CSS | `.nvui-overlay.is-panel` / `.nvui-panel` 使用面板态高透明玻璃 + 强 blur；`dialog.nvui-tl` 作用域副本保证多扩展共存时生效；`.nvui-solid`/Fast UI 回退/减少透明度降级仍可覆盖。面板态为视觉优先档（极亮宿主不承诺 text-2 AA）；新增 `test/st-glass-transparency.js` 与真实宿主 21 项断言 |
| 22 | 玻璃探测时序死锁 + 不可逆：kit CSS 未就绪时调用 `syncGlassFallback()` 永久缓存 false 并挂 `.nvui-solid`；`.nvui-solid .nvui-glass` 反压探针，导致 CSS 就绪后 `{force:true}` 仍返回 false、无法恢复；另有 `setTheme()` 误清用户实心偏好、`open()` 不重探的反向缺陷 | **P1 正确性** | 已修复（v2.7.2） | CDP 复现：CSS 未注入时 `{supported:false, html:'nvui-solid'}`；注入 CSS 后 `{supported:false}` 且面板 `rgb(22,26,36)`、`backdrop-filter:none`；真实 ST `fast_ui_mode` 默认 true（body.no-blur），首装 `showToast()` 即可触发并永久实心；`setTheme()` 只清 body 类、自动回退在 html，两边状态失联 | 探测三态化（supported/unsupported/unknown）：unknown（CSS 未就绪）不缓存、不落回退，按「根/body class + reduce 偏好 + CSS 就绪 + 用户实心」签名重探（定时器 / load / fonts.ready / `openLayer()` / 媒体变化）；探测前临时摘掉 `.nvui-solid` 与 `.nvui-glass-fallback` 避免自锁；宿主禁模糊时改挂可逆的 `.nvui-glass-fallback`（97% token 派生近不透明档），支持恢复后自动移除；`setTheme()` 不再无条件清 `.nvui-solid`；`openLayer()` 增加重探。新增 `test/st-glass-transparency.js` 覆盖时序竞争与回退可逆 |
| 23 | 焦点陷阱尾项误判：`tabindex="-1"` 的未激活 tab 被计入可 Tab 项，纯文本面板从激活 tab 按一次 Tab 即逃出模态，焦点落到宿主页面 | **P1 可访问性** | 已修复（v2.8.2） | 2026-11-16 实机（ST 1.19.0 / Chrome，1440×900）：trap items 含 `repro-tab-b ti=-1`；焦点在激活 tab（`ti=0`）按一次 Tab 后 `document.activeElement` 变为宿主 `body.drop_target`（`inPanel=false`）；三 tab 面板同样复现。根因：`last` 取到 `ti=-1` 项 → `current !== last` → 放行默认 Tab，而原生序列已无下一站 | `trapTabFocus()` 抽到模块级：只统计 `tabIndex >= 0` 的节点；焦点在容器或 `tabindex=-1` 节点时用 `compareDocumentPosition` 判断该方向是否还有下一站，无则回卷。`test/issue-13-14-focus-escape.spec.js` 新增 T1b；root + template **15/15**，静态门禁 **368/368**，模板已同步 **GitHub GH-#20**（2026-11-16 建，随 v2.8.2 发布关闭）。 |

### 2026-11-13 图谱批次结项（G-02 / G-03 / G-04 / G-08，工具链项，无版本变更）

> 这四项属**内部工具链 / 文档 / 测试**闭环，不涉及运行时代码与发布版本，按批次约定不写 CHANGELOG、不升版本号。

| # | 问题 | 严重度 | 状态 | 证据 | 修复 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| G-02 | 焦点囚笼 / 销毁 / 打开三条生命周期路径与 `createPanel` 之间只有 INFERRED `indirect_call`，无显式契约，也缺少「改动 createPanel 必跑哪条回归」的映射 | P2 正确性风险 | 已关闭（2026-11-16） | 去噪后 `.graphify_analysis.json` 的 `surprises` 中三条为 `createPanel → isTrapFocusable`（C7→C32）、`→ destroy`（C7→C21）、`→ openPanel`（C7→C27），均 INFERRED。核查发现缺口**只在文档**：行为断言已存在于 `test/probe/st-live-check.js`（6 项）、`test/probe/st-destroy-close-check.js`（11 条）、`test/issue-13-14-focus-escape.spec.js`（真实 Tab / Shift+Tab / Esc） | `TEST_INFRA.md` 新增 §3.1「Implicit coupling map (G-02)」：三条「可观察行为 ↔ 路径」映射 + 「改动 `createPanel` 必跑脚本」约定；按 §1 黑盒原则**不断言内部符号**，测试脚本零改动 |
| G-03 | 知识图谱只含 AST、文档未进图；`GRAPH_REPORT.md` / 社区标签 / 建议问题缺失，构建止于建图 | P3 工具链 | 已关闭（2026-11-16，语义层另立 G-07） | 原 `graphify-out/` 只有 `graph.json` / `.graphify_analysis.json` / `manifest.json`，`questions` 为 `null`。**更正 11-13 的判断**：当时记录「`cluster-only` 会重算社区 id、作废引用」，实测否证——900 节点副本上重跑，**900/900 社区 id 完全不变**（`createPanel` 仍 C7），同一张图的聚类是确定性的 | `graphify cluster-only . --no-label` 生成 `GRAPH_REPORT.md`（10.6 KB：Corpus Check / Summary / Community Hubs / God Nodes / Surprising Connections / Import Cycles / 57 社区），`graph.html` 同步重导出（665 KB）；`.graphify_analysis.json` 的 `questions` 由 `null` → **7 条**（1 桥接 + 1 INFERRED 复核 + 5 低内聚）。社区标签仍为 `Community N` 占位，连同语义层转 G-07 |
| G-04 | 模板内嵌的 4 资产副本使图谱节点翻倍、社区成对镜像，god nodes 与 surprising connections 全部重复计数 | P3 工具链 | 已关闭（2026-11-16） | 去噪前两份 `nvui-api.js` 各 120 节点，社区 C4/C6、C7/C8、C12/C13 为镜像对，god nodes 前三名成对（67/67、23/23、20/20）。副本本身**不是 bug**：`scripts/sync-template.js` L14 同步、`scripts/verify-release.js` L68–77 逐个 MD5 校验保护 | 排除配置持久化为 `graphify-out/.graphify_build.json`（`{"excludes":["st-extension-template/ui-kit/"],"code_only":true}`），`graphify extract . --code-only --force --exclude st-extension-template/ui-kit/` 重建：**1021→900 节点 / 1714→1366 边 / 64→57 社区 / 模板残留 0**，god nodes 不再成对；2026-11-16 复验结果一致。仓库零新增文件（配置在已 gitignore 的 `graphify-out/` 内），`graph.html` 已重导出；不影响 `verify:release` 的文件级 MD5 校验 |
| G-08 | §3.1 的「改动 `createPanel` 必跑脚本」实际不可执行：`st-live-check.js` / `st-destroy-close-check.js` 依赖宿主侧 `window.__NVUI_LAB__`（lab 扩展），ST 1.19.0 默认不带；替代冒烟脚本又放在 gitignore 目录、未入库 | P2 测试可复跑性 | 已关闭（2026-11-16，部分采纳） | 实机：宿主已加载 `NVUI 2.8.0` 但 `window.__NVUI_LAB__ === undefined`，两份脚本首条断言即失败；`st-lab-out/smoke/` 两套虽能跑（54 条），但不在版本控制内 | 两套冒烟整理入库为 `test/host/smoke-panel.js`（35 条）+ `test/host/smoke-deep.js`（19 条）：路径改 `__dirname` 派生、Chrome 多候选探测、`playwright-core` 缺失时打印修复命令并以退出码 2 退出、版本断言改为读 `package.json`；入口 `npm run test:host`。新增 `test/README.md` 五类索引；`TEST_INFRA.md` §3.1 必跑入口改为 `test:host` + `test:browser`，§3.2 基线更新为 35/35 + 19/19。lab 扩展依赖留在 Roadmap A2（GH-#17）跟踪 |
| G-01 | `createPanel()` 曾是单函数 1433 行 / 36 个嵌套函数的巨型闭包，图谱中唯一枢纽节点（度 67），承担 4 类职责 | P2 可维护性 | 已关闭（2026-11-16） | 重构前：`nvui-api.js` L1480 定义、函数体 1433 行、20 个 `function` 声明（含 `var f = function` 共 36 个）、全文件 3118 行；图谱度 67，为全项目唯一枢纽 | 分七步抽出 7 个模块级 factory：`createAccordionRegistry`（15 函数 / 283 行）→ `createPersistence`（7 / 332）→ `createFocusChain`（4 / 88）→ `createTabController`（2 / 54，独占 `activeDom`）→ `createUpdatePillController`（1 函数 + 3 份状态 / 95）→ `createPaneWriter`（2 / 62）→ `createGlassController`（1 函数 + 4 份状态 / 40）。**createPanel 1433 → 531 行（-63%）、嵌套函数 36 → 4 个**，复杂度门禁同步降到 531（只允许降）。**有意保留** `openPanel` / `closePanel` / `destroy`：它们是面板对外的生命周期契约，抽取需要 15 项能力的 ctx（含 `opener` / `disposed` 两份可变状态），耦合重于收益。关键约束：`tabs` / `keyMap` / `acc` / `activeDom` 必须以 **getter** 注入，销毁顺序固定为 `persist.cleanup()`（内先 flush）→ `disposed=true` → `acc.unbindAll()`。验证：静态 370/370、持久化压力 19/19、头部压力 15/15、e2e 58/58、浏览器 4 spec、实机 35/35 + 19/19 |
| G-05 | `test/` 历史上 20 个一次性探针与正式门禁混放 | P3 可维护性 | 已关闭（2026-11-16，部分采纳） | 复核引用关系后**只归档 7 个零引用脚本**：`challenge-m2-2` / `gate2-challenger-m2-2` / `st-clamping-stress-test` / `st-review-diag-n03` / `n05` / `n07` / `st-toplayer-probe2`；其余 13 个被 `ISSUES.md` / `CHANGELOG.md` 作为缺陷复现证据引用（如 `st-review-repro.js` 被 `st-review-verify.js` 依赖），移动会断历史链。 | 归档 7 个零引用脚本（`challenge-m2-2` / `gate2-challenger-m2-2` / `st-clamping-stress-test` / `st-review-diag-n03` / `n05` / `n07` / `st-toplayer-probe2`）：已 `git mv` 至 `test/archive/2026-10/`，修正 3 处 `path.resolve(__dirname, "..")` → `"../../.."` 与 3 处 `require("./st-review-harness")` → `"../../st-review-harness"`，`node --check` 全通过，并补归档 README 说明判据。`test/` 根脚本 50 → 43，`npm test` 仍 368/368。 |

---

## 待办

> 规则：疑似问题先登记在此区并写明**复现证据**（文件路径 + 行号 / 实机观测数据），
> 不允许凭印象下结论。确认是真问题后再转「已修复」或「已确认-不修」。

> **2026-11-13 图谱梳理批次**：编号 `G-01` ~ `G-07`（G = Graphify），与 GitHub Issue `#N`、历史 `NEW-N` 编号互不冲突。
> 初始来源为 `graphify-out/graph.json`（1021 节点 / 1714 边 / 64 社区）；**16:31 去噪重建后为 900 节点 / 1366 边 / 57 社区**，
> 文中社区编号一律以重建后的图为准。这批是**内部架构 / 工具链维护项**，不涉及公开行为与使用体验，按规则 3 暂不开 GitHub Issue。
> 本批标记「已关闭」/「已修复」仅表示内部工作闭环，**不涉及发布版本与运行时代码变更，故不写 CHANGELOG、不升版本号**
> （与规则 2 的代码 bug 流程区分）。完整方案与执行记录见文末「架构优化方案」章节。
> **2026-11-16 维护（一）**：`G-02` / `G-03` / `G-04` 已结项关闭，记录移入上方「已修复」区的「2026-11-13 图谱批次结项」表；`G-06` 经实测判定为上游提取器限制，转入「已确认-不修」区；语义层与社区标签另立 `G-07`。
> **2026-11-16 维护（三）**：`G-01` 七步重组全部落地并结项（`createPanel` 1433 → 531 行），记录移入上方「2026-11-13 图谱批次结项」表；**本表仅剩 `G-07`**（语义层 / 社区标签，阻塞于本机无 LLM key）。
> 上一轮的 5 项（#8 / #9 / #10 / #12 / #16）已全部经实机测量判定「已确认-不修」，转入下方对应区块。

| # | 问题 | 严重度 | 状态 | 证据 / 说明 |
| :--- | :--- | :--- | :--- | :--- |
| G-07 | 图谱缺语义层与可读社区标签：文档（README / AUDIT / AI-GUIDE）未进图，57 个社区仍是 `Community N` 占位 | P3 工具链 | 待办 | 11-16 生成 `GRAPH_REPORT.md` 时用 `--no-label` 保留占位，因本机无 `GEMINI_API_KEY` / `GOOGLE_API_KEY`，`graphify label` 需 LLM 后端；文档约 523 KB / 5.5k 行，全量语义提取成本过高。**建议分级**：先只接 `AI-GUIDE.md` + `README.md` §13，验证 doc↔code 关联是否够用，再决定是否全量。`tokens.json` 因 G-06 的文件名启发式无法进图，不列入。 |


---

## 待修复

> **2026-10-21 系统性 Review 第一轮（NEW-25 ~ NEW-34）与第二轮多 Agent 团队深度审计（NEW-35 ~ NEW-46）**：排查出的共 22 项缺陷已**全部修复并通过实机复验**，记录已移入下方「已验证」区。

| # | 类别 | 严重度 | 问题 | 影响范围 | 修复方案 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| — | — | — | **暂无**（GH-#23–GH-#29 见下方已验证记录） | — | — | — |

> **历史记录（2026-10-20 系统性 Review）**：共 24 条（高 7 / 中 10 / 低 7），已全部闭环（13 条高危/中危 + 9 条中低危已修复并实机验证，2 条经实机证伪转入「已确认-不修」区）。

---

## 修复中

| # | 类别 | 严重度 | 问题 | 影响范围 | 修复方案 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| — | — | — | **暂无**（本轮 ui-kit 仓库内的 13 条高危/中危 + 9 条中低危已全部修复并实机验证；仅剩 2 条**跨仓库**的下游副本漂移待各插件作者同步） | — | — | — |

---

## 已验证

> 判定标准：**必须在真实 SillyTavern 宿主（`http://127.0.0.1:8000`，v1.19.0）里跑过**，
> 且同时覆盖**正常路径**与**异常输入**；静态阅读不算数。
> 复现脚本 `test/probe/st-review-repro.js`（修复前 11 PASS / 18 FAIL → 修复后全绿）、
> 复验脚本 `test/probe/st-review-verify.js`（62 条断言）、harness `test/probe/st-review-harness.js`。

| # | 类别 | 严重度 | 问题 | 影响范围 | 修复方案 | 验证结果 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| NEW-35 | 宿主/层级 | **P0** | `hostModalScanObserver` 漏监听 `removedNodes`：宿主直接 `dialog.remove()` 卸载模态弹窗时不触发 `close` 事件亦无属性变动，导致 kit 载体永久冻结在 `.is-host-modal` 状态 | 全局交互瘫痪，kit 所有浮层/按钮因 pointer-events: none 无法点击 | 在 `childList` 变动观察器中增加 `removedNodes` 扫描，检测到含 dialog 节点移除时主动触发 `syncHostModalState()` 自愈 | 已验证：实机创建模态 dialog 后直接 `d.remove()`，载体自动自愈解除 `.is-host-modal` |
| NEW-36 | 宿主/生命周期 | **P0** | SillyTavern `fixToastrForDialogs` 查找 `dialog[open]:not([closing])` 将全局 `#toast-container` 移入 kit 载体，在 kit `destroy()` 时连带销毁宿主全局 Toast 容器 | 宿主原有通知系统彻底损坏，后续所有全局 Toast 丢失 | 载体创建时设置 `closing=""` 与 `role="presentation"` 避开误判；`destroy()` 时防御性恢复外来子节点至 `document.body` | 已验证：载体属性齐备；面板销毁时成功将误注入的 `#toast-container` 归还至 `document.body` |
| NEW-37 | 交互/键盘 | **P0** | `escapeStack` 未校验 `isConnected`：面板被宿主直接移除 DOM 时孤儿 entry 仍残留在调度器中且率先响应 Esc，导致屏幕上真正可见的面板无法按 Esc 关闭 | 多面板动态卸载时键盘 Esc 关闭功能失效 | `registerEscapeHandler` 增加活跃性判断，并在调度循环中动态剔除 `!isConnected` 的孤儿 entry | 已验证：外部直接 `remove()` 面板后按 Esc，孤儿 entry 被自动清理，在场顶层面板顺利响应关闭 |
| NEW-38 | 安全/健壮性 | **P0** | `attrAllowed` 无条件放行 `aria-*` 与 `data-*`，属性名含空格等非法字符时调用 `setAttribute` 触发未捕获 `InvalidCharacterError` 崩溃 | 动态配置或异常属性输入时打断整站渲染流程 | 用正则 `/^aria-[a-z0-9_-]+$/` 与 `/^data-[a-z0-9_-]+$/` 严格过滤非法字符，且 `setAttribute` 包裹 try/catch 兜底 | 已验证：传入带空格与非法字符的属性时不崩溃，安全丢弃并记 warn 诊断日志 |
| NEW-39 | 安全/DoS | **P0** | DOM Cloaking 伪造 `#nvui-api-toast-layer` 导致通知系统全局静默失效：页面若存在非 dialog 的同名节点，`ensureToastLayer` 命中后直接返回，后续吐司挂载到非载体节点上不可见 | 页面存在 DOM 投毒时全站通知瘫痪 | `ensureToastLayer` 校验节点标签名必须为 `DIALOG` 且带 `nvui-tl` 类，否则自动重命名避让并重建合法载体 | 已验证：注入同名 div 后调用 `showToast`，伪造节点被重命名隔离，正规 dialog 顺利接管展示吐司 |
| NEW-40 | 无障碍/焦点 | P1 | Accordion 折叠态仅靠 `grid-template-rows: 0fr` 塌陷高度，未设 `visibility: hidden`，内部可聚焦表单控件仍有排版尺寸导致键盘 Tab 焦点穿透 | 视障/键盘用户在不可见折叠区迷失焦点 | 在 `.nvui-acc-body` 增加 `visibility: hidden;`，展开态 `.nvui-acc.is-open .nvui-acc-body` 增加 `visibility: visible;` 并带过渡 | 已验证：收起态计算样式 `visibility: hidden`，展开态恢复 `visible`，键盘焦点无法穿透 |
| NEW-41 | 无障碍/键盘 | P1 | 标签页（Tabs）缺失方向键（ArrowLeft/Right/Home/End）键盘轮巡导航，违反 WAI-ARIA APG Tabs Pattern | 纯键盘用户无法通过方向键切换 Tab，必须依赖鼠标点击 | 在 `tabsNav` 上监听 `keydown`，支持左右/上下方向键轮巡切换及 Home/End 跳转，并自动同步切换 active pane 与 focus | 已验证：实机按 ArrowRight 激活 Tab 2，按 End 激活 Tab 3，焦点与状态同步切换 |
| NEW-42 | 交互/并发 | P1 | `openLayer` 与 `closeLayer` 快速并发时状态错乱：未完成的退场定时器在面板重新 open 后触发，幽灵关闭正常面板 | 用户快速双击或程序并发调用时面板意外关闭 | `openLayer` 时清除 `__nvuiCloseTimer`，`closeLayer` 结束时若检测到已被重开则中止退场流程 | 已验证：连续并发 `open/close/open` 零抛错且最终维持开启状态 |
| NEW-43 | 性能/重排 | P1 | `isFocusable` 几何先行导致 `visibility: hidden` 误判为可见，且循环读取引发布局抖动（Reflow） | 焦点探测时计算开销大并可能聚焦到不可见元素 | 优先使用现代浏览器原生 `checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })` 硬件加速判定 | 已验证：不可见元素被精确识别过滤，避免无谓的强制布局重排 |
| NEW-44 | 视觉/无障碍 | P2 | 高对比度模式（`forced-colors: active`）下按钮与激活 Tab 边界不够醒目 | 弱视与特殊显示需求用户视觉识别困难 | 增加系统高对比度颜色适配（`.nvui-btn:not([hidden])` 边框 `1px solid ButtonText`，激活 Tab 加 `3px solid Highlight`） | 已验证：`forced-colors: active` 下规则完整且未破扁平区块契约红线 |
| NEW-45 | 安全/防御 | P1 | `Symbol` 与非 Node 类型导致未捕获 TypeError 击穿调用栈，`el()` 缺乏危险标签隔离 | 异常/非法数据传入时页面抛错并中断执行 | 在 `el()`、`append()`、`inputRow()` 等入口增加 Symbol 过滤降级与危险标签（script/iframe等）隔离拦截 | 已验证：非 Node/恶意标签/Symbol 传入不抛 TypeError，优雅回退并记 warn 日志 |
| NEW-46 | 安全/投毒 | P1 | 扩展模板 `extension_settings` 活引用暴露，同页第三方脚本可通过修改返回对象实现原型链与持久化配置篡改 | 敏感设置与 API Key 存在被同页脚本窃取或篡改风险 | 模板扩展中实行深度克隆，屏蔽原型链注入，安全落盘与隔离配置 | 已验证：测试原型链污染 payload 不影响当前运行环境 |
| NEW-25 | 性能/内存 | **高** | `observedDialogs` 强引用 Detached DOM 节点导致内存泄漏：动态创建与销毁的 dialog 被全局数组永久持有引用，无法被 GC 回收 | 长时间运行的大型会话/多弹窗插件会导致 DOM 节点与内存持续攀升 | 去除全局强引用数组，改用私有标记 `dialog.__nvuiObserved` 进行 O(1) 幂等判定 | 已验证：测试创建并移除 dialog，私有属性标记正常且节点脱离文档树无强引用保留 |
| NEW-30 | 缺失/边界 | **高** | 容器包裹的 `<dialog open>` 动态插入时漏触发 `syncHostModalState()`：`scanForDialogs(node)` 虽注册了子 dialog 但未向上传播发现标志，导致 `sawDialog` 为 false | 宿主或第三方插件以 `div > dialog` 形式插入模态弹窗时，kit 载体无法主动降级让位 | 让 `scanForDialogs` 递归返回是否发现 dialog，发现时向上传播并触发 `syncHostModalState()` | 已验证：容器包裹的 dialog 动态插入并调用 `showModal()`，kit 载体自动加上 `.is-host-modal` 降级让位 |
| NEW-34 | 安全/输入 | **高** | `progress({ variant })` 传入带空格等非法字符时抛出未捕获 `DOMException`（`classList.add` 拒绝含空格的 token） | 调用方或配置数据含有复合类名时，整个 `progress()` 崩溃并打断面板初始化流程 | 增加 `sanitizeIdPart` 过滤校验，只允许安全 token，非法时记录 warn 并安全降级 | 已验证：传入含空格 variant `'success glow'` 不崩溃，安全转义为 `is-success_glow`；合法 variant 正常生效 |
| NEW-29 | 交互/层级 | 中 | 多面板场景下 Esc 响应顺序与打开顺序不一致：先开 2 再开 1 时，按 Esc 错误地关闭底层的面板 2 而非当前顶层的面板 1 | 多面板/子配置弹窗场景下键盘操作顺序错乱 | 在 `openPanel()` 时将当前面板在 `escapeStack` 中的 entry 动态提升至栈顶（promote），且退场中状态排除在 Esc 响应之外 | 已验证：先开 2 后开 1，首次 Esc 准确关闭顶层面板 1；二次 Esc 准确关闭底层面板 2 |
| NEW-26 | 性能/重排 | 中 | `focusFirstVisible()` 盲目遍历元素执行 `getComputedStyle()` 造成同步强制样式计算（Forced Reflow / Style Recalculation） | 面板关闭触发焦点兜底时，宿主隐藏元素过多会导致显著的掉帧和主线程卡顿 | 优先采用低开销几何判定（`offsetWidth/offsetHeight > 0`），结合原生 `checkVisibility` 硬件级加速，减少 `getComputedStyle` 调用 | 已验证：可见与隐藏元素准确判定，几何先行避免触发同步强制样式计算 |
| NEW-31 | 缺失/容错 | 中 | `ensureToastLayer()` 缺少 `document.body` 就绪与挂载失败保护，异常时抛未捕获 TypeError 穿透至调用方 | 在 `<head>` 脚本同步加载期或脱离文档上下文调用 `showToast` 会引发调用链直接报错 | 增加 `document.body` 存在性校验与 `appendChild` try/catch 兜底，失败返回 null 并不抛异常 | 已验证：正常与异常上下文下调用 `showToast` 均零未捕获异常，具备完整生命周期控制 |
| NEW-32 | 缺失/边界 | 中 | `showToast({ duration })` 接收 NaN / 负数时导致吐司立即闪退消失（`duration <= 0` 判定漏洞） | 业务传错 duration 参数（如 `NaN`）会导致用户完全看不到提示信息即刻闪退 | 引入数值归一化防护：只允许正有限数值，非有效数字自动回退默认 3200ms | 已验证：`duration: NaN` 与 `duration: -100` 均不闪退，安全以默认时长保持展示 |
| NEW-28 | 性能/遍历 | 中 | 流式文本输出高频变动时对内联文本节点无差别执行 `node.querySelectorAll('dialog')` | SillyTavern AI 打字机流式生成聊天长文本时带来大量无谓的子树 DOM 扫描开销 | 增加内联文本标签过滤与叶子节点快速跳过，避免在纯文本节点上执行 querySelectorAll | 已验证：高频追加纯文本节点不触发无效子树查询，模态 dialog 发现仍准确无误 |
| NEW-27 | 性能/冗余 | 低 | `countHostModals()` 每次调用重复执行静态平台能力检测 `CSS.supports('selector(:modal)')` | 频繁模态同步时重复调用浏览器底层 CSS 字符串解析与 try/catch | 将支持检测结果缓存在模块级变量中，仅在首次加载时探测一次 | 已验证：`countHostModals` 连续调用稳定且返回值正确 |
| NEW-33 | 缺失/日志 | 低 | `setTheme` 缺少 host 有效性校验与未知 theme 诊断日志 | 外部传错非法 host 或拼错主题名称时静默失败或抛错，缺乏可观测性 | 防御性检查 `host.classList`，对非预期主题名记录 warn 日志 | 已验证：传入 `{ host: null }` 与未知主题名均不崩溃，正常模式类名切换无误 |
| NEW-24 | 缺失 | **高** | `showToast()` 的吐司层被最后一条吐司的 `dismiss()` 关闭并 `hidden=true` 后，`ensureToastLayer()` 命中已有层**直接 return、不再 `show()`** → **页面生命周期内只有第一条吐司可见，之后所有吐司彻底不可见**（实测 `rectW:0 rectH:0 offsetParentNull:true opacity:0`，命中栈里根本没有吐司元素） | **全局功能失效**。任何插件的「保存成功 / 操作失败」提示，只要出现过一条会自己消失的吐司，之后**全部静默丢失**，用户侧表现是「点了按钮什么都没发生」。触发门槛极低（默认 duration 3200ms 即触发） | `ensureToastLayer` 命中已有层时若 `!layer.open` 则重新 `show()` 并 `layer.hidden=false`；`dismiss` 的 `done()` 里**不再关闭承载层**，只清空 stack | 已验证：连续 4 条吐司逐条实测宽高 > 0、opacity > 0、**命中栈可命中吐司元素**；duration=0 与 duration=3000 混合场景亦通过 |
| NEW-03 | 安全 | **高** | `opts.focusFallback` 字符串被直接喂给 `document.querySelector` → 非法选择器（如 `'#a['`）抛**未捕获** `SyntaxError`，打断焦点归还链：`opts.onClose` 未被调用、焦点掉到 BODY | 键盘用户彻底失去焦点位置；调用方 try/catch **抓不到**（异步未捕获） | 三级解析：纯 `#id` 走 `getElementById`（零注入面）→ 其余选择器先做字符白名单校验 → `querySelector` 包 try/catch 静默降级为 null | 已验证：非法选择器下 **pageerror=0**、`onClose` 被调用、焦点有落点（走完三级兜底到面板容器，**不落 BODY**）；正常选择器 `'#extensionsMenuButton'` 仍正常工作 |
| NEW-02 | 安全 | **高** | `tabs[].key` 未校验即拼进 DOM `id`（`id + '-tab-' + key`）→ 含空格/`<`/`"` 产生非法 id、重复 key 使 `panes` 覆盖导致**面板静默丢失 + 两个 tab 同时 active**、ARIA IDREF 断链 | 下游插件用用户数据当 tab key 时可致面板不可达、ARIA 关联失效 | `sanitizeIdPart()` 折算为 `[A-Za-z0-9_-]`；重复 key 追加序号去重；对外仍使用**调用方原始 key**（`setTab`/`addNode` 契约不变），内部另建 domKey | 已验证：含空格 / 含 `<>` 的 key 生成合法 id 且 ARIA 链完整；**重复 key 的两个 tab 各自独立可激活、同时只能激活一个**；`setTab(原始key)` 与 `addNode(原始key)` 均正确落到目标 pane |
| NEW-04 | 缺失 | **高** | `progress()` 初始路径的 `aria-valuenow` 取 `String(opts.value \|\| 0)`，而 width 只在 `typeof value === 'number'` 时才写 → 传 `'80'`（字符串）→ aria=80 但 width=0%；传 `200` → aria=**200 超出 aria-valuemax=100** | 无障碍读屏播报错误的进度值；与视觉宽度不一致且**无自愈路径** | `normalizeProgressValue()` 统一归一化（钳制 [0,100]、非有限值归零），初始路径与 `setValue` 共用同一结果 | 已验证：`'80'` / `200` / `NaN` 三种异常输入下 aria-valuenow 与 width **始终一致**；合法值 50 与 `setValue(50)` 行为不变 |
| NEW-05 | 缺失 | **高** | `inputRow()` 的 `input.type` 只认 `'number'`，**其余 10 种请求类型里有 8 种被静默改写为 text**（`file`/`color`/`date` 的文件选择器/取色器/日期选择器直接消失）；number 的 `onChange` 也回传字符串 | 用户可感知的功能消失 | `INPUT_TYPES` 白名单（14 种原生类型）+ `'path'` 伪类型；number 的 `onChange` 回传数字 | 已验证：`file`/`color`/`date`/`email`/`url`/`tel`/`search` 均为**真实 DOM type**；number 的 onChange 实参为 number；`'path'` 保持 DOM `type="text"` + `.is-path`（与 `preview.html:1713` 手写 DOM 一致），意图由 `data-nvui-type` 承载 |
| NEW-01 | 安全 | 高→中 | `el()` 的 `setAttribute` 通道无属性名白名单，`onclick`/`onerror`/`style`/`srcdoc`/`href` 可被注入（ISSUES #1 删除 `html` 通道后的**同类残留**） | **实机证实当前不可达**：43 次调用、12 种属性名全为 kit 内部字面量，危险属性名 0 种，恶意 title 未触发 XSS。作为**纵深防御**修复 | `ALLOWED_ATTRS` 白名单 + `on*` 前缀 / `style` / `srcdoc` / `formaction` 直接丢弃；`aria-*` / `data-*` 放行 | 已验证：危险属性全部被拦并记 warn；**合法属性未误伤**（aria-*/data-*/id/role/type/hidden/tabindex/title/for/value 等全部正常生效） |
| NEW-06 | 性能 | 高→中 | `closeLayer()` 每次关闭都 `on(overlayEl,'animationend', onAnimEnd)` **叠加监听器且从不移除** → 面板反复开合时监听器线性增长、无上界 | 内存/性能（非功能失效：`onClose` 调用数实测严格 1:1，无重复调用） | `finish()` 内 `removeEventListener` 摘除退场监听 | 已验证：开合 30 轮后 `animationend` 监听器数量**保持恒定**（修复前 30 轮 = 30 个，线性增长） |
| NEW-07 | 性能 | 中→低 | `installHostModalWatcher` 的 `MutationObserver` 装在 `documentElement` 且 `subtree:true` + `attributes:true` + `attributeFilter:['open']` → 宿主**任何元素的 open 属性变化**都触发两次全文档查询。实测触发源是宿主的 **10 个 `<details>`**（展开一个 details 即触发 1 次），单次成本 0.17ms（亚毫秒，非卡顿） | 冗余开销，随宿主规模线性放大 | 观察面收窄为「逐个 `<dialog>` 元素的 open 属性」+ 仅 `childList` 的轻量 dialog 发现器 | 已验证：展开宿主 `<details>` **不再触发**同步；宿主真实 `dialog.showModal()` **仍正确触发**降级、关闭后还原 |
| NEW-14 | 缺失 | 中 | `iconNode()` 传入非字符串对象时**直接返回该对象**当 DOM 节点 → `appendChild` 收到非 Node 抛 `TypeError` → 整个面板创建失败且无 try/catch | 传错参数即整个面板建不出来 | 非字符串时校验 `instanceof Node`（或 duck-typing `nodeType`），否则 warn 后返回 null | 已验证：传对象不再抛错，面板正常创建并给出 warn |
| NEW-17 | 缺失 | 中 | `closeLayer` 兜底时长 260ms **硬编码**，与 CSS 的 `--nvui-duration-base` 可能不一致 | 令牌被宿主改写时退场兜底时长失配 | `animationFallbackMs()` 从 `--nvui-duration-base` 派生（+60ms 余量），读不到时退回 260ms | 已验证：兜底时长随令牌变化且默认行为不变 |
| NEW-19 | 缺失 | 低 | 全文**零 `console.*` 输出**、无统一调试开关 → 运行时异常对使用者完全静默，排障只能翻源码 | 可观测性缺失 | 新增 `NVUI.config = { debug: false, logger: console }`；`logAt()` 三级分级：**debug 仅开关打开时输出，warn / error 始终输出**（异常路径绝不静默） | 已验证：debug 关闭时安静、开启时有诊断日志；warn/error 不受 debug 开关影响 |
| 副本漂移 | 缺失 | 中 | `st-extension-template/ui-kit/tokens.json` 与根目录**版本落后两版**（`2.2.0` vs `2.4.0`）且**缺失 `--nvui-z-layer`**（v2.3.0 新增的载体档令牌） | 整目录复制到下游插件后，AI/脚本从 `tokens.json` 读不到载体 z-index 档位 | 副本与根目录对齐；`test/test-ui-kit.js` 增加**四文件 md5 比对断言**，防止再次漂移 | 已验证：四方（根目录 / 模板副本 / 宿主实验室副本 / 宿主模板副本）md5 一致；npm test 通过数由 280 → 338 |
| NEW-09 | 性能 | 中 | `setTab` 每次切 tab 用 `Object.keys(panes).forEach` **全量遍历**所有 pane 并逐个 `classList.toggle` | 切换成本 O(N)，每 pane 触发样式失效 | 缓存当前激活 pane 引用，切换时只对旧/新两个 pane toggle；pane 集合改 Map | 已验证：spy 计数确认切 tab 只触碰 2 个 pane（非全量遍历） |
| NEW-10 | 性能 | 中 | `getToken()` 每次调用都执行 `getComputedStyle(host).getPropertyValue(name)`，**无缓存** | `getCarrierState()` 等高频路径持续触发样式解析 | 加 `Map` 缓存（键 = name + scope），并以**宿主样式签名**（className + 内联 style）判定失效；新增公开导出 `NVUI.invalidateTokenCache()` | 已验证：缓存命中；宿主外部改样式后签名变化 → 缓存自动失效，取值正确 |
| NEW-11 | 性能 | 低 | `preview.html` resize 监听**无节流**直接调 `syncIndicator()`（内部读 offset 触发强制布局） | 拖拽窗口时每秒触发数十次强制布局 | 改 `requestAnimationFrame` 合并为每帧至多一次（与同文件既有 `scheduleSync` 同模式） | 已验证：resize 期间 `syncIndicator` 调用次数被压到每帧至多一次 |
| NEW-12 | 性能 | 低 | `preview.html` `spawnToast` 每条吐司起独立 4.2s 定时器，`dismissToast` 不取消 | 连发 N 条 → N 个定时器同时挂起 | 定时器 id 存入闭包变量，`dismissToast` 中 `clearTimeout` | 已验证：连发后吐司全部消失、无残留定时器 |
| NEW-13 | 性能 | 低 | `components.css` 六处 `animation: ... infinite` 常驻（含 `.nvui-skeleton::after` / `.nvui-progress-bar::after`） | 批量渲染骨架屏时 N 条常驻合成层动画，无 `will-change`、无数量上限 | 给两处**纯 transform** 扫光动画补 `will-change: transform`（**未新增 `!important`**，保住 kit 的「`!important` 预算 ≤ 8」隐性契约） | 已验证：改动仅 2 行 `will-change`；`!important` 计数未增加 |
| NEW-15 | 缺失 | 中 | `opts.tabs` 空数组与未定义行为不一致；`opts.active` 可指向不存在的 key | 内容掉到 `body` 外，不进任何 pane | `active` 归一化为「tabs 中存在的第一个 key」；`addNode` 无效 key 走**四级回退链**：有效 key → 当前激活 pane → 首个 pane → body（**绝不落 body 优先**） | 已验证：无效 key 的内容**不落 body**，落在可见的激活 pane；`opts.active` 指向不存在 key 时正常回退 |
| NEW-16 | 缺失 | 中 | `destroy()` 直接 `removeChild`，**不触发 `dialog.close()`** | 宿主若依赖 dialog 的 `close` 事件做清理会漏收 | **两版修法**：① 先 `dialog.close()` 再同步摘除 —— QA 实测**无效**（`close` 事件是**异步 task** 派发，同步 `removeChild` 后元素已脱离文档树 → **不向 document 传播**，改前改后 document 级委托均为 1/5）；② **定版修法**：等 `close` 事件到达后再摘除（元素仍在文档树 → 事件可冒泡到 document），并加 `setTimeout(removeNodes, 50)` **兜底**保证载体节点不泄漏 | 已验证：**document 级委托 5/5 稳定收到** close 事件（改前 1/5）；destroy 后载体节点数归位、无泄漏；正常路径不回归（destroy 后可再 createPanel） |
| NEW-18 | 缺失 | 低 | `createPanel` 末尾 `(opts.mount \|\| document.body).appendChild(dialog)` 无兜底 | `document.body` 未就绪或 mount 无效节点时抛 `TypeError` | 三层兜底：① mount 非有效节点 → `warn` + 回退 `document.body`；② body 也不可用 → `error` + **返回 null 不抛错**；③ `appendChild` 本身抛错（宿主重写 / 节点所在文档拒绝）→ `error` + **返回 null**，**异常不穿透到调用方** | 已验证：三种情形均**不抛异常**，返回 null 且有对应级别日志（error / warn 归属正确）；mount 无效但 body 可用时仍能正常创建 |
| NEW-20 | 安全 | 中 | `el()` 的 `setAttribute` 通道**未做属性名白名单**（与 NEW-01 同源） | **实机证实不可达**：43 次调用、12 种属性名全为 kit 内部字面量，危险属性名 0 种；恶意 title 未触发 XSS | 已随 NEW-01 一并修复（白名单收敛到唯一入口），本条为同源残余 | 已验证：白名单生效，合法属性未误伤 |
| NEW-22 | 安全 | 低 | `st-extension-template/index.js` 把**插件设置的可变副本**挂到 `window.__MY_PLUGIN__` | 同宿主任意脚本可读 | `getSettings` 改为仅在 `localhost/127.0.0.1` 暴露，`open` 保留全量暴露 | 已验证：用 `--host-resolver-rules` 把 `example.com` 解析到本地构造**真实非本地宿主**场景，确认 `getSettings` 不暴露、`open` 仍可用；本机 `127.0.0.1` 下 `st-template-check.js` 读设置回写仍正常（7/7） |


### v3.1.0 审查修复

GH-#23–GH-#29 均在 Chromium 157 与真实 SillyTavern 宿主上复现并完成修复验证。专项回归位于
[`test/v310-audit.spec.js`](test/v310-audit.spec.js)，宿主模式运行 `node test/v310-audit.spec.js --host`，7/7 通过。

| # | 类别 | 严重度 | 问题 | 修复前表现 | 修复方案 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [GH-#23](https://github.com/zgy-beep/ui-kit/issues/23) | 持久化 | P1 | setLayoutState 导入后重新打开同一面板未应用布局 | 同一实例关闭再开仍为 `a / 720px / 折叠`，存储已是 `b / 912px / 展开`。 | 将待应用布局与待写入记录分开，重开时恢复尺寸、标签、折叠项。 | 已修复（本地验证） |
| [GH-#24](https://github.com/zgy-beep/ui-kit/issues/24) | 持久化 | P2 | 异步存储的迟到读写会恢复旧布局 | 清空后迟到的读取恢复了 `b / 910px`。两笔保存逆序完成时界面是 `a`，存储是 `b`。 | 使迟到的初始化读取失效，按存储适配器和键串行执行写入与清除。 | 已修复（本地验证） |
| [GH-#25](https://github.com/zgy-beep/ui-kit/issues/25) | 持久化 | P2 | 归一化后相同的面板 ID 共用存储键 | `plugin one` 与 `plugin_one` 获得不同 DOM ID，却共享 `nvui_state_plugin_one` 并互相覆盖标签。 | 为需要归一化的原始 ID 使用独立编码键，兼容旧记录并保护其它面板的键。 | 已修复（本地验证） |
| [GH-#26](https://github.com/zgy-beep/ui-kit/issues/26) | 调尺寸 | P2 | Home 复位后旧存档高度被立即回填 | 由 `810×450` 的存档启动，按 Home 后宽度回到 `720px`，`--nvui-panel-h` 仍是 `450px`。 | Home 退出最大化，保留高度自适应语义，重建时不回填旧高度。 | 已修复（本地验证） |
| [GH-#27](https://github.com/zgy-beep/ui-kit/issues/27) | 可访问性 | P3 | 面板 ID 为 -1 时方向键切换标签抛出选择器异常 | `id: '-1'` 的面板切到 `b` 时，`querySelector('#-1-tab-b')` 抛异常，焦点无法随之移动。 | 按 DOM ID 获取目标标签，方向键同步切换激活项和焦点。 | 已修复（本地验证） |
| [GH-#28](https://github.com/zgy-beep/ui-kit/issues/28) | 可访问性 | P3 | 退场期间重开会丢失原触发按钮的焦点归还 | 退场期间取消关闭并重开后，最终关闭把焦点还给第一个按钮，原触发按钮是第二个。 | 取消旧退场任务和监听器，保留第一次打开时的焦点归还目标。 | 已修复（本地验证） |
| [GH-#29](https://github.com/zgy-beep/ui-kit/issues/29) | 生命周期 | P3 | 重复 destroy 触发两次回调，销毁后 open 重挂监听 | 销毁回调执行 2 次；旧控制器调用 `open()` 后，dialog 仍脱离 DOM，`resize` 监听数从 0 变 1。 | 在销毁开始时封闭控制器，冲刷最后一次状态并幂等解绑监听。 | 已修复（本地验证） |

---

## 已确认-不修

| # | 事项 | 说明 |
| :--- | :--- | :--- |
| - | 复用 `--nvui-z-overlay` 作为载体档 | 最初为避免「109 令牌」计数契约变动而复用 `--nvui-z-overlay`。**该方案已被推翻**：载体与子浮层混用同一档位语义不清，且 `--nvui-z-overlay` 实际比载体高一档，层级语义倒挂。最终改为新增专属 `--nvui-z-layer: 1000000`，token 总数 109 → 110，版本号按语义化规则升 **v2.3.0**（小版本，新增 token 不破坏既有取值） |
| - | 载体改用 `popover=manual` | 见 #16 实测结论：宿主模态打开时 kit 浮层本就因 `inert` 不可交互，「被压住」是模态语义的正确表现。改 `popover=manual` 会变更 DOM 契约（`<dialog class="nvui-tl">` → `<div popover="manual">`），属破坏性变更，收益不成立 |
| - | 进度条 / tabs 指示器 / 折叠面板 改用 transform 方案 | 见 #8 / #9 / #10 实测：三者均**无可感知卡顿**（帧间隔与基线一致），且替代方案要么无效（`contain` / `will-change`）、要么需破坏性改 JS 契约。维持现状 |
| - | 桌面端取消双层 `backdrop-filter` | 见 #12 实测：双层与单层帧间隔完全一致（p95 均为 16.80ms）。保留全档是 Flat Glass 设计意图，且窄屏已有降档 |
| **NEW-08**（2026-10-20 新增） | `syncTabsIndicator` 读 4 个 offset 属性造成强制同步布局 → **不改** | 实测（严格按 README §13.6 判据，看**帧间隔**而非累计布局耗时）：baseline p95 = **16.80ms** / switching p95 = **16.80ms**，**差 0.00ms**；超 16.7ms×1.5 帧预算的帧数 = **0**，长帧 = **0** → **不可感知卡顿**。与 #9（tabs 指示器）历史结论一致，改造需破坏 README §7.7 的 CSS 变量契约，收益不成立 |
| **NEW-21**（2026-10-20 新增） | `preview.html` 的 URL 参数可能构成反射型 XSS → **不成立** | 全量 grep 确认 `preview.html` **0 处** `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` / `eval`，文本一律走 `textContent`；URL 参数仅用于 `params.get(...) === 'light' / '1'` 严格白名单比较后 `classList.add`，`?toast=` 经 `TOAST_META[type] \|\| TOAST_META.info` 白名单兜底。**否定性结论** |
| **NEW-23**（2026-10-20 新增） | 路径遍历 / 敏感信息硬编码 → **不成立** | 全项目**无任何文件系统操作**（`nvui-api.js` 零 fs 调用，`preview.html` 纯前端）→ **无路径遍历面**；全仓 grep `C:\Users` / `D:\Github` / `T:\Github` **0 命中**，`api_key` / `secret` / `password` / `bearer` **0 命中**（`package.json` 的 `author: "zgy-beep"` 是公开署名）。**否定性结论** |
| **G-06**（2026-11-16 新增） | CSS / 令牌层无法进图 → **不修**（上游提取器限制，非配置问题） | 实测三条：① `.css` 不在 `graphify/detect.py` 的 `CODE_EXTENSIONS`，临时目录单文件测试输出 `1 file(s) not classified ... a.css`；② `components.css` / `style.css` / `tokens.css` 的 `classify_file()` 均返回 `None`，而 `.graphifyrc` 的 `language.<ext>` 只能重映射到**已有提取器**的语言（无 CSS 提取器，强行映射即误解析）；③ `tokens.json` 分类为 `FileType.CODE` 但 `_is_sensitive()` 返回 `True`，命中泛化关键字 `(?<![a-zA-Z0-9])tokens?(?![a-zA-Z])` 叠加 `_SECRET_PRONE_DATA_EXTS`（含 `.json`），且无白名单开关；同样的 `tokens.md` 因仅 `_PROSE_EXTS` 豁免而不触发。**替代方案**：令牌 ↔ 组件覆盖由 `test/test-ui-kit.js` §1–§3 静态守护，临时查询 `grep -o "var(--nvui-[a-z0-9-]*" components.css \| sort \| uniq -c`；不为图谱改资产名（`tokens.json` 是公开契约，改名连带 sync / verify / 文档） |

### 由待办转入的 5 项（附实机测量数据）

> 已在 GitHub 开 issue #3 公开这轮实测方法与数据：https://github.com/zgy-beep/ui-kit/issues/3

下表各项**曾登记为「逐帧重排 / 性能风险」**，经真实 SillyTavern 宿主实测后判定为**无需修改**。
测量方法与完整数据见 README §13.6。

| # | 原疑点 | 实测结论 | 实测数据 |
| :--- | :--- | :--- | :--- |
| 8 | 进度条 `transition: width` 逐帧触发布局重排 | **不修**：width 过渡与 transform 缩放的布局次数完全相同，width 反而略快；改 scale 需重做 shimmer 独立层 + 改宽度语义，收益为负 | A(width) = 2.0 次/动画、14.3ms；B(transform) = 2.0 次/动画、16.2ms |
| 9 | tabs 指示器 `transition: width/height` 逐帧重排 | **不修**：累计布局耗时虽高（10.5 次/切换、21.89ms），但**帧间隔与无动画基线完全一致** → 无可感知卡顿。`contain` / `will-change` 三种零契约变更手段实测收益均为 0；唯一有效的 transform 方案需破坏性改 JS 契约 | 帧间隔 p95 = 16.80ms（基线 16.80ms）、超 16.7ms 帧 35/74 vs 基线 35/73、max 17.00ms |
| 10 | 折叠面板 `transition: grid-template-rows` 逐帧重排 | **不修**：5 次展开共 16.37ms（3.27ms/次），布局次数仅 10 次；替代方案（max-height 猜测 / JS 计算高度）精度或复杂度代价更高 | 3.27ms/次、2.0 次布局/次 |
| 12 | 桌面端双层 `backdrop-filter` 开销显著 | **不修**：双层与单层与无浮层基线的帧间隔**三者完全一致**；窄屏已有降档，桌面端保留全档是 Flat Glass 设计意图 | 双层 p95 16.80ms = 单层 16.80ms = 基线 16.80ms |
| 16 | 宿主 `showModal()` 模态压住 kit 浮层 | **不修**：层级事实成立，但宿主模态已用 `inert` 禁用整页交互（kit 浮层内按钮 `focus()` 失败），「被压住」是模态语义的正确表现；关闭后立即还原。改 `popover=manual` 属破坏性 DOM 变更，收益不成立 | 命中栈顶层 = 宿主模态；`focusWorked: false`；关闭后顶层回到 `nvui-panel-body` |

---

## 需求与特性规划 (Feature Requests)

> 记录来自开发者生态的通用特性需求提议。经评审后对齐设计规范与架构约束，纳入演进里程碑。

| Issue # | 模块 | 提议内容 | 目标版本 | 状态 / 评审结论 |
| :--- | :--- | :--- | :--- | :--- |
| [Issue #5](https://github.com/zgy-beep/ui-kit/issues/5) | 表现层持久化 | 面板与核心组件状态记忆（`persist: true`）：支持自动记忆面板宽高尺寸、分栏比例、激活 Tab 索引；支持自定义 Storage Adapter（适配酒馆 `settings.json`）；内置 250ms 防抖与视口多分辨率边界越界钳制保护 | v2.5.0 | **Closed (v2.5.0)**：全量实现并实机验证。支持声明式 `persist: true` 或精细化对象配置 `{ size, tab, accordion, storage }`；内置可插拔 `StorageAdapter`（默认 localStorage 沙箱键 `nvui_state_${id}`，支持适配宿主 `extension_settings` 与 `saveSettingsDebounced`，内置 Quota 异常防护）；内置 250ms 写入防抖调度器与关闭/销毁安全冲刷（Flush）；实现多分辨率跨屏 Viewport Clamping 视口越界钳制（PC 默认 720px 黄金尺寸，移动端 <=600px 强制回退 100% 抽屉，坐标防溢出自愈）；导出全局 `NVUI.clearLayoutState(id)` 与实例级 `panel.clearLayoutState()` 清理接口。 |
| [Issue #6](https://github.com/zgy-beep/ui-kit/issues/6) | 面板头部交互 | 预置主题切换按钮（`themeToggle`）与版本更新提示按钮（`update` / `panel.showUpdate`）：规范右上角标准操作流（Actions → 主题切换 → 关闭）及左上角版本更新动态点亮入口 | v2.5.0 | **Closed (v2.5.0)**：全量实现并实机验证。规范操作流标准次序（`.nvui-panel-actions` 严格保证 `[自定义 actions...]` -> `[themeToggle]` -> `[closeBtn]`）；预置主题切换按钮（日/月图标平滑过渡动效、直连 `NVUI.setTheme` 切换 `.nvui-theme-light` 并失效 Token 缓存、联动 `onThemeChange` 回调）；标题区预置版本更新提示胶囊（`opts.update` 静态配置与 `panel.showUpdate` 动态点亮/隐藏/更新接口）；严格遵守 WAI-ARIA APG 无障碍规范（`role="button"`, `tabindex="0"`, 键盘 Enter/Space 触发）、纯文本注入（杜绝 XSS）与 Flat Glass 无实体外描边红线。 |
| [Issue #10](https://github.com/zgy-beep/ui-kit/issues/10) | 组件层 | 独立复选框 `.nvui-checkbox`：批量选择场景的 16px 小方块，自带宿主隔离，支持 `:checked` / `:indeterminate`，避免每个下游插件自绘 | v2.6.0 | **Implemented (v2.6.0)**：组件、示例与文档已落地并在 Chromium 回归中验证；GitHub issue 由本次发布提交关闭（`Fixes #10`）；同批的 #9 / #11 见「已修复」表第 18 / 20 行。 |
| —（规划） | 表单作用域 | opt-in `.nvui-form-scope`：自定义普通容器显式加类后，既有 `.nvui-input` 的 input / select / textarea / option 共享既有 7 条宿主表单隔离；默认双载体不变，非 kit 控件不接管，不创建定位 / 遮罩 / 模态，`!important` 预算仍 14 | v2.7.0 | **已打 tag，本地验收通过**：Codex 独立复验静态门禁 362/362、forms 455/455、accordion 18/18、reporting 31/31、本地 E2E 52 PASS / 0 FAIL / 6 SKIP（真实宿主未执行）；模板 4 资产已同步。详见 `CHANGELOG.md` 的 v2.7.0 条目。announce API 与尺寸令牌扩展暂缓。 |
| —（冒烟观察 2026-11-16） | 移动端底部导航 | `.nvui-bottom-nav-item` 在 390×844 实测高 **26px**（图标 + 2 字标签，padding 仅 `space-15`） | 待定 | **已交付（v2.8.2，GH-#21）**：`min-height: 40px`（抽屉整体 +14px）；原判断「属视觉取舍、需设计确认」经用户拍板按 40px 落地 |
| —（冒烟观察 2026-11-16） | 进度条 | `progress({ label, value })` 的 `label` 只落到 `aria-label`，视觉上只有一条 4px 进度线，没有标题与数值 | 待定 | **已交付（v2.9.0，GH-#21）**：`progress({ showLabel, showValue })` 默认关闭；开启后容器变 `.nvui-progress-field`，可视文本 `aria-hidden` 防重复播报，不确定进度不渲染数值 |
| —（冒烟观察 2026-11-16） | 长内容滚动 | 面板 body 滚动时内容在 tabs 下沿与 footer 上沿硬切（正常裁剪，无渐隐/阴影提示） | 待定 | **已交付（v2.9.0，GH-#21）**：`data-nvui-fade`（top/bottom/both）+ `mask-image`，方向按滚动位置动态决定；选 mask 而非内阴影（内阴影会随内容滚走，覆盖层还要处理 pointer-events 与 sticky footer） |

### v2.5.0 特性结项与关闭明细 (Feature Resolution Details)

#### Issue #5: UI 表现层布局状态持久化引擎 (Layout State Persistence)

- **关闭状态**: `Closed (v2.5.0)` · SemVer MINOR，100% 向后兼容，零外部 npm 依赖。
- **关联 GitHub Issue**: https://github.com/zgy-beep/ui-kit/issues/5
- **核心能力交付**:
  1. **声明式状态配置**: `createPanel(opts)` 扩展支持 `persist: true`（一键全开）或对象配置 `{ size: boolean, tab: boolean, accordion: boolean, storage: StorageAdapter }`；未声明时完全向下兼容历史默认行为。
  2. **可插拔 StorageAdapter 架构**: 抽象标准化 `get(key)` / `set(key, val)` / `delete(key)` 契约。默认使用 `window.localStorage`，键名沙箱前缀 `nvui_state_${id}`（`sanitizeIdPart` 规范化过滤）；全面包裹 try/catch，静默吸收 `QuotaExceededError` 与无痕模式受阻异常；无缝支持外部宿主适配器桥接 SillyTavern 的 `extension_settings` 与 `saveSettingsDebounced`，支持 Promise 异步回写。
  3. **250ms 防抖写入引擎**: 高频尺寸拖拽调整、Tab 连续切换与折叠面板开合操作经 `PERSIST_DEBOUNCE_MS = 250` 防抖合并写入，面板关闭或 `destroy()` 时立即执行同步安全冲刷（Flush），消除 I/O 阻塞并彻底杜绝游离定时器泄漏。
  4. **多分辨率跨屏 Viewport Clamping 钳制**: 实现 `clampPanelLayout` 数学模型。桌面端钳制宽在 `[min(320, vw-32), vw-32]`、高在 `[min(240, vh-32), vh-32]`，坐标防溢出自愈（安全边距 16px）；移动端（<=600px）强制清空内联固定像素，平滑回退为 100% 底部抽屉规范；窗口 `resize` 时自愈重算。
  5. **PC 端 720px 黄金尺寸调优**: 将 `--nvui-panel-width` 默认值由 880px 调优为 720px 黄金尺寸，支持可选的 `opts.width` 自定义，经 Viewport Clamping 边界保护。
  6. **辅助重置与清理接口**: 全局导出 `NVUI.clearLayoutState(id, storageAdapter?)` 与实例方法 `panel.clearLayoutState()`，支持一键复位存储与 DOM 表现层。
- **核心代码落地点**:
  - `nvui-api.js`: L983-1165 (常量、defaultStorageAdapter、clearLayoutState、getViewport、clampPanelLayout), L1195-1235 (persist 解析), L1440-1530 (防抖写入调度与事件挂载), L1582-1595 (控制器 clearLayoutState 方法), L2355 (全局 API 导出)。
  - `tokens.css`: L45 (`--nvui-panel-width: 720px;`)。
  - `tokens.json`: L41 (`"--nvui-panel-width": "720px"`).
  - `components.css`: L1880-1925 (桌面与移动端抽屉规则)。
- **测试与验证覆盖**:
  - `test/test-ui-kit.js`: Section 9.1 (`NVUI.clearLayoutState` 导出守卫)、Section 1 (`GOLDEN_DARK` 720px 校验)。
  - `test/test-e2e-v250.js`: T1-R1-01 ~ T1-R1-15 (功能契约)、T2-BC-01 ~ T2-BC-06 (视口钳制与防抖边缘用例)、T3-CB-01 ~ T3-CB-05 (生命周期协同)、T4-SC-01 ~ T4-SC-04 (双模式场景与 0 pageerror)。
  - SillyTavern 宿主实机测试: `http://127.0.0.1:8000` 100% PASS，0 pageerror。

#### Issue #6: 面板头部标准化增强 (Standardized Panel Header)

- **关闭状态**: `Closed (v2.5.0)` · SemVer MINOR，100% 向后兼容，零规范破坏。
- **关联 GitHub Issue**: https://github.com/zgy-beep/ui-kit/issues/6
- **核心能力交付**:
  1. **标准操作流次序保证**: 面板头部 `.nvui-panel-actions` 严格强制 DOM 排列次序：`[自定义 actions...]` -> `[主题切换 themeToggle]` -> `[关闭按钮 closeBtn]`。
  2. **预置标准化主题切换按钮**: `createPanel` 支持 `themeToggle: true` 或 `{ onThemeChange, initial }`；预置太阳/月亮图标平滑过渡（180°旋转缩放淡入淡出）；直连 `NVUI.setTheme` 切换 `.nvui-theme-light` 并触发 `NVUI.invalidateTokenCache()`；动态同步 `aria-label` 与全局指示器；派发 `opts.onThemeChange` 回调。
  3. **标题区版本更新提示胶囊**: 
     - 静态配置: 支持 `opts.update: { version, label, onClick, url }` 在标题栏右侧展示更新胶囊。
     - 动态点亮接口: 控制器暴露 `panel.showUpdate(updateConfig)`，支持扩展在异步检查 GitHub Releases 或后端版本后动态点亮、更新文案或隐藏（传 null）。
  4. **WAI-ARIA APG 无障碍与 Flat Glass 红线守卫**:
     - 更新胶囊结构为 `<span class="nvui-badge is-accent nvui-update-pill" role="button" tabindex="0">`，键盘 Tab 可聚焦，支持 Enter 与 Space 键激活。
     - 注入内容严格采用 `textContent` 与标准 URL 协议白名单校验，彻底阻断 XSS 注入通道。
     - 严格遵循 Flat Glass 扁平优先原则：仅采用 `var(--nvui-accent-bg)` 与 `var(--nvui-accent-2)`，**严禁添加 1px 实体外描边**；聚焦态使用统一 `--nvui-focus-ring-*` 焦点环。
- **核心代码落地点**:
  - `nvui-api.js`: L1244-1331 (`showUpdate` 接口与更新胶囊渲染), L1333-1342 (头部操作流标准排序), L1343-1385 (`themeToggle` 按钮创建、动效与事件联动)。
  - `components.css`: L1927-1950 (`.nvui-theme-toggle` 按钮动效与悬浮态), L1951-2005 (`.nvui-update-pill` 扁平无边框样式与 focus-visible 焦点环), L2278/2308/2338 (reduced-motion 降级适配)。
- **测试与验证覆盖**:
  - `test/test-ui-kit.js`: Section 9.2 (头部操作流次序静态断言、`showUpdate` 导出断言、无 innerHTML 断言)。
  - `test/test-e2e-v250.js`: T1-R2-01 ~ T1-R2-18 (功能契约)、T2-BC-07 ~ T2-BC-12 (边界用例)、T3-CB-01 ~ T3-CB-05 (生命周期协同)、T4-SC-01 ~ T4-SC-04 (实机场景)。
  - SillyTavern 宿主实机测试: `http://127.0.0.1:8000` 100% PASS，0 pageerror。

---

### v2.6.0 修复与验证记录（GitHub #9 / #10 / #11）

三条 issue 的代码与文档已在 v2.6.0 落地；本次发布提交通过 `Fixes #9` / `Fixes #10` / `Fixes #11` 关闭 issue，并分别补充维护评论（若未自动关闭，由维护者手动标 `completed`）。

| 验证入口 | 覆盖 | 本轮实测 |
| :--- | :--- | :--- |
| `node test/test-issues-9-10-forms.js` | #9 表单隔离（载体 × 主题的 `input` / `textarea` / `select` / `option` 与 `:hover` 还原）、#10 复选框（16px 几何、`::before` 抑制、半选、焦点 / Space、disabled、载体外隔离） | 273/273 PASS，pageerror 0 |
| `node test/test-issue-11-accordion.js` | #11 注入折叠条接管：同面板多次重渲染、立即 close 后重建、`persist.accordion:false` 的 factory / `addNode` 路径、全 false 不写空值、中文 / 非 ASCII 键与 `__proto__`、混合登记、外部 / 销毁边界、调用方自管 class 切换 | 18/18 PASS，pageerror 0 |
| `node test/stress-m1-persistence.js` | v2.5 持久化引擎回归（防抖 / 钳制 / 存储异常 / 陈旧状态） | 19/19 PASS，pageerror 0 |
| `node test/test-ui-kit.js`（`npm test`） | 静态规范门禁：token、组件类、`!important` 预算与有界选择器、版本与模板资产一致性 | 361/361 PASS |

> 发布后如发现回归：重开对应 issue 并在本条记录；真实 SillyTavern 宿主浅色 / 第三方主题冒烟仍是后续建议项。

---

## 实机测试脚本

| 脚本 | 覆盖 |
| :--- | :--- |
| `test/probe/st-live-check.js` | 运行时行为回归 6 项：冒泡截断 / Esc 单例 / destroy / id 唯一 / focus trap / 焦点归还 |
| `test/probe/st-template-check.js` | ST 模板实机 7 项：扩展加载 / 菜单开面板 / tab 同步 / 吐司 / Esc 焦点归还 / 设置回写 / 移动端布局 |
| `test/probe/st-layer-check.js` | 层级回归：面板 5 采样点是否在宿主之上 / 吐司是否高于面板 / 关闭后还原 |
| `test/probe/st-layer-probe.js` | 层级根因探针：对比 dialog.show / showModal / popover / 固定 div 四种载体的命中顺序 |
| `test/probe/st-glass-probe.js` | 玻璃生效探测：宿主 no-blur 下 backdrop-filter 是否被关掉 |
| `test/probe/st-glass-fallback-check.js` | 玻璃回退（#15/#21/#22）：宿主 no-blur 下探测值 / 根节点自动挂 `.nvui-glass-fallback`（不再 `.nvui-solid`）/ 面板 97% token 派生近不透明档 / 移除 no-blur 后自动恢复 / 用户 `.nvui-solid` 优先 / 零控制台错误 |
| `test/st-glass-transparency.js` | 玻璃透明感（#21/#22，零依赖 CDP）：面板自身 blur（透明 + 背后模糊）/ `.nvui-solid` 实心 / no-blur 97% 近不透明回退 / CSS 未就绪时序竞争自愈 / reduced-transparency / solid 覆盖 fallback |
| `test/probe/st-focus-probe.js` | 焦点归还根因探针 |
| `test/probe/st-toplayer-probe.js` | top-layer 行为探针：实测非模态 `dialog.show()` 是否进浏览器 top layer（结论：不进） |
| `test/probe/st-perf-probe.js` | 性能总探针（#8 / #9 / #10 / #12）：CDP `Performance.getMetrics` 测布局次数 / 布局耗时 + 双层 blur 帧间隔对照 |
| `test/probe/st-perf-tabs-fine.js` | #9 精测：分离「创建 DOM」与「纯动画」成本，三组对照（width 过渡 / 无过渡 / transform） |
| `test/probe/st-perf-tabs-options.js` | #9 方案选型：`contain: layout` / `contain: strict` / `will-change: transform` / transform 缩放，四组对照 |
| `test/probe/st-perf-tabs-frames.js` | #9 帧间隔判定：过渡期间 rAF 帧间隔分布 vs 无动画基线（判定是否真掉帧） |
| `test/probe/st-modal-layer-check.js` | #16 模态层级：宿主 `showModal()` 打开时 kit 浮层是否被压住 / 是否可聚焦 / 关闭后是否还原 |
| `test/probe/st-carrier-host-modal-check.js` | #17 载体让位机制：宿主模态下 `.is-host-modal` 是否自动增删 / 不可点 / 压暗 / `getCarrierState()` 快照 / 还原 |

### 2026-10-20 系统性 Review 新增

| 脚本 | 覆盖 |
| :--- | :--- |
| `test/probe/st-review-harness.js` | **可复用实机脚手架**：`launch()` / `injectKit(page,{force:true})` 注入仓库版 kit / `assert()` / `summary()` / `cleanup()`；内部自动清代理并设 `NO_PROXY=*` |
| `test/probe/st-review-harness-selftest.js` | 脚手架自身自测（15 项：注入后 `NVUI.version`、面板 open/close/destroy、CSS 注入、零 pageerror） |
| `test/probe/st-review-host-probe.js` | 宿主环境与扩展安装状态探测（只读） |
| `test/probe/st-review-repro.js` | **修复前复现脚本**：29 条断言，断言语义为「正确行为必须成立」→ 修复前 11 PASS / 18 FAIL，修复后 **29/29** |
| `test/probe/st-review-verify.js` | **修复后复验脚本**：62 条断言，覆盖正常路径 + 异常输入 + 历史契约不破 → **62/62** |
| `test/probe/st-review-2026-verify.js` | **2026 深度加固实机复验脚本**：24 条断言，覆盖 NEW-25 ~ NEW-46 全量实机交互、异常渗透与宿主集成 → **24/24 PASS，0 pageerror** |
| `test/probe/st-review-diag.js` / `-n03` / `-n05` / `-n07` | 针对性诊断：焦点落点、input type 白名单、观察器收窄 |
| `test/probe/st-review-repro-n07-detail.js` | NEW-07 观察器触发频率细测 |
| `test/probe/st-review-legacy-preload.js` | 历史脚本预加载兼容层（应对宿主 LAB 夹具缺失） |
| `test/probe/st-template-new22-check.js` | NEW-22 非本地宿主门禁验证（用 `--host-resolver-rules` 构造真实非本地场景） |
| `test/probe/st-review-verify-r4.js` | 第四轮专项 27 条（含 NEW-16 destroy 摘除时机的 document 级委托验证） |
| `test/probe/st-review-verify-r5.js` | 最终收口专项 18 条（6 轮独立循环验证 document 委托稳定性 + DOM 不泄漏 + NEW-18 两分支 + 正常路径非回归） |
| `test/probe/st-destroy-close-check.js` | destroy → close 事件传播与兜底摘除的故障注入验证（11 条） |
| `test/probe/st-review-provenance.js` | **版本溯源**：用 HTTP 响应体字节 md5 对比仓库 md5，证明「测的到底是不是最新版」 |

> 本轮审查报告：`.workbuddy/review/AUDIT-2026-10-20.md`（904 行）+ `AUDIT-2026-10-20-appendix.md`
> 修复前取证：`REPRO-2026-10-20.md` + `REPRO-raw-2026-10-20.json`
> 修复后复验：`VERIFY-2026-10-20.md` + `VERIFY-raw-2026-10-20.json`

运行环境：本机 SillyTavern `T:\Github\SillyTavern\APP\SillyTavern`（v1.19.0，http://127.0.0.1:8000）。
用 `playwright-core` 直连本机 Chrome（`NODE_PATH` 注入模块解析路径）。

---

## 架构优化方案（2026-11-13 图谱梳理）

> 对应待办条目 `G-01` ~ `G-07`。方案按「零契约变更」边界设计，理由见下方红线。
> 文中社区编号（C5 / C7 / C9 / C21 / C27 / C32 等）绑定 **2026-11-13 16:31 去噪重建后**的
> `graph.json`（900 节点 / 1366 边 / 57 社区）；图谱再次重建会重新分配 id，跨版本引用前须重新映射。
> 16:31 起按「优先级」执行 P0 与 P1-2，结果见文末「执行记录」章节。
> **运行时代码、CSS、令牌零改动**，仅新增一条测试断言与两份文档。

### 红线（先于一切优化）

本项目历史上 5 次以「破坏性变更收益不成立」判定不修（见「已确认-不修」区 #8 / #9 / #10 / #12 / #16），
因此本轮优化一律限定在**内部实现、测试与工具链**范围内，以下六项不动：

| # | 不可变更契约 | 当前事实源 |
| :--- | :--- | :--- |
| 1 | `NVUI` 导出面（27 个公开成员） | `nvui-api.js` L3064–3107 |
| 2 | 4 个运行时资产清单与模板副本一致性 | `scripts/sync-template.js` L14；`scripts/verify-release.js` L68–77 |
| 3 | DOM / 类名契约（`nvui-` 与 `is-`、`<dialog class="nvui-tl">` 载体） | `AI-GUIDE.md` §0 硬约束 3 |
| 4 | 令牌数量与 `!important` 预算 | `tokens.json` dark 111 / light 47；`components.css` 18 条（`verify-release.js` L47–54） |
| 5 | 6 处版本号自洽与 README / CHANGELOG / preview 标题 | `scripts/verify-release.js` L32–61 |
| 6 | 零运行时依赖、整目录可复制 | `package.json`（无 `dependencies`） |

### P0 零风险项（已执行）

1. **图谱去噪（G-04）[已完成 16:31]**：执行
   `graphify extract . --code-only --force --exclude st-extension-template/ui-kit/`，
   CLI 自动把配置持久化为 `graphify-out/.graphify_build.json`
   （`{"excludes":["st-extension-template/ui-kit/"],"code_only":true}`）；`graphify-out/` 已 gitignore，仓库零新增文件。
   结果 **1021→900 节点 / 1714→1366 边 / 64→57 社区 / 模板残留 0**，god nodes 不再成对，`graph.html` 已按新图重导出。
   原方案预估「社区降到约 40」偏乐观，实测 57，如实修正。该排除**不影响** `verify-release` 的 MD5 校验（文件级，与图谱无关）。
2. **复杂度冻结（G-01 第一步）[已完成 16:31]**：`test/test-ui-kit.js` 新增 §9.7，断言 `createPanel` 函数体
   ≤ **1447** 行（实测 L1429–L2875；原方案写「约 1445」已按实测修正）。`npm test` **367 → 368 PASS / 0 FAIL**。
   **方案修订**：原计划的「27 个导出成员逐一比对」经核查**已存在**于 `test/test-api-surface.js` 的
   `EXPECTED_EXPORTS`（`npm run test:api` 覆盖），故不重复添加，只在 §9.7 注释中引用。
3. **产物补齐（G-03 已完成 11-16）**：`graphify export html` 于 16:26 产出 `graph.html`，16:31 去噪后重导出；
   11-16 执行 `graphify cluster-only . --no-label` 补齐 `GRAPH_REPORT.md`（10.6 KB）与 **7 条**建议问题（`questions` 由 `null` 变为有值）。
   **更正**：此前记录「该命令会重算社区 id、作废编号映射」经实测否证——同一张图上重聚类 **900/900 节点社区 id 不变**
   （`createPanel` 仍为 C7），故本页与 `TEST_INFRA.md` §3.1 的编号引用全部继续有效。

### P1 下个迭代（纯内部重构）

1. **G-01 分区重组 [暂缓]**：把 `nvui-api.js` L1429–L2875 内 42 个嵌套函数按「宿主/层级、玻璃能力、
   DOM 与无障碍、布局/持久化」收进 4 个 factory，`createPanel` 只负责组装并返回 controller。导出面、DOM、CSS 全不变。
   **暂缓原因（16:31）**：本机 SillyTavern 宿主 `http://127.0.0.1:8000` 不可达（绕代理复测 `HTTP 000`，直连 `502`），
   `test/probe/st-review-verify.js`（62 条）/ `test/probe/st-review-2026-verify.js`（24 条）等实机回归无法执行；
   在没有实机基线的情况下改 1447 行闭包体，违反本项目「先实机复现 / 复验再修」的规则 1 / 2。
   **待宿主恢复后单独确认再动刀。**
2. **G-02 隐式耦合显式化 [已完成 16:31]**：`TEST_INFRA.md` 新增 §3.1，补三条「可观察行为 ↔ 路径」映射
   （Tab 焦点循环 → `isTrapFocusable`；destroy 后 document 监听数不增 → `destroy`；Esc 关闭与焦点归还 → `openPanel`），
   并写明「改动 `createPanel` 必跑脚本」。**方案修订**：原计划「补齐对应可观察断言」经核查**已存在**——
   `test/probe/st-live-check.js` 六项已含 focus trap / 焦点归还 / destroy DOM 清理 / Esc 单例无监听器泄漏 / 冒泡截断，
   `test/probe/st-destroy-close-check.js` 另有 11 条；按 §1 黑盒原则不新增内部符号断言，**测试脚本零改动**。
3. **验收清单**：`npm test` → `npm run test:api` → `npm run test:v280` → `npm run test:browser` →
   `node test/test-e2e-v250.js --no-host` → `npm run verify:release` → `npm run downstream:check`，
   实机前后对照 `test/probe/st-review-verify.js`（62 条）与 `test/probe/st-review-2026-verify.js`（24 条）；
   最后 `npm run sync:template` 重同步，确认 4 资产 MD5 与根版一致。

### P2 选择性项（先算成本）

1. **G-07 语义层与社区标签 [阻塞：无 LLM 凭据，2026-11-16 复核]**：文档共约 523 KB / 5.5k 行（README 2506、AUDIT 1022、CHANGELOG 867、AI-GUIDE 540 等）。
   **复核证据**：`GEMINI_API_KEY` / `GOOGLE_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` 全部为空（`printenv` 实测）；
   `graphify label` 无后端可用，`--no-label` 只能保留 `Community N` 占位。**恢复条件**：任一路径注入 key 后执行
   `graphify label . --only AI-GUIDE.md,README.md`（先两份文档试水，再决定是否全量 `extract --mode deep`）。
   当前环境**无** `GEMINI_API_KEY` / `GOOGLE_API_KEY`，`graphify label` 需 LLM 后端，全量语义提取会落到 host agent，成本过高。
   **建议分级**：先只接 `AI-GUIDE.md` + `README.md` §13 两个文件，验证 doc↔code 关联是否够用，再决定是否 `graphify extract . --mode deep` 全量重建。
   （原拟纳入的 `tokens.json` 因 G-06 的文件名启发式无法进图，暂不列入。）
2. **G-05 测试脚本归档**：20 个一次性探针下游依赖均为 0，可移入 `test/archive/2026-10/`；
   但探针内是 `require('./st-review-harness')`（`test/probe/st-review-diag.js` L17 等），移动后须改相对路径，
   而 `test/probe/st-review-harness.js` 被 14 个脚本依赖，**不可移动**。同步更新本文件「实机测试脚本」表
   与 `TEST_INFRA.md` 的脚本索引。
3. **G-06 CSS / 令牌层 [已判定不修]**：`.css` 无提取器、`.graphifyrc` 无法补、`tokens.json` 命中 `tokens` 关键字启发式，
   证据与替代方案见「已确认-不修」区；本条不再作为待办。

### 明确不做

| 提议 | 否决理由 |
| :--- | :--- |
| 把 `nvui-api.js` 拆成多个运行时文件 | 破坏「4 资产整目录复制」契约，连带改 sync / verify / pack / downstream-check / CI 五处 |
| 把 `createPanel` 拆成多个公开 API | 改导出面，破坏下游插件 |
| 为性能重写 CSS 动画 | #8 / #9 / #10 / #12 已有实机帧间隔数据证明无可感知收益 |
| 引入任何 npm 运行时依赖 | 违反零依赖定位；Node 仅测试用 |

### 优先级

`P0-1 图谱去噪`（零仓库改动）→ `P0-3 复杂度冻结`（只加测试）→ `P1-2 隐式耦合映射` →
`P1-1 内部重组`（最大收益 / 最大风险，必须全套实机回归）→ `P2` 视需要。

### 执行记录（2026-11-13 16:31）

| 项 | 结果 | 验证 |
| :--- | :--- | :--- |
| P0-1 图谱去噪 | 完成：900 节点 / 1366 边 / 57 社区，模板残留 0 | `.graphify_build.json` 持久化；`graph.html` 重导出 |
| P0-3 复杂度冻结 | 完成：`test/test-ui-kit.js` §9.7，上限 1447 行 | `npm test` 368 PASS / 0 FAIL |
| P1-2 隐式耦合映射 | 完成：`TEST_INFRA.md` §3.1 | 文档校验，测试脚本零改动 |
| P1-1 分区重组 | **暂缓**：宿主不可达，缺实机基线 | 待 `http://127.0.0.1:8000` 恢复后单独确认 |
| P2 | 未执行 | 视需要 |

**全套静态验收**：`npm test` 368/368、`npm run test:api` 27 导出冻结通过、
`npm run test:v280` 静态功能断言通过、`npm run verify:release` 全部通过（含模板 4 资产 MD5）。
浏览器回归（`test:browser`）与实机脚本因本机 Chrome / ST 宿主环境不可用，未纳入本轮结果。

**改动文件清单**：`ISSUES.md`、`TEST_INFRA.md`、`test/test-ui-kit.js`（新增 1 条断言）、
`graphify-out/`（已 gitignore：`graph.json`、`.graphify_analysis.json`、`.graphify_build.json`、`graph.html` 及两份重建前备份）。
运行时资产（`tokens.css` / `components.css` / `nvui-api.js` / `tokens.json`）、模板副本、`package.json` 全部未改动。

### 维护记录（2026-11-16）

| 动作 | 内容 | 依据 |
| :--- | :--- | :--- |
| 结项关闭 | `G-02` / `G-04` 移出「待办」，转入「已修复」区的批次结项表，状态记为 `已关闭（2026-11-16）` | 关闭前复验：`.graphify_build.json` 排除生效、模板残留 0；`TEST_INFRA.md` §3.1 在册 |
| 状态校准 | `G-01` / `G-03` 由「修复中」改为「待办」（`G-03` 同日随后结项关闭） | 规则 4：`修复中` 表示在办；两者分别等宿主恢复、等社区 id 重算决策，均无在办工作 |
| 表格修复 | 「已修复」表原被 3 处空行截断为 4 段（GFM 在空行处终止表格），合并为单表并按编号升序（1–7、11、13–15、17–22） | 渲染验证：单表 17 行 + 2 行批次结项 |
| 未变 | 运行时代码、CSS、令牌、测试脚本、`package.json`、模板副本零改动；本批仍不写 CHANGELOG、不升版本号 | 批次约定（见「待办」区说明） |
| 报告补齐（G-03 关闭） | `graphify cluster-only . --no-label` 生成 `GRAPH_REPORT.md`（10.6 KB）+ 重导出 `graph.html`（665 KB）；`questions` 由 `null` → **7 条** | 先在副本预演再正式执行；社区 id 900/900 不变，「会重算 id」的旧判断被否证 |
| 判定不修（G-06） | CSS / 令牌层无法进图：`.css` 无提取器、`.graphifyrc` 补不了、`tokens.json` 命中 `tokens` 关键字启发式且无白名单 | 临时目录单文件实测 + `classify_file()` / `_is_sensitive()` 直接取证 |
| 新登记 G-07 | 语义层（文档进图）与社区可读标签需 LLM 后端，本机无 key，`--no-label` 保留 `Community N` 占位 | 文档 523 KB / 5.5k 行，全量成本高；建议先接两份文档试水 |
| 实机冒烟（11-16） | 35 条断言覆盖面板骨架 / 焦点 / 持久化 / 吐司 / 宿主模态让位 / Fast UI 回退 / 移动端 / 360×640 / 减弱动效，**34 通过**；未过项为移动端导航项高 26px（设计取舍，非缺陷） | 真实 ST 1.19.0 + Chrome；探针在 `st-lab-out/smoke/`（已 gitignore）。补充两轮深水区 19/19：长内容滚动 + sticky footer、双面板 Esc 只关顶层、4 条吐司堆叠、Fast UI 回退可逆 |
| 修复焦点陷阱（#23） | `trapTabFocus()` 模块级化；`test/issue-13-14-focus-escape.spec.js` 新增 T1b；模板已同步 | 修复前复现「Tab1 → `body.drop_target`」；修复后 spec 15/15、静态 368/368 |
| 测试归档（G-05） | 7 个零引用探针 → `test/archive/2026-10/`，补目录 README | 全文索引确认仅 7 个 0 引用；`node --check` 全通过；`test/` 根脚本 50 → 43 |
| GitHub 维护（11-16） | 建 GH-#20（焦点陷阱，对应本地 `#23`）/ GH-#21（3 条 UX 观察）；GH-#17 勾选与进度段按实测刷新（A1–A3 未开始、A4/A5 部分）；补建 `ROADMAP.md` 修掉三个 open issue 的死链 | `gh issue list/view` 逐条核对；本地 `#N` 与 GitHub 编号是两套序列，已加映射约定 |
| G-07 复核（11-16） | 语义层 / 社区标签仍阻塞：四种常见 LLM key 环境变量实测全空；`--no-label` 产物已可用（`GRAPH_REPORT.md` 10.6 KB + 7 条建议问题），仅「可读标签」缺后端 | `printenv GEMINI_API_KEY / GOOGLE_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY` 均空；恢复命令与试水范围已写进待办区 |
| 测试归档 A4（11-16） | 30 个零门禁引用探针 → `test/probe/`（新增 `probe/README.md` 30 条清单 + lab 依赖列）；5 个脚本 `__dirname` 改 `'..','..'`；`test/` 根 44 → 14 个脚本；文档路径 47 处同步 | `npm test` 370/0；`node --check` 30/30；`test-ui-kit.js` 两条存在性断言改指 probe/ |
| 尺寸矩阵 A1（11-16） | `issue-16` 8 → 12 项（T9 三项全关 / T10 `persist:true` / T11 `persist:{}` / T12 异步 adapter；错误面移到末尾为 T13） | 变异测试：`anyPersistEnabled()` 改成 `!!persistConfig` 时 T9 变红；12/12 绿 |
| 依赖解析 A2（11-16） | `scripts/resolve-browser.js` 统一 playwright/Chrome 解析 + 可执行修复命令（退出码 2）；`playwright-core@^1.64.0` 进 devDependencies；11 个脚本改用；运行时仍零依赖 | 未设 `NODE_PATH` 跑 `test:browser` 455+18+217+15+12 全绿；缺包模拟 exit=2 |
| 一键门禁 A3（11-16） | `npm run verify:all`：9 步 = 静态 4 → `verify:release` → `pack` + 产物校验 → browser / stress / e2e；`--no-browser` / `--only=` / `--list`；CI 改单条命令 | 9/9；`--no-browser` 6 通过 3 跳过；模拟无 playwright 6 通过 3 跳过且 exit=0 |
| 布局读写 B1（11-16） | `panel.getLayoutState()` / `setLayoutState(state,{silent})`；`flushPersistSave` 的 DOM 反解抽成 `collectState()` 供 flush 与 get 共用；`pendingState` 承接待落盘导入值 | `v290-layout-state` 10/10；变异：get 不克隆时 L3 红；`issue-16` 12/12；行数删重复 `syncGlassFallback()` 维持 531 |
| 尺寸三态 B3（11-16） | `persist.size: 'width-only'`；`sizeMode()` 三态出口；`applyClamping` 的 `useSavedSize` 拆 `useSavedW`/`useSavedH`；`collectState` 下 `height` 恒 null 且不记 `isMaximized` | `v290-width-only` 9/9；变异：`useSavedH` 与 `useSavedW` 同源时 W1 红；非法字符串按 true + 告警 |
| 运行诊断 B2（11-16） | `NVUI.diagnostics()` 8 字段纯只读；`on/off` 活体计数 + `isGlobalListenerTarget()` 过滤；12 处直连 `addEventListener` 改走助手；三条源码形态断言改写（负向前瞻失效 → 抓处理函数名） | `v290-diagnostics` 8/8；D6 实测销毁后 resize/scroll/change/keydown 回落基线；`test:api` 28 导出 |
| 主题跟随 B6（11-16） | `setTheme('auto')` 双信号并集；`themeAuto` 状态 + `teardownAutoTheme/syncAutoTheme`；采样排除自写类；显式主题摘监听 | `v290-theme-auto` 10/10；判据改为「后注册的 change 探针收到事件时类名已更新」；变异：去掉 `hostLightSignal` 时 A4 红 |
| 调尺寸手柄 B4（11-16） | `createPanel({ resizable })` + `createResizeGrip(ctx)`；Pointer Events + `setPointerCapture`；方向键 ±8 / Shift ±32 / Home 复位；写入一律「内联 px → `applyClamping()`」 | `v290-resize` 11/11；已知边界：高度受 `max-height: 88vh`，只在可收缩区间可调；行数合并 `var disposed/acc` 维持 531 |
| 表单补齐 B5（11-16） | `inputRow` 的 `textarea` 伪类型（`data-nvui-type`，不覆盖 IDL）+ `rows`；`hint`/`error` 各占独立 `aria-describedby` id | `v290-inputrow` 8/8；组件类 83 → 84（`.nvui-input-msg`）；`is-msg`/`is-error` 状态类 |
| 线路 D 立项（11-16） | 按 MAINTAINING §2.5 为 v3.1 建 GH-#22 + milestone 4 + ROADMAP §5 线路 D（D1 代码零残留 / D2 开关无效断言 / D3 文档清将来时）；顺手修正上一轮公告模板插在 §5 前的章节乱序 | `npm test` 373/0；commit `8091015` |
| 移除过渡开关 D1/D2（11-16） | 删 `LEGACY_SIZE_ATTR` / `usesLegacySize()` / legacy 分支 + warnOnce，载体只剩 CSS 变量；V2 改直接证明下游 CSS 接管、V3 改防复活断言（设属性后仍只写变量、legacyWarns=0） | `test:sizevars` 8/8；`verify:all` 10/10（移除前后各跑一次）；commit `d6c26cc` |
| 夹具二修（11-16） | ① `test-v280-features.js` 的 `max:'3.0.0'` 升到 v3.1 当天失效（v2.9 时只修了 min 半边）；② AI-GUIDE 漏 bump 到 3.1.0，`verify:release` 21 项不查它、e2e T1-R3-04 抓到 | `test:v280` 8/8；`test:e2e` 58/0（修复前 57/58）；commits `7e655f4` / `384835f` |
| 发布 v3.1.0（11-16） | MINOR：10 处版本 3.1.0、CHANGELOG 实体条目、UPGRADING 新增「3.0.0 → 3.1.0」、README §10.10/§11.4 各加行、ROADMAP 线路 D 标已交付；GH-#22 关闭 + milestone 4 closed | `verify:all` 10/10；373/0；浏览器 455+18+217+12+11+10+9+8+10+11+8+8；实机 35/35 + 19/19；e2e 58/0；`pack` 出 `ui-kit-3.1.0.zip`（259,385 B）；tag + Release 3 产物（body 2256 字符） |
| 尺寸载体 C1（11-16） | 停写内联 px，改写 `--nvui-panel-w` / `--nvui-panel-h`；`writePanelSize/readPanelSize/clearPanelSize` 三个助手收敛读写；状态 v2 `{ w, h, mode }` + `migrateStateV1toV2()` + `data-nvui-legacy-size` 开关；`applyClamping` 在「两维都读不到 px 但身上挂着尺寸」时清 calc（修掉 v2 的「最大化→还原」残留） | `v300-size-vars` 8/8；V2 用同一段下游 CSS 双向证明（v3 载体 500px / legacy 860px）；`test:api` 29 导出；行数删注释维持 531 |
| 按钮组归一 C2（11-16） | 四段 `display:flex + align-items + gap` 收成一条 `:where(...)`（零 specificity）；差异只剩「操作区右对齐」与 `.nvui-btn-row` 内按钮等宽；`.nvui-btn-row` 降为 `.nvui-actions` 别名 | `npm test` 372/0（+2 条防分叉断言：同一组必须恰好一条规则、`.nvui-actions` 仍 `flex-end`） |
| tokens schema v2 C3（11-16） | `scripts/tokens-v1-to-v2.js` 从 CSS 注释生成 `schema` / `meta{group,type,description}` / `groupDescriptions`；`tokens:migrate` / `tokens:check`；值结构逐字节不变 | 111 token / 16 组 / 9 段说明 / 75 个空 description（不编造）；`npm test` 373/0（+1 条 schema 断言）；踩坑：块结束不清 current 会把 `.nvui-theme-light` 整段吸进 dark 表 |
| 兼容矩阵 C4（11-16） | README §11.5 表 ↔ `manifest.minimum_client_version` ↔ `engines.node` ↔ `checkCompatibility` 四方自洽；`verify:all` 9 → 10 步；`MAINTAINING` §2.4 改用 `verify:all` 作唯一入口 | `test:compat` 9/9；判据按大版本线（`vX.0.0`）而非逐版本一行 |
| 解析器修复（11-16） | `test-compat-matrix.js` 裸搜「兼容矩阵」会命中 §10.10 / §11.4，把日期当宿主版本读（实测 `README=2026-11-16 / manifest=1.12.0`）；改以 §11.5 标题为锚 + 下一个标题截断（`rest.slice(1)` 也是错的，`## 11.5` 自己又以 `##` 开头） | `test:compat` 9/9；`npm test` 373/0 |
| 发布 v3.0.0（11-16） | MAJOR，线路 C 四项：13 处版本 3.0.0、CHANGELOG 实体条目（C1–C4 + 工程 + 验证 + 关联）、`MIGRATION-v3.md` 新建、UPGRADING 重写「2.9.0 → 3.0.0」四行变更表、README §10.10 + §11.4 各补一行、ROADMAP 三条线路全标已交付 + §8 公告模板、`verify:release` 20 → 21 项；GH-#19 关闭 + milestone 3 closed | `verify:all` 10/10；373/0；浏览器 455+18+217+12+11+10+9+8+10+11+8+8；实机 35/35 + 19/19；e2e 58/0；`pack` 出 `ui-kit-3.0.0.zip`（258,184 B）；tag `v3.0.0` + Release 3 产物（body 4326 字符，CI 占位已被 `release edit` 覆盖） |
| 发布 v2.9.0（11-16） | MINOR，全 opt-in：13 处版本 2.9.0、CHANGELOG 实体条目、UPGRADING 新增「2.8.3 → 2.9.0」（含七行接入对照表）、README §10.10 + §11.4 各补一行、ROADMAP 线路 B 标为到出口；GH-#18 / GH-#21 关闭 | `verify:all` 9/9；浏览器 455+18+217+15+12+11+10+9+8+10+11+8；实机 35/35 + 19/19；`verify:release` 20 项 + `--self-test` 3/3；`pack` 出 `ui-kit-2.9.0.zip`；tag `v2.9.0` + Release 3 产物 |
| 夹具失效修复（11-16） | `test-v280-features.js` 用 `{ min: '2.9.0' }` 当「高于当前版本」，v2.9.0 收口后它等于当前版本，`verify:all` 必红；改 `99.0.0` 并注明原因 | `test:v280` 8/8；这是会随版本推进自己失效的夹具，不是 API 缺陷 |
| 发布 v2.8.3（11-16） | PATCH，只含测试与工程脚本：13 处版本 2.8.3、CHANGELOG 条目、README §10.10 + §11.4 各补一行、UPGRADING 新增「2.8.2 → 2.8.3」、ROADMAP 线路 A 标为到出口；GH-#17 关闭 | `verify:all` 9/9；实机 35/35 + 19/19；`verify:release` 20 项 + `--self-test` 3/3；`pack` 出 `ui-kit-2.8.3.zip`；tag `v2.8.3` + Release 3 产物 |
| 发布 v2.8.2（11-16） | 远端已先行发布 v2.8.1（#16），本批按语义化版本改号 v2.8.2；`git tag -a v2.8.2` + Release + 资产（zip / SHA256SUMS）；GH-#20 关闭 | `verify:release` 20 项 + `--self-test` 3/3；实机 35/35 + 19/19；浏览器 455+18+217+15+8 |

## 下一步迭代计划

> 计划详情统一维护在 [`ROADMAP.md`](ROADMAP.md)（本文件只记已发生的事实，计划漂移以 ROADMAP 为准）。
> 执行进度在 GitHub：每个线路一个追踪 issue + 一个 milestone。

| 线路 | 目标版本 | 追踪 | Milestone |
| :--- | :--- | :--- | :--- |
| A · 工程化收尾（测试可复跑、门禁可信任） | v2.8.2 / v2.8.3 **已交付** | [#17](https://github.com/zgy-beep/ui-kit/issues/17) | v2.8.2 · 工程化收尾（已 closed） |
| B · 下游可维护性与可观测性（6 项 additive） | v2.9.0 **已交付** | [#18](https://github.com/zgy-beep/ui-kit/issues/18) | v2.9.0 · 下游可维护性（已 closed） |
| C · 内联尺寸停写与命名收敛（破坏性 + 迁移器） | v3.0.0 **已交付** | [#19](https://github.com/zgy-beep/ui-kit/issues/19) | v3.0.0 · 尺寸与命名重构（已 closed） |
| D · 移除过渡尺寸开关（兑现 C 的承诺） | v3.1.0 **已交付** | [#22](https://github.com/zgy-beep/ui-kit/issues/22) | v3.1.0 · 移除 legacy 尺寸开关（已 closed） |

排期原则：**先让断言可信（A）→ 再让下游少写代码（B）→ 最后才动破坏性契约（C）→ 收掉 C 留的过渡开关（D）**。四条线路已全部到出口。

**未立项 / 无版本归属**：G-07 语义层 / 社区标签（四种 LLM key 环境变量实测全空，见待办区）、
ST 1.20 实机补跑（本机无环境）。`MIGRATION-v3.md` §6 已写明 v3.x 内不再有破坏性变更；
v3.1 移除 `data-nvui-legacy-size` 是最后一项，已兑现。
