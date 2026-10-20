# Spec - novel-stream v2.0.0 MVP（规格即契约）

> 生成日期：2026-10-20
> 基于：用户确认的 MVP 范围（Phase 0）+ 设计文档 `docs/mvp/design.md` v1（颜好看，已过 P0 门禁）
> 状态：**已确认**（总监裁定 7 项待定项后锁定）
> 读者：前端工程师（开发唯一依据）、测试工程师（验收唯一依据）

---

## 1. 产品定义

- **一句话描述**：SillyTavern 扩展——把每一轮 AI 回复清洗、编排成规范小说章节，随时一键导出整本 TXT。
- **目标用户**：酒馆角色扮演玩家，想把对话沉淀为可导入阅读器的小说。
- **核心问题**：v1.17.6 是 18 设置键 / 3670 行前端 / 306+ 断言的功能全家桶；v2.0.0 只保留核心链路，UI 全面改用 NVUI Kit。

## 2. MVP 范围（锁定——不在此列表的功能一律不做）

| 优先级 | 功能 | 验收标准摘要 |
|---|---|---|
| P0 | 章节派生引擎 | 从聊天记录全量派生章节（问候语延迟入书规则见 §5.2），重 roll / 划动 / 编辑 / 删除 / 切聊天全部即时正确（无状态派生，聊天记录是唯一事实源） |
| P0 | 标签清洗引擎 | 白名单提取 + 黑名单剔除 + 思维链/注释/杂质清洗（沿用 v1.x `cleanNovelText` 全部能力，函数原样保留） |
| P0 | 一键导出 TXT | 纯前端 Blob 下载；UTF-8 BOM；文件名遵循命名规则；导出后刷新「文件」页状态行 + 1 次性 toast |
| P0 | 设置面板（ui-kit） | `NVUI.createPanel` 生成 3 tab 面板（连载/过滤/文件），按 `docs/mvp/design.md` §1.4 装配；即改即存；开合持久化 |
| P0 | 魔法棒菜单入口 | `#extensionsMenu` 内一项，图标 `fa-book-bookmark`，副标 连载中/已关闭，点击打开面板 |
| P0 | 连载总开关 | `settings.enabled` 驱动状态行三态文案与魔法棒副标（显示语义，见 §5.3） |
| P1 | 章节计数展示 | 面板「连载」页状态行 + 魔法棒副标显示「第 N 章」（计数 = 派生章节数，见 §5.2） |

## 3. 明确不做（Out-of-Scope — 锁定）

| 不做的功能 | 原因 | 何时考虑 |
|---|---|---|
| 服务端插件 `plugins/auto-save`（/append /sync-all /status）+ install.ps1 / install.sh | 需 config.yaml + 重启酒馆，门槛高；纯前端导出已覆盖核心价值 | v2.1，看用户反馈（OPEN-DECISIONS #2） |
| 悬浮药丸 / 楼层工具条 / 楼层徽标 | 入口收敛为魔法棒一项；减少 UI 面与回归面 | 用户明确要求 |
| 会话标签检测器（扫描/预览/免手打） | 高级功能，白黑名单手动输入已够用 | **v2.2.0 已交付**（用户反馈：怪标签手打易错 + 手机端不便）；「过滤效果预览弹窗」仍未做 |
| 过滤效果预览弹窗 | 高级功能 | v2.1 |
| 连载更新 Toast | 噪音源；导出反馈 toast 除外（§2 P0） | — |
| 群聊专属聚合命名 | 基础命名规则已覆盖 | — |
| 同步历史 / 试写一章 | 全量派生后无「历史未同步」概念 | — |
| `save_dir` / `buffer_latest_message` / `show_toast` / `show_embedded_toolbar` / `show_floating_window` / `float_pos` / `userDisabled` / `ui_v113_migrated` 设置键 | 随功能一起退役 | — |
| 浅色主题面板 / 宿主主题同步 | Kit 深色自包含，跨宿主一致（design.md §5） | 未来 |
| 酒馆助手（JS-Slash-Runner）桥接 | 非核心链路 | v2.1 |

## 4. 技术架构（锁定 — 含版本锚定）

| 层 | 技术 | 实际版本 | 锁定原因 |
|---|---|---|---|
| 宿主 | SillyTavern 扩展（ESM） | ≥1.12.0 | 既定平台 |
| 设计基底 | SillyTavern NVUI Kit（vendor 进 `ui-kit/`，除 `.git` 全目录复制） | v2.2.0 | 用户指定；品牌色与 Kit 默认 accent 同值零迁移；自带 test-ui-kit.js 守护 |
| 面板运行时 | `ui-kit/nvui-api.js`（UMD，ESM `import` 后挂 `globalThis.NVUI`） | v2.2.0 | 布局标准 + 无障碍 + 开合动画固化 |
| 样式 | `style.css` = 2 行 `@import`（tokens/components）+ 插件自有规则（`novel-` 前缀） | — | 全项目唯一色源 = `ui-kit/tokens.css` |
| 图标 | 宿主 Font Awesome 6 solid（`<i class="fa-solid fa-…">`） | 宿主自带 | 零外链零依赖 |
| 测试 | 5 个纯 node + 1 个 playwright（Edge）+ Kit 自带测试 | node 24 / playwright-core | 见 §12 |
| 设置存储 | 酒馆 `extension_settings.autoSaveTxt`（`saveSettingsDebounced`） | — | 沿用 v1.x 键名，老用户设置无缝继承 |

**文件级改动清单（锁定）：**

| 文件 | 动作 |
|---|---|
| `index.js` | 整文件重写（保留引擎函数，见 §5；ESM；CRLF 行尾保持仓库惯例） |
| `style.css` | 整文件重写：顶部 2 行 `@import url('./ui-kit/…')` + `novel-` 自有规则（CRLF） |
| `manifest.json` | `version` → `2.0.0`；`description` 更新为 MVP 表述；其余不动 |
| `ui-kit/` | 新增：从 `T:/Github/SillyTavern/Plugins/ui-kit` 整目录复制（除 `.git`），字节级原样 |
| `README.md` | 重写为 MVP 使用文档（两种模式 → 一种：随时导出） |
| `test/` | 删 5 个（server / tag-scanner / ui-wiring / settings-tabs / mobile-overlay）；升级 3 个（think / universal-tags / chapter-map 改为抽真源码）；新增 2 个（export-build / mvp-panel）；保留 1 个（version-compare） |
| `plugins/` | **删除**（服务端退役） |
| `install.ps1` / `install.sh` | **删除** |
| `docs/mvp/design.md`、`docs/mvp/SPEC.md`、`docs/decisions/OPEN-DECISIONS.md` | 新增（本目录） |

## 5. 模块契约与函数签名（开发唯一依据）

### 5.1 保留自 v1.x 的函数（签名与语义不变，测试靠抽取它们锁定）

| 函数 | 来源行（v1.17.6 index.js） | 说明 |
|---|---|---|
| `compareVersion(a, b)` | 852 | 语义化版本比较 |
| `parseTagList(str)` | 1042 | 逗号分隔标签串 → 数组 |
| `sanitizeFilename(rawName)` | 898 | Windows 非法字符清洗 |
| `getBookTitle(settings, speakerName)` | 922 | 书名（角色名 - 对话名 或 角色名） |
| `getBookFileName(settings)` | 1017 | 文件名（遵循 naming_rule） |
| `cleanNovelText(rawText, settings)` | 1218 | 清洗引擎**原样保留**（含 INLINE_TAGS 常量、四阶段清洗） |
| `buildNovelText(settings, chatLog)` | 1186 | 整书编排；返回 `{ bookTitle, novelText, chapterCount }` |
| `getCleanedMessage(msg, index, settings)` | 1169 | 带缓存清洗（缓存逻辑保留） |
| `getSettings()` / `saveSettingsDebounced()` | 863 / 导入 | 设置读写（迁移代码全部删除，见 §6） |

### 5.2 章节派生（新架构核心——无状态）

```
computeChapters(settings, chatLog) → [{ index, no, speaker, text }]
```

- **唯一事实源 = 聊天记录**。不维护任何「已写入」持久状态；重 roll / 划动 / 编辑 / 删除 / 切聊天天然正确。
- **问候语延迟入书规则**：若聊天记录中**不存在任何 `is_user` 消息**，返回 `[]`（尚未开始，状态行显示「尚未开始」文案）；否则从 index 0 开始编号，问候语即第 1 章。
- 编号规则：跳过 `is_user && !include_user_dialogue`；跳过清洗后为空的楼层（不占号——沿用 v1.x `computeChapterMap` 语义）。
- 章节标题格式沿用 `buildNovelText` 的 4 种 `chapter_style`。
- `computeChapterMap(settings, chatLog)`（楼层序号→章节号）保留同名函数供测试抽取，内部改调 `computeChapters`。
- 导出（`exportNovelText`）与计数（面板状态行/魔法棒副标）**共用同一派生结果**，永不分歧。

### 5.3 连载总开关语义（显示语义，非持久闸门）

- `enabled = true`（默认）：状态行显示「当前书稿《书名》 第 N 章」；魔法棒副标「连载中」。
- `enabled = false`：状态行显示「连载已关闭：AI 回复不会入书，仍可随时导出整本」；魔法棒副标「已关闭」。
- **导出不受 enabled 影响**（与 v1.x `exportNovelText` 行为一致：随时可导出整本）。

### 5.4 事件接线（全部无状态——每个处理器只做 UI 刷新）

| 酒馆事件 | 动作 |
|---|---|
| `MESSAGE_RECEIVED`（`genType !== 'first_message'`） | `refreshNovelUI()` |
| `MESSAGE_RECEIVED`（`genType === 'first_message'`） | `refreshNovelUI()`（问候语不占章，计数不变） |
| `MESSAGE_SENT` | `refreshNovelUI()`（首条用户消息解锁问候语入书） |
| `MESSAGE_SWIPED` / `MESSAGE_EDITED` / `MESSAGE_DELETED` | `refreshNovelUI()` |
| `CHAT_CHANGED` / `CHARACTER_PAGE_LOADED` / `GROUP_UPDATED` | `refreshNovelUI()` |

- `refreshNovelUI()`：重算 `computeChapters` → 更新面板状态行（若开着）+ 魔法棒副标。防抖 300ms。
- **禁止**：任何跨消息持久状态、签名去重、缓冲计时器（v1.x 的 `lastSavedSignature` / `seedLastSavedSignature` / `checkAndSaveBufferedTurn` / `ensureGreetingSerialized` / `postChapterToServer` / `checkServerPluginStatus` / `executeSyncAll` 全部删除）。

### 5.5 UI 装配（按 `docs/mvp/design.md`，锁定要点）

- `NVUI.createPanel({ id: 'novel_stream_panel', title: '小说连载阅读', tabs: [serial/filter/file], actions: [导出图标钮], footer: [关闭 ghost, 导出整本 TXT primary], mount: document.body, onClose: persistAccOpen })`；面板根加 `nvui-scope`；每次打开 `panel.setTab('serial')`。
- 自定义节点（`panel.addNode`，只用 `nvui-` 类 + `var(--nvui-*)` 令牌，自有类 `novel-` 前缀）：分段控件（章节格式 4 选 1 / 命名 2 选 1，radiogroup + roving tabindex + 方向键）、全宽标签字段（白/黑名单）、分区 heading、状态行。DOM 骨架与 CSS 见 design.md §3。
- 业务必须补：焦点陷阱（Tab 循环）、tabs 方向键、`resize` 后 `panel.syncIndicator()`、打开后 400ms 遮罩点击守卫。
- 魔法棒菜单项：design.md §9 骨架；不 `stopPropagation`；宿主重绘后按 id 幂等补回 + 短轮询兜底（沿用 v1.x `injectWandEntry` 策略）。

## 6. 设置 Schema（锁定——8 键，`extension_settings.autoSaveTxt`）

| 键 | 类型 | 默认 | UI |
|---|---|---|---|
| `version` | string | `'2.0.0'` | — |
| `enabled` | bool | `true` | 连载页 is-feature 开关 |
| `chapter_style` | enum | `'numbered_floor'` | 分段控件 4 选 1（numbered_floor / numbered / separator / dialogue） |
| `naming_rule` | enum | `'char_chat'` | 分段控件 2 选 1（char_chat / char_only） |
| `indent_paragraphs` | bool | `true` | 「章节格式」组内开关 |
| `include_user_dialogue` | bool | `false` | 「主角对白」组开关 |
| `include_tags` | string | `''` | 白名单全宽字段（空 = 保留全文） |
| `exclude_tags` | string | `'status,memory,details,variables,analysis,ooc,note,draft,system,log'` | 黑名单全宽字段 + 恢复默认 |
| `acc_open` | string[] | `[]` | 折叠分组开合持久化（默认全收起） |

- `EXTENSION_NAME` 保持 `'autoSaveTxt'`（v1.x 老用户同名键无缝继承）。
- 旧键（`save_dir` / `show_toast` / `show_floating_window` / `float_pos` / `buffer_latest_message` / `userDisabled` / `ui_v113_migrated` / `show_embedded_toolbar`）**读取时忽略，不写迁移代码**。
- 缺失键补默认值（`getSettings` 的 for 循环保留），无版本迁移分支。

## 7. UI 结构锁定

- 完整规格 = `docs/mvp/design.md`（Phase 1 交付，P0 门禁已过）。本节只锁不可协商项：
  1. 形态：`dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel`，非模态 `show()`，禁 `showModal()` / 裸 fixed。
  2. 3 tab：连载（`fa-book-bookmark`）/ 过滤（`fa-filter`）/ 文件（`fa-file-lines`）；桌面顶部 tabs + 手机底部导航同一份状态。
  3. 每 pane 至多 1 条 `is-feature`（仅连载页总开关）；每个 `.nvui-acc` 必须有实时 summary。
  4. 唯一滚动层 `.nvui-panel-body`；面板固定高度，折叠展开外框不跳变。
  5. 即改即存（change 事件 → `saveSettingsDebounced`），无保存/取消按钮；footer = 关闭（ghost）+ 导出整本 TXT（primary）。
  6. 品牌色：**零 token 覆盖**（Kit 默认 `--nvui-accent #8b6dff` 与旧产品牌同值）；插件 CSS 禁止任何 `#hex`/`rgb()`/`hsl()` 字面量（验算表语境的 design.md 除外）。
  7. 图标全用 design.md §6 的 FA 清单；禁 emoji。

## 8. 设计 Token（锁定）

- 唯一色源 = `ui-kit/tokens.css`（`:root`，全局可达——魔法棒菜单项在宿主 DOM 也可引用 `var(--nvui-accent)`）。
- 面板恒用 Kit 深色默认；`.nvui-theme-light` 不接入；玻璃/动效降级由 Kit 全量处理，业务零分支。
- 焦点环、圆角、间距、动效一律 `var(--nvui-*)`；插件自有类只允许 `novel-` 前缀，禁止碰 `nvui-` 前缀、禁止给 Kit 组件加第二套皮肤。

## 9. 验收标准（锁定——QA 测试时以此为唯一依据，EARS 格式）

| 编号 | 功能 | EARS 格式验收标准 | 优先级 |
|---|---|---|---|
| AC-01 | 章节派生 | While 聊天中含用户消息，系统**必须**从 index 0 起将非空清洗楼层连续编号（问候语为第 1 章） | P0 |
| AC-02 | 延迟入书 | If 聊天中无任何用户消息，系统**必须**返回 0 章且状态行显示「尚未开始」文案 | P0 |
| AC-03 | 重 roll/划动 | When 用户重新生成或划动分支，系统**必须**在下次刷新时以新内容重新派生该章（无残留旧文） | P0 |
| AC-04 | 主角对白 | While `include_user_dialogue=false`，用户楼层**必须**不出现在章节中；为 true 时必须出现 | P0 |
| AC-05 | 白名单 | While 白名单非空且标签命中，系统**必须**只保留标签内内容；未命中时保留全文并**不得**静默清空 | P0 |
| AC-06 | 黑名单 | While 黑名单含 status，系统**必须**完整剔除 `<status>…</status>` 块（含成对/无头/未闭合三态） | P0 |
| AC-07 | 导出 | When 用户点击导出，系统**必须**下载 UTF-8 BOM 的 TXT，文件名遵循命名规则，章节标题遵循 chapter_style | P0 |
| AC-08 | 导出反馈 | When 导出完成，系统**必须**刷新「文件」页状态行并弹出 1 次性 toast；无有效章节时必须 toast 警告且不下载 | P0 |
| AC-09 | 面板结构 | While 面板打开，载体**必须**为 dialog.nvui-tl > overlay.is-panel > .nvui-panel 且非模态 show() | P0 |
| AC-10 | 标签同步 | When 用户切 tab（点击/方向键/底部导航），系统**必须**同步 tabs、底部导航、tabpane 的 is-active/aria-selected/aria-current/tabindex 且不重建 DOM | P0 |
| AC-11 | 焦点 | When 面板打开，焦点**必须**移入面板；关闭后**必须**归还魔法棒菜单项；Tab 循环不逃逸 | P0 |
| AC-12 | 关闭 | When 用户按 Esc / 点遮罩 / 点关闭钮 / 点 ghost 关闭，系统**必须**走退场动画后隐藏并归还焦点 | P0 |
| AC-13 | 开合持久化 | When 用户展开/收起折叠组后关闭再打开面板，系统**必须**恢复上次开合状态（默认全收起） | P1 |
| AC-14 | 设置持久化 | When 用户改任何设置，系统**必须**立即写入 extension_settings 并在重载后保持 | P0 |
| AC-15 | 计数 | While 面板打开且有章节，状态行**必须**显示「第 N 章」；切聊天后**必须**重算 | P1 |
| AC-16 | 魔法棒入口 | While 扩展已加载，`#extensionsMenu` 中**必须**存在「小说连载阅读」项（图标 fa-book-bookmark + 副标），点击打开面板 | P0 |
| AC-17 | P0 红线 | 全仓库（index.js/style.css/README/设计文档）**必须**零 emoji 功能图标、零紫粉渐变、组件样式零硬编码颜色 | P0 |
| AC-18 | Kit 契约 | `node ui-kit/test/test-ui-kit.js` **必须** 0 失败（vendor 的 Kit 未被改坏） | P0 |

## 10. 边界与约束

- 行尾：`index.js` / `style.css` 保持 CRLF（仓库惯例）；`ui-kit/` 字节级原样复制（不转行尾）。
- `index.js` 为 ESM：禁 `require`；`ui-kit/nvui-api.js` 用 `import './ui-kit/nvui-api.js'`（UMD 执行后挂 globalThis.NVUI）。
- 不支持 IE；响应式断点 600px（Kit 内置）；面板 880px / 88vh（桌面）、100% / 92dvh（手机）。
- 单章上限不设（无服务端）；导出体积受浏览器内存限制（v1.x 的 100KB/20MB 熔断随服务端一起退役）。
- 性能：清洗缓存（`getCleanedMessage` 的 sig+map）保留；`refreshNovelUI` 防抖 300ms。

## 11. 内嵌已知坑（从项目记忆拉取，开发时必须规避）

| 坑 | 根因 | 修法 |
|---|---|---|
| 酒馆 `html` 有 transform → 浮层飞出屏幕 | html 成为 fixed 包含块 + 层叠上下文 | 浮层进 `dialog.nvui-tl`（Kit 已内置），禁裸 fixed 挂 body |
| 宿主 checkbox `::before` 对勾泄漏（v1.17.6 蓝三角） | 酒馆给每个 input[type=checkbox] 挂对勾伪元素 | 用 Kit 的 `.nvui-switch-row`（§6 已做宿主隔离），不自造 appearance:none 开关 |
| 高特异性静默作废声明 | `#id` 压 `.class` | 只追加覆盖块，不删 Kit 规则；改样式量 computed |
| 语义版本字符串比较 | `'1.12.0' < '1.7.8'` | `compareVersion()`（已保留，测试锁定） |
| HTML 注释反引号截断模板字符串 | 语法仍合法，node --check 查不出 | 模板字符串少用；面板 DOM 用 API/节点创建，不用大 innerHTML |
| 测试自造假象 | 环境搭错导致恒真/恒假 | 测滚动先确认 scrollHeight>clientHeight；结论无效的测试比没测试更糟 |
| CRLF 匹配串 | `\r\n` 不匹配 | 自证脚本匹配串带 `\r\n` 或统一 LF+toCRLF() |

## 12. 端到端验证步骤（Spec 锁定的最后一项）

```bash
# 0. 语法
node --check index.js

# 1. 纯逻辑测试（5 个，全部从 index.js 抽真源码执行）
node test/test-think.js            # 清洗引擎（升级：抽真源码，不再手抄）
node test/test-universal-tags.js   # 通用标签清洗（升级：抽真源码）
node test/test-version-compare.js  # 版本比较（保留）
node test/test-chapter-map.js      # 章节派生（重写：抽真 computeChapters + cleanNovelText）
node test/test-export-build.js     # 整书编排输出（新增：BOM/4 种章节风格/命名/书名）

# 2. 面板契约测试（playwright-core + 本机 Edge）
NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" node test/test-mvp-panel.js
# 断言：载体结构/非模态 show/tab 三处同步/切 tab 不重建 DOM/分段控件方向键/
#       Esc+遮罩+关闭钮三路关闭/焦点归还/折叠 aria-expanded/summary 实时刷新/is-feature 唯一性

# 3. Kit 契约（vendor 未被改坏）
node ui-kit/test/test-ui-kit.js

# 4. P0 红线扫描（emoji / 渐变 / 硬编码色）
#    （脚本由 Phase 3 总监验收时执行，正则见 design.md §11）

# 5. 人工端到端（用户侧）：酒馆加载扩展 → 魔法棒出现「小说连载阅读」→
#    对话几轮 → 面板显示「第 N 章」→ 导出 TXT → 阅读器识别目录
```

## 13. 变更记录

| 日期 | 变更内容 | 原因 | 影响范围 |
|---|---|---|---|
| 2026-10-20 | Spec 创建并锁定 | MVP 化启动 | 全部 |
