# ROADMAP · v2.8.1 → v3.1（线路 A / B / C / D 全部结项）

> 本文件是**计划详情的单一来源**；执行进度在 GitHub 追踪：
> [#17 · 线路 A（v2.8.2）](https://github.com/zgy-beep/ui-kit/issues/17) ·
> [#18 · 线路 B（v2.9.0）](https://github.com/zgy-beep/ui-kit/issues/18) ·
> [#19 · 线路 C（v3.0.0）](https://github.com/zgy-beep/ui-kit/issues/19) · [#22 · 线路 D（v3.1.0）](https://github.com/zgy-beep/ui-kit/issues/22)。
> 已发生的缺陷与修复历史仍记在 [`ISSUES.md`](ISSUES.md)，版本事实以 [`CHANGELOG.md`](CHANGELOG.md) 为准。

---

## 0. 基线（v2.8.1，2026-11-05）

规划里所有「不变」承诺都锚定在这组数字上，任何一项变动都要在 CHANGELOG 显式声明。

| 契约 | 当前值 | 允许在 v2.x 变化？ |
| :--- | :--- | :--- |
| 设计令牌 | 深色 111 / 浅色覆盖 47 | 只允许**新增**（MINOR） |
| 组件类名 | 81 | 只允许新增；改名留给 v3.0 |
| `!important` 预算 | 18（4 类） | 不允许增加 |
| 关键帧 | 16 | 只允许新增且必须被引用 |
| 顶层导出 | 27 | 只允许新增 |
| 持久化状态格式 | `nvui_state_v1` | v2.x 不动；v3.0 升 v2 + 迁移器 |
| 尺寸语义 | 内联 px + `clampPanelLayout()` | v2.x 维持；v3.0 改 CSS 变量 |
| 测试脚本 / 已接入 `npm` | 51 / 6 | 线路 A 要把「接入数」提到 51 中的可回归部分 |

**v2.8.1 出口状态**：`npm test` 367 PASS、`test:api` 27 导出、forms 455、accordion 18、optgroup 217、focus 13、issue-16 8/8；`verify:release` 通过；CI（main + tag）绿；Release 3 产物。

### 0.1 发布流水（最近四版）

| 版本 | 日期 | 类型 | 内容一句话 | 出口数据 |
| :--- | :--- | :--- | :--- | :--- |
| v3.1.0 | 2026-11-16 | MINOR | 线路 D：移除 `data-nvui-legacy-size` 过渡开关，尺寸只走 CSS 变量一条路径；V2 改直接证明下游 CSS 接管、V3 改防复活断言 | `verify:all` 10/10；373/0；`test:sizevars` 8/8；实机 35+19；e2e 58/0；token / 组件类 / 导出面不变 |
| v3.0.0 | 2026-11-16 | MAJOR | 线路 C 四项：尺寸载体换轨（内联 px → `--nvui-panel-w` / `--nvui-panel-h`）+ 状态 v2 + `migrateStateV1toV2()` + `data-nvui-legacy-size` 过渡开关；四套按钮组归一为零 specificity；`tokens.json` schema 2；兼容矩阵硬门禁 | `verify:all` 10/10；373/0；浏览器 455+18+217+12+11+10+9+8+10+11+8+8；实机 35+19；e2e 58/0；组件类 84 / 导出 29 |
| v2.9.0 | 2026-11-16 | MINOR | 线路 B 六项（布局导入导出 / `width-only` / `diagnostics` / `setTheme('auto')` / 调尺寸手柄 / `textarea`+`hint`+`error`）+ GH-#21 剩余两条（进度可视标签、边缘渐隐） | `verify:all` 9/9；370/0；浏览器 455+18+217+15+12+11+10+9+8+10+11+8；实机 35+19；组件类 84 / 导出 28 |
| v2.8.3 | 2026-11-16 | PATCH | 测试基建收尾：`test/probe/` 归档、`issue-16` 矩阵 8 → 12、`scripts/resolve-browser.js`、`npm run verify:all`（线路 A 到出口） | `verify:all` 9/9；370/0；实机 35+19；`verify:release` 20 项 |
| v2.8.2 | 2026-11-16 | PATCH | 焦点陷阱修正（GH-#20）、40px 触控（GH-#21）、`test/host/` 基线入库、`createPanel` 七步拆分 1433 → 531 | 浏览器 455+18+217+15；实机 35+19；e2e 58 |


---

## 1. 排期总览

| 里程碑 | 追踪 | 窗口 | 出口指标 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **v2.8.2 / v2.8.3** 工程化收尾 | [#17](https://github.com/zgy-beep/ui-kit/issues/17) | 2026-11-06 → 11-16 | `npm run verify:all` 一次通过；新机器 `npm i` 后浏览器套件可复跑；零行为变更 | **已交付**（2026-11-16，§2） |
| **v2.9.0** 下游可维护性 | [#18](https://github.com/zgy-beep/ui-kit/issues/18) | 2026-11-15 → 12-04 | 6 项 additive 能力 + 双绿断言 + 文档与 API 表同步 | **已交付**（2026-11-16，§3） |
| **v3.0.0** 尺寸与命名重构 | [#19](https://github.com/zgy-beep/ui-kit/issues/19) | 2026-12-05 → 2027-01-14 | 迁移器测试通过；旧类 alias 一版；`MIGRATION-v3.md` + 下游公告 | **已交付**（2026-11-16，提前于窗口，§4 + §9 公告模板） |
| **v3.1.0** 移除过渡尺寸开关 | [#22](https://github.com/zgy-beep/ui-kit/issues/22) | 2026-11-16 → 11-30 | `data-nvui-legacy-size` 零残留；开关无效断言；文档不再有将来时 | **已交付**（2026-11-16，§5） |

线路 A / B / C 已全部到出口；线路 D（v3.1.0）已立项（§5）。
**四条线路全部结项**：A 让断言可信 → B 让下游少写代码 → C 动破坏性契约 → D 收掉 C 留的过渡开关。

**未立项 / 无版本归属**：G-07 语义层 / 社区标签（四种 LLM key 环境变量实测全空，阻塞）；
ST 1.20 实机补跑（本机无环境）。二者不阻塞 v3.1.0 发布，已写进 GH-#19 关闭评论与 MIGRATION-v3。

---

## 2. 线路 A · v2.8.2 工程化收尾（[#17](https://github.com/zgy-beep/ui-kit/issues/17)）

无行为变更，只让「测试能复跑 + 门禁值得信任」。

| # | 任务 | 动作 | 验收 | 估时 |
| :--- | :--- | :--- | :--- | :--- |
| A1 | 尺寸语义矩阵 | `test/issue-16-persist-size.js` 增 T9~T12：`{size:false,tab:false,accordion:false}` / `persist:true` / `persist:{}` / 异步 StorageAdapter | 12/12 绿；异步 adapter 下 `size:null` 落盘。**状态：v2.8.3 已交付（12/12，错误面断言移到末尾为 T13）** | 0.5d |
| A2 | 浏览器套件免 NODE_PATH | `playwright-core` 进 `devDependencies`；新增 `scripts/resolve-browser.js`，缺包/缺 Chrome 输出**可执行修复命令** | 新机器 `npm i && npm run test:browser` 一次通过。**状态：v2.8.3 已交付（未设 `NODE_PATH` 实测 5 套全绿）** | 0.5d |
| A3 | 一键门禁 | 新增 `scripts/verify-all.js`：静态 4 项 → `verify:release` → `pack` 产物校验 →（有 Chrome 时）浏览器段 | 本机全绿；CI 自动跳过浏览器段且不报错。**状态：v2.8.3 已交付（9/9；`--no-browser` 6 通过 3 跳过）** | 0.5d |
| A4 | 测试目录收敛 | 按「回归 / 宿主实机 / 一次性探针」分到 `test/host/`、`test/probe/`，新增 `test/README.md` 索引；探针结论留在 `ISSUES.md` | `test/*.js` 顶层只剩可回归脚本；README §13 同步。**状态：v2.8.2 交付 `test/host/` + `test/README.md`；v2.8.3 交付 `test/probe/`（30 个脚本 + 索引）—— 本条完成** | 1d |
| A5 | 版本一致性门禁 | `verify-release.js` 增加「CHANGELOG 首条 == `package.json.version`」「README §11.4 时间线含当前版本行」 | 故意写错版本号 → `verify:release` 必红。**状态：v2.8.2 已交付，`--self-test` 反向 3/3** | 0.5d |

**出口**：`npm run verify:all` 绿 + CI 绿 + 4 资产 md5 一致 + 下游零改动（无 API / 样式 / 状态格式变化）。

> **2026-11-16 实际发布（两批）**：v2.8.2 以补丁形式发出（焦点陷阱 / 40px 触控 / 宿主实机基线 / `createPanel` 七步拆分），交付 A5 与 A4 的 `test/host/` + `test/README.md`；同日 v2.8.3 交付 A1（尺寸矩阵 12 项）、A2（`playwright-core` + `scripts/resolve-browser.js`）、A3（`npm run verify:all`）与 A4 剩余的 `test/probe/` 收敛。**线路 A 到达出口**。

---

## 3. 线路 B · v2.9.0 下游可维护性（[#18](https://github.com/zgy-beep/ui-kit/issues/18)）

MINOR，全 additive。推荐顺序：**B1 → B3（共用持久化语义）→ B2 → B6 → B4 / B5**。

> **2026-11-16 追加（GH-#21 剩余两条）**：进度条可视标签 `progress({ showLabel, showValue })` 与面板 body
> 滚动边缘渐隐 `data-nvui-fade`（mask-image）已落地，均属 additive，计入本版（commit `e37b446`，
> 回归 `test/issue-21-ux.spec.js` 11/11）。
>
> **2026-11-16 结项**：B1–B6 六项已全部落地并随 **v2.9.0** 发布（`f601260` B1 / `8b7f4be` B3 / `e200899` B2 /
> `98dd3b3` B6 / `9b37425` B4 / `05e3db0` B5）。**线路 B 到达出口**。

| # | 能力 | 问题 | API 草案 | 验收 |
| :--- | :--- | :--- | :--- | :--- |
| B1 | 布局状态读写出入口 | 现在只有 `clearLayoutState()`，下游要「导出/导入布局」「同步到 `extension_settings`」只能反解存储结构 | `panel.getLayoutState() → state`<br>`panel.setLayoutState(state, { silent })`<br>只写内存 + 调度一次落盘，不触发 `applyLoadedState` 的 tab 恢复 | 往返幂等：`get → set → get` 深相等；`silent:true` 不写存储。**状态：v2.9.0 已交付（`v290-layout-state` 10/10；变异：get 不克隆时 L3 红）** |
| B3 | `persist.size: 'width-only'` | 「定宽 + 高度自适应」是高频诉求，#16 正是它的误用形态 | 布尔值保持兼容，新增 `'width-only'`；`applyClamping()` 的 `useSavedSize` 门禁按「宽/高」分别判定 | 高宽分别持久化：只回写 width、height 恒为空；`true` / `false` 行为不变。**状态：v2.9.0 已交付（`v290-width-only` 9/9；变异：`useSavedH` 与 `useSavedW` 同源时 W1 红）** |
| B2 | `NVUI.diagnostics()` | #16 报告里最贵的一步是「确认下游装的哪版、状态里到底有什么」 | 返回可贴进 issue 的 JSON：`version / assets{md5, kitVersion} / glass / hostModals / escapeStackDepth / persistKeys / listenerCounts` | Node 无 DOM 返回 `no-dom`；浏览器返回 8 个字段；不产生副作用。**状态：v2.9.0 已交付（`v290-diagnostics` 8/8；D6 实测销毁后 `resize`/`scroll`/`change`/`keydown` 全部回落基线）** |
| B6 | `NVUI.setTheme('auto')` | 下游普遍在写两套皮肤切换逻辑 | 双信号：`prefers-color-scheme` + 宿主 `.nvui-theme-light`；`matchMedia` 监听 + `invalidateTokenCache()` | 系统切深浅后 1 帧内生效；显式 `'light'/'dark'` 不受影响。**状态：v2.9.0 已交付（`v290-theme-auto` 10/10；判据改成「后注册的 change 探针收到事件时类名已更新」；变异：去掉 `hostLightSignal` 时 A4 红）** |
| B4 | 键盘调尺寸 | 调尺寸只有鼠标；键盘用户用不了「记忆尺寸」 | resize 手柄 `tabindex=0` `role=separator` `aria-orientation`；方向键 ±8px（Shift ±32）、Home 复位；统一走 `setSize()` | 键盘可改宽高并落盘；焦点环可见；`prefers-reduced-motion` 下无过渡。**状态：v2.9.0 已交付（`v290-resize` 11/11；已知边界：高度受 `max-height: 88vh` 约束，只在可收缩区间内可调）** |
| B5 | `inputRow` 补 `textarea` 与 `hint`/`error` | 14 种原生类型里没有多行文本；错误态只能自绘 | `'textarea'` 伪类型（DOM 仍 `textarea`，意图走 `data-nvui-type`）；`hint` `aria-describedby`、`error` `aria-invalid + aria-describedby` | 类型白名单断言；`error` 时 `aria-invalid="true"`；`hint`/`error` 不同时指向同一 id。**状态：v2.9.0 已交付（`v290-inputrow` 8/8）** |

**出口**：每项「静态 + 真机」双绿 + `verify:release` 通过 + CHANGELOG 条目 + README / AI-GUIDE API 表更新 + 4 资产同步。

---

## 4. 线路 C · v3.0.0 内联尺寸停写与命名收敛（[#19](https://github.com/zgy-beep/ui-kit/issues/19)）· **2026-11-16 结项**

MAJOR。**C1 是核心**：把「kit 写内联 px」与「下游用 CSS 接管尺寸」这对根本冲突消掉 —— #16 只是它的一个症状。

| # | 任务 | 交付状态 |
| :--- | :--- | :--- |
| C1 | 尺寸载体换轨 + 状态 v2 + 迁移器 + legacy 开关 | **已交付**（commit `5865946`；`test/v300-size-vars.spec.js` 8/8，V2 用同一段下游 CSS 对比「变量载体 500px / legacy 载体 860px」双向证明） |
| C2 | 四套按钮组归一 + 旧类 alias | **已交付**（commit `e2cf4e4`；`:where()` 零 specificity，静态门禁加 2 条防分叉断言） |
| C3 | `tokens.json` schema 2 + 生成脚本 | **已交付**（commit `f619a77`；111 token / 16 组 / 9 段说明，值结构逐字节不变） |
| C4 | 兼容矩阵硬门禁 + `engines` | **已交付**（commit `427a50a`；`test:compat` 9 项，`verify:all` 9 → 10 步） |

### C1 迁移设计（实际落地）

| 项 | 现状（v2.x） | v3.0 |
| :--- | :--- | :--- |
| 尺寸载体 | `panel.style.width/height = '400px'` | `panel.style.setProperty('--nvui-panel-w', '400px')`；CSS 侧 `width: var(--nvui-panel-w, min(var(--nvui-panel-width), 100%))` |
| 钳制 | `clampPanelLayout()` 返回 `styleWidth/styleHeight` | 同一函数返回变量值；测试断言从 `style.*` 改为 `getPropertyValue('--nvui-panel-w')`（`readPanelSize()` 变量优先、回退内联） |
| 状态格式 | `{ size: { width, height, isMaximized } }` | `{ version: 2, size: { w, h, mode } }` + `migrateStateV1toV2()` |
| 兼容开关 | — | 一版 `data-nvui-legacy-size`：仍写内联 px 并 `warnOnce`，v3.1 移除 |

其余：C2 三套按钮组（`.nvui-btn-row` / `.nvui-actions` / `*-footer`）合一 + 旧类 alias 一版；C3 `tokens.json` schema v2（分组 / 类型 / 描述）+ `scripts/tokens-v1-to-v2.js`；C4 兼容矩阵硬门禁（`checkCompatibility({ min })` + `engines` + README 版本矩阵）。

**出口核对**：迁移器测试（v1 存档 → v2 → 布局等价）✅ V4；alias `warnOnce` 断言 ✅ V3（合并进 `v300-size-vars`，不单开 spec）；`MIGRATION-v3.md` ✅；下游公告模板 ✅ 见 §9；ST 实机双跑 ✅ `test:host` 35/35 + 19/19（宿主 1.19，1.20 待有条件时补）。

**额外收获**：C1 顺手修掉一个 v2 就有的缺陷 —— 「最大化 → 还原」后宽度一直挂着 `calc(100vw - 32px)`
（`applyClamping()` 读不到 px 目标时直接 return，从不清那条 calc）。现在两个维度都读不到 px 且身上还挂着
尺寸时会显式 `clearPanelSize()`。

---

## 5. 线路 D · v3.1.0 移除过渡尺寸开关（[#22](https://github.com/zgy-beep/ui-kit/issues/22)）· **2026-11-16 结项**

v3.0.0 发布时明确承诺：`data-nvui-legacy-size` 过渡开关 v3.1 移除。本线路兑现该承诺，是 v3.x 内最后一次契约变更。

| # | 任务 | 验收 |
| :--- | :--- | :--- |
| D1 | 删掉 `LEGACY_SIZE_ATTR` / `usesLegacySize()` / `writePanelSize()` 的 legacy 分支与 warnOnce | ✅ `d6c26cc`：代码与模板副本零残留；`writePanelSize()` 恒写 CSS 变量，顺手简化 `applyOne()` |
| D2 | 改写 `test/v300-size-vars.spec.js` V2 / V3 | ✅ V2 实测 `renderedWidth=500 / varW=860px`（下游 CSS 直接生效）；V3 设属性后 `legacyWarns=0`、内联为空（防复活）；8/8 |
| D3 | 清理 7 份文档的开关引用 | ✅ README / AI-GUIDE / MIGRATION-v3 / UPGRADING 改为「已移除」+ 替代方案；CHANGELOG / ISSUES / ROADMAP 的 v3.0 历史行保留事实，由 v3.1 新条目承载移除 |

**出口**：`verify:all` 10/10；`test:host` 35/35 + 19/19；`verify:release` 21 项；tag + Release 3 产物；GH-#22 关闭。

---
## 6. 全局完成定义（DoD）

任何版本发布前必须全部为真：

1. `npm run verify:all` **10/10** 全绿（test / api / v280 / compat / downstream / verify:release / pack 产物校验 / browser / stress / e2e）；
   没有 Chrome 时后三段 SKIP，**必须在有 Chrome 的机器上补跑**，不能拿 SKIP 当通过；
2. 有 Chrome 的机器上 `test:browser` 全绿（含新增回归）；
3. `npm run pack` 能出 zip + `SHA256SUMS` + `manifest.json`；
4. 4 资产与 `st-extension-template/ui-kit/` md5 一致；
5. 版本十处对齐（`package.json` / `tokens.json` / `tokens.css` 文件头 + 令牌 / `components.css` / `nvui-api.js` / `preview.html` / `README` / `AI-GUIDE` / `CHANGELOG`；
6. `CHANGELOG.md` 有本版条目且写明兼容性结论；`ISSUES.md` 相关项闭环；
7. GitHub：issue 有结论、milestone 清空、tag 推送后 Release 有 3 个产物、CI 绿。

```bash
npm run verify:all                  # 唯一门禁入口（10 步）
npm run test:host                   # 宿主在线时（不在 verify:all 里）
npm run verify:release -- --self-test
npm run pack
```

---

## 7. 风险登记

| 风险 | 触发信号 | 缓解 |
| :--- | :--- | :--- |
| A4 目录搬动打断下游脚本引用 | 下游/NPM 脚本里出现 `test/st-*.js` 硬编码路径 | 先在 `test/README.md` 落索引并保留一版转发 stub，下一版删除 |
| B3 枚举语义与 B1 状态读写打架 | `getLayoutState()` 返回的 `size` 在 `width-only` 下语义不明 | 先定语义：`size` 中缺省字段即「不持久化」，`get` 返回实际生效字段；B1 完成后才动 B3 |
| C1 打断读取 `panel.style.*` 的下游 | 下游报「尺寸读不到」 | `data-nvui-legacy-size` 兼容一版 + `NVUI.diagnostics()` 报出兼容开关状态 |
| 浏览器套件在 CI 上不可用 | CI 需要 Chrome | 正因如此，A3 的浏览器段必须**可跳过**，CI 只跑静态 + `pack` |
| 计划文档与实现漂移 | ROADMAP 写的与 CHANGELOG 不一致 | 每个里程碑关闭时同步更新本文件与 `ISSUES.md` |

## 8. 已拍板决策（原「待拍板」）

1. **B3 命名** → 定为 `'width-only'`（v2.9.0 已交付）。与 `size` 名词一致，`persist.size: 'width-only'` 读起来就是「只记宽」。
2. **A2 依赖策略**：`playwright-core` 进 `devDependencies` 会不会影响「零依赖」宣传口径？倾向：运行时仍零依赖，README 明确「开发期可选依赖」。
3. **C1 变量名** → 定为 `--nvui-panel-w` / `--nvui-panel-h`（v3.0.0 已交付）。与既有 `--nvui-panel-width` 同族，且 `-w` / `-h` 与状态里的 `w` / `h` 对齐；`--nvui-size-*` 太泛，会让人以为管所有尺寸。
4. **C4 支持下限** → 仍承诺 SillyTavern 1.12.0（v3.0.0 已交付，README §11.5 第一行）。v3.0 的新依赖只有 `style.setProperty` 自定义属性支持，不构成抬高门槛；1.19 / 1.20 实机都已在 `test:host` 覆盖。

## 9. 下游公告模板（v3.0.0 发布用）

> **ui-kit v3.0.0 是 MAJOR，四类契约变更**
>
> 1. **面板尺寸不再写内联 px**，改用 CSS 变量 `--nvui-panel-w` / `--nvui-panel-h`。用 CSS 覆盖面板宽度的
>    写法**从这版起才真的生效**；反过来，读 `panel.style.width` 的代码要改读变量或 `panel.getLayoutState().size`。
> 2. **布局状态格式升 v2**：`{ version: 2, size: { w, h, mode } }`（`mode` = `normal` / `maximized` /
>    `width-only` / `off`）。v1 存档自动迁移、落盘写 v2，你不需要清存储。
> 3. **四套按钮组规则归一**（零 specificity），`.nvui-btn-row` 在 v3.x 内是 `.nvui-actions` 的别名。可见差异：
>    窄屏按钮换行而不是溢出。
> 4. **`tokens.json` 升 schema 2**：值结构不变，新增 `schema` / `meta` / `groupDescriptions`。遍历顶层键当
>    令牌名的代码要改成遍历 `dark` / `light`。
>
> 另：新增 `engines.node: >=18.0.0`（只影响开发期脚本）与 README §11.5 兼容矩阵硬门禁。
>
> **只覆盖 4 资产、不碰上述四类的插件不用改代码。** 过渡开关 `data-nvui-legacy-size` 可临时回到内联 px 行为，
> v3.1 移除。完整对照与升级步骤见 [MIGRATION-v3.md](MIGRATION-v3.md)。

---

## 10. 明确不做

- 不再开「逐帧重排」性能改造轮次：#3 / #8~#12 已用帧间隔实测证伪（`test/st-perf-*.js`）。
- v2.x 内不动 DOM 必需层级与载体结构（留给 C1 / C2）。
- 不引入运行时第三方依赖；`playwright-core` 只允许是开发期依赖。
- 不提供全局 `setGlassMode` 之类的全局状态开关（`glass` 仍是面板级 opt-in）。
- 不为单个下游的布局定制新增 token（下游用 CSS 变量覆盖即可）。
