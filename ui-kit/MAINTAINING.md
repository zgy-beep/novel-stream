# 维护流程规范（Maintaining）

本文件定义三件事的**标准动作**，目的是让维护不依赖记忆、不依赖临时提醒：

1. [什么时候提交、提交信息怎么写](#1-提交规范)
2. [什么时候升版本、升到哪一位、什么时候打 tag](#2-版本迭代规范)
3. [GitHub Issue 什么时候关、怎么关、多久巡查一次](#3-github-issue-维护规范)

最后是[每轮的 Definition of Done](#4-每轮的-definition-of-done) 与[一张速查表](#5-速查表)。

## 0. 与其它维护文档的分工

| 文件 | 只记什么 | 不记什么 |
| :--- | :--- | :--- |
| `MAINTAINING.md`（本文件） | **流程与判据**：何时做、做到什么程度才算完 | 具体改了哪些代码 |
| [`CHANGELOG.md`](CHANGELOG.md) | **历史事实**：每个已发布版本改了什么 | 流程、待办 |
| [`ISSUES.md`](ISSUES.md) | **维护者工作队列**：本地序号、复现证据、修复记录 | 公开讨论 |
| [`ROADMAP.md`](ROADMAP.md) | **线路视图**：A/B/C 三条线的目标与状态 | 单条缺陷 |
| [`TEST_INFRA.md`](TEST_INFRA.md) | **门禁地图**：改哪块代码必须跑哪些测试 | 发布节奏 |

冲突时以本文件为流程准绳，以 `CHANGELOG.md` 为历史准绳。

---

## 1. 提交规范

### 1.1 什么时候必须提交

**判定原则：一个提交 = 一个能独立 `git revert` 而不牵连其它改动的语义单元。**
只要达成下列任一条件，就必须立刻提交，不允许攒过一轮、更不允许攒过夜：

| # | 触发点 | 典型例子 |
| :--- | :--- | :--- |
| T1 | 一个缺陷修复完成，且对应回归断言已补、门禁已跑 | 焦点陷阱修正 + T1b 用例 |
| T2 | 一次纯内部重构完成，**行为零变化**且全门禁绿 | 抽 `createFocusChain(ctx)` |
| T3 | 一次版本准备完成：10 处版本 + CHANGELOG + `verify:release` 通过 | `chore(release): prepare v2.8.1` |
| T4 | 测试/门禁能力本身发生变化（新增套件、提升基线、改阈值） | 实机冒烟入库 `test/host/` |
| T5 | 文档形成独立闭环（新增文件、章节级重写） | 本文件首次落地 |
| T6 | 某个 issue 的**全部验收项**落地，可以进入「待发布」 | G-01 抽完最后一类 |

**必须拆开提交的情形**（合成一个提交视为违规）：

- 行为变更 + 内部重构 —— 重构必须能被单独证明「零行为变化」；
- 版本号 bump + 功能改动 —— 除非该功能就是本版本的唯一内容；
- 多个互不相关的 issue 修复；
- 大规模格式化/换行符统一 + 任何逻辑改动。

**禁止**：`wip` / `tmp` / `fix again` / `更新一下` 这类提交；跨天未提交；把编辑器自动格式化噪音混进功能提交。

### 1.2 提交信息格式

```
<type>(<scope>): <英文祈使句，≤72 字符，无句号>

<body：为什么改 + 关键决策 + 已知取舍；每行 ≤ 100 字符，可多段；破坏性变更写 BREAKING CHANGE:>

Tests: <真实执行的命令与结果数字，多项用分号>
Refs: #N            ← 部分完成
Fixes: #N           ← 真正关闭该 issue 时才写
```

`type` 取值（与仓库历史一致，不引入新词）：

| type | 用于 |
| :--- | :--- |
| `feat` | 新增能力、新增版本（含版本准备提交） |
| `fix` | 缺陷修复 |
| `refactor` | 行为零变化的内部重组 |
| `perf` | 性能优化 |
| `test` | 只动测试/门禁 |
| `docs` | 只动文档 |
| `chore` | 构建、依赖、发布准备（`chore(release): prepare vX.Y.Z`） |
| `revert` | 回滚，body 必须写被回滚的 hash 与原因 |

`scope` 取值：`api` / `css` / `tokens` / `template` / `test` / `host` / `docs` / `release`。

硬性要求：

1. **subject 用英文**（便于 `git log --oneline` 对齐既有历史），body 中英混排不限；
2. body 的 `Tests:` 行**必须写实测数字**，不允许写「tests pass」；
3. 涉及 `createPanel` 或任一 factory 的重构，`Tests:` 必须含 `test:stress`；
4. 涉及焦点/生命周期/Esc 栈，`Tests:` 必须含 `test:browser` 与 `test:host`（宿主在线时）；
5. 改动 `README §11.5` 兼容矩阵、`package.json engines.node` 或 `manifest.minimum_client_version`，`Tests:` 必须含 `test:compat`；
6. 提交前 `npm test` 必须通过。主干单人维护，**不接受红着提交**。

### 1.3 提交与 issue 的绑定

| 场景 | 提交里写 | GitHub 侧动作 |
| :--- | :--- | :--- |
| 修复 + 本版就发布 | `Fixes: #N` | 推送后自动关闭 |
| 修复但本版不发布（待发布状态） | `Refs: #N` | 打 `fixed-pending-release` 标签 + 进度评论 |
| 只完成部分验收项 | `Refs: #N` | issue 内勾选对应项 + 一句话进度 |
| 纯文档/重构/测试 | 不写 | 无需动作 |

---

## 2. 版本迭代规范

### 2.1 三态模型（关键：区分「已 bump」和「已发布」）

| 状态 | 判据 | `package.json.version` | Git tag |
| :--- | :--- | :--- | :--- |
| **开发中** | 有未判定级别的改动 | 保持上一个**已发布**版本 | 无 |
| **待发布** | 级别已判定、10 处版本已 bump、CHANGELOG 有 `## vX.Y.Z` 条目、`verify:release` 通过、已提交 | 新版本 | **无**（还没打） |
| **已发布** | 附注 tag 已推、GitHub Release 已建 | 新版本 | `vX.Y.Z` |

规则：

1. **「待发布」是合法状态，允许停留多天**（v2.8.2 准备期就曾停留此态，直到 tag 推出）。此时禁止再往该版本塞新功能：要么本版消化，要么留给下一版并顺延版本号。
2. **`CHANGELOG.md` 不使用 `Unreleased` 标题**。待发布版本就是实体条目：标题写 `## vX.Y.Z（YYYY-MM-DD）`，日期为**准备日**；发布跨天则改为实际发布日期。
3. tag 一旦推出就不要重打。发现漏改 → 发下一个 PATCH，而不是 `tag -f`。
4. 版本号只增不减；撤回功能用 `revert` 提交 + 新 PATCH，不改历史版本号。

### 2.2 升哪一位（判定树，从上往下命中即止）

1. 删除了 public API / token / 组件类？重命名了 DOM 契约或必需挂载点？→ **MAJOR**
2. 新增 token / 组件族 / public API / 可选配置项 / 官方模板？→ **MINOR**
3. 其余（缺陷修复、健壮性、可访问性细节、内部重构、文档、测试）→ **PATCH**

容易判错的边界：

| 改动 | 级别 | 理由 |
| :--- | :--- | :--- |
| 只改 `aria-*`、焦点顺序、键盘可达性 | PATCH | 可访问性细节，不扩张契约 |
| 新增 CSS 变量但未写入 `tokens.css` / `tokens.json` | PATCH | 未成为公开 token 前属实现细节 |
| 新增 `data-*` 钩子且写进文档 | MINOR | 下游可依赖 = 契约扩张 |
| 删除从未导出的内部函数 | PATCH | 外部不可见 |
| 删除 `NVUI.*` 导出成员 | MAJOR | 下游会 `undefined is not a function` |
| 改默认值（面板宽度、超时、防抖） | MINOR | 行为可见变化，但不破坏契约 |
| 改变持久化存储键或结构 | MAJOR | 下游已有用户数据会失效 |

### 2.3 一个版本允许多少提交

不限。但必须满足：

- 功能/修复各自独立提交，位于版本收口提交**之前**；
- 必须有一个 `chore(release): prepare vX.Y.Z` 收口提交，内容是「10 处版本 bump + CHANGELOG 条目 + 模板 4 资产同步」，便于整体回滚与定位；
- 收口提交的 `Tests:` 必须含 `verify:release --self-test` 与 `pack`。

### 2.4 发布动作（顺序固定，不许跳步）

```bash
npm run verify:all              # 唯一门禁入口：10 步（test/api/v280/compat/downstream/
                                # verify:release/pack 产物校验/browser/stress/e2e）
npm run test:host               # 宿主在线时（不在 verify:all 里，需要真实 ST）
npm run verify:release -- --self-test
npm run pack                    # 产出 ui-kit-X.Y.Z.zip
git tag -a vX.Y.Z -m "vX.Y.Z"
git push --follow-tags
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <notes>
```

`verify:all` 缺 Chrome 或缺 `playwright-core` 时，后三段（browser / stress / e2e）报 SKIP 并返回 0 —— 这种情况下**必须**在有 Chrome 的机器上补跑一遍三段，不能拿 SKIP 当通过。

Release notes 必含四块：**版本定位 / 核心更新与缺陷（列 GH 编号）/ 兼容性说明 / 自动化验证数据**（真实数字）。
`gh release create` 若报「同 tag 的 Release 已存在」，是 CI 的 release job 抢先建了占位：用
`gh release edit vX.Y.Z --notes-file <notes>` 覆盖正文、`gh release upload vX.Y.Z <files> --clobber` 重传产物。
**绝不要**把 workflow 改回 `action-gh-release` + `generate_release_notes`（v2.8.3 实测会把正文整段换成 Full Changelog）。

发布后立刻做三件事：① 关闭本版已修 issue（§3.3）；② `ROADMAP.md`「已发布」区追加一行；③ `README §11.4` 时间线补行（`verify:release` 会校验）。

### 2.5 版本与 issue 的对应

- MINOR / MAJOR 必须有对应的 Roadmap issue（线路 A/B/C），PATCH 允许无 issue；
- 一个 issue 只归属一个版本，不允许「计划随 2.8.1，也可能拖到 2.9.0」这种模糊表述；
- Release notes 必须列出本版**关闭**的 issue 编号。

---

## 3. GitHub Issue 维护规范

### 3.1 巡查节奏（主动做，不等提醒）

| 时机 | 必做动作 |
| :--- | :--- |
| **每个提交后** | 若提交涉及某 issue：评论一条进度（一句话 + commit hash）；部分完成则勾选验收项 |
| **每轮工作收尾** | `gh issue list --state open` 逐个核对：状态、标签、与 `ISSUES.md` 是否一致 |
| **每次发版** | 关闭本版已修 issue；Release notes 关联；核对是否有「实际已修但忘关」的 |
| **每 10 个提交或每周** | 扫一遍 open issue：有无 stale、有无可合并的重复项、优先级是否还成立 |

### 3.2 状态机

```
OPEN（新建）
  └─ 确认 + 分级（打 type 标签）        ← 不允许无标签长期挂着
       └─ 修复中（评论说明在哪个提交/分支）
            └─ 已修复待发布（标签 fixed-pending-release）  ← 代码+回归已落地，tag 未推
                 └─ CLOSED（tag 已推 + Release 已建）
```

不允许：代码没落地就关；只关不评论；一个 issue 混装多个不相关任务；用「已修复」描述只有计划没有代码的状态。

### 3.3 关闭判据（只有三种合法关闭）

| 情形 | 判据（缺一不可） | 关闭方式 | 关闭时必须留下 |
| :--- | :--- | :--- | :--- |
| **A. 已发布修复** | tag 已推 + Release 已建 + 验证数据齐 | 优先在发布提交里写 `Fixes #N` 自动关；否则手动关 | 修复版本、commit hash、验证方式与数字 |
| **B. 确认不修** | 有实测数据或规范依据（禁止仅凭推理） | 手动关 + `wontfix` / `invalid` 标签 | 为什么不修、证据、替代方案或规避写法 |
| **C. 重复 / 已合并** | 存在保留的 issue | 手动关 + `duplicate` 标签 | 指向保留 issue 的编号与链接 |

**禁止关闭**：验收项只完成一部分；「应该修好了」但没有回归或实机验证；等用户确认（应转 `question` 标签并给出**建议默认值 + 期限**，到期按建议执行并说明）。

### 3.4 标签规范

- **类型标签必选 1 个**：`bug` / `enhancement` / `accessibility` / `documentation` / `question`；
- **状态标签可选 1 个**：`fixed-pending-release`（已修未发）；
- 不自造更多标签。本仓库单人维护，标签多了没人看。

### 3.5 本地台账同步（`ISSUES.md`）

- GitHub 编号一律写 `GH-#N`，本地维护者序号写 `#N`，两套序列**永不混用**；
- 每次改 GitHub 状态，**同一次提交**里改 `ISSUES.md` 对应行（状态 + 证据 + 修复版本）；
- `ISSUES.md` 的行状态只有五种：`待办` / `修复中` / `已修复` / `已确认-不修` / `已上报`。

---

## 4. 每轮的 Definition of Done

一轮工作（无论大小）收尾前逐条打勾，缺项即视为未完成：

- [ ] 代码改动有对应回归断言（静态 `test/test-ui-kit.js` 或浏览器 spec 或实机冒烟）
- [ ] 相关门禁**真实执行**过，数字写进提交 body 与工作日志
- [ ] 提交已落库，message 符合 §1.2，含 `Tests:` 行
- [ ] 版本级别已判定：本版消化 or 明确记入下一版
- [ ] GitHub issue 已按 §3 更新（进度评论 / 标签 / 关闭），无「已修忘关」
- [ ] `ISSUES.md`、`ROADMAP.md`、`CHANGELOG.md` 三处状态一致
- [ ] `.workbuddy/memory/YYYY-MM-DD.md` 追加本轮记录（含新踩的坑）
- [ ] 若处于「待发布」：`verify:release` 通过，且未把新功能塞进该版本

---

## 5. 速查表

| 我做了什么 | 提交？ | 升版本？ | GitHub？ |
| :--- | :--- | :--- | :--- |
| 修了个 bug，回归已补 | 立刻 | 记入下个 PATCH | 进度评论；发布后 `Fixes` |
| 抽了个 factory，行为不变 | 立刻（`refactor`） | 记入下个 PATCH | 通常无需 |
| 加了新 API / 组件 | 立刻（`feat`） | 下个 MINOR | `Refs` + 勾选验收项 |
| 删/改了公开契约 | 立刻（`feat!` + BREAKING） | 下个 MAJOR | 需要迁移说明与公告 |
| 只改文档 | 立刻（`docs`） | 通常不升 | 无 |
| 只改测试/门禁 | 立刻（`test`） | 通常不升 | 若提升基线，评论说明 |
| 判定「不是问题」 | — | — | `wontfix` + 证据后关闭 |
| 版本 10 处已 bump | `chore(release)` 收口 | 该版本 | 打标签 `fixed-pending-release` |
| tag 已推 + Release 已建 | — | 已发布 | 关闭本版 issue + ROADMAP 追加 |

---

> 本文件自身也是受管文件：修改流程规则时，必须同步检查 `README §11.3`、`ISSUES.md` 顶部规则、`ROADMAP.md` 维护约定三处是否仍与本文件一致。
