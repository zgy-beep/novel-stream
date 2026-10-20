# SillyTavern UI Kit · 界面架构审核报告（v1.1.0 → v2.0.0 → v2.0.1 → v2.1.0 → v2.1.1 → v2.2.0）

> 审核人：audit-reviewer（独立于实现方，结论均由本人读代码、跑测试、看截图后得出）
> 审核对象：`D:\Github\ui-kit`（SillyTavern 插件通用 UI Kit，独立项目，零依赖纯 CSS + 可选零依赖 JS API）
> 基线版本：**v1.1.0**（只读快照 `C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\v1-snapshot`）
> 目标版本：**v2.0.0「Flat Glass」→ v2.0.1（反馈补丁）→ v2.1.0（面板布局标准）→ v2.1.1（描边/固定尺寸/滚动条）→ v2.2.0（圆角玻璃去外框描边防锯齿 + nvui-api.js / tokens.json / AI-GUIDE.md）**
> 报告状态：**阶段 1~6 均已完成**；各阶段结论见第 0 节、第 9~13 节：v2.0.0 / v2.0.1 / v2.1.0 / v2.1.1 / v2.2.0 均为**有条件通过**（无阻塞项，残余项已记录并获 Lead 接受）。
> 契约追加：契约 §12（v2.0.0 AUD 决策）、§13 / §13.5（v2.0.1）、§14（v2.1.0 面板布局标准）、§15（v2.1.1 描边/固定尺寸/滚动条）、§16（v2.2.0 描边精致化 + API/JSON/AI 指南）均已按文件核验。
> 复核时点：阶段 2 = 2026-10-17 22:07–22:25；阶段 3 = 22:57–23:10；阶段 4 = 23:18–23:35；阶段 5 = 23:32–23:45；阶段 6 = 23:46–23:58（各版冻结/修复哈希见对应章节）。
> 更新时间：2026-10-17

---

## 0. 结论摘要

| 维度 | 结论 |
| :--- | :--- |
| 架构分层 | **好**。tokens / components / preview / test / docs 五层职责清晰，令牌契约、三方覆盖、金标准、宿主兼容红线、独立项目自洽性在纯 CSS 组件库中属于上游水平。 |
| 视觉语言 | **不满足用户诉求**。静态组件大量「1px 描边 + 半透明底」层层嵌套，形成盒子化界面；阴影只用于浮层且是纯黑硬阴影；**完全没有玻璃拟态**（`backdrop-filter` 零命中）；动效只有颜色过渡 + 一个旋转加载环。与「扁平化 + 玻璃拟态 + 提升动画」的目标存在代差。 |
| 反馈与可访问性 | **有明显缺口**。无 toast / 进度条 / 骨架屏 / 状态点；状态行无 `aria-live`；焦点环 6 处硬编码；`prefers-reduced-motion` 缺 `animation-delay` 重置；渲染级（opacity 稀释后）对比度低于 AA，但现有测试只验 token 静态值。 |
| 工程与文档门禁 | **基础扎实但有盲区**。86 条测试偏「源码字符串/正则断言」，能防删除与漂移，不能防新增漏登记、不能验计算样式、无能力降级断言；README 自述「不靠描边堆盒子」但实现用 12 处 1px 描边；无 v1→v2 迁移表、无玻璃/动效/降级演示。 |
| 总体判断 | v1.1.0 应升 **v2.0.0 破坏性升级**，方向与内部契约一致。本报告共记录 **15 项问题**（P1 3 项、P2 8 项、P3 4 项），其中 **4 项为契约未覆盖的新发现**（AUD-06 / AUD-11 / AUD-13 / AUD-14）；Lead 已通过**契约追加 §12** 全部决策，阶段 2 复核确认：3 项已修复并验证、1 项文档已补并验证。 |
| 阶段 2 复核 | **有条件通过**。169 条测试两次复跑均 0 FAIL；玻璃 AA 独立复算与 README/测试完全吻合；AUD-01~15 逐项验证（13 项通过、2 项条件通过）；复核期间发现并已修复 3 项（A/B/D，复验通过）；C（玻璃内开关轨道非文本对比 2.86/2.77）与 AUD-12（尺寸 token 未全覆盖）为 Lead 决策接受的已知残余，不阻塞 v2.0.0。详见第 9 节。 |
| 阶段 3 复核（v2.0.1） | **有条件通过**。187 条测试 0 FAIL；v2.0.1 新 AA 口径独立复算完全吻合（深弹窗 10.33/4.70、深 popover 正文 7.76、浅弹窗 9.31/4.64、浅 popover 9.66/4.81）；标签粘连指示器 stretch→settle + spring 过冲、tabpane 入场、开关回弹/按压拉伸、进度扫光、折叠/弹窗动画、数字框 spinner 隐藏、玻璃 computed（0.80 / 0.06 / blur 20 / sat 1.5）全部 CDP 实测通过；宽度 1440→320 无横向溢出；六处版本/107 令牌/68 类/16 关键帧一致。残余：指示器为可选 JS 能力、强制动效仅演示、系统 reduce 环境（红线）、C/AUD-12 继承，均不阻塞。复核后 P3 注释矛盾已由 Lead 修复（components.css 新哈希 `34D82F…`，仅注释、无行为变化，测试仍 187/0）。详见第 10 节。 |
| 阶段 4 复核（v2.1.0） | **有条件通过**。197 条测试 0 FAIL；CDP 实测桌面 1440 面板 880×650.81 居中（dx/dy=0，max-h 88vh）、手机 390 底部抽屉（全宽、bottom=844、92dvh、仅上圆角、拖拽把手、底部导航 5 项、项高 46px、safe-area 内边距）、顶部 tabs 与底部导航 display 互斥、双向导航同步（aria-selected / aria-current / tabpane / tabindex）、回缩桌面状态保持、1440→320 共 10 档 docSW==innerWidth、单一滚动层（矮视口 body 独立滚动且页面不锁滚动）；排列结构与契约 §14.2/README §12 逐项一致、视觉为 Kit 紫色 Flat Glass 未复刻参考图皮肤；六处版本 2.1.0、109 令牌、78 类、16 关键帧一致。复核中发现底部导航文字色 AA/政策不一致（P3），Lead 已修（inactive text-2 / active text + README 2 行），复验通过（最坏宿主 4.70/4.64 与 8.79/8.17）。残余见 §11.9，不阻塞。详见第 11 节。 |
| 阶段 5 复核（v2.1.1） | **有条件通过**。203 条测试 0 FAIL；CDP 四状态（默认/全折叠/全展开/切 tab）面板外框完全一致（桌面 880×792、手机 390×828，宽高 x/y/bottom 逐项相同），展开内容只在 panel-body 内滚动（scrollHeight 1072>635，scrollTop 生效、window.scrollY 不变）；焦点环单圈（token 1.5px、keyboard/真实鼠标点击 focus-visible 下 outline solid accent、box-shadow none；Chromium used outline-width 取整为 1px 属预期）；panel-body/modal-body `scrollbar-width:none` + `::-webkit-scrollbar` 隐藏且滚动有效；描边 token 新值全部落地、玻璃 computed border 仅 0.03；六处版本 2.1.1、109/47/78/16、README §3.13/§10.6/§11、CHANGELOG/package 一致；44 项独立静态检查全 PASS。残余见 §12.8，不阻塞。详见第 12 节。 |
| 阶段 6 复核（v2.2.0） | **有条件通过**。223 条测试 0 FAIL；CDP 实测 6 个圆角玻璃组件 computed `border-width=0`（无 1px 外框、消除亚像素锯齿来源）、7 处直线分隔改用 `--nvui-glass-line`（深 0.06 / 浅 0.28 computed 核对）、ghost 无描边+淡底、tabs indicator `inset 0 -2px 0 accent-line` 无 1px 内环、empty 无虚线、焦点环 computed **2px 整数**单圈 + box-shadow none；API 真实可用：`NVUI.version=2.2.0`，`createPanel` 生成 `dialog.nvui-tl > overlay.is-panel > panel`（role/aria 正确、固定 880×792、tabs↔底部导航↔tabpane↔aria-current 同步、关闭焦点归还），`showToast` 进 top-layer 且 role=status；console exceptions/network fails 均 0、无 http 资源；`tokens.json` 与 `tokens.css` 独立解析 **109/47 逐值 0 mismatch**；AI-GUIDE 覆盖 ST 插件/其它软件/提示词/验收/API 速查且无 emoji；六处版本 2.2.0 + nvui-api VERSION + tokens.json version、109/47/78/16、README 第 13/14 章 + §10.7、CHANGELOG v2.2.0、package main 一致；44 项静态检查全 PASS。复核中发现 `.nvui-panel` 能力降级缺失（继承 v2.1.0），经两轮修复（直补 selector 不生效 → 文件末尾高 specificity 晚绑定覆盖）后 CDP 复验通过（reduced-transparency 不透明+none、forced-colors CanvasText 边+去 blur/阴影）。残余见 §13.7，不阻塞。详见第 13 节。 |

---

## 1. 审核范围、方法与证据

### 1.1 范围与版本

- 审核对象为 **v1.1.0 只读快照**（因为工作区正在被 v2 升级，不能作为 v1 基线）。
- 快照内含：`tokens.css`、`components.css`、`preview.html`、`README.md`、`CHANGELOG.md`、`package.json`、`test/test-ui-kit.js`。
- 版本号证据：`package.json:3` 为 `1.1.0`；`tokens.css:4` / `components.css:4` 文件头为 `ui-kit v1.1.0`；`README.md:3` 为 `版本：**v1.1.0**`；`CHANGELOG.md:9` 最新条目 `## v1.1.0`；`preview.html:6,58` 为 `v1.1.0`；测试文件 `VERSION` 断言为 `^1\.1\.0$`（`test/test-ui-kit.js:160-161`）。

### 1.2 文件规模（快照实测）

| 文件 | 字节 | 行数 | 角色 |
| :--- | ---: | ---: | :--- |
| `tokens.css` | 10,605 | 233 | 设计令牌（深色 84 个 + 浅色覆盖 41 个） |
| `components.css` | 29,575 | 1,087 | 组件样式（53 个类名、13 个组件族） |
| `preview.html` | 28,427 | 456 | 离线预览页（13 个演示分区） |
| `README.md` | 35,829 | 631 | 设计规范（12 章） |
| `test/test-ui-kit.js` | 27,697 | 504 | 规范守护测试（86 条检查） |
| `CHANGELOG.md` | 1,140 | 20 | 变更记录 |
| `package.json` | 431 | 17 | 项目元信息 |

### 1.3 证据获取手段

1. **全文通读**：快照全部 7 个文件逐行阅读，所有结论标注文件与行号。
2. **静态统计**：用正则对 `components.css` / `tokens.css` / `preview.html` 做定量扫描（描边数、阴影数、动画数、硬编码色、px 字面量、能力检测关键词等，统计结果见附录 8.2）。
3. **基线测试复跑**：在快照副本中执行 `node test/test-ui-kit.js`，复现 **86 PASS / 0 FAIL**（详见 1.4）。
4. **无头浏览器截图**：Microsoft Edge `--headless=new`，从 v1.1.0 快照渲染深色 / 浅色 / 窄屏 / 弹窗四态截图，并逐张目检：
   - `C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\shots\v1-dark.png`（1440×3400，深色）
   - `C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\shots\v1-dark-full.png`（1440×5600，深色全页）
   - `C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\shots\v1-light.png`（1440×3600，浅色）
   - `C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\shots\v1-narrow.png`（420×2400，窄屏）
   - `C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\shots\v1-modal.png`（1440×1200，弹窗打开态）
   注：v1 预览页无 URL 参数（见 AUD-15），浅色与弹窗截图由快照副本改一行 class/属性后渲染，**仅用于观感取证，不影响代码结论**。
5. **渲染级对比度手工验算**：用 sRGB 逐通道混合 + WCAG 相对亮度公式计算 opacity 稀释后的实际对比度（附录 8.3），弥补测试只验 token 静态值的盲区。

### 1.4 基线测试复跑与快照完整性说明

- 直接在快照目录运行会崩溃：`test/test-ui-kit.js:135` 读取 `LICENSE`，而快照目录**缺少 `LICENSE` 与 `.gitignore`**（`ENOENT`，进程退出码 1，测试一条都没跑）。
- 处理方式：把快照整体复制到临时目录 `...\ui-kit-v2\v1-audit-run`，并从工作区补入 v1.1.0 原文件 `LICENSE`（MIT）与 `.gitignore` 后运行，结果：

  ```text
  === UI Kit 规范测试结果: 通过 86, 失败 0 ===
  UI Kit 规范与实现、预览、文档三方一致，宿主兼容红线全部在位。
  ```

- 结论：**v1.1.0 的 86 PASS / 0 FAIL 基线成立**；但「快照不是完整可运行基线」。建议后续做快照时保留 `LICENSE` / `.gitignore`，否则任何复核者都无法直接复现基线测试（本次已在临时副本中复现，未修改快照本身）。

### 1.5 方法与局限

- 本审核**未在真实 SillyTavern 宿主内运行**（宿主环境不可用），宿主兼容结论基于代码审查 + README 红线 + 契约约束，未做真机验证。
- 截图来自静态 `preview.html`，是「组件在受控页面内」的观感，不等同于插件内真实布局；但足以证明视觉语言层面的问题（盒子化、无玻璃、无动效）。
- 本报告不把「测试通过」等同于「质量达标」：第 3 节多项问题恰恰是 86 条测试**覆盖不到**的地方。

---

## 2. 架构分层评估与优点

### 2.1 五层架构

```text
tokens.css        设计事实层：全部颜色/尺寸/字体/动效/层级令牌；组件不写死值
components.css    实现层：只消费 token，nvui- 前缀 + dialog.nvui-tl 作用域
preview.html      演示层：单文件离线，覆盖全组件，pv- 前缀页面骨架不进 kit
test/             守护层：token 完整性 / 三方覆盖 / 配色规范 / 宿主红线 / 版本自洽
README.md 等      规范层：设计原则、组件契约、宿主红线、迁移表、版本管理
```

分层之间是**单向依赖**（组件依赖 token，预览与测试依赖组件+文档，文档描述全部），没有循环；kit 自身不引入 JS 运行时，交互配方以文档形式给出，符合「插件通用 UI Kit」的定位。

### 2.2 优点（均有证据，不照抄实现方自述）

1. **令牌化程度高、颜色红线可执行**：`components.css` 无 `#hex` / `rgb()` / `hsl()` 字面量（测试 `test/test-ui-kit.js:222-224` 扫描），颜色声明全部走 `var(--nvui-*)`（`test-ui-kit.js:226-235`）；token 金标准锁值防静默改色（`test-ui-kit.js:238-268`、`270-288`）。
2. **三方覆盖门禁**：53 个组件类名必须在 `components.css` / `preview.html` / `README.md` 三处同时出现（`test-ui-kit.js:328-346`），有效防止「实现了没演示、演示了没文档」。
3. **WCAG AA 有数据支撑**：深/浅主题正文、次要文字、语义色、主按钮白字逐项验算（`test-ui-kit.js:290-319`）；`--nvui-text-3` 从旧实现 `#6c7487`（3.72:1）提亮到 `#7d879b`（4.81:1）并写入文档（`tokens.css:80-82`、`README.md:209`）。
4. **宿主兼容红线具体且来自实战**：`dialog.nvui-tl` 非模态 top-layer 载体解决酒馆 `html { transform }` 导致 fixed 浮层错位（`components.css:52-89`、`README.md:535-539`）；对抗酒馆全局 checkbox `::before` 的隔离（`components.css:405-411`、`README.md:540`）；全部选择器限定 `.nvui-*` / `dialog.nvui-tl`，测试扫描裸元素选择器（`test-ui-kit.js:401-407`）。
5. **作用域与降级有底线**：`prefers-reduced-motion` 全局降级（`components.css:1078-1087`）；`!important` 实际仅 6 处声明，全部用于宿主 checkbox 隔离与 reduced-motion（`components.css:409-410,1082-1085`），测试限制 <=8（`test-ui-kit.js:417-424`）。
6. **独立项目自洽**：自带 `package.json` / `CHANGELOG` / `test/`，无父目录引用（`test-ui-kit.js:467-472`），可整目录移动复用；版本在 6 处声明一致（`test-ui-kit.js:485-494`）。
7. **预览页零依赖离线可用**：相对路径引 CSS、无外链脚本/样式/字体/CDN（`test-ui-kit.js:432-435`、`preview.html:7-9`），双击即可预览，对插件开发者非常友好。
8. **无障碍基础存在**：`.nvui-sr-only` 用 clip 方案而非 `display:none`（`components.css:39-50`）、7 处 `:focus-visible`、标签页只切 `display` 不重建 DOM（`components.css:582-588`）、弹窗 JS 配方支持 Esc 与遮罩关闭（`preview.html:431-452`）。

> 结论：**架构与工程门禁值得保留和复用**，本次升级应「换视觉与动效语言，不推翻分层与门禁」。事实上 v2 契约（§2-§8）正是沿着这套门禁做增量加固。

---

## 3. 问题清单

### 3.1 优先级定义

| 级别 | 含义 |
| :--- | :--- |
| **P0** | 阻断交付 / 安全 / 数据问题（本次无） |
| **P1** | 与用户核心诉求（扁平化、玻璃拟态、动效）直接冲突，属于视觉语言级问题 |
| **P2** | 明显可用性 / 可访问性 / 工程门禁缺口，用户可感知或会反复踩坑 |
| **P3** | 打磨项或前瞻性风险，本次可不修但应记录并给出归属 |

### 3.2 P1 问题

#### AUD-01 扁平化不彻底：静态区块靠「1px 描边 + 半透明底」堆盒子

- **现象**：按钮、输入框、折叠面板、徽标、标签块、告警条等静态组件全部是「半透明底 + 1px 描边」；预览页自身又用 1px 描边分区、虚线描边嵌套演示区，观感是「盒子里套盒子」。阴影只用于弹窗 / 悬浮面板 / 工具提示 3 类浮层，静态层级没有阴影或色阶表达，层级完全依赖描边。
- **证据**：
  - `components.css` 共 **12 处 `border: 1px solid`**：弹窗 `:117`、版本胶囊 `:155`、按钮 `:245`、开关轨道 `:394`、输入框 `:481`、折叠面板 `:607`、徽标 `:835`、标签块 `:878`、悬浮面板 `:927`、工具提示 `:959` 等；
  - 另有多处局部描边/虚线：`:130`、`:188`、`:370`、`:463`、`:532`、`:730`、`:791`、`:893`；
  - 静态组件使用半透明底 `background: var(--nvui-block-bg*)` 共 **11 处**（`:157,247,609,732,837,880` 等）；
  - `box-shadow` 全文件仅 **4 处**（弹窗 `:119`、主按钮 hover 光晕 `:290`、悬浮面板 `:930`、工具提示 `:962`）；
  - 文档**自相矛盾**：`README.md:163` 写「层级靠表面与阴影，不靠描边堆盒子」，但实现恰恰是描边堆盒子；
  - 截图 `v1-dark.png` / `v1-light.png`：每个分区、每组控件都以完整描边盒子呈现，浅色主题下盒子感更强。
- **用户影响**：界面密度高、视觉噪音大，与用户要求的「扁平化」直接冲突；层级主次依靠描边而非色阶，长时间使用容易视觉疲劳。
- **v2 修复方式**：静态区块去 1px 描边、去投影、去渐变，只用 `--nvui-block-bg` / `-bg-2` 色阶与间距表达层级（契约 §0 硬规则 1、§3.1 保留类名外观升级、§7.6 测试红线）。

#### AUD-02 无玻璃拟态：浮层是纯不透明「黑板」，与宿主割裂

- **现象**：全项目 `backdrop-filter` 零命中；弹窗/遮罩/悬浮面板/工具提示全部为不透明表面或纯色遮罩，没有半透明磨砂、受光边、内高光，浮层像一块实心板贴在页面上。
- **证据**：
  - 正则扫描 `backdrop-filter` 在 `tokens.css` / `components.css` / `preview.html` 中 **0 命中**（附录 8.2）；
  - 遮罩为纯色半透明、无模糊：`tokens.css:60` `--nvui-overlay-bg: rgba(6, 8, 14, 0.72)`；
  - 弹窗本体完全不透明：`components.css:116` `background: var(--nvui-bg)`（`#161a24`）；
  - 悬浮面板 / 工具提示同理：`components.css:929`、`:961` 用不透明 `--nvui-bg-2`；
  - 截图 `v1-modal.png`：遮罩只是压暗，弹窗是一块实心深色板，没有任何背景透出与模糊。
- **用户影响**：浮层与宿主页面之间缺少「同一空间的不同深度层」观感，用户明确要求的玻璃拟态完全缺失；在多插件并存的酒馆页面中也难以形成高级感。
- **v2 修复方式**：新增玻璃 7 令牌（`--nvui-glass-bg` / `-bg-strong` / `-line` / `-highlight` / `-blur` / `-blur-sm` / `-saturate`）+ `.nvui-glass` 工具类；弹窗/遮罩/悬浮面板/工具提示/吐司走「半透明底 + `backdrop-filter` 模糊/饱和 + 1px 受光边 + 内高光阴影」；同步补 AA 安全合成对比度测试（契约 §2、§3.2、§3.4、§5、§7.4）。

#### AUD-03 动效单薄：只有颜色过渡 + 1 个旋转关键帧，折叠/弹窗/标签页都是硬切

- **现象**：全项目只有 1 个 `@keyframes`（加载环旋转）；所有过渡只改 `background-color` / `border-color` / `color`；没有任何进出场动画、按压反馈、折叠高度过渡、标签激活动效、stagger/循环动效。
- **证据**：
  - `@keyframes` 仅 1 个 `nvui-spin`（`components.css:912-916`），`animation:` 仅 1 处（`:909`）；
  - 9 处 `transition` 声明全部是颜色/边框（`:209,256,402,423,488,556,610,676`），唯一的非颜色过渡是开关滑钮位移与箭头旋转；
  - `:active` 选择器 **0 命中**（附录 8.2）——按钮/图标按钮/开关没有任何按压缩放反馈；
  - 折叠面板硬切：`.nvui-acc-body` 默认 `display:none`（`:683-690`），展开时直接 `display:block`，无高度/透明度过渡；
  - 标签页只改背景与字重（`:565-570`），无激活动效；弹窗打开/关闭无进出场（`preview.html:434-441` 只是 `hidden` 切换）；
  - 测试只断言 `nvui-spin` 存在（`test-ui-kit.js:386-387`），没有任何动效清单断言。
- **用户影响**：交互缺少方向感与因果感——折叠生硬、弹窗突兀、按压无反馈、长列表无渐入节奏，用户明确要求「提升动画」但现状几乎是静态 UI。
- **v2 修复方式**：14 个 `nvui-*` 关键帧 + 3 时长 + 3 缓动 + 组合过渡令牌；弹窗/遮罩进出场；折叠改 `grid-template-rows 0fr↔1fr` + `nvui-acc-inner`；按钮/图标按钮按压缩放；开关弹簧回弹；标签页 `nvui-tab-select`；吐司进出场；骨架屏 shimmer；进度条不确定动画；状态点呼吸；`.nvui-fade-in/.nvui-slide-up/.nvui-pop-in/.nvui-stagger/.nvui-pulse` 工具类（契约 §3.2、§3.4、§4）。

### 3.3 P2 问题

#### AUD-04 焦点环 6 处硬编码像素值，offset 三套取值，无法统一主题

- **现象**：每个可聚焦组件的 `:focus-visible` 都手写 `outline: 2px solid var(--nvui-accent)`，且 `outline-offset` 有三种不同取值；改焦点环需改 6 个组件，无法通过 token 统一。
- **证据**：`components.css:220`（icon-btn，offset 2px）、`:267`（btn，offset 2px）、`:437`（switch，offset 2px）、`:496`（input，offset 1px）、`:577`（tab，offset 2px）、`:640`（acc-head，offset -2px）共 **6 处**，offset 出现 `2px / 1px / -2px` 三种；测试只统计 `:focus-visible` 数量 >= 6（`test-ui-kit.js:375-377`），不验证取值统一。
  > 说明：任务简报提到「8 处」，独立核对后**实际为 6 处 `outline: 2px solid var(--nvui-accent)`**；另外 1 处 `:focus-visible` 是开关 `::before` 隔离选择器（`:408`），1 处 `outline: none`（`:399`）。以代码为准。
- **用户影响**：焦点环是键盘用户唯一的位置线索；三套 offset 造成视觉不齐，未来品牌化改色必须逐个改组件，容易漏改。
- **v2 修复方式**：新增 `--nvui-focus-ring-color` / `-w` / `-offset` 三令牌，全部焦点环统一引用；测试断言统一写法出现 >= 6 次且禁止 `outline: 2px solid var(--nvui-accent)` 硬编码（契约 §2、§7.6）。

#### AUD-05 reduced-motion 降级不完整：未重置 `animation-delay`，v2 引入 stagger 后会「长时间不可见」

- **现象**：`prefers-reduced-motion: reduce` 块只重置了 `animation-duration / iteration-count / transition-duration / scroll-behavior`，**没有 `animation-delay`**。v1 目前没有带 delay 的动画，所以现网影响低；但 v2 的 `.nvui-stagger` 用 `nth-child` 递增 `animation-delay`（契约 §3.2），若降级块不重置 delay，用户会看到元素延迟数秒才出现——在 reduced-motion 模式下「内容长时间不可见」是比动画更严重的问题。
- **证据**：`components.css:1078-1087` 降级块缺 `animation-delay`；全文件 `animation-delay` 0 命中；测试同样只断 duration/transition（`test-ui-kit.js:378-381`）。
- **用户影响**：对前庭功能敏感/系统开启「减少动态效果」的用户，v2 升级后可能出现内容迟迟不显示。
- **v2 修复方式**：契约 §4 明确降级块必须包含 `animation-delay: 0.01ms !important`，§7.6 增加测试断言。**本项是 v2 发布前必须验证的回归点**。

#### AUD-06 渲染级对比度测试盲区：opacity 稀释后时间戳低于 AA

- **现象**：token 级 WCAG 全部达标，但组件用 `opacity` 做弱化，渲染后的实际文字对比度并未被测试覆盖，实测低于 4.5:1。
- **证据**（手工按 sRGB 混合 + WCAG 公式验算，见附录 8.3）：
  - `components.css:814-819` `.nvui-status-time`：`opacity: 0.6` + `color: --nvui-text-2`（11px）；
    - 深色：`#98a1b3` 以 0.6 叠在 `#161a24` 上 → `rgb(100,107,122)`，对比度 **3.25:1**；
    - 浅色：`#4a5365` 以 0.6 叠在 `#f7f8fc` 上 → `rgb(143,149,161)`，对比度 **2.83:1**；
  - 同类的 `.nvui-status-file`（`:821-825`，opacity 0.85）实测 5.22:1 / 4.97:1，**仍达标**，问题集中在 0.6 档；
  - 现有测试只验 token 两两对比度（`test-ui-kit.js:290-319`），不验 opacity 合成。
- **用户影响**：状态时间戳在深/浅主题下都偏灰难读（11px 小字 + 2.83:1 已明显不达 AA），状态行是插件高频信息。
- **v2 修复方式（已决策）**：Lead 已将本项纳入**契约追加 §12**：`.nvui-status-time` / `.nvui-status-file` 去掉 `opacity`，改为 `color: var(--nvui-text-2)`（玻璃最坏情况 4.69~4.79:1）。状态：**已修复并经阶段 2 复核验证**，验证方法见第 5 节第 12 行。

#### AUD-07 反馈组件缺口：无 toast / 进度条 / 骨架屏 / 状态点，异步状态读屏不可感知

- **现象**：v1 只有 `.nvui-spinner` 与静态的状态行/告警条；缺少瞬时反馈（toast）、可量化进度（progress）、列表加载占位（skeleton）、状态点（status-dot）。同时状态行与告警没有 `aria-live` / `role="status"` / `role="alert"`，读屏用户听不到「更新中 → 更新完成」的变化。
- **证据**：
  - 关键词扫描：`toast` / `progress` / `skeleton` / `status-dot` / `aria-live` / `role="status"` / `role="alert"` 在 tokens+components+preview+README 中全部 **0 命中**（附录 8.2）；
  - 状态行只有视觉样式（`components.css:785-825`），告警只有视觉样式（`:725-782`），README 可访问性速查（`README.md:520-527`）也未要求 live region；
  - 预览页“空态与加载”仅展示空态与 spinner（`preview.html:287-295`）。
- **用户影响**：导出/同步等真实场景里用户不知道进度、不知道操作是否成功；读屏用户完全感知不到异步状态变化。
- **v2 修复方式**：契约 §3.2 新增 toast / progress / skeleton / status-dot 共 4 族 + §3.4 吐司进出场行为 + `role="status"`；§6 预览与 §7.6 测试同步覆盖。**`aria-live` 用于状态行/告警这一点契约未明确，列为遗留建议（第 6 节第 11 项）。**

#### AUD-08 能力检测与降级机制缺位（v2 引入玻璃后成为发布前置条件）

- **现象**：v1 全项目没有 `@supports`、`prefers-reduced-transparency`、`forced-colors` 处理，也没有 `.nvui-solid` 实心模式。当前无玻璃所以只是「缺失基础设施」；一旦 v2 引入 `backdrop-filter`，缺降级会直接变成线上问题：旧内核透底不可读、高对比模式浮层消失、透明度偏好用户观感异常。
- **证据**：`@supports` / `backdrop-filter` / `prefers-reduced-transparency` / `forced-colors` / `nvui-solid` 全部 0 命中；测试无对应断言（`test-ui-kit.js` 中仅注释提到 `@supports`，`:115`）。
- **用户影响**：v2 的玻璃是本版本核心卖点，降级缺失意味着核心卖点在部分浏览器/系统设置下不可用甚至破坏可读性。
- **v2 修复方式**：契约 §5 六条：`-webkit-` 前缀成对、`@supports not` 回退不透明、`.nvui-solid` 实心底、`prefers-reduced-transparency` 回退、`forced-colors` 系统色描边、窄屏降 blur；§7.6 逐条测试。

#### AUD-09 文档与实现矛盾 + 迁移缺口 + 预览页无玻璃/动效/降级可视化

- **现象**：
  1. README 设计原则第 4 条声称「不靠描边堆盒子」，实现满屏描边（见 AUD-01）；
  2. `--nvui-shadow-accent` 是主按钮 hover 的紫色发光投影（`tokens.css:151`、`components.css:290`、`README.md:329`），与扁平化目标冲突，却被当作规范记录；
  3. README 只有 §10.1 token 映射 / §10.2 类名映射（从 novel-stream 迁移），**没有 v1.1.0 → v2.0.0 的迁移对照**；本次是破坏性升级（删 token、折叠 DOM 变更），缺迁移表会直接伤害已有插件；
  4. preview 无玻璃、无动效工具类、无能力降级（reduced-motion / forced-colors / solid）演示，也无 URL 参数，无法无人值守地截图验收；
  5. README 文件表没有 `AUDIT.md`（`README.md:7-16`）。
- **证据**：`README.md:163`、`:323-329`；`tokens.css:151`；`README.md:565-609`（仅 10.1/10.2）；`preview.html` 全文无 `backdrop-filter`/`@keyframes`/URL 参数（附录 8.2）。
- **用户影响**：规范与实现对不上会让集成方困惑；破坏性升级无迁移指引会导致旧插件升级踩坑；验收依赖人工点击，回归成本高。
- **v2 修复方式**：契约 §8 要求 README 增加 `### 10.3 v1.1.0 → v2.0.0 迁移`、文件表补 AUDIT.md、玻璃精确取值进入文档；§6 要求预览 17 个分区（玻璃/动效/降级）且支持 `?theme=light`、`?solid=1`；§7.8 测试断言这些文档特征。

#### AUD-10 测试门禁缺口：只防删不防增、无能力/动效/新组件断言、只做源码正则

- **现象**：86 条检查质量总体不错，但存在明确盲区：
  1. `CORE_TOKENS` 是写死的 84 项清单（`test-ui-kit.js:174-197`），只保证「清单里的都有定义/被使用/被文档」，**没有反向断言「tokens.css 里定义的每个令牌都必须在清单里」**——新增 token 不登记也能全绿；
  2. 浅色覆盖只断言 `>= 40`（`test-ui-kit.js:205-207`），不锁精确集合，删 1 个浅色覆盖测试也不会红；
  3. 焦点环只数数量（`:375-377`），不验写法统一；
  4. 无 `animation-delay`、无 `@supports`/`reduced-transparency`/`forced-colors`/`.nvui-solid`、无玻璃 AA、无 toast/progress/skeleton/status-dot 断言（grep 确认这些关键词在测试中 0 命中）；
  5. 无「每个 `@keyframes` 都必须被 `animation:` 引用」检查，无「`!important` 行白名单含 animation-delay」演进准备；
  6. 测试是源码字符串/正则断言，无法验证计算样式与层叠结果（例如 opacity 稀释对比度、backdrop-filter 是否真的生效）。
- **证据**：`test-ui-kit.js:174-218`（token 清单与检查）、`:203-207`（>= 80 / >= 40 模糊阈值）、`:375-397`（红线检查）、`:417-424`（!important）；关键词 grep 结果见附录 8.2。
- **用户影响**：v2 令牌数将由 84 增至 107（净增 23：删除 `--nvui-shadow-accent`、新增玻璃/焦点/动效/骨架/radius-xl/`--nvui-on-accent`），另有 14 个类名、14 个关键帧，若门禁不升级，漂移与僵尸令牌会快速出现，规范文档失去可信度。
- **v2 修复方式**：契约 §7 全面升级：CORE=107 显式数组（契约追加 §12 新增 `--nvui-on-accent` 后由 106 调整为 107）+ 定义即登记反向检查 + 玻璃 AA 合成对比度 + 14 新类 + 7 类关键实现红线（`-webkit-` 配对、回退块、focus token、折叠 grid、弹窗动画、toast/progress/skeleton/status-dot、keyframes 全被引用、!important 白名单加 `animation-delay`）。

#### AUD-11 浅色主题关闭态开关辨识度不足（WCAG 1.4.11 非文本对比）

- **现象**：浅色主题下，开关关闭态轨道与页面背景、滑钮与轨道几乎同色，控件边界难以辨认；截图 `v1-light.png` 第 4 节目视确认「未开启的开关」非常淡。
- **证据**（手工合成计算，附录 8.3）：
  - 浅色 `--nvui-switch-off-bg: rgba(15, 23, 42, 0.18)`（`tokens.css:192`）叠在 `#f7f8fc` 上 → `rgb(205,208,214)`；
  - 轨道 vs 页面背景对比度 **1.46:1**（低于非文本 UI 组件 3:1 要求）；
  - 浅色 `--nvui-knob-off: #ffffff`（`tokens.css:194`）→ 滑钮 vs 轨道 **1.55:1**；
  - 相关 CSS：`components.css:394-396`（轨道）、`:414-424`（滑钮）。
  - 深色主题同样轨道的 1.45:1 由高对比滑钮（`--nvui-knob-off` = text-2，4.24:1）补偿，可辨；浅色是白滑钮配灰轨道，两个方向都弱。
- **用户影响**：浅色主题用户关闭态开关容易看成「不可用/无控件」；属于可访问性非文本对比不达标，且现有测试只验文字 token，完全覆盖不到。
- **v2 修复方式（已决策）**：Lead 已纳入**契约追加 §12**：深色 `--nvui-switch-off-bg` 0.12→0.34（轨道 vs 页面 3.11:1）、`--nvui-knob-off` 改 `var(--nvui-text)`；浅色 `--nvui-switch-off-bg` 0.18→0.47（轨道 vs 页面约 3.08:1、白滑钮 vs 轨道约 3.3:1）。状态：**已修复并经阶段 2 复核验证**，验证方法见第 5 节第 13 行。

### 3.4 P3 问题

#### AUD-12 尺寸令牌覆盖不完整，「改 token 整体缩放」只部分成立

- **现象**：`tokens.css:158` 注释声称「组件尺寸（改这里即可整体缩放）」，但组件内仍有大量原始 px 字面量：图标按钮 28×28（`:199-200`）、标签页 gap 7px（`:544`）、折叠箭头 8px（`:670-671`）、spinner 16px（`:903-904`）、tooltip max-width 340px（`:957`）、路径框 200px（`:514`）、数值框 96px（`:508`）、按钮组基准 140px（`:345`）、小按钮 26px（`:328`）、断点 600px（`:1047`）等，全文件 **58 处 px 字面量**（附录 8.2）。
- **证据**：`components.css` 全量 px 扫描；`tokens.css:158-166`。
- **用户影响**：替换 token 无法整体缩放/适配大字号模式；与「token 化」承诺有落差。
- **v2 修复方式**：契约新增焦点环/动效/骨架屏/radius-xl 令牌，属于部分收敛；未要求全量尺寸 token 化。建议记录为后续版本改进（第 6 节）。

#### AUD-13 弹窗焦点管理配方缺失：只教开关，不教焦点移入/陷阱/归还

- **现象**：README §2.3 的弹窗 JS 配方（`README.md:138-152`）与 preview 示例（`preview.html:431-452`）只实现 `show()/close()`、Esc、点遮罩关闭；**没有打开时把焦点移入弹窗、没有焦点陷阱、没有关闭后焦点归还**。而弹窗还标了 `aria-modal="true"`，无障碍语义与真实焦点行为不一致。
- **证据**：上述代码段；标题的可聚焦性/初始焦点未处理；`preview.html:357-384` 弹窗 DOM 无 `autofocus`，打开后焦点仍在触发按钮。
- **用户影响**：键盘用户在弹窗打开后需要按多次 Tab 才能进入弹窗，且 Tab 会跑到背景页面；关闭后焦点丢失，方向感断裂。
- **v2 修复方式（已决策）**：Lead 已转 docs-writer 处理（**契约追加 §12**）：README §2.3 弹窗配方补焦点移入、Tab 循环陷阱、关闭后归还触发元素（最小实现 + 说明）。状态：**文档已补并经阶段 2 复核验证**，验证方法见第 5 节第 15 行。

#### AUD-14 token 语义耦合：主按钮文字色借用开关滑钮 token

- **现象**：`.nvui-btn.is-primary` 的文字色用 `var(--nvui-knob)`（开关滑钮颜色），而不是独立的文字 token。
- **证据**：`components.css:284`（`color: var(--nvui-knob);`）；`--nvui-knob` 定义于 `tokens.css:63`，语义是「开关开启态滑钮」。
- **用户影响**：主题定制时若只改 `--nvui-knob` 想调开关，会连带改变主按钮文字色；token 语义边界被打破，长期维护易出错。
- **v2 修复方式（已决策）**：Lead 已纳入**契约追加 §12**：新增令牌 `--nvui-on-accent: #ffffff`，主按钮改用它，不再借用 `--nvui-knob`；tokens.css 现 **107 个令牌 / 47 个浅色覆盖**，测试 CORE 同步。状态：**已修复并经阶段 2 复核验证**，验证方法见第 5 节第 14 行。

#### AUD-15 预览页无法自动验收：无 URL 参数、无降级可视化

- **现象**：v1 preview 的主题切换只能点击按钮（`preview.html:391-395`），无 `?theme=light` / `?solid=1` 之类 URL 参数；无 reduced-motion / forced-colors / 无 backdrop-filter / 实心模式的可视化演示；深/浅/窄屏只能人工切换截图。
- **证据**：`preview.html` 脚本（`:386-454`）无 `location.search` 读取；页面分区 1-13（`:67-353`）无玻璃/动效/降级分区。
- **用户影响**：验收与回归依赖人工点击，无法在 CI/无头浏览器里稳定复现四态；视觉回归没有基线。
- **v2 修复方式**：契约 §6 要求 URL 参数、17 个分区（含玻璃演示与可访问性/降级说明分区），并明确「自查四态截图」。自动截图脚本仍属工程建议（第 6 节）。

---

## 4. v2.0.0 升级方案映射（问题 → 契约修复方式）

| 问题 | 级别 | v2 契约修复方式 | 契约位置 | 阶段 2 验证手段 |
| :--- | :--- | :--- | :--- | :--- |
| AUD-01 盒子化 | P1 | 静态区块去描边/投影/渐变，色阶 + 间距表达层级 | §0 硬规则 1、§3.1、§7.6 | 读 components.css 静态区块规则 + 深/浅截图目检 |
| AUD-02 无玻璃 | P1 | 玻璃 7 令牌 + `.nvui-glass` + 弹窗/遮罩/浮层磨砂 + 内高光/受光边 | §2、§3.2、§3.4、§5 | grep `backdrop-filter`/`-webkit-` 配对 + 截图看磨砂 |
| AUD-03 动效单薄 | P1 | 14 关键帧 + 进出场/折叠高度/按压/标签/弹簧/吐司/骨架/进度/呼吸/stagger | §3.2、§3.4、§4 | 读实现 + 预览页实际触发 + 截图 |
| AUD-04 focus ring 硬编码 | P2 | 焦点环 3 令牌统一，禁止硬编码 2px accent | §2、§7.6 | grep 计数 + 测试断言 |
| AUD-05 reduced-motion 缺 delay | P2 | 降级块补 `animation-delay: 0.01ms !important` | §4、§7.6 | grep + 测试断言 |
| AUD-06 opacity 稀释对比度 | P2（契约外） | **契约追加 §12**：去 opacity，status-time/file 改 `--nvui-text-2` | §12（追加） | 读 CSS 确认无 opacity + 独立复算深/浅玻璃最坏情况 >= 4.5 |
| AUD-07 反馈组件缺口 | P2 | 新 toast / progress / skeleton / status-dot + 吐司 `role="status"` | §3.2、§3.4、§6、§7.6 | 读实现 + 预览页触发 + 截图 |
| AUD-08 降级机制缺位 | P2 | `@supports` 回退、`.nvui-solid`、reduced-transparency、forced-colors、窄屏降 blur、`-webkit-` 配对 | §5、§7.6 | grep 六条 + 截图 `?solid=1` |
| AUD-09 文档矛盾/迁移缺口 | P2 | README 10.3 迁移表、Flat Glass 原则、玻璃精确取值、AUDIT.md 入表；preview 17 分区 + URL 参数 | §6、§8 | 文档逐项 diff + 测试新断言 |
| AUD-10 测试门禁缺口 | P2 | CORE=107 定义即登记反向检查、玻璃 AA、14 新类、7 类实现红线 | §7 | 读测试源码 + 跑测试 |
| AUD-11 浅色开关非文本对比 | P2（契约外） | **契约追加 §12**：深/浅关闭态轨道加深 + knob-off 改 text | §12（追加） | 独立复算轨道/滑钮非文本对比均 >= 3:1 + 浅色截图 |
| AUD-12 尺寸 token 不完整 | P3 | 部分收敛（焦点/动效/骨架/radius-xl），未全量 | §2 | 统计 px 字面量变化 |
| AUD-13 弹窗焦点管理缺失 | P3（契约外） | **契约追加 §12**：README 配方补焦点移入/trap/归还（docs-writer） | §12（追加） | 读 README 配方关键词/代码 + 键盘手测（可行时） |
| AUD-14 主按钮借用 knob token | P3（契约外） | **契约追加 §12**：新增 `--nvui-on-accent`，主按钮改用 | §12（追加） | grep tokens/components 确认替换 + CORE 含该令牌 |
| AUD-15 预览无法自动验收 | P3 | URL 参数 `?theme=light` / `?solid=1` + 降级说明分区 | §6 | 无头截图四态可复现 |

**映射结论**：契约对 P1 三项与大多数 P2 项有明确、可验证的修复方案；**4 项新发现（AUD-06/11/13/14）Lead 已通过契约追加 §12 全部决策**，且阶段 2 已逐项复核：AUD-06 / AUD-14 **已验证通过**，AUD-11 **条件通过**（页面场景达标、玻璃内最坏场景为已接受残余），AUD-13 **文档已补并验证**。完整验证结果见第 9 节。

---

## 5. 验收矩阵（阶段 2 已回填；全部 16 行为最终结果）

| # | 验收项 | 方法与证据 | 通过标准 | 阶段 2 结果 |
| :--: | :--- | :--- | :--- | :--- |
| 1 | 回归测试 | 工作区运行 `node test/test-ui-kit.js` | 0 FAIL；PASS 数 >= v1 的 86，且新增检查覆盖契约 §7 清单 | **已验证**：22:07 与 22:17 两次复跑均 **169 PASS / 0 FAIL，exit 0**（修复前后各一次）；断言数量未放宽 |
| 2 | 玻璃 AA 合成对比度 | 独立重写 sRGB blend + WCAG 脚本复算（不使用测试代码） | 深色白底→overlay→glass：text/text-2 >= 4.5；浅色黑底同理 | **已验证**：深 10.52/4.79、10.30/4.69；浅（纯黑最坏）9.31/4.64、11.80/5.88；浅色典型 #161a24 = 9.70/4.83、12.15/6.05 —— 与测试/README 完全一致 |
| 3 | 玻璃实现红线 | grep + CDP computed style | 所有玻璃表面成对出现，>= 5 类（弹窗/遮罩/浮层/提示/吐司） | **已验证**：`backdrop-filter` 与 `-webkit-` 各 17 处成对；6 类玻璃表面 computed 生效（overlay blur 10、modal blur 18、strong 0.88 等） |
| 4 | 能力降级 | 静态 selector 审查 + CDP `setEmulatedMedia` 动态 | 四块存在且回退为不透明/系统色；`?solid=1` 截图验证 | **已验证（@supports 为静态）**：reduced-transparency / forced-colors / `.nvui-solid` 动态实测通过（含修复后的 subtle）；窄屏 modal blur(10px) 实测；`?solid=1` 截图。`@supports not` 无法在 Chromium CDP 动态模拟，采用静态审查（见 §9.6-6） |
| 5 | 动效体系 | 读 CSS + CDP 强制 `no-preference` 后实测 | 14 个 `nvui-*` 关键帧全部被引用；reduced-motion 含 `animation-delay` | **已验证**：14/14 关键帧均被引用；强制 no-preference 下实测 stagger delay 0.045s、折叠/弹窗/吐司动画真实播放；reduced-motion 下 duration/delay 均 0.01ms、iteration 1 |
| 6 | 折叠高度过渡 | CDP 点击 + 采样 `getBoundingClientRect().height` | `grid-template-rows:0fr→1fr` + `.nvui-acc-inner` 存在；无跳变 | **已验证**：closed=0；展开采样 0→20.67→68.55→86.55→93.52→…→98.19px（0.32s emphasized），关闭回 0；无跳变 |
| 7 | 焦点环统一 | grep + CDP 键盘 Tab 实测 computed | 统一 token >= 6；0 处硬编码 2px accent | **已验证**：6 处统一 token 写法、0 处硬编码 px；Tab 实测 `outline: 2px solid rgb(139,109,255)`、`outline-offset: 2px` |
| 8 | 深/浅/实心/窄屏截图 | CDP `Emulation.setDeviceMetricsOverride` 17 档宽度 + 四态截图逐张目检 | 无溢出、无裁切、玻璃可读、文字对比正常 | **已验证**：1440→320 共 17 档 `docScrollWidth == innerWidth`、越界元素 0；深/浅/实心/390 窄屏截图逐张目检无溢出、玻璃可读 |
| 9 | 七处一致性 | tokens/components/preview/test/README/CHANGELOG/package.json 独立交叉检查 | 版本 2.0.0 全一致；类名/token 三方覆盖；10.3 迁移表与实现对应 | **已验证**：六处版本 2.0.0；107 令牌 = CORE 107 = README 全覆盖；47 浅色；67 类三方齐全；10.3 迁移表 8 项与实际差异逐条一致 |
| 10 | 文档门禁 | README/CHANGELOG/package.json | Flat Glass 原则、玻璃取值、10.3 迁移、AUDIT.md 入表、keywords 更新、无 emoji | **已验证**：全部满足；AA 两种口径、玻璃精确取值、关键字（glassmorphism/motion/flat-design）、无 emoji/BOM/U+FFFD/外链 |
| 11 | 视觉目标达成 | 截图对照 AUD-01/02/03 + computed | 静态区块扁平（无 1px 描边盒子）、浮层有真实玻璃、动效可感知 | **已验证**：静态区块无可见描边/投影/渐变（仅 ghost 按钮为 README 注明的唯一例外）；弹窗/浮层/吐司为真实磨砂玻璃；折叠/弹窗/吐司动画实测 |
| 12 | AUD-06 status 文字对比度（契约 §12） | 读 CSS + CDP computed + 独立复算玻璃最坏情况 | `--nvui-text-2` 在玻璃最坏情况下 >= 4.5:1 | **已验证**：无 opacity、computed color text-2/opacity 1；玻璃最坏 4.79:1（深）/ 4.64:1（浅）≥ 4.5 |
| 13 | AUD-11 开关关闭态非文本对比（契约 §12） | 独立复算深/浅：轨道 vs 页面、滑钮 vs 轨道；另测玻璃内场景 | 页面场景 >= 3:1 | **条件通过**：页面 3.11:1 / 3.08:1、滑钮 4.73:1 / 3.27:1 达标；**玻璃内最坏宿主 2.86:1 / 2.77:1 < 3:1** → Lead 接受为已知残余 C（§9.6-1） |
| 14 | AUD-14 `--nvui-on-accent`（契约 §12） | 读 tokens/components + CORE 清单 | 令牌存在（107/47）；主按钮引用；无 knob 借用；CORE 含 | **已验证**：全部成立 |
| 15 | AUD-13 焦点管理配方（契约 §12） | 读 README §2.3 + preview 行为实测 | 含焦点移入、Tab 陷阱、关闭后归还 | **已验证（文档级）**：README 配方含 14 行可执行代码与 `[data-autofocus]`；preview 实测打开焦点入弹窗、关闭后焦点归还触发元素 |
| 16 | 契约外其他风险 | 复核 AUD-12 / AUD-15 + 阶段 2 新发现 | 已修复或书面接受并写入遗留风险 | **条件通过**：AUD-15 已验证（URL 参数实测）；AUD-12 由 Lead 接受为残余（§9.6-2）；阶段 2 新发现 A/B/D 已修复并复验，C 接受 |

---

## 6. 契约外发现与遗留建议（不在本次 v2 契约范围）

> 原则：本次只做「扁平化 + 玻璃拟态 + 动效」，以下问题不阻塞 v2，但不应被 86+ 条测试全绿的假象掩盖。阶段 2 已复核：AUD-06 / AUD-11 / AUD-14 已修复并验证（AUD-11 的玻璃内最坏场景为已接受残余，见 §9.6）、AUD-13 文档已补并验证；其余仍为后续建议。

1. **AUD-06 状态时间戳对比度**（**已复核：无 opacity + 玻璃最坏 4.79/4.64 ≥ 4.5**）：`.nvui-status-time` / `.nvui-status-file` 改 `color: var(--nvui-text-2)`；CDP 实测 computed color `rgb(152,161,179)`、`opacity: 1`；独立复算玻璃最坏情况 text-2 = 4.79:1（深）/ 4.64:1（浅）。
2. **AUD-11 浅色关闭态开关**（**已复核：页面场景达标；玻璃内最坏场景为已接受残余**）：深色轨道 0.34、`--nvui-knob-off`=text、浅色轨道 0.47；独立复算页面背景上 3.11:1 / 3.08:1、滑钮 4.73:1 / 3.27:1（全部 ≥3:1）。**残余**：玻璃弹窗内 + 最坏宿主（纯白/纯黑）时轨道 vs 玻璃底 2.86:1 / 2.77:1，Lead 已书面接受（理由与后续建议见 §9.6-C）。
3. **AUD-13 弹窗焦点管理**（**已复核：文档配方已补并通过**）：README §2.3 已含「记录触发元素 → 打开后聚焦 `[data-autofocus]`/主按钮/标题 → Tab/Shift+Tab 焦点陷阱 → 关闭后归还」可执行代码；preview 实测打开聚焦关闭按钮、关闭后焦点归还触发元素（preview demo 本身未实现完整陷阱，符合 kit 无 JS 运行时的文档契约定位）。
4. **AUD-14 主按钮文字色语义**（**已复核：替换彻底**）：`--nvui-on-accent: #ffffff` 已入 tokens/CORE，`.nvui-btn.is-primary` 使用它；`components.css` 中无主按钮借用 `--nvui-knob` 的残留；tokens 107 / 浅色 47 / CORE 107 三方一致。
5. **移动端底部抽屉（bottom sheet）**：v2 弹窗在窄屏是全屏卡片；导出/同步类长操作更适合底部抽屉（`grid-template-rows` + `translateY` + 安全区）。属新组件，建议 v2.1。
6. **View Transitions / 路由级转场**：纯 CSS kit 无法接管 JS 视图切换；若未来接入，建议按「渐进增强 + `@supports (view-transition-name: none)`」处理，并保持 reduced-motion 降级。属浏览器前沿能力，暂不纳入。
7. **更老浏览器回退策略**：v2 已覆盖「无 backdrop-filter / 减少透明度 / 强制色彩」三类；仍建议 README 明确最低浏览器基线（例如 Chrome/Edge 105+、Safari 16+、Firefox 103+ 才有 `backdrop-filter`/`prefers-reduced-transparency`），避免集成方误判。
8. **自动化视觉回归**：目前截图靠人工。建议后续加一个不依赖第三方库的 `test/screenshot.ps1`（Edge headless 四态截图 + 文件存在/尺寸断言），至少把「四态能渲染、无 JS 报错」纳入门禁；像素级 diff 可另立项目。
9. **测试从「源码正则」向「计算样式」演进**：在本项目零依赖约束下，可考虑在 Node 测试里内联一个极简 CSS 解析器，对关键选择器断言属性值组合（如 `backdrop-filter` 与 `-webkit-` 成对、`grid-template-rows` 两个状态），比纯字符串匹配更抗重构。
10. **`--nvui-z-*` 与真实 top-layer 的关系**：v2 保持 z-index 兜底是合理的；建议 README 明确「同一时刻只提升一个 dialog 载体」之外，再补「多个 toast 堆栈共享一个载体」的示例，避免插件各自建 dialog。
11. **状态行/告警的 live region（AUD-07 剩余部分）**：v2 只给吐司加了 `role="status"`；状态行（更新中→更新完成）与告警仍没有 `aria-live`/`role="status"`/`role="alert"`，读屏用户感知不到异步状态变化。建议 README 约定「异步状态行加 `aria-live="polite"`、错误告警加 `role="alert"`」，并在 v2 测试或文档检查中体现。

---

## 7. 阶段 2 复核清单（已执行；结果回填第 5 节与第 9 节）

复核前置：等 Lead 明确通知 v2 已集成完成（tokens/components/preview/test/README/CHANGELOG/package.json 全部 v2.0.0 且测试可跑），不以中间态下结论。

阶段 2 优先级（Lead 指定）：**玻璃 AA 合成对比度 > 降级（`@supports` / reduced-transparency / forced-colors / `.nvui-solid`）> 动效与折叠高度 > 文档一致性**。

- [x] 读取工作区全部 v2 文件，确认版本头均为 `ui-kit v2.0.0`、测试版本正则 `^2\.0\.0$`
- [x] 运行 `node test/test-ui-kit.js` 并记录 PASS/FAIL 尾部；核对新增检查是否真的覆盖契约 §7，而非放宽（169/0；逐条对照 §7）
- [x] 逐项验证 AUD-01 ~ AUD-15 的修复状态（读代码 + grep + 测试断言 + CDP；结果见 §9.3）
- [x] 核对契约 §2 玻璃 7 / 焦点 3 / 动效 12-13 / 骨架屏 2 / radius-xl 令牌与实现一致；`--nvui-shadow-accent` 已删除
- [x] 核对 14 个新类名在 components / preview / README 三方齐全；折叠新 DOM（`nvui-acc-inner`）在预览与文档同步
- [x] 核对 14 个 `@keyframes` 全部被 `animation:` 引用；reduced-motion 含 `animation-delay`
- [x] 核对 `@supports` 回退、`.nvui-solid`、reduced-transparency、forced-colors、窄屏 blur、`-webkit-` 配对（静态 + 动态；`@supports` 无法动态模拟）
- [x] 复算玻璃 AA 合成对比度（独立实现 blend/contrast，结果与测试/README 完全一致）
- [x] Edge/CDP 截图深 / 浅 / 实心 / 窄屏四态（URL 参数），逐张用图片查看工具目检
- [x] 七处一致性抽查（版本、类名、token、迁移表、CHANGELOG、package keywords、AUDIT.md 入表）
- [x] 回归检查 v1 优点未倒退：宿主红线（top-layer/checkbox/裸选择器/!important）、三方覆盖、金标准、无 emoji、离线预览
- [x] 按契约追加 §12 验证 AUD-06 / AUD-11 / AUD-14 / AUD-13，结果回填第 5 节第 12~15 行
- [x] 把复核结论（有条件通过）与验收矩阵结果追加到本文件第 9 节，保留阶段 1 全部内容
- [x] 完成后 `team_task_update` complete 并 `send_message` 给 Lead：结论、证据、遗留风险

---

## 8. 附录

### 8.1 复现命令

```powershell
# 基线测试（v1.1.0 快照副本需补 LICENSE/.gitignore，见 1.4）
& 'C:\Users\zgy\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' `
  'C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\v1-audit-run\test\test-ui-kit.js'

# 无头截图（深色示例；浅色/弹窗/窄屏通过副本改一行 class/属性后渲染）
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check `
  --user-data-dir="$env:TEMP\edge-ui-kit-v1" --window-size=1440,3400 --virtual-time-budget=4000 `
  --screenshot="$env:TEMP\ui-kit-v2\shots\v1-dark.png" `
  "file:///C:/Users/zgy/AppData/Local/Temp/ui-kit-v2/v1-audit-run/preview.html"
```

### 8.2 v1.1.0 静态统计快照（本人实测）

| 指标 | 数值 | 说明 |
| :--- | ---: | :--- |
| `components.css` 行数 | 1,087 | — |
| `border: 1px solid` 声明 | 12 | 静态组件盒子化主因 |
| 全部 `border*` 声明 | 22 | 含局部/虚线描边 |
| 静态组件 `background: var(--nvui-block-bg*)` | 11 | 半透明叠加层 |
| `box-shadow` 声明 | 4 | 2 个浮层 + 1 弹窗 + 1 主按钮光晕 |
| `@keyframes` 数量 | 1 | 仅 `nvui-spin` |
| `animation:` 引用 | 1 | 仅加载环 |
| `:active` 选择器 | 0 | 无按压反馈 |
| 硬编码 `outline: 2px solid var(--nvui-accent)` | 6 | focus ring 未令牌化 |
| `:focus-visible` 出现 | 7 | 含 1 处 `::before` 隔离 |
| `transition` 声明 | 9 | 全部颜色/位移，无高度/透明度 |
| `backdrop-filter` | 0 | 无玻璃 |
| `@supports` | 0 | 无能力检测 |
| `prefers-reduced-transparency` | 0 | 无透明度降级 |
| `forced-colors` | 0 | 无强制色彩适配 |
| `nvui-solid` | 0 | 无实心模式 |
| `animation-delay` | 0 | reduced-motion 未重置 |
| `toast` / `progress` / `skeleton` / `status-dot` | 0 / 0 / 0 / 0 | 反馈组件缺失 |
| `aria-live` / `role="status"` / `role="alert"` | 0 / 0 / 0 | 异步状态读屏不可感知 |
| 原始 px 字面量 | 58 | 尺寸 token 未全覆盖 |
| 深色令牌 / 浅色覆盖 | 84 / 41 | token 总量 84 唯一键 |
| 测试检查条数 | 86 | 复跑 86 PASS / 0 FAIL |

### 8.3 渲染级对比度验算（sRGB 逐通道混合 + WCAG 相对亮度）

```text
深色 status-time：text-2 #98a1b3 以 opacity 0.6 叠在 bg #161a24
  → rgb(100,107,122) / 对比度 3.25:1   （< 4.5，11px 小字不达 AA）
浅色 status-time：text-2 #4a5365 以 opacity 0.6 叠在 bg #f7f8fc
  → rgb(143,149,161) / 对比度 2.83:1   （< 4.5）
深色 status-file：opacity 0.85 → 5.22:1（达标）
浅色 status-file：opacity 0.85 → 4.97:1（达标）
浅色开关关闭态：轨道 rgba(15,23,42,.18) over #f7f8fc → rgb(205,208,214)
  轨道 vs 页面背景 = 1.46:1；白色滑钮 vs 轨道 = 1.55:1（均 < 3:1，非文本对比不足）
深色开关关闭态：轨道 rgb(55,60,73)（over #1c2130）
  轨道 vs 面板 = 1.45:1；滑钮 text-2 vs 轨道 = 4.24:1（由高对比滑钮补偿，可辨）
```

### 8.4 截图证据索引

| 截图 | 状态 | 用于证明 |
| :--- | :--- | :--- |
| `v1-dark.png` / `v1-dark-full.png` | 深色全页 | 盒子化布局、无玻璃、无动效、状态行可读性 |
| `v1-light.png` | 浅色全页 | 盒子感更强、浅色关闭态开关偏淡（AUD-11） |
| `v1-narrow.png` | 420px 窄屏 | 窄屏布局可用（v1 的优点）、响应式规则生效 |
| `v1-modal.png` | 弹窗打开态 | 遮罩只是压暗、弹窗为实心板（AUD-02）、无比入动画（AUD-03） |

### 8.5 v2.0.0 阶段 2 复核证据索引（本人独立产出，均在临时目录，不写入交付仓库）

**脚本与原始结果**（`C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\audit2\`）：

| 文件 | 用途 |
| :--- | :--- |
| `audit-calc.js` / `contrast-report.txt` | 独立重写 sRGB blend + WCAG 脚本：10 组玻璃合成、开关/焦点非文本对比、令牌计数 |
| `cdp-audit.js` / `cdp2-results.json` 等 | CDP 动态验证：17 档宽度/溢出、折叠高度采样、媒体特性模拟、solid/窄屏 computed、键盘 focus-visible、弹窗/吐司生命周期 |
| `cdp-audit2.js` / `cdp2-run.log` | 交互 1：折叠/弹窗/Esc/footer/toast/降级/solid/焦点 |
| `cdp-audit3.js` / `cdp3-run.log` | 交互 2：真实吐司堆栈生命周期、键盘 Tab focus-visible |
| `cdp-audit4.js` / `cdp4-run.log` | A/B 修复后复验：× 关闭按钮、三种降级下 subtle、solid 顺序 |
| `docs-check.js` / `docs-check.txt` | 静态一致性：107 token/CORE/README、67 类三方、六处版本、10.3 迁移、红线、编码/emoji |

**截图**（同目录）：`v2-dark-full.png`、`v2-light-full.png`、`v2-dark-glass.png`、`v2-light-glass.png`、`v2-dark-buttons.png`、`v2-dark-accordion.png`、`v2-solid-glass-section.png`、`v2-narrow-390-top.png`、`v2-narrow-390-mid.png`、`v2-modal-dark.png`、`v2-modal-dark-postfix.png`、`v2-toast-dark.png`（均逐张目检；修复前后弹窗截图 SHA256 一致，A 项为纯 DOM 属性修复、无视觉变化）。

---

## 9. v2.0.0 独立复核结果（阶段 2）

> 状态：**已完成（2026-10-17 22:07–22:25，v2 冻结版 + 22:16 受控回改）**。
> **最终结论：有条件通过**——无 P0/P1 未解决项；A/B/D 三项在复核期间发现并已修复、复验通过；C 与 AUD-12 为 Lead 决策接受的已知残余，不阻塞 v2.0.0 发布（详见 §9.6/§9.7）。

### 9.1 复核时点、冻结与复跑证据

| 时点 | 事件 | 证据 |
| :--- | :--- | :--- |
| 22:07 | Lead 通知 v2 ready，7 个交付文件冻结；开始阶段 2 | 初检 SHA256 前 16 位：tokens `3A08A28B9B08309B`、components `C610612294434A39`、preview `025AFC0D01934B63`、README `B7EE4BB7495A0A76`、CHANGELOG `ECC1220AD94990BF`、package `9F39887170F81518`、test `887621541A50EAE5` |
| 22:07 | 首轮复跑测试 | **169 PASS / 0 FAIL，exit 0** |
| 22:10–22:16 | 完成玻璃 AA、宽度、折叠、弹窗/吐司、降级、文档一致性独立验证；发现 A/B/D | 见 §9.2–§9.5 |
| 22:16:49–22:16:58 | Lead 受控回改：preview（A，`DD058DC552FDA93D`）、components（B，`979E1B3FED7C597D`）、test（D，`F3C536D641EDE679`） | tokens/README/CHANGELOG/package 哈希未变，证明只改了 3 个文件；A 为 1 个属性、B 为 3 处 selector、D 为 1 行注释 |
| 22:17 | 复验后复跑测试 | **169 PASS / 0 FAIL，exit 0**（断言未放宽） |
| 22:17–22:25 | A/B/solid/C 证据复验并回填本报告 | `cdp4-run.log`、`cdp4-results.json` |

环境事实（影响解读，非 v2 问题）：**本机 OS 为 `prefers-reduced-motion: reduce`**，不强制时 CSS 动画会被系统降级为 0.01ms；因此动画验证用 CDP `Emulation.setEmulatedMedia` 强制 `no-preference` 完成。静态截图取动画终态，不受影响。另：`.gitignore` 在 22:07:10 有一次非交付文件更新（不在 7 个交付文件内，测试仅校验其存在性，无影响）。

### 9.2 复核方法与独立证据

1. **测试复跑**两次（修复前/后），记录 PASS/FAIL 与退出码；另逐条对照契约 §7 清单确认新增检查不是「为通过而放宽」。
2. **独立对比度复算**：不调用测试代码，重写 `parseColor / blend / relLuminance / contrast`，复算 10 组玻璃合成（深/浅 × 最坏白/黑 × overlay+glass/strong、典型宿主）+ 开关（页面/弹窗玻璃/popover 玻璃 × 开关/关）+ 焦点环；结果见 §9.3 与 `contrast-report.txt`。
3. **CDP 动态验证**（自己编写 4 个脚本，非复用队友产出）：17 档 `Emulation.setDeviceMetricsOverride` 宽度实测、折叠高度逐帧采样、弹窗 ×/footer/Esc 三种关闭路径 + 焦点归还、吐司真实生命周期、`Emulation.setEmulatedMedia` 模拟三种降级、`.nvui-solid` 与窄屏 computed style、键盘 Tab focus-visible。
4. **静态一致性**：独立解析 tokens/test/CORE/README/preview/components，核对 107 令牌、47 浅色、67 类三方、六处版本、10.3 迁移表、红线、!important、keyframes、emoji/BOM。
5. **截图目检**：深/浅/实心/390 窄屏/弹窗/吐司/玻璃局部/按钮/折叠共 12 张 PNG，逐张用图像查看工具确认无溢出、无裁切、玻璃可读、扁平化到位。

### 9.3 阶段 1 问题清单复核（AUD-01 ~ AUD-15）

| 问题 | 阶段 2 状态 | 关键证据 |
| :--- | :--- | :--- |
| AUD-01 盒子化 | **已验证通过** | 独立规则解析：`.nvui-btn/.nvui-badge/.nvui-chip/.nvui-input/.nvui-tab/.nvui-acc-head` 基础规则无可见描边/投影/渐变；全文件 `border: 1px solid` 仅 8 处（4 处玻璃受光边 + ghost 例外 + 透明占位 + forced-colors 系统色）；行分隔/告警竖线为结构线保留；截图扁平 |
| AUD-02 无玻璃 | **已验证通过** | 6 类玻璃表面均 `backdrop-filter` + `-webkit-`（17/17 成对）；computed：overlay `blur(10px) saturate(1.4)`、modal `rgba(22,26,36,.72)` + `blur(18px)`、strong `.88`、radius 20px、1px `glass-line` 受光边、内高光阴影；截图可见背景磨砂 |
| AUD-03 动效单薄 | **已验证通过** | 14/14 keyframes 均被引用；折叠实测 0→20.67→68.55→86.55→…→98.19px（0.32s emphasized）；modal overlay-in/modal-in 与 -out 均实测；toast-in/out 实测；按钮/图标/开关/标签 `:active`/`nvui-tab-select`/弹簧存在；stagger delay 0.045s 实测 |
| AUD-04 focus ring 硬编码 | **已验证通过** | 6 处统一 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)` + offset token；0 处硬编码 px；Tab 实测 2px rgb(139,109,255) offset 2px |
| AUD-05 reduced-motion 缺 delay | **已验证通过** | 降级块含 `animation-delay: 0.01ms !important`；CDP reduce 下 stagger delay=`1e-05s`、iteration=1、live-dot iteration=1 |
| AUD-06 status 文字对比度 | **已验证通过** | 源码无 opacity；computed color text-2、opacity 1；玻璃最坏 4.79/4.64 ≥4.5；页面场景更高 |
| AUD-07 反馈组件缺口 | **已验证通过（含遗留项）** | toast/progress/skeleton/status-dot 全部实现+预览；toast role=status、真实进出场、DOM 移除、空栈关 dialog；**状态行/告警仍无 aria-live**（契约外，遗留建议 §6.11） |
| AUD-08 能力降级缺位 | **已验证通过（@supports 静态）** | 三降级块 + solid + 窄屏 blur 全部存在；reduced-transparency/forced-colors/solid 动态实测；subtle 缺口已由 B 修复并复验；`@supports not` 无法动态模拟，静态审查选择器 |
| AUD-09 文档矛盾/迁移缺口 | **已验证通过** | README 原则与实现一致（ghost 为唯一边框例外并已注明）；shadow-accent 已删；10.3 迁移表 8 项逐条与 v1→v2 实际差异核对一致；17 分区+附录；URL 参数实测；AUDIT 入表 |
| AUD-10 测试门禁缺口 | **已验证通过** | 169 条覆盖契约 §7 全部要求：CORE=107 显式+反向登记（防漏登记）、浅色 47、玻璃 AA 4 场景、14 关键帧全引用、focus token、折叠/进出场/新组件/降级、!important≤8、UTF-8/无 BOM/无乱码门禁；未见放宽。残余：源码级测试无法覆盖运行时交互（A 靠 CDP 发现） |
| AUD-11 开关非文本对比 | **条件通过** | 页面轨道 3.11/3.08、滑钮 4.73/3.27 达标（独立复算=测试值）；玻璃内最坏宿主轨道 2.86/2.77 <3 → Lead 接受为已知残余 C（§9.6-1） |
| AUD-12 尺寸 token 未全覆盖 | **条件通过（接受）** | 组件 px 字面量 58→65（新增组件引入），契约未要求全量 token 化，Lead 接受为遗留（§9.6-2） |
| AUD-13 弹窗焦点管理 | **已验证通过（文档级）** | README §2.3 含「记录触发元素/聚焦 `[data-autofocus]`/Tab 陷阱/关闭归还」可执行配方；preview 实测打开聚焦关闭按钮、关闭后焦点归还触发元素 |
| AUD-14 主按钮借用 knob | **已验证通过** | `--nvui-on-accent` 存在并入 CORE；主按钮引用它；无 `--nvui-knob` 借用 |
| AUD-15 预览无法自动验收 | **已验证通过** | `?theme=light`、`?solid=1` 实测生效（另有 `?modal=1`/`?toast=...` 自查参数）；四态截图可无人值守复现 |

### 9.4 降级链实测（含 B 修复前后对比）

CDP `Emulation.setEmulatedMedia` 强制三种媒体特性后的 computed style（`cdp4-run.log`）：

| 表面 | `prefers-reduced-transparency: reduce`（B 修复后） | `forced-colors: active`（B 修复后） | `.nvui-solid` |
| :--- | :--- | :--- | :--- |
| `.nvui-modal` | bg `rgb(22,26,36)` + none | none + 1px CanvasText 边框 + 无阴影 | bg `rgb(22,26,36)` + none |
| `.nvui-floating/.nvui-tooltip/.nvui-toast/.nvui-glass` | bg `rgb(28,33,48)` + none | none + CanvasText 边框 + 无阴影 | bg `rgb(28,33,48)` + none |
| **`.nvui-glass.is-subtle`（B 修复项）** | **修复前：rgba(.72) + blur(10px) 残留 → 修复后：bg `rgb(28,33,48)` + none** | **修复前：blur(10px) 残留 → 修复后：none + CanvasText 边框 + 无阴影** | bg `rgb(28,33,48)` + none（顺序未受影响） |
| `.nvui-overlay` | backdrop none（遮罩底色保留） | backdrop blur(10px) 仍保留（观察项，非文字表面） | backdrop none |

`@supports not` 回退：静态核对三处回退块选择器组均已含 `.nvui-glass.is-subtle`（`components.css:1293/1315/1329`，基础规则在 1250），specificity 相同且更靠后，可正确覆盖；该特性无法在 Chromium CDP 中动态模拟，故为静态审查结论。

### 9.5 复核期间发现并已修复 / 已接受的事项

| 编号 | 问题 | 处理 | 复验证据 |
| :--- | :--- | :--- | :--- |
| 阶段 2-A | preview 弹窗头部 × 按钮缺 `data-pv-close-modal`，点击无反应 | **已修复**（preview.html:2070 加属性，SHA `DD058DC5…`） | CDP：× 点击后 `is-closing`=true、overlay-out/modal-out 播放；500ms 后 hidden、dialog 关闭、焦点归还 opener；footer/Esc 无回归 |
| 阶段 2-B | `.nvui-glass.is-subtle` 未随三种降级回退（specificity 覆盖） | **已修复**（components.css 三处回退块补 selector，SHA `979E1B3F…`） | 见 §9.4；normal 模式仍为玻璃，solid 顺序不受影响 |
| 阶段 2-C | 关闭态开关轨道在「玻璃内 + 最坏宿主」下非文本对比 2.86/2.77 <3:1 | **Lead 接受为已知残余**（不修，理由：滑钮≥3.6、形状/位置/开态主色为主识别；修需新增轨道 token 且改变观感） | 独立复算数值；建议见 §9.6-1 |
| 阶段 2-D | test 头注释「深色 106」与 107 不符 | **已修复**（test-ui-kit.js:11 改 107，SHA `F3C536D6…`；仅注释） | 复跑 169/0 不变 |
| 观察-E | forced-colors 下 `.nvui-overlay` 的 backdrop-filter 未关闭 | 记录为低风险观察（遮罩无文字，UA 强制色下影响小） | §9.4 |
| 观察-F | preview 第 13 节「静态形态示意」吐司的 × 按钮无行为（明示静态示意） | 记录为演示细节，不作为缺陷 | 源码 1626-1633 |
| 观察-G | 本机 OS `prefers-reduced-motion: reduce` | 记录为验收环境注意事项（截图看不到动效属正常） | 见 §9.1 |

### 9.6 残余风险（已记录 / 已由 Lead 接受，不阻塞 v2.0.0）

1. **C：开关轨道在玻璃弹窗内、最坏宿主（深色纯白 / 浅色纯黑）下的非文本对比 2.86:1 / 2.77:1 < 3:1**（页面场景 3.11/3.08 达标，测试只覆盖页面场景）。Lead 决策接受。**后续建议**：未来加 `--nvui-switch-off-bg-on-glass`，或在玻璃容器内给开关轨道加 1px `--nvui-block-line-2` 描边/提高不透明度；若纳入测试，需在玻璃合成底色上验算轨道对比。
2. **AUD-12：尺寸令牌未全覆盖**。组件 px 字面量 58→65（新增 toast/progress/skeleton/status-dot 等引入），「改 token 整体缩放」仍只部分成立；Lead 接受为遗留。建议后续版本收敛 `--nvui-*` 尺寸并加测试防回退。
3. **状态行/告警无 live region**（AUD-07 剩余部分）：只有吐司有 `role="status"`；异步状态行/错误告警建议补 `aria-live="polite"`/`role="alert"`（已写入 §6.11 遗留建议）。
4. **`.nvui-glass.is-subtle` 直接叠最坏宿主时 text-2 仅 2.65:1**（深色纯白宿主）：README §7.2 已书面限定「is-subtle 只能用于底下已有遮罩/深色画布的场景」，属**使用约束而非缺陷**；测试未守护该使用场景，依赖文档约束。
5. **`@supports not` 无法动态验证**：Chromium CDP 不支持模拟 `backdrop-filter` 能力缺失，仅做静态选择器审查；Safari/旧 WebKit 的 `-webkit-backdrop-filter` 行为需目标真机验收。
6. **未在真实 SillyTavern 宿主内验证**：宿主 transform/inert/浅色主题联动等红线基于代码 + 文档审查（阶段 1 已声明同一局限）；建议 task-7 在真实宿主做一次冒烟。
7. **测试是源码静态门禁**：无法保证运行时交互（阶段 2 的 A 即靠 CDP 发现）；建议把 preview 关键交互（弹窗三路径、吐司生命周期、折叠）纳入轻量 CDP 冒烟脚本（§6.8 建议）。
8. **浏览器差异**：forced-colors 的实际渲染、`prefers-reduced-transparency` 的 Safari/新版 Chromium 支持差异需真机确认；本报告动态数字均来自本机 Edge（Chromium）无头环境。

### 9.7 最终结论

**有条件通过（v2.0.0 可发布，残余项均为 Lead 已接受的已知风险）**：

- **阻塞项零**：P0/P1 全部修复并复验；169/0 测试一致；玻璃 AA 核心卖点独立复算完全达标；扁平化/玻璃/动效三大目标经截图与 CDP 实测达成；降级链、折叠、弹窗/吐司、焦点环、七处一致性均验证通过。
- **条件**：§9.6 的 C 与 AUD-12 为 Lead 决策接受的已知残余；其余为使用约束/环境限制/后续建议，均不阻塞。
- 与阶段 1 对照：AUD-01/02/03（P1）**全部消除**；P2 除 AUD-11（条件通过）外全部通过；P3 中 AUD-13/14/15 通过、AUD-12 接受。
- 建议：task-7 收尾时在交付说明中引用本报告 §9.6；最终提交前再跑一次 `npm test` 并确认 §9.1 哈希未变。

---

## 10. 阶段 3：v2.0.1 修订复核（玻璃更透 / 动效补强 / 数字框 / 标签粘连指示器）

> 状态：**已完成（2026-10-17 22:57–23:10，v2.0.1 冻结版）**。
> **最终结论：有条件通过（v2.0.1 可发布）**——无阻塞项；187/0 测试、v2.0.1 AA 新口径、标签粘连/动效补强/数字框/玻璃观感/版本一致性均经独立复算与 CDP 实测通过；条件/残余见 §10.7（指示器为可选 JS 能力、强制动效仅演示、系统 reduce 红线、C/AUD-12 继承残余；原 P3 注释矛盾已在复核后修复并复验）。

### 10.1 冻结版本、新哈希与复跑

| 文件 | 大小 | mtime | SHA256（前 16） |
| :--- | ---: | :--- | :--- |
| `tokens.css` | 16,190 B / 308 行 | 22:29:44 | `9FBEC6EF6027A7A4` |
| `components.css` | 51,082 B / 1,795 行 | 23:01:50 | `34D82FD189926547`（复核后注释级回改，见下） |
| `preview.html` | 145,418 B / 2,871 行 | 22:48:54 | `298C22784626EC48` |
| `test/test-ui-kit.js` | 75,691 B / 1,290 行 | 22:48:18 | `5C43EB7AC9A465A0` |
| `README.md` | 98,461 B / 1,261 行 | 22:48:15 | `30AD372F6D2DE97B` |
| `CHANGELOG.md` | 11,780 B / 132 行 | 22:48:22 | `93FB656323A6FD4D` |
| `package.json` | 529 B / 20 行 | 22:33:56 | `B80E7265412579A9` |

- 冻结核对：复核开始时 7 个交付文件哈希与 Lead 冻结值一致；复核结束时其中 **6 个交付文件哈希未变**（tokens `9FBEC6EF…`、preview `298C2278…`、test `5C43EB7A…`、README `30AD372F…`、CHANGELOG `93FB6563…`、package `B80E7265…`），`.gitignore` `9298EF7D…` 未变；仅 `AUDIT.md` 由本审核更新。
- **复核后受控回改（23:01:50，仅注释级）**：Lead 修复本报告 §10.7-1 的 P3 注释矛盾，`components.css` 只改 2 处注释（§8 标签页说明改为「v2.0.1 起可选 `.nvui-tabs-indicator` 粘连滑动指示器 / 未接入时自动回退按钮自身高亮」；文件头组件清单「标签页」→「标签页（可选粘连指示器）」），**规则、选择器、取值零变化**（独立核对：16 关键帧、17 对 backdrop、3 处 indicator 选择器等均不变）。文件 50,928→51,082 B、行数 1,794→1,795（纯注释文本变化），新 SHA16 `34D82FD189926547`；回改后本审核独立复跑 `node test/test-ui-kit.js` → **187 PASS / 0 FAIL，exit 0**。
- 复跑 `node test/test-ui-kit.js`：**187 PASS / 0 FAIL，exit 0**（v2.0.0 为 169 条，v2.0.1 新增 18 条，断言未放宽；新增覆盖见 §10.6）。
- 环境事实：**本机 OS 为 `prefers-reduced-motion: reduce`**。默认打开 preview 时 kit 按无障碍红线把全部动画降为 `0.01ms`（含 `animation-delay` / `iteration-count` / `transition`），**这是预期行为，不是回归**。动效类验证通过 preview 的「强制播放动效」/`?motion=1` 或 CDP `Emulation.setEmulatedMedia` 强制 `no-preference` 完成；截图取静态终态，不受影响。

### 10.2 独立复算 v2.0.1 AA（契约 §13.2；自写 sRGB blend/WCAG，不调用测试代码）

| 场景（最坏宿主） | 合成底色 | text | text-2 | 判定 |
| :--- | :--- | ---: | ---: | :--- |
| 深色弹窗级：`#ffffff` → overlay 0.62 → glass 0.64 | `rgb(50.3,53.3,61.0)` | **10.33** | **4.70** | 双 AA 达标，与契约一致 |
| 深色 popover 级：`#ffffff` → strong 0.80 | `rgb(68.6,71.8,79.8)` | **7.76** | 3.53 | **只承诺正文 AA**（3.53 与契约一致，故 popover 正文统一 `--nvui-text`） |
| 浅色弹窗级：`#000000` → overlay 0.30 → glass 0.78 | `rgb(199.9,200.4,201.7)` | **9.31** | **4.64** | 双 AA 达标，与契约一致 |
| 浅色 popover 级：`#000000` → strong 0.80 | `rgb(204,204,204)` | **9.66** | **4.81** | 双 AA 达标，与契约一致 |
| 参考：浅色弹窗级 + 典型深色宿主 `#161a24` | `rgb(203.3,204.4,207.2)` | 9.70 | 4.83 | 与 README 参考口径一致 |

- 与契约 §13.2 参考值误差均 ≤0.01（要求 ±0.02）。
- 政策落地核对：`.nvui-floating` / `.nvui-tooltip` / `.nvui-toast` / `.nvui-glass` 基础规则 `color` 均为 `var(--nvui-text)`（tooltip 已从 text-2 改 text）；preview 的 `.pv-on-glass` / `.pv-toast-text` / `.pv-mini-title` 也同步为 `--nvui-text`。CDP computed：四类 popover 玻璃 `color: rgb(233,236,243)`。

### 10.3 CDP 实测：标签页「粘连」指示器（stretch-then-settle + spring）

方法：`?motion=1` 强制动效，点击 tab2 后逐帧（rAF）采样指示器 `getBoundingClientRect` 与 `--nvui-tab-ind-*`。

| 帧 | 指示器 left / width | `--nvui-tab-ind-w` | 说明 |
| ---: | :--- | :--- | :--- |
| 初始 | 194.5 / 50 | 50px | 与 tab1 对齐（dLeft=0，dW=0，dH=-0.19px） |
| 点击后 frame0 | 194.5 / 50 | **104px** | 写入 union（tab1.left 194.5 → tab2.right 298.5 = 104px） |
| frame1 | 194.5 / **67.98** | 50px | **可见拉伸态**（右缘 262.48 越过 tab1 右缘 244.5，伸入标签间隙），随后 2 帧内收缩 54.19→50.95→50.16 |
| frame5–12 | left 233.56 → **253.78** | 50px | 向 tab2（left 248.5）滑动，**spring 过冲 5.28px** |
| frame13–21 | left 253.55 → **248.5** | 50px | 回弹并稳定；最终 `left=248.5 / width=50` 与 tab2 完全一致 |

- tab2 切换后：`.nvui-tabs.is-indicator` 生效、指示器 `opacity:1`、active 按钮 `background: transparent` 且 `animation: none`；`tabpane#pv-pane-2` computed `animation-name: nvui-tabpane-in`。
- tab3 点击 → 指示器最终 310/50 对齐；键盘 `ArrowRight`（tab2→tab3）→ `aria-selected [false,false,true]`、`tabindex [-1,-1,0]`、指示器对齐 310/50；resize / `document.fonts.ready` 重算路径已在代码中确认。
- 无 JS 回退：未加 `is-indicator` 时指示器默认 `opacity:0` 不显示，按钮自身 `is-active` 高亮 + `nvui-tab-select` 保留（CSS 静态验证，README §7.7 有说明）。
- 窄屏 390：指示器与 active tab 对齐（dLeft=0 / dW=0），`indRight 204 < navRight 344`、`scrollWidth==clientWidth=298`，无横向滚动。
- 截图目检：`task14/sec08-tab1.png`、`sec08-tab2-midstretch.png`、`sec08-tab2-settled-motion.png`（+ 本审核自摄 `audit2/v201/sec08-tab1-motion.png` / `sec08-tab2-settled-motion.png`）。

### 10.4 CDP 实测：动效补强（16 关键帧）与降级/强制模式

| 项目 | 默认（系统 reduce） | 强制动效（`?motion=1`） | 结论 |
| :--- | :--- | :--- | :--- |
| tabpane 入场 | `nvui-tabpane-in`，0.00001s / delay 0.00001s / iter 1 | `nvui-tabpane-in`，0.32s（preview 演示覆盖统一为 slow；kit 原生为 base 0.2s） | 通过 动画存在且可播放 |
| 开关勾选回弹 | `nvui-switch-on`，0.00001s | `nvui-switch-on`，0.32s spring | 通过 |
| 开关按压拉伸 | —（降级） | 按住时 input `matrix(0.9707…)`（趋向 0.96）、`::after` `matrix(1.11485,0,0,1,15,0)`（**scaleX≈1.115，目标 1.12**，勾选态叠加 translateX 15） | 通过 iOS 风格拉伸实测 |
| 进度条扫光 | `nvui-shimmer`，0.00001s | `nvui-shimmer` 1.4s **infinite**，`::after` transform 矩阵持续变化 | 通过 |
| 不确定进度 | `nvui-progress-indeterminate`，0.00001s | 1.4s infinite；关键帧含 `scaleX(0.6→1→0.8)` 呼吸（静态核对） | 通过 |
| 折叠高度 | transition 0.01ms | 采样 0→59.47→84.28→95.03→97.31→98.19→…→0（真实高度动画） | 通过 |
| 弹窗进出场 | 0.00001ms | 入场 `nvui-overlay-in` / `nvui-modal-in` 0.32s；关闭 `nvui-overlay-out` / `nvui-modal-out`；hidden+close+焦点归还 | 通过 |
| 循环动画恢复 | 全部 iter 1 | spinner 0.8s / skeleton 1.4s / progress 1.4s / status-dot 1.8s，均 infinite | 通过 |
| 「强制播放动效」开关 | `body.pv-force-motion=false`，提示文案显示（reduce） | 按钮切换类 + `?motion=1` 均可；`pv-motion-note` 文案正确 | 通过 默认不生效、仅演示 |

16 个关键帧（spin / fade-in / slide-up / pop-in / overlay-in/out / modal-in/out / toast-in/out / tab-select / tabpane-in / switch-on / shimmer / progress-indeterminate / pulse）全部定义、全部被 `animation:` 引用、全部只改 opacity/transform 等合成友好属性（测试 + 独立静态核对）。

### 10.5 CDP 实测：玻璃 computed、数字框与宽度

- **玻璃外观 computed**（`?motion=1`，深色）：`.nvui-glass` / `.nvui-floating` / `.nvui-toast.pv-toast-static` / `.nvui-tooltip.pv-tooltip-static` 一致为
  `background rgba(22,26,36,0.8)`、`border 1px rgba(255,255,255,0.06)`、`backdrop-filter blur(20px) saturate(1.5)`、`color rgb(233,236,243)`、阴影含 `inset 0 1px 0 rgba(255,255,255,0.04)`；弹窗 `rgba(22,26,36,0.64)` + blur 20px + radius 20px。
- **数字框**：`.nvui-input[type="number"]` computed `appearance: textfield`（+`-webkit-`），`::-webkit-inner/outer-spin-button` 隐藏规则在位；截图 `sec07-input.png` 中数值框不再出现白色步进箭头（键盘/滚轮调值属原生行为保持不变）。
- **宽度**：CDP `Emulation.setDeviceMetricsOverride` 1440→320 共 14 档，`docScrollWidth == innerWidth` 全部成立；唯一被检测为「越界」的元素是动画中的 `.nvui-progress-bar`（其父 `.nvui-progress` 有 `overflow:hidden` 裁剪，且文档无横向滚动 → 属检测器对动画 transform 的误报，非真实溢出）；390 窄屏无溢出。
- **降级链**（继承阶段 2 已验证）：v2.0.1 未改动 `@supports not` / `prefers-reduced-transparency` / `forced-colors` / `.nvui-solid` / 窄屏 blur 的选择器与回退逻辑，仅玻璃取值变化；`prefers-reduced-motion` 降级块（含 `animation-delay`）保持原位。`@supports not` 仍无法用 CDP 动态模拟，仅静态审查（同 §9.6-5）。
- 截图目检（抽查 8 张）：`task14/sec08-tab1|tab2-midstretch|tab2-settled-motion`、`sec09-accordion-motion`、`modal-motion-open`，`v201/sec07-input-dark`、`sec12-progress-dark`、`sec13-toast-dark`、`sec14-float-dark`，`final/dark|light|solid` 全页；结论：玻璃更透、受光边几乎不可见（不再突兀）、文字可读、动效可观察。

### 10.6 版本 / 文档 / 一致性独立核对

- **版本六处 2.0.1 全一致**：package.json、tokens.css 头、components.css 头、README 标题、CHANGELOG 最新条目、preview 标题+徽标（`UI Kit v2.0.1` / `>v2.0.1<`）。
- **令牌**：107 个唯一令牌 = test CORE 107（无增删；`--nvui-tab-ind-*` 为 JS 运行时几何变量，已由测试显式列为 RUNTIME_VARS，不冒充设计令牌）；浅色覆盖 47；README 全覆盖。
- **类名**：68 个（53 保留 + 14 v2 新增 + `nvui-tabs-indicator`），components/preview/README 三方齐全；`.nvui-tabs-indicator` 为第 68 类。
- **关键帧**：16 个全部定义/引用；README §6.4.4 与 §7.17 清单一致。
- **文档**：README §2.6（动效降级与强制演示开关）、§4.4（v2.0.1 AA 新口径 + popover 政策）、§7.7（indicator DOM + stretch-then-settle JS 配方 + 无 JS 回退）、§10.4（v2.0.0→v2.0.1 修订）、§11 版本记录均存在且与实现一致；CHANGELOG v2.0.1 覆盖玻璃/动效/数字框/AA 政策/指示器/演示开关；package.json 2.0.1。
- v2.0.1 未改变静态扁平规则、宿主红线、focus ring token、!important 预算（≤8）、无硬编码颜色、backdrop `-webkit-` 成对（17/17）、无 emoji/BOM/U+FFFD/外链。

### 10.7 阶段 3 新发现与残余风险（均不阻塞）

1. **（P3，已修复：注释级，无行为变化）** `components.css` 第 593 行段注释曾写「不做滑动指示器（Kit 无 JS 运行时）」，与 v2.0.1 新增的可选 `.nvui-tabs-indicator` 矛盾。Lead 已在 23:01:50 修复：§8 标签页注释改为「v2.0.1 起可选 `.nvui-tabs-indicator` 粘连滑动指示器（stretch-then-settle JS 配方见 README §7.7；未接入时自动回退按钮自身高亮）」，文件头组件清单补「标签页（可选粘连指示器）」。仅注释文本变化（新 SHA16 `34D82FD189926547`），本审核复核后测试仍 187/0，规则无变化。
2. **（设计约定）指示器为可选 JS 能力**：不接入 JS / 不加 `is-indicator` 时不出现滑动，回退为按钮自身高亮；stretch-then-settle 需业务按 README §7.7 配方接入。这不是缺陷，但集成方需知晓（README 已写明）。
3. **（环境红线）系统 reduce 下默认看不到动效**：本机即如此；kit 的 0.01ms 降级是无障碍红线，**不是回归**。「强制播放动效」/`?motion=1` 仅 preview 演示，生产不得复制。preview 的演示覆盖会把所有 `animation-duration` 统一为 `--nvui-duration-slow`（如 tabpane 原生 0.2s→0.32s），仅影响演示观感。
4. **（继承）C：开关关闭态轨道在玻璃内最坏宿主** 2.84:1（深）/ 2.77:1（浅）仍 <3:1（v2.0.1 玻璃更透后由 2.86 微降），Lead 已接受；后续建议见 §9.6-1。
5. **（继承）AUD-12 尺寸 token 未全覆盖**：components px 字面量 65→71（新增指示器与演示相关数值），仍属遗留建议。
6. **（继承/使用约束）`.nvui-glass.is-subtle` 直叠最坏宿主**进一步变差（深色纯白：text 4.42、text-2 2.01）；README §7.2 已限定仅用于「已有遮罩/深色画布」，属使用约束；若未来放宽使用需重新验算。
7. **（环境/兼容）** 未在真实 SillyTavern 宿主验证；`@supports not` 无法 CDP 动态模拟；Safari/旧 WebKit 的 `-webkit-backdrop-filter` 与 forced-colors 实际渲染需真机复核；本报告动态数字均来自本机 Edge（Chromium）无头环境。
8. **（继承）状态行/告警仍无 live region**（AUD-07 剩余部分），v2.0.1 未处理，保留为遗留建议。

### 10.8 阶段 3 验收矩阵与结论

| # | 验收项 | 结果 | 证据 |
| :--: | :--- | :--- | :--- |
| 1 | 回归测试 | **已验证**：187 PASS / 0 FAIL，exit 0；新增 18 条未放宽 | §10.1 |
| 2 | v2.0.1 AA 独立复算 | **已验证**：10.33/4.70、7.76（popover 仅正文）、9.31/4.64、9.66/4.81，误差 ≤0.01 | §10.2 |
| 3 | 标签粘连指示器 | **已验证**：union 104px→渲染 67.98px 拉伸→spring 过冲 5.28px→对齐 248.5；点击/键盘/窄屏/无 JS 回退 | §10.3 |
| 4 | 动效补强与降级 | **已验证**：tabpane-in / switch-on / 按压拉伸 / 进度扫光 / 不确定呼吸 / 折叠 / 弹窗 全部实测；reduce 下正确降级；强制模式恢复 | §10.4 |
| 5 | 玻璃观感与 computed | **已验证**：四类 popover 玻璃 bg 0.80 / border 0.06 / blur 20 / sat 1.5 / 正文 text；截图描边不再突兀 | §10.5 |
| 6 | 数字框 spinner 隐藏 | **已验证**：computed appearance textfield + 隐藏规则 + 截图无白色箭头 | §10.5 |
| 7 | 宽度无横向溢出 | **已验证**：1440→320 共 14 档 `docScrollWidth==innerWidth`；动画中 progress-bar 越界为父级 overflow 裁剪的检测误报 | §10.5 |
| 8 | 版本/文档/一致性 | **已验证**：六处 2.0.1、107 令牌、68 类三方、16 关键帧、README §2.6/§7.7/§10.4、CHANGELOG/package 一致；无 emoji/BOM/外链 | §10.6 |

**结论：有条件通过（v2.0.1 可发布）**。阻塞项为零；§10.7 中所列为已记录/已接受的残余与环境限制（其中第 1 条 P3 注释矛盾已在复核后修复并复验，不属功能缺陷）。复核后受控回改仅 `components.css` 注释（新 SHA16 `34D82FD189926547`，其余 6 个交付文件哈希未变），独立复跑仍 **187 PASS / 0 FAIL**，结论不变。建议 task-13 收尾：最终 `npm test`（应为 187/0）、引用本报告 §10.7、以 §10.1 的最终哈希为准（components.css = `34D82FD189926547`）。

**阶段 3 证据路径**：脚本/结果 `C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\audit2\`（`v201-cdp.js` / `v201/cdp-v201.log` / `v201/cdp-v201-results.json` / `indicator-frames.js` / `v201/indicator-frames.json` / `v201-docs-check.js` / `v201/docs-check-v201.txt`）；截图 `...\ui-kit-v2\task14\`、`...\v201\`、`...\final\` 及本审核补充的 `...\audit2\v201\`。

---

## 11. 阶段 4：v2.1.0 面板布局标准复核（桌面居中面板 / 手机底部抽屉）

> 状态：**已完成（2026-10-17 23:18–23:35，v2.1.0 冻结版 + 23:21/23:22 受控修复）**。
> **最终结论：有条件通过（v2.1.0 可发布）**——无阻塞项；197/0 测试、桌面/手机布局几何、导航双向同步、单一滚动层、宽度全扫描、版本/文档一致性全部经独立 CDP/静态实测通过；复核期间发现并推动修复 1 项 P3（底部导航文字色 AA/政策不一致），已复验。残余见 §11.9。

### 11.1 冻结版本、新哈希与复跑

| 文件 | 大小 / 行数 | mtime | SHA256（前 16） |
| :--- | ---: | :--- | :--- |
| `tokens.css` | 16,608 B / 312 行 | 23:11:34 | `63F35574F3EFD4DF` |
| `components.css` | 59,997 B / 2,067 行 | 23:21:48 | `BA78522B24E39135`（复核后受控修复，见下） |
| `preview.html` | 176,252 B / 3,410 行 | 23:16:49 | `48123FA8581252F4` |
| `README.md` | 123,854 B / 1,585 行 | 23:22:05 | `01CD95E7C2D522E9`（复核后受控修复，见下） |
| `CHANGELOG.md` | 14,531 B / 163 行 | 23:14:45 | `93BCE6F838A517C5` |
| `package.json` | 529 B / 20 行 | 23:14:45 | `E63C398005089E51` |
| `test/test-ui-kit.js` | 83,983 B / 1,394 行 | 23:14:23 | `261EEB7431D25376` |

- 初次冻结（23:11–23:16）：components `9F17086D337FC750`（59,770 B）、README `D85CDD85B0FC7087`（123,662 B），其余 5 个交付文件与本表一致。
- **复核后受控修复（23:21:48 / 23:22:05）**：仅底部导航文字色 2 行 CSS（inactive `text-3`→`text-2`、active `accent-2`→`text`，保留 accent-bg 淡底）+ 2 行注释，以及 README §12.4 两行同步说明。components `59,770→59,997 B`、`2,064→2,067 行`；README `123,662→123,854 B`。其余 5 个交付文件哈希未变（tokens `63F35574…`、preview `48123FA8…`、test `261EEB74…`、CHANGELOG `93BCE6F8…`、package `E63C3980…`），`.gitignore` 未变。
- 复跑 `node test/test-ui-kit.js`：复核开始与受控修复后两次均 **197 PASS / 0 FAIL，exit 0**（v2.0.1 的 187 条 → +10 条，断言未放宽；新增面板布局红线见 §11.8）。
- 编码插曲：修复过程中一次写文件带入 BOM，被测试的「UTF-8 无 BOM」守卫拦截并已去 BOM；最终 7 个文件均无 BOM / U+FFFD（本审核独立复核，见 §11.8）。

### 11.2 桌面 1440×900 CDP 实测（`?panel=1`）

| 项目 | 实测值 | 判定 |
| :--- | :--- | :--- |
| overlay | rect 1440×900、`align-items:center`、`justify-content:center`、`padding:16px` | 符合 |
| panel | **880×650.81**、x=280、**中心偏移 dx=0 / dy=0（水平+垂直居中）**、`max-height:792px`（=88vh）、`border-radius:20px`、玻璃 `rgba(22,26,36,0.64)` + `blur(20px) saturate(1.5)`、`overflow:hidden`、flex column | 符合；高度由内容驱动（< 最大高度） |
| 顶部 tabs | `display:flex`、5 个 `role=tab`、active=设置、指示器对齐（dLeft=0 / dW=0） | 符合 |
| sheet-handle / bottom-nav | 均 `display:none`（rect 0） | 符合桌面规则 |
| 内容结构 | header：标题 + **2 个 icon-btn**；panel-heading：「设置」+ `v2.1.0` badge；`is-feature` 行：`border-left:2px solid rgb(139,109,255)` + `block-bg`；**6 个折叠分组**；可选 footer（取消/保存） | 符合排列标准 |
| panel-body | `overflow-y:auto`；1440×900 下内容恰好放下（scrollHeight=clientHeight=494）——矮视口另测见 §11.5 | 符合 |
| 页面滚动/溢出 | 页面 body `overflow:visible`、可滚动；`docScrollWidth=1440==innerWidth` | 无横向溢出 |
| 焦点 | 打开后焦点在 `#pv-panel-close` | 符合 |

截图：`task18\desktop-panel-1440.png`、`desktop-panel-tab2.png`、`desktop-panel-light-1440.png`；本审核自摄 `audit2\v210\panel-desktop-1440(-postfix).png`。

### 11.3 手机 390×844 CDP 实测（`?panel=1`，同一 DOM）

| 项目 | 实测值 | 判定 |
| :--- | :--- | :--- |
| overlay | `align-items:flex-end`、`padding:0` | 底部对齐 |
| panel | **390×650.63、x=0、bottom=844（贴视口底）**、`max-height:776.48px`（=92dvh）、`border-radius:20px 20px 0 0`、底边框 0 | 底部抽屉 |
| sheet-handle | `display:block`、**40×4**、居中 x=175、`aria-hidden="true"` | 符合 |
| 顶部 tabs | `display:none` | 符合 |
| bottom-nav | `display:flex`、5 项、rect bottom=844、高 55px、`padding-bottom:4px`（声明含 `env(safe-area-inset-bottom)`）；**项高 46px**（README ≥44px 声明成立） | 符合 |
| 横向溢出 | `docScrollWidth=390==innerWidth`；页面 body `overflow:visible` | 无溢出 |
| 焦点 | 打开后焦点在 `#pv-panel-close` | 符合 |

截图：`task18\mobile-sheet-390.png`、`mobile-sheet-roles-390.png`；本审核自摄 `audit2\v210\panel-mobile-390(-postfix).png` 与浅色版。

### 11.4 导航同步、开合与断点扫描

- **桌面 tab → 状态**：点击「渠道」→ `is-active`/`aria-selected=true`/对应 tabpane 显示；隐藏的 bottom-nav 同步 `is-active` 且 `aria-current="page"`；`tabindex` 为 `[0,-1,-1,-1,-1]`。
- **桌面 bottom-nav → 状态**（JS 直接触发隐藏按钮）：点击「图库」→ tabs active=图库、`aria-selected` 正确、tabpane=gallery、bottom-nav active/current=gallery —— **双向同步成立**。
- **手机 bottom-nav → 状态**：点击「历史」→ tabs active=history（隐藏）、tabpane=history、`aria-selected[false,false,false,true,false]`、`aria-current=history`。
- **同一份状态跨断点**：手机切到「历史」后 `setDeviceMetricsOverride` 回 1440 → tabs 显示、bottom-nav 隐藏，active tab/nav/pane 仍是 history，顶部 indicator 对齐（dLeft=0/dW=0）—— 证明「同一份 DOM/同一份状态」。
- **开合**：× 关闭 → overlay hidden、dialog.close；重新打开焦点回 `#pv-panel-close`；`?panel=1` 自动打开时 opener=null，关闭后焦点回 body（预期行为）；Esc/点遮罩与按钮开合共用 modal 的 `createOverlayLayer` 配方（阶段 2 已验证）。
- **断点扫描**（CDP 真机宽度）：1440/1024/768 为桌面（panel 880/880/736 居中、tabs flex、nav none）；600/599/480/420/390/360/320 为手机（panel 全宽、底部对齐、tabs none、nav flex）；全部 `docScrollWidth==innerWidth`，**断点严格 ≤600px**。

### 11.5 单一滚动层与页面滚动（矮视口下强制出现滚动）

| 视口 | panel 高度 | panel-body | 独立滚动验证 | 页面滚动 |
| :--- | :--- | :--- | :--- | :--- |
| 1440×560 | 492.8px（=88vh） | client 336 / scroll 494，`overflow-y:auto` | `body.scrollTop=120` 生效，`window.scrollY` 保持 0 | `window.scrollTo(0,150)` 生效（页面未锁滚动） |
| 390×500 | 460px（=92dvh） | client 295 / scroll 486，`overflow-y:auto` | 同上（面板内滚动不影响页面） | 页面可滚动 |

—— 与 README「只有 `.nvui-panel-body` 滚动、面板其它区域固定、页面本身不锁滚动」一致；`.nvui-panel` 自身 `overflow:hidden`。

### 11.6 与用户参考图的排列结构对照

> 说明：原始参考图未随任务下发到本机可访问路径（已检查 TEMP/工作区），本审核以**契约 §14.2 与 README §12 记录的排列标准**（即已从参考图提炼的结构）为准，逐项核对 DOM 顺序、计算布局与截图；**未做像素级图像对照**，这是本轮对照的客观限制。

| 参考结构项 | v2.1.0 实现证据 | 结论 |
| :--- | :--- | :--- |
| 顶部标题栏：标题 + 次级操作 + 关闭 | `.nvui-panel-header`：`.nvui-panel-title`（fs-2xl 粗体）+ `.nvui-panel-actions` 内 2 个 `.nvui-icon-btn`（快速设置 / 关闭，均 aria-label） | 一致 |
| 分区导航位置：电脑顶部 / 手机底部 | 桌面 `.nvui-tabs`（5 个 role=tab + 粘连指示器）；手机同位置换成 `.nvui-bottom-nav`（5 项：图标+中文短标签），顶部 tabs `display:none`；两套互斥、同一份状态 | 一致 |
| 可滚动内容区：分区标题 + 版本徽标 | `.nvui-panel-body` 内 `.nvui-panel-heading`：「设置」+ `v2.1.0` badge，flex 两端对齐 | 一致 |
| 高亮功能开关行 | `.nvui-switch-row.is-feature`：左侧 2px 主色竖条 + `block-bg` 淡底 + 标题 semibold（截图可见） | 一致 |
| 折叠列表 | 内容区 6 个 `.nvui-acc`（基本设置/副 API/自动生成 tag/排除角色/排除世界书/自定义提示词），每条带右侧当前值摘要 + 展开高度动画 | 一致 |
| 底部操作区（可选） | `.nvui-panel-footer`：取消 / 保存，右对齐；README 说明纯浏览面板可省略 | 一致（可选） |
| 同一 DOM 兼容电脑/手机 | 仅靠 600px 媒体查询切换，无第二套 HTML；跨断点状态保持已实测 | 一致 |
| 皮肤：只参考排列、不复刻参考图 | 视觉全部使用 Kit Flat Glass：紫色 accent `#8b6dff`、玻璃 `rgba(22,26,36,0.64)`、扁平列表、统一焦点环；**未出现参考图的青色/他插件皮肤**（深/浅/手机截图目检） | 一致 |

截图（目检）：`task18\desktop-panel-1440.png`（桌面深色）、`task18\desktop-panel-light-1440.png`（浅色）、`task18\mobile-sheet-390.png`（手机底部抽屉）、`task18\mobile-sheet-roles-390.png`（手机「角色」分区 + 底部导航激活态）、`task18\section18-1440.png`（第 18 节结构说明）。

### 11.7 本轮发现与修复：底部导航文字色（P3，已修复并复验）

- **发现**：`.nvui-bottom-nav-item` 原未激活色为 `--nvui-text-3`、激活色为 `--nvui-accent-2` on `--nvui-accent-bg`。独立复算（sRGB 合成）：深色最坏宿主（纯白）面板底 `rgb(50,53,61)` 下未激活 **3.38:1**、激活 **4.23:1**；浅色最坏宿主（纯黑）下 **3.37:1 / 3.53:1**，均 <4.5；且与 README §4.4「`--nvui-text-3` 不承载玻璃上的信息」自相矛盾（典型深色宿主下约 4.96 / 6.16 可通过，属最坏宿主+语义一致性问题）。
- **修复**（Lead，23:21:48 / 23:22:05）：未激活 → `--nvui-text-2`；激活 → `--nvui-text`（保留 `accent-bg` 淡底作为选中指示）；README §12.4 两行同步说明「玻璃上保证 AA，勿用 text-3 / 主色文字」；2 行注释说明政策。
- **复验**（CDP computed）：深色手机未激活 `rgb(152,161,179)`（=text-2）、激活 `rgb(233,236,243)`（=text）+ `rgba(139,109,255,0.14)` 底；浅色未激活 `rgb(74,83,101)`（=浅色 text-2）、激活 `rgb(31,36,48)`（=浅色 text）。独立复算最坏宿主：未激活 **4.70 / 4.64**，激活 text on accent-bg **8.79 / 8.17**，均 ≥4.5；顶部 tabs（未激活 text-2 / 激活 text + indicator）与其他区域未受影响。截图已重拍（postfix）。

### 11.8 版本 / 文档 / 一致性（独立静态核对）

- **版本六处 2.1.0 全一致**：package.json、tokens.css 头、components.css 头、README 标题、CHANGELOG 最新条目、preview 标题+徽标（`UI Kit v2.1.0` / `>v2.1.0<`）。
- **令牌**：**109** 个唯一令牌 = test CORE 109（新增 `--nvui-panel-width: 880px`、`--nvui-panel-max-h: 88vh`）；浅色覆盖 47；README 全覆盖。
- **类名**：**78** 个（+10 panel 类），components/preview/README 三方齐全；状态类 `overlay.is-panel`、`switch-row.is-feature`、`bottom-nav-item.is-active` 在文档化。
- **关键帧**：16 个全部定义/引用（v2.1.0 未新增/删除关键帧）。
- **文档**：README 新增 **第 12 章**「SillyTavern 插件面板布局标准（桌面 / 手机）」、许可顺延 **第 13 章**、新增 `### 10.5 v2.0.1 → v2.1.0`、计数 109/78、§12.4 文字色说明；CHANGELOG v2.1.0（新增面板标准，**无破坏性变更**）；package.json 2.1.0；preview 第 18 节 + `?panel=1` + 面板 demo。
- **红线**：components 无硬编码颜色；`backdrop-filter` 与 `-webkit-` **18/18 成对**（v2.1.0 的 `.nvui-panel` 是第 7 类玻璃表面，新增 1 对）；`!important` 7 处且白名单内；focus ring 6 处统一 token、0 硬编码 px；无 emoji / BOM / U+FFFD / 外链 / 父目录引用；`.gitignore` 未变。
- **静态检查说明**：本审核自写 51 项一致性检查中 49 项 PASS；另有 2 项 FAIL 为**审核脚本沿用 v2.0.1 预期**（backdrop 计数 17→18、bottom-nav 激活色 accent-2→text）导致的过期断言，人工复核后确认实现正确，非项目问题。

### 11.9 阶段 4 残余风险（均不阻塞 v2.1.0）

1. **面板高度由内容驱动**：桌面实测 650.81px（最大 792）、手机 650.63px（最大 776.48），未强制撑满最大高度——符合「最大高度」语义；若产品希望固定高度，需业务侧设置 `height`。
2. **面板/抽屉没有独立进出场动画**：沿用 overlay 的淡入淡出（`.nvui-overlay-in/out`），抽屉无上滑、桌面 panel 无缩放入场；建议 v2.1.1 评估补 `nvui-panel-in` / sheet-up（本版未要求）。
3. **拖拽把手为纯视觉元素**（`aria-hidden`），真正的拖拽/下滑关闭由业务 JS 实现（README 已写明）；preview demo 未实现拖拽，Esc/遮罩/按钮关闭已具备。
4. **焦点陷阱未内建**（kit 无 JS 运行时）：README §2.3/§12.9 提供配方，preview demo 实现了打开移入 + 关闭归还，但未实现完整 Tab 陷阱；生产接入需业务按配方处理。
5. **safe-area 仅静态+声明级验证**：`env(safe-area-inset-bottom)` 已进入 bottom-nav `padding-bottom`，无头环境 env=0，无法验证真实刘海屏数值；需真机验收。
6. **`.nvui-bottom-nav-item` 样式定义在 ≤600px 媒体查询内**（桌面 bottom-nav `display:none`）：消费方不要手动在桌面显示 bottom-nav，否则无样式；属设计约束。
7. **原始参考图未下发到本机可访问路径**：排列对照以契约 §14.2 / README §12 记录的结构为准（见 §11.6），未做像素级对照；未发现结构偏差。
8. **继承**：未在真实 SillyTavern 宿主验证；状态行/告警 live region 仍缺（遗留建议）；AUD-12 尺寸 token 未全覆盖，components px 字面量 71→81（面板尺寸字面量增加，继续作为遗留）。
9. **底部导航标签 10px 偏小**（项高 46px≥44 的 README 声明成立）；如面向更大年龄用户可考虑 11px（建议，非必须）。

### 11.10 阶段 4 验收矩阵与结论

| # | 验收项 | 结果 | 证据 |
| :--: | :--- | :--- | :--- |
| 1 | 回归测试 | **已验证**：197 PASS / 0 FAIL，exit 0（复核开始与修复后两次；+10 条未放宽） | §11.1 |
| 2 | 桌面布局 | **已验证**：overlay 居中 padding16、panel 880×650.81 居中（dx/dy=0）、max-h 88vh、radius 20、tabs flex 5 + indicator 对齐、bottom-nav/sheet-handle none | §11.2 |
| 3 | 手机布局 | **已验证**：overlay flex-end padding0、panel 全宽 bottom=844、max-h 92dvh、仅上圆角、handle 40×4、tabs none、bottom-nav flex 5 项/项高 46px/safe-area 声明、docSW==390 | §11.3 |
| 4 | 导航双向同步 | **已验证**：tab→bottom-nav 与 bottom-nav→tab 均同步 aria-selected/aria-current/tabpane/tabindex；手机切状态后回桌面保持 | §11.4 |
| 5 | 单一滚动层/页面不锁滚动 | **已验证**：1440×560 与 390×500 下 panel-body 独立滚动（body.scrollTop 生效、window.scrollY 不变），页面仍可滚动 | §11.5 |
| 6 | 排列结构对照参考 | **已验证（以契约/README 结构为基准）**：标题栏/导航位置/分区标题+版本/高亮功能行/折叠列表/可选 footer/同一 DOM 逐项一致；样式为 Kit 紫色 Flat Glass | §11.6 |
| 7 | 可访问性/导航文字色 | **已验证**：修复后 computed 未激活 text-2、激活 text；最坏宿主 4.70/4.64 与 8.79/8.17；tabs 未受影响 | §11.7 |
| 8 | 版本/文档/一致性 | **已验证**：六处 2.1.0、109 令牌、78 类三方、16 关键帧、README 第 12/13 章 + §10.5、CHANGELOG v2.1.0、package 2.1.0；无 emoji/BOM/外链 | §11.8 |
| 9 | 宽度无横向溢出 | **已验证**：1440/1024/768/600/599/480/420/390/360/320 全部 `docScrollWidth==innerWidth`；断点严格 ≤600px | §11.4 |

**结论：有条件通过（v2.1.0 可发布）**。阻塞项为零；复核期间发现的 P3 底部导航文字色问题已由 Lead 修复并复验（components.css `BA78522B24E39135`、README `01CD95E7C2D522E9`）；§11.9 为已记录残余/环境限制，均不阻塞。最终 7 文件哈希：tokens `63F35574F3EFD4DF`、**components `BA78522B24E39135`**、preview `48123FA8581252F4`、test `261EEB7431D25376`、**README `01CD95E7C2D522E9`**、CHANGELOG `93BCE6F838A517C5`、package `E63C398005089E51`。建议 task-22 收尾：最终 `npm test`（应为 197/0）、交付说明引用 §11.9、以 §11.1 哈希为准。

**阶段 4 证据路径**：脚本/结果 `C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\audit2\`（`v210-cdp.js` / `v210/cdp-v210.log` / `v210/cdp-v210-results.json`、`v210-scroll.js` / `v210/scroll-results.json`、`v210-postfix.js` / `v210/postfix-colors.json`、`v210-docs-check.js` / `v210/docs-check-v210.txt`、`v210-nav-contrast.js`）；截图 `...\ui-kit-v2\task18\`（desktop-panel-1440 / desktop-panel-tab2 / desktop-panel-light-1440 / mobile-sheet-390 / mobile-sheet-roles-390 / section18-1440）与本审核补充的 `...\audit2\v210\`（桌面/手机 postfix、浅色手机）。

---

## 12. 阶段 5：v2.1.1 复核（描边再减弱 / 单圈焦点环 / 面板固定尺寸 / 隐藏滚动条）

> 状态：**已完成（2026-10-17 23:32–23:45，v2.1.1 冻结版）**。
> **最终结论：有条件通过（v2.1.1 可发布）**——无阻塞项；203/0 测试、面板固定尺寸防跳变（四状态外框完全一致）、单圈 1.5px 焦点环、面板/弹窗滚动条隐藏但滚动有效、描边新 token 与玻璃极淡边、版本/文档一致性全部经独立 CDP/静态实测通过。残余见 §12.8。

### 12.1 冻结版本、新哈希与复跑

| 文件 | 大小 / 行数 | mtime | SHA256（前 16） |
| :--- | ---: | :--- | :--- |
| `tokens.css` | 16,937 B / 315 行 | 23:26:25 | `BA1C9D5547CCD6B9` |
| `components.css` | 60,677 B / 2,083 行 | 23:26:48 | `09D29F4318AE1EF8` |
| `preview.html` | 179,120 B / 3,439 行 | 23:29:14 | `7CA507AC4EBC354E` |
| `test/test-ui-kit.js` | 86,710 B / 1,430 行 | 23:29:57 | `87418B6FDA93C5EE` |
| `README.md` | 130,381 B / 1,612 行 | 23:28:56 | `252A1B6FB660CC40` |
| `CHANGELOG.md` | 16,716 B / 198 行 | 23:29:04 | `BE430A2B63E1CAAC` |
| `package.json` | 529 B / 20 行 | 23:29:04 | `15AD2592DD294023` |

- 复核开始/结束两次核对哈希一致（含 `.gitignore` `9298EF7D…`），冻结期间无文件漂移；仅 `AUDIT.md` 由本审核更新。
- 复跑 `node test/test-ui-kit.js`：**203 PASS / 0 FAIL，exit 0**（v2.1.0 的 197 条 → +6 条，断言未放宽；新增覆盖见 §12.7）。
- v2.1.1 无新增/删除 token 与类（109 / 47 / 78 / 16 关键帧不变）；版本六处 2.1.1。

### 12.2 固定尺寸防跳变（核心）—— 四状态外框完全一致

CDP `?panel=1`，在设置 tab 内依次操作并记录 `getBoundingClientRect`：

| 状态 | 桌面 1440×900 panel rect | 手机 390×900 panel rect |
| :--- | :--- | :--- |
| 默认（1 个折叠展开） | x=280 / y=54 / **880×792** / bottom=846 | x=0 / y=72 / **390×828** / bottom=900 |
| 全部折叠（6 组全关） | x=280 / y=54 / **880×792** / bottom=846 | x=0 / y=72 / **390×828** / bottom=900 |
| 全部展开（6 组全开） | x=280 / y=54 / **880×792** / bottom=846 | x=0 / y=72 / **390×828** / bottom=900 |
| 切 tab（图库 → 设置） | x=280 / y=54 / **880×792** / bottom=846 | 同左（未切 tab，CSS 固定尺寸同样成立） |

- 四状态的 x/y/width/height/bottom **逐项完全相同**（桌面 880×792=88vh；手机 390×828=92dvh，底部对齐 900）——折叠展开/切换 tab 不改变外框。
- 展开态内容外层不动、只在 `.nvui-panel-body` 内滚动：桌面默认/折叠时 body client=635、scrollHeight=635（内容未超高）；**全展开后 scrollHeight=1072 > client=635**，设 `scrollTop=180` 生效且 `window.scrollY` 保持 0；随后 `window.scrollTo(0,130)` 页面可滚动（页面未锁滚动）。手机同：client=663，全展开 scrollHeight=1064，`scrollTop=150` 生效、`window.scrollY=0`。
- 面板滚动容器 `overflow-y:auto`、`overscroll-behavior:contain` 不变；`.nvui-panel` 自身 `overflow:hidden`。

### 12.3 单圈 1.5px 焦点环（输入框双描边修复）

验证方式覆盖三种真实触发路径（Chromium 对编程式 focus 的 `:focus-visible` 启发式与真实交互不同，故分开记录）：

| 触发方式 | `:focus-visible` | computed outline | box-shadow | 结论 |
| :--- | :--- | :--- | :--- | :--- |
| 键盘 Tab 聚焦 | true | style=solid、color=`rgb(139,109,255)`、offset=2px、**width 取整显示 1px** | **none** | 单圈可见（截图确认） |
| 真实鼠标点「聚焦示例」按钮 | true | 同上 | **none** | 演示按钮在真实点击下正常出现焦点环 |
| 真实鼠标直接点输入框 | true | 同上 | **none** | 单圈可见 |
| 编程式 `input.focus()`（无用户手势） | false | none（UA 默认） | none | Chromium focus-visible 启发式，属预期，不是实现缺陷 |

- 判定依据按任务约定：**token 源码 `--nvui-focus-ring-w: 1.5px` + `.nvui-input:focus-visible` 规则为 `outline: var(--nvui-focus-ring-w) solid var(--nvui-focus-ring-color)` 且规则内无 `box-shadow`**；computed `outline-width` 的 used value 被 Chromium 取整为 1px（1x DPI），与契约 §15 说明一致，不作为失败依据。
- 输入框基础态 `border:0`、`box-shadow:none`（内圈 `inset accent-line` 已删除），**不存在第二圈描边**；截图中可见单圈紫色焦点环。
- 其它组件（按钮等）焦点环仍统一走 token、无第二圈（`.nvui-tabs-indicator` 的 `inset accent-line` 是选中态胶囊轮廓，与焦点环无关）。

### 12.4 滚动条隐藏但滚动有效

| 元素 | computed `scrollbar-width` | `overflow-y` | 伪元素规则 | 滚动实测 |
| :--- | :--- | :--- | :--- | :--- |
| `.nvui-panel-body` | **none** | auto | `::-webkit-scrollbar { display: none }`（源码核对） | 全展开后 `scrollTop=180` 生效、`scrollHeight 1072 > clientHeight 635`；截图无可见滚动条 |
| `.nvui-modal-body` | **none** | auto | `::-webkit-scrollbar { display: none }`（源码核对） | 内容较短（289=289）未触发滚动；`scrollbar-width:none` + 伪元素规则与 panel-body 同一实现模式，滚动能力由 `overflow-y:auto` 保留 |

- 页面级滚动条属于浏览器/宿主页面（kit 只负责浮层内部），本轮未隐藏；见 §12.8-4 说明。

### 12.5 描边 token 新值与极淡玻璃边

- tokens 新值全部落地（独立静态核对）：深色 `line 0.05 / line-2 0.08 / dash 0.14 / block-line 0.04 / block-line-2 0.07 / glass-line 0.03 / glass-highlight 0.03`；浅色 `line 0.06 / line-2 0.10 / dash 0.18 / block-line 0.045 / block-line-2 0.07 / glass-line 0.18 / glass-highlight 0.30`；`--nvui-focus-ring-w: 1.5px`（不再是 2px）。
- CDP computed：`.nvui-panel` / `.nvui-modal` / `.nvui-toast` 边框均为 `1px rgba(255,255,255,0.03)`（视觉近似无边框但结构仍可辨）；panel header / tabs 分隔线 `1px rgba(255,255,255,0.05)`；输入框 `box-shadow:none`、`border:0`。截图确认描边显著弱化、无双描边。

### 12.6 版本 / 文档 / 一致性（独立静态核对，44 项全 PASS）

- **版本六处 2.1.1 全一致**：package.json、tokens.css 头、components.css 头、README 标题、CHANGELOG 最新条目、preview 标题+徽标（`UI Kit v2.1.1` / `>v2.1.1<`）。
- **计数不变且一致**：109 令牌（=CORE 109）、47 浅色、78 类三方、16 关键帧全部定义/引用。
- **文档**：README §3 原则 13「描边一律减弱」、token 表新值、§7.5 输入框单圈说明、第 12 章固定尺寸/滚动条说明、新增 **`### 10.6 v2.0.1→v2.1.1`**、§11 版本记录；CHANGELOG v2.1.1（无破坏性变更、无 token/类增删）；package 2.1.1；preview 第 7 节「聚焦示例」+ 第 18 节固定尺寸/滚动条说明 + 版本标记。
- **红线**：components 无硬编码颜色；`backdrop-filter` 与 `-webkit-` 成对；`!important` ≤8 且白名单内；focus ring 全部 token（无硬编码 px outline）；无 emoji / BOM / U+FFFD / 外链 / 父目录引用；`.gitignore` 未变。
- 本审核自写静态检查共 44 项，**全部 PASS**（含 token 新值、panel 固定高/手机 92dvh、输入框单圈、panel/modal-body 滚动条规则、README §10.6/§11/§3.13、CHANGELOG/package、卫生检查等）。

### 12.7 测试门禁变化（197 → 203）

新增 6 条断言（断言未放宽）：`.nvui-panel` 固定高度 `height:var(--nvui-panel-max-h)`、手机抽屉固定 `height:92dvh` 且保留 max-height、`.nvui-input:focus-visible` 单圈（outline token + 规则内无 box-shadow）、`.nvui-panel-body` 滚动条隐藏但可滚动（scrollbar-width:none + 伪元素 display:none + overflow-y:auto）、`.nvui-modal-body` 同规则、README v2.1.1 打磨与版本记录；金标准同步 `focus-ring-w: 1.5px` 与全部新描边取值。

### 12.8 阶段 5 残余风险（均不阻塞 v2.1.1）

1. **固定尺寸带来的留白**：内容少的折叠态/空 tab 会在外框内留白（截图 panel-state-baseline/collapsed 可见）；这是「固定高度防跳变」的预期代价，用户明确要求固定尺寸。
2. **`outline-width` 取整**：Chromium 在 1x DPI 下把 1.5px 的 used value 取整为 1px（源码/token 仍为 1.5px）；视觉上焦点环较细。WCAG 2.4.11（AA）无宽度要求、颜色对比（accent vs 面板最坏 3.39:1）达标；WCAG 2.4.13（AAA）要求约 2px 等效周界，本版不满足 AAA（用户要求更细，属取舍）。若后续面向低视力/高 DPI 用户，可评估 2px 或双色环。
3. **无可见滚动条的可发现性**：面板/弹窗内容超高时无滚动条提示，用户可能不知道可滚动（尤其桌面鼠标无滚轮习惯者）；建议后续加 hover 淡入滚动条或内容边缘渐隐提示（非本版要求）。
4. **隐藏范围仅限浮层内部**：用户反馈「去掉滚动条」按契约 §15 只处理 `.nvui-panel-body` / `.nvui-modal-body`；页面级滚动条仍由浏览器/酒馆宿主决定，未隐藏。若用户期望整页无滚动条，需业务/宿主侧 CSS 处理（kit 不接管宿主页面）。
5. **仅 `.nvui-panel` 固定尺寸**：`.nvui-modal` 仍为内容驱动 `max-height`（契约仅要求面板）；若希望所有浮层固定尺寸需后续统一。
6. **safe-area 仅声明级验证**（继承）：`env(safe-area-inset-bottom)` 在底部导航 padding 内，无头环境 env=0，真机刘海屏需实机复核。
7. **未在真实 SillyTavern 宿主验证**（继承）；原始参考图未下发（阶段 4 已说明，结构对照以契约/README 为准）；状态行/告警 live region、AUD-12 尺寸 token 未全覆盖（px 字面量 81→80，微降）仍为遗留建议。
8. **描边极淡的取舍**：ghost 按钮等弱边界控件依赖文字标签识别（`line-2` 0.08 在深色下对比很低）；这是用户「描边甚至没有」诉求的直接结果，若后续发现识别困难，建议仅对 ghost/空态保留略高对比（非阻塞）。

### 12.9 阶段 5 验收矩阵与结论

| # | 验收项 | 结果 | 证据 |
| :--: | :--- | :--- | :--- |
| 1 | 回归测试 | **已验证**：203 PASS / 0 FAIL，exit 0（+6 条未放宽） | §12.1/§12.7 |
| 2 | 固定尺寸防跳变（核心） | **已验证**：默认/全折叠/全展开/切 tab 四状态桌面 880×792、手机 390×828，x/y/w/h/bottom 完全一致；展开内容只在 panel-body 内滚动（1072>635，scrollTop 生效、window.scrollY 不变） | §12.2 |
| 3 | 单圈焦点环 | **已验证**：token 1.5px + 规则单圈无 box-shadow；键盘/真实鼠标触发 focus-visible 时 outline solid accent、offset 2、box-shadow none；无双描边 | §12.3 |
| 4 | 滚动条隐藏但可滚动 | **已验证**：panel-body/modal-body computed `scrollbar-width:none` + 伪元素隐藏规则 + overflow-y:auto；panel-body 展开后滚动实测有效 | §12.4 |
| 5 | 描边 token/玻璃边极淡 | **已验证**：深/浅全部新值落地；panel/modal/toast 边框 computed `1px rgba(255,255,255,0.03)`；截图无突兀描边 | §12.5 |
| 6 | 版本/文档/一致性 | **已验证**：六处 2.1.1、109/47/78/16、README §3.13/§10.6/§11、CHANGELOG v2.1.1、package 2.1.1；44 项静态检查全 PASS；无 emoji/BOM/外链 | §12.6 |
| 7 | 截图目检 | **已验证**：task26 抽查 5 张（panel-state-baseline / panel-state-expanded / mobile-sheet-fixed-390 / desktop-panel-expanded-scrolled / sec07-input-focused）+ 本审核自摄（桌面固定/折叠/展开滚动、手机固定/展开、聚焦单圈） | §12.2-12.5 |
| 8 | 残余风险记录 | **已完成**：见 §12.8（固定尺寸留白、outline 取整、滚动条可发现性、仅浮层内部/仅 panel、safe-area、宿主验证、描边取舍等） | §12.8 |

**结论：有条件通过（v2.1.1 可发布）**。阻塞项为零；用户三项诉求（全部描边减弱/双描边修复、固定尺寸不跳变、去掉滚动条）均实测达成且无行为回归；203/0 测试与 44 项静态检查通过。§12.8 为已记录残余/取舍与环境限制，不阻塞。最终 7 文件哈希：tokens `BA1C9D5547CCD6B9`、components `09D29F4318AE1EF8`、preview `7CA507AC4EBC354E`、test `87418B6FDA93C5EE`、README `252A1B6FB660CC40`、CHANGELOG `BE430A2B63E1CAAC`、package `15AD2592DD294023`。建议 task-28 收尾：最终 `npm test`（应为 203/0）、交付说明引用 §12.8、以 §12.1 哈希为准。

**阶段 5 证据路径**：脚本/结果 `C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\audit2\`（`v211-cdp.js` / `v211/cdp-v211.log` / `v211/cdp-v211-results.json`、`v211-focus.js` / `v211/focus-methods.json`、`v211-docs-check.js` / `v211/docs-check-v211.txt`）；截图 `...\ui-kit-v2\task26\`（panel-state-baseline / panel-state-collapsed / panel-state-expanded / desktop-panel-expanded-scrolled / desktop-panel-fixed / mobile-sheet-fixed-390 / mobile-sheet-expanded-390 / sec07-input-focused / dark-1440-full / light-1440-full）与本审核补充的 `...\audit2\v211\`（panel-fixed-baseline/collapsed/expanded-scrolled、mobile-sheet-fixed-baseline/expanded、focus-input-realclick/mouse）。

---

## 13. 阶段 6：v2.2.0 复核（描边精致化 / nvui-api.js / tokens.json / AI-GUIDE.md）

> 状态：**已完成（2026-10-17 23:46–23:58，v2.2.0 冻结版 + 两轮受控修复）**。
> **最终结论：有条件通过（v2.2.0 可发布）**——无阻塞项；223/0 测试、6 个圆角玻璃组件无 1px 描边（computed 0px）、7 处直线分隔、ghost/indicator/empty 去描边、焦点环 2px 单圈、API 真实生成面板/吐司（DOM/a11y/固定尺寸/导航同步/关闭归还/零报错）、tokens.json 与 tokens.css 逐值一致、AI-GUIDE 覆盖完整均实测通过；复核中发现并修复的 `.nvui-panel` 能力降级缺口经二次晚绑定修正后复验通过（见 §13.6）。残余见 §13.7。

### 13.1 冻结版本、新哈希与复跑

| 文件 | 大小 / 行数 | mtime | SHA256（前 16） |
| :--- | ---: | :--- | :--- |
| `tokens.css` | 17,078 B / 316 行 | 23:38:23 | `91D8242F27E58BF5` |
| `components.css` | 61,963 B / 2,113 行 | 23:50:12 | `016B4EDAABD9114D`（两轮受控修复后） |
| `preview.html` | 194,299 B / 3,711 行 | 23:43:09 | `032A41E596C475B5` |
| `test/test-ui-kit.js` | 95,812 B / 1,559 行 | 23:50:29 | `5C716617168FEAE0`（两轮受控修复后） |
| `README.md` | 149,822 B / 1,871 行 | 23:48:52 | `4526255CF561ABDD`（降级补齐文档更新后） |
| `CHANGELOG.md` | 19,878 B / 236 行 | 23:48:47 | `E18663F1A31FC929`（降级补齐小节后） |
| `package.json` | 554 B / 21 行 | 23:42:53 | `E4C46386AEC9E2E4` |
| `nvui-api.js` | 24,878 B / 573 行 | 23:39:14 | `B78222F8341C52E8` |
| `tokens.json` | 7,108 B / 166 行 | 23:38:47 | `02F4032A9340F2B6` |
| `AI-GUIDE.md` | 17,794 B / 284 行 | 23:39:36 | `6EFB5A6B1FDB3BB7` |

- 复跑 `node test/test-ui-kit.js`：复核开始 **217/0**；第一轮降级补齐后 **221/0**；第二轮晚绑定修正后 **223/0**（最终三次均 exit 0，断言未放宽；v2.1.1 的 203 条 → +20 条）。
- **复核期间受控修复链（本审核推动）**：
  - 发现 `.nvui-panel` 缺能力降级（继承 v2.1.0）→ Lead 修复 1：三个降级块加 `.nvui-panel`、`.nvui-solid` 加 panel、测试 +4（217→221）；components `FE5C6B9B178E4D1C` → `E6FA9D3381BBCFAD`，test `9F798186C16761F1` → `17932576FA3A2B98`，README/CHANGELOG 同步；
  - 本审核 CDP 复验发现**修复 1 写了但不生效**（降级块位于 1361/1382/1407，`.nvui-panel` 基础规则位于 1788，同 specificity 后写胜出）→ Lead 修复 2：文件末尾新增 **§21 晚绑定覆盖**（`.nvui-overlay.is-panel > .nvui-panel`，0,3,0，位于 `.nvui-panel {` 之后），测试 +2（221→223）；components → `016B4EDAABD9114D`，test → `5C716617168FEAE0`；
  - 本审核再次 CDP 强制媒体特性复验：三个场景全部通过（见 §13.6）。
- 其余 6 个文件（tokens/nvui-api/tokens.json/AI-GUIDE/preview/package）在复核期间哈希未变；`.gitignore` 未变。

### 13.2 描边无锯齿（核心）—— CDP computed + 静态

| 对象 | 实测 / 证据 | 结论 |
| :--- | :--- | :--- |
| 6 个圆角玻璃组件（modal / panel / floating / tooltip / toast / glass） | computed `border-width: 0px`、`border-style: none`（dark/light 均）；基础规则静态无 `border` 声明；形态依赖背景 + backdrop-filter + 阴影（阴影 token 内含 `inset 0 1px 0 var(--nvui-glass-highlight)` 柔和顶光） | **无 1px 外框、无锯齿来源** |
| 直线分隔（7 处） | modal header/footer、panel header/footer、tabs 底边、panel>tabs 底边、bottom-nav 顶边；computed dark `1px solid rgba(255,255,255,0.06)`、light（header/tabs）`1px solid rgba(255,255,255,0.28)`；`--nvui-glass-line` 使用恰好 **7 次** | 直线分隔保留且改用玻璃分隔色 |
| `.nvui-btn.is-ghost` | computed `border: 0 none`、`background: rgba(255,255,255,0.05)`（light `rgba(15,23,42,0.035)`） | 无描边、淡底 |
| `.nvui-tabs-indicator` | computed `border: 0 none`、`box-shadow: rgba(139,109,255,0.4) 0px -2px 0px 0px inset` | 底部直线强调、无 1px 内环 |
| `.nvui-empty` | computed `border: 0 none`、`background: rgb(35,41,57)`、`background-image: none` | 无虚线圆角 |
| 输入框焦点 | computed `outline: solid 2px rgb(139,109,255)`、`outline-offset: 2px`、`box-shadow: none`、`border: 0 none`；token `--nvui-focus-ring-w: 2px` | 单圈 2px 整数像素、无双描边 |
| token | 深 `glass-line 0.06 / highlight 0.05 / focus-ring-w 2px`；浅 `glass-line 0.28 / highlight 0.40` | 全部落地 |

截图目检：`task32\dark-top-slice.png`（整页 + 玻璃演示放大）、`task32\api-panel-basic-desktop.png`、`api-panel-about-tab.png`、`api-panel-mobile-390.png`、`sec19-api-demo.png`、`sec07-focus-2px.png`（+ 本审核自摄 `audit2\v220\`）——圆角边缘平滑、无可见 1px 锯齿边、无双描边；焦点环 2px 清晰。

> 说明：forced-colors（高对比）模式下仍保留 1px `CanvasText` 系统色边框（无障碍降级所需，不是锯齿来源）；正常模式该边框不存在。

### 13.3 API 真实可用（浏览器运行时 + Node 静态）

CDP 在 preview 中真实调用 `NVUI.createPanel(...)` + `NVUI.showToast(...)`：

| 检查项 | 实测结果 |
| :--- | :--- |
| 版本 | `NVUI.version === '2.2.0'`；`NVUI.PANEL_CLASS === 'nvui-panel'` |
| DOM 结构 | `DIALOG.nvui-tl > .nvui-overlay.is-panel > .nvui-panel[role=dialog][aria-modal=true][aria-labelledby]`；header（title + actions + 关闭按钮）、`.nvui-tabs[role=tablist]`、`.nvui-panel-body`、footer、`.nvui-bottom-nav` 齐全 |
| 固定尺寸/居中 | 桌面 panel **880×792**、x=280、`centeredDx=0`（88vh 固定尺寸沿用 v2.1.1）；手机 390×900 下 **390×828**、bottom=900、仅上圆角、顶部 tabs none、底部 nav flex、docSW=390 |
| 导航同步 | 点底部导航第 2 项 → tabs `aria-selected [false,true]`/`is-active`、`tabindex [-1,0]`、tabpane=about；bottom-nav active/`aria-current=page` 同步 |
| 关闭与焦点 | 关闭按钮 → overlay hidden、dialog.close、**焦点归还触发元素**（`focusReturned=true`） |
| 吐司 | `role="status"`、位于 `dialog.nvui-tl` 内的 toast-stack、文本正确；dismiss 后 DOM 移除、空栈后 layer 关闭 |
| Node 侧 | `require('./nvui-api.js')` 正常（加载不访问 DOM）：version 2.2.0、10 个 API 函数齐全 |
| 运行时错误 | **console exceptions 0 / Log error 0 / Network.loadingFailed 0 / http(s) 资源 0** |

### 13.4 tokens.json 与 AI-GUIDE

- **tokens.json 与 tokens.css 独立解析逐值对比**：`dark` **109** / `light` **47**，normalized 值 **0 mismatch**（含 shadow 组合值/var() 引用/浅色覆盖）；`version: 2.2.0`、`generatedFrom: tokens.css`。自动比对脚本见证据路径。
- **AI-GUIDE.md**（284 行）：覆盖「给 AI 的硬约束、读文件顺序、SillyTavern 插件面板标准流程、其它软件复用/迁移规范、提示词模板（生成/审查/迁移 3 套）、API 速查、验收清单、Do/Don't」；无 emoji；与 README 第 13 章、tokens.json、nvui-api.js 互链一致。
- **nvui-api.js**：零依赖 UMD 风格（浏览器挂 `window.NVUI`、Node `module.exports`）；生成 DOM 自动带布局标准/aria/焦点移入与归还/Esc 与遮罩关闭/进出场；文档明确焦点陷阱仍由业务按 README §2.3 配方接入（kit 无 JS 运行时定位）。

### 13.5 版本 / 文档 / 一致性（独立静态核对 44 项全 PASS）

- **版本口径**：package.json 2.2.0 + `main: nvui-api.js`；tokens.css / components.css / README / CHANGELOG / preview 六处 2.2.0；另 **nvui-api.js VERSION=2.2.0、tokens.json version=2.2.0、AI-GUIDE v2.2.0**。
- **计数**：109 令牌 / 47 浅色 / 78 类 / 16 关键帧不变；tokens.json dark/light 与 tokens.css 一致；`REQUIRED_FILES` 门禁包含 3 个新文件。
- **文档**：README 文件表 + 第 13 章「JS API 与 AI 协作指南」、许可顺延第 14 章、§10.7 v2.1.1→v2.2.0、§3 原则（圆角玻璃去外框/直线分隔/单圈 2px）、tokens 表新值；CHANGELOG v2.2.0（描边精致化 + 新文件 + 能力降级补齐，无破坏性）；preview 第 19 节 API 演示 + 本地 `./nvui-api.js` + `?api=1`（无外链）。
- **红线**：components 无硬编码颜色；backdrop 与 `-webkit-` 成对；`!important` ≤8 且白名单；focus ring 全 token；无 emoji（11 个文件）/BOM/U+FFFD/外链/父目录引用。

### 13.6 面板能力降级复核闭环（发现 → 修复 → 二次晚绑定 → 复验通过）

- **发现**（本审核）：`@supports not` / `prefers-reduced-transparency` / `forced-colors` 三个降级块均未包含 `.nvui-panel`（继承 v2.1.0 的缺口；v2.2.0 去掉面板外框描边后高对比模式边界更明显）。
- **修复 1**（Lead）：三块 selector 组加入 `.nvui-panel`、`.nvui-solid` 补 panel、测试 +4（221/0）、README/CHANGELOG 同步。
- **复验发现修复 1 不生效**（本审核 CDP）：降级块在 `components.css:1361/1382/1407`，而 `.nvui-panel` 基础规则在 `:1788`，同 specificity 后写胜出 → reduced-transparency 下 panel 仍是 `rgba(22,26,36,0.64)+blur(20px)`；forced-colors 下 panel blur 未关（border 虽生效）。
- **修复 2**（Lead）：文件末尾新增 **§21 晚绑定覆盖**（`components.css:2083+`）：`@supports not` / `prefers-reduced-transparency` 下 `.nvui-overlay.is-panel > .nvui-panel { background: var(--nvui-bg); backdrop-filter: none }`；`forced-colors` 下同 selector 加 `border: 1px solid CanvasText` + 去 blur/阴影；测试 +2 条晚绑定断言（223/0）。
- **最终复验通过**（本审核 CDP 强制媒体特性）：

| 场景 | `.nvui-panel` 实测 | 结论 |
| :--- | :--- | :--- |
| 默认 | `rgba(22,26,36,0.64)` + `blur(20px) saturate(1.5)`、border 0 | 玻璃正常 |
| `prefers-reduced-transparency: reduce`（深色） | **`rgb(22,26,36)` + `backdrop: none`** | 回退通过 |
| `prefers-reduced-transparency: reduce`（浅色） | **`rgb(247,248,252)` + `backdrop: none`** | 回退通过 |
| `forced-colors: active` | **`border: 1px solid rgb(255,255,255)`（CanvasText）、`backdrop: none`、`box-shadow: none`** | 高对比边界通过 |
| `.nvui-solid` | `rgb(22,26,36)` + `none` | 实心降级通过 |
| `@supports not` | 静态核对：§21 晚绑定块位于 `.nvui-panel {`（1788）之后、selector 0,3,0、含 `background: var(--nvui-bg)` + `backdrop-filter: none` | 静态通过（无法动态模拟） |

—— 修复闭环完成；221/223 测试、CDP 三场景与静态规则一致，`.nvui-modal` 等既有降级未回归。

### 13.7 阶段 6 新发现与残余风险（均不阻塞 v2.2.0）

1. **去圆角外框描边后的边界可辨识性**：玻璃浮层依赖「背景 + backdrop-filter + 阴影内高光」成形；在极低对比背景/低性能设备（blur 不可用且阴影弱）下边界可能弱化——设计取舍，forced-colors 已有 CanvasText 边框兜底。
2. **focus ring 使用 outline**：2px 整数、颜色 accent 对比达标，但 `outline` 不跟随 `border-radius`（矩形轮廓），在圆角控件上略超出圆角——浏览器行为，kit 统一 token 可控；如需完全贴合可用 box-shadow ring（与「无描边/性能」取舍，非必须）。
3. **glass-line 语义变化**：token 从「圆角外框受光边」改为「玻璃表面内直线分隔」（深 0.06 很淡、浅 0.28）；分隔线属于弱装饰，功能不依赖；极强光环境下可能偏淡（用户要求）。
4. **ghost / empty 去描边后识别**：依赖文字与淡底区分（用户明确要求），非文本边界不再提供；如面向低视力用户可评估保留更明显底/文字。
5. **API 为可选运行时**：需业务显式引入 `nvui-api.js`；不提供完整焦点陷阱（README §2.3 配方负责）；toast 图标依赖宿主 Font Awesome（preview 用离线 CSS 字形兜底）；API 只生成 DOM/切类名，不改变纯 CSS 用法。
6. **tokens.json 是生成镜像**：由 tokens.css 派生，测试守护 109/47 逐值一致；手工改 JSON 会被测试拦截，改色仍需改 tokens.css。
7. **继承残余**（阶段 4/5 已记录）：面板固定高度内容少时留白；滚动条隐藏后的可发现性；仅 `.nvui-panel` 固定尺寸（modal 仍内容驱动）；safe-area 仅声明级验证；未在真实 SillyTavern 宿主验证；状态行/告警无 live region；AUD-12 尺寸 token 未全覆盖（components px 字面量 71）。
8. **原始参考图未下发到本机可访问路径**（阶段 4 已说明）：排列结构对照以契约 §14.2/README §12 为准，未做像素级对照。
9. **能力降级修复的静态盲区**：降级规则「存在」的断言无法发现「被后续同 specificity 规则覆盖」；本轮靠 CDP 计算样式发现。建议后续测试对关键降级块增加「源顺序在基础规则之后」断言（本轮已为 panel 补晚绑定断言，可推广到其它后期新增组件）。

### 13.8 阶段 6 验收矩阵与结论

| # | 验收项 | 结果 | 证据 |
| :--: | :--- | :--- | :--- |
| 1 | 回归测试 | **已验证**：217→221→223 PASS / 0 FAIL，exit 0（三次；+20 条未放宽） | §13.1 |
| 2 | 描边无锯齿（核心） | **已验证**：6 个圆角玻璃 computed border 0px；7 处直线分隔 glass-line（0.06/0.28）；ghost/indicator/empty 去描边；截图圆角平滑 | §13.2 |
| 3 | 焦点环单圈 2px | **已验证**：token 2px、computed outline solid 2px accent + box-shadow none、无第二圈 | §13.2 |
| 4 | API 真实可用 | **已验证**：createPanel DOM/aria/固定 880×792/导航同步/关闭归还 + showToast role=status；console/network 零错误；Node require 正常 | §13.3 |
| 5 | tokens.json 同步 | **已验证**：109/47 独立解析 0 mismatch、version 2.2.0、generatedFrom tokens.css | §13.4 |
| 6 | AI-GUIDE 完整性 | **已验证**：ST 插件/其它软件/提示词/验收/API 速查齐全、无 emoji | §13.4 |
| 7 | 版本/文档/一致性 | **已验证**：六处 2.2.0 + API VERSION + tokens.json version + package main；109/47/78/16；README 第 13/14 章 + §10.7；CHANGELOG v2.2.0；44 项静态检查全 PASS | §13.5 |
| 8 | 面板能力降级闭环 | **已验证**：发现 → 修复 1 → 复验不生效 → 修复 2 晚绑定 → CDP 三场景复验通过（见 §13.6） | §13.6 |
| 9 | 截图目检 | **已验证**：task32 抽查 6 张（API 面板/关于页/吐司/手机 API 面板/第 19 节/焦点 2px）+ dark-top-slice 放大看圆角；本审核自摄 API 桌面/手机面板 | §13.2/§13.3 |

**结论：有条件通过（v2.2.0 可发布）**。阻塞项为零；用户两项诉求（① 描边锯齿/精致化、② 设计调用 API + AI 指南）均实测达成；复核中发现并推动修复的面板能力降级缺口已完成「发现→修复→二次晚绑定→复验」闭环；残余见 §13.7。**最终 10 文件哈希**：tokens `91D8242F27E58BF5`、components `016B4EDAABD9114D`、preview `032A41E596C475B5`、test `5C716617168FEAE0`、README `4526255CF561ABDD`、CHANGELOG `E18663F1A31FC929`、package `E4C46386AEC9E2E4`、nvui-api `B78222F8341C52E8`、tokens.json `02F4032A9340F2B6`、AI-GUIDE `6EFB5A6B1FDB3BB7`。建议 task-34 收尾：最终 `npm test`（应为 223/0）、交付说明引用 §13.7、以 §13.1 哈希为准。

**阶段 6 证据路径**：脚本/结果 `C:\Users\zgy\AppData\Local\Temp\ui-kit-v2\audit2\`（`v220-cdp.js` / `v220/cdp-v220.log` / `v220/cdp-v220-results.json`、`v220-degradation.js` / `v220/degradation-postfix.json`、`v220-docs-check.js` / `v220/docs-check-v220.txt`、`v220-compare.js` / `v220/tokens-compare.txt`）；截图 `...\ui-kit-v2\task32\`（api-panel-basic-desktop / api-panel-about-tab / api-toast-desktop / api-panel-mobile-390 / sec19-api-demo / sec07-focus-2px / dark-top-slice / dark-1440-full / light-1440-full）与本审核补充的 `...\audit2\v220\`（api-panel-desktop / api-panel-mobile-390 / sec07-focus-2px）。
