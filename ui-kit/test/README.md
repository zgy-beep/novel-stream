# test/ 索引

按「能否无宿主复跑」分类。**新增脚本前先确定它属于哪一类**，别再往根目录堆一次性探针。

## 1. 静态门禁（无需宿主 / 无需浏览器）

| 入口 | 脚本 | 说明 |
| :--- | :--- | :--- |
| `npm test` | `test-ui-kit.js` | 规范守护主体：文件结构、令牌清单、组件三方覆盖、CSS 红线、版本一致性、复杂度冻结、模板自洽 |
| `npm run test:api` | `test-api-surface.js` | 导出面冻结（29 顶层导出 + 控制器方法） |
| `npm run test:v280` | `test-v280-features.js` | v2.8.x 功能契约（selfCheck / defaults / force 玻璃） |
| `npm run test:compat` | `test-compat-matrix.js` | 兼容矩阵硬门禁：README §11.5 当前大版本线那行 ↔ `manifest.minimum_client_version` ↔ `package.json engines.node` ↔ `checkCompatibility` / `migrateStateV1toV2` 四方自洽 |
| `npm run tokens:check` | `scripts/tokens-v1-to-v2.js --check` | `tokens.json` schema 2 元信息与 `tokens.css` 注释是否漂移（`tokens:migrate` 重新生成） |
| `npm run verify:release` | `scripts/verify-release.js` | 发布一致性：版本自洽、模板 MD5、CDN tag、CHANGELOG / README 时间线；`--self-test` 做反向验证 |

## 2. 浏览器 spec（需 Chrome + `playwright-core`，无需 ST 宿主）

**前置**：`npm i`（`playwright-core` 是 devDependency）+ 本机 Chrome（`CHROME_PATH` / `ST_CHROME` 可覆盖）。
解析顺序与缺包时的修复命令统一在 [`scripts/resolve-browser.js`](../scripts/resolve-browser.js)，缺环境时退出码 2。

| 入口 | 脚本 |
| :--- | :--- |
| `npm run test:browser` | `test-issues-9-10-forms.js` → `test-issue-11-accordion.js` → `issue-12-optgroup-dark-theme.spec.js` → `issue-13-14-focus-escape.spec.js` → `issue-16-persist-size.js`（12）→ `issue-21-ux.spec.js`（11）→ `v290-layout-state.spec.js`（10）→ `v290-width-only.spec.js`（9）→ `v290-diagnostics.spec.js`（8）→ `v290-theme-auto.spec.js`（10）→ `v290-resize.spec.js`（11）→ `v290-inputrow.spec.js`（8）→ `v300-size-vars.spec.js`（8）→ `v310-audit.spec.js`（GH-#23–GH-#29，7 项） |
| `npm run test:issue16` / `test:issue21` / `test:layout` / `test:widthonly` / `test:diagnostics` / `test:theme` / `test:resize` / `test:inputrow` / `test:sizevars` | 单跑某一条回归（改持久化 / 进度条 / 滚动行为 / 布局导入导出 / 尺寸三态 / 诊断快照 / 主题跟随系统 / 调尺寸手柄 / 输入行 / 尺寸载体与状态迁移时） |
| `npm run test:stress` | `stress-m1-persistence.js`（19，持久化/损坏数据/竞态）→ `stress-m2-header.js`（15，头部控制流） |
| `npm run test:e2e` | `test-e2e-v250.js`（58，v2.5.0 全路径） |
| `npm run test:glass` | `st-glass-transparency.js` |

## 3. 宿主实机（需真实 SillyTavern + Chrome）

**前置**：宿主在 `http://127.0.0.1:8000`（可 `NVUI_HOST_URL` 覆盖）、Chrome 可执行（`CHROME_PATH`）、
`playwright-core` 可解析（`npm i` 后的本地 devDependency，或 `NODE_PATH`）。三者统一由
`scripts/resolve-browser.js` 解析，缺条件时退出码 2 并打印修复命令。

| 入口 | 脚本 | 断言数 |
| :--- | :--- | :--- |
| `npm run test:host` | `host/smoke-panel.js` + `host/smoke-deep.js` | 35 + 19 |
| `npm run test:host:panel` | `host/smoke-panel.js` | 35 |
| `npm run test:host:deep` | `host/smoke-deep.js` | 19 |

产物（截图 / result.json）默认写 `st-lab-out/host/`，已被 `.gitignore` 排除。
基线结果与覆盖范围见 `TEST_INFRA.md` §3.2。

## 4. 历史实机脚本与一次性探针 → `probe/`

**2026-11-16 起根目录只保留可回归脚本**（上表 1–3 类），其余 30 个历史实机脚本与一次性探针统一收进
[`probe/`](probe/README.md)：依赖宿主 lab 扩展的（`st-live-check.js` 等 8 个）、根因/性能探针
（`st-layer-probe.js`、`st-perf-*.js` 等）、2026-10 审查批次（`st-review-*.js`）都在那里。

它们**不进任何门禁**，清单、用途与 lab 依赖见 [`probe/README.md`](probe/README.md)。新增回归请写到
`test/*.spec.js` / `test/stress-*.js` / `test/host/`，不要往根目录堆一次性探针。

## 5. 一次性探针（归档）

`archive/2026-10/` 存放已退役的一次性探针（7 个），仅作历史证据，不纳入任何门禁。
判据与依赖改动见该目录的 `README.md`。
