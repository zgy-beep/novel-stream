# test/probe/ 一次性探针与历史实机脚本

本目录收的是**不进任何门禁**的脚本：它们要么依赖宿主侧 lab 扩展（`window.__NVUI_LAB__`），
要么是一次性根因/性能探针，结论已固化进 `ISSUES.md` / `CHANGELOG.md`。

判定标准与移动记录见 `ISSUES.md`「维护记录」的「G-05 / A4 测试归档」两行。

## 1. 使用约定

- **不要把这里的脚本接进 `npm` 门禁**：它们没有稳定的前置条件，出现假红会污染发布判据。
- 需要长期守护的行为，请写到 `test/*.spec.js` / `test/stress-*.js` / `test/host/`。
- 脚本里的相对路径已按本层目录修正（`path.resolve(__dirname, '..', '..')` = 仓库根）。
- 运行前先确认宿主在线（`http://127.0.0.1:8000`）并把 `NO_PROXY` 设为 `*`，多数脚本会自行处理代理。

```bash
cd <repo>
node test/probe/st-review-verify.js      # 例：62 条实机复验
```

## 2. 清单（30 个）

`lab` 列 = 是否依赖宿主侧 `window.__NVUI_LAB__` 夹具（ST 1.19.0 默认不带，故不可直接复跑）。

| 脚本 | 用途 | lab |
| :--- | :--- | :--- |
| `adversarial-url-v250.js` | M2-Gate2 对抗性套件：`isSafeUrl()` 消毒 + 更新胶囊（`showUpdate`） | — |
| `st-carrier-host-modal-check.js` | #17 载体让位：宿主 `showModal()` 下 `.is-host-modal` 增删 / 不可点 / 压暗 / `getCarrierState()` 快照 / 还原（18/18） | ✓ |
| `st-destroy-close-check.js` | destroy → close 事件传播与兜底摘除的故障注入（11 条） | — |
| `st-focus-probe.js` | 焦点归还根因探针 | — |
| `st-glass-fallback-check.js` | #15/#21/#22 玻璃回退：no-blur 下探测值 / `.nvui-glass-fallback` / 97% 近不透明档 / 移除后自愈（9/9） | ✓ |
| `st-glass-probe.js` | 玻璃生效探测：宿主 no-blur 下 `backdrop-filter` 是否被关掉 | ✓ |
| `st-layer-check.js` | 层级回归：面板 5 采样点是否在宿主之上 / 吐司是否高于面板 / 关闭后还原 | ✓ |
| `st-layer-probe.js` | 层级根因：对比 `dialog.show` / `showModal` / `popover` / 固定 div 的命中顺序 | — |
| `st-live-check.js` | 运行时行为回归 6 项：冒泡截断 / Esc 单例 / destroy / id 唯一 / focus trap / 焦点归还 | ✓ |
| `st-modal-layer-check.js` | #16 模态层级：宿主模态打开时 kit 浮层是否被压住 / 可聚焦 / 关闭后还原 | ✓ |
| `st-perf-probe.js` | 性能总探针（#8/#9/#10/#12）：CDP `Performance.getMetrics` 布局次数与耗时 + 双层 blur 帧间隔 | — |
| `st-perf-tabs-fine.js` | #9 精测：分离「创建 DOM」与「纯动画」成本（width 过渡 / 无过渡 / transform） | — |
| `st-perf-tabs-frames.js` | #9 帧间隔判定：过渡期间 rAF 分布 vs 无动画基线 | — |
| `st-perf-tabs-options.js` | #9 方案选型：`contain` / `will-change` / transform 缩放四组对照 | — |
| `st-review-2026-verify.js` | 2026 深度加固复验：24 条（NEW-25 ~ NEW-46） | — |
| `st-review-diag.js` | 针对性诊断：焦点落点 / input type 白名单 / 观察器收窄 | — |
| `st-review-harness.js` | **可复用实机脚手架**：`launch()` / `injectKit()` / `assert()` / `summary()` / `cleanup()` | — |
| `st-review-harness-selftest.js` | 脚手架自测 15 项（注入后 `NVUI.version`、open/close/destroy、零 pageerror） | ✓ |
| `st-review-host-probe.js` | 宿主环境与扩展安装状态探测（只读） | ✓ |
| `st-review-legacy-preload.js` | 历史脚本预加载兼容层（应对宿主 LAB 夹具缺失） | — |
| `st-review-provenance.js` | **版本溯源**：HTTP 响应体字节 md5 对比仓库 md5，证明测的是最新版 | — |
| `st-review-repro-n07-detail.js` | NEW-07 观察器触发频率细测 | — |
| `st-review-repro.js` | 修复前复现：29 条（修复前 11 PASS / 18 FAIL → 修复后 29/29） | — |
| `st-review-verify-r4.js` | 第四轮专项 27 条（含 NEW-16 destroy 摘除时机） | — |
| `st-review-verify-r5.js` | 收口专项 18 条（6 轮循环验证 document 委托稳定性） | — |
| `st-review-verify.js` | 修复后复验：62 条（正常路径 + 异常输入 + 历史契约） | — |
| `st-template-check.js` | ST 模板实机 7 项：扩展加载 / 菜单开面板 / tab 同步 / 吐司 / Esc 焦点归还 / 设置回写 / 移动端 | — |
| `st-template-new22-check.js` | NEW-22 非本地宿主门禁（`--host-resolver-rules` 构造真实非本地场景） | — |
| `st-toplayer-probe.js` | top-layer 探针：非模态 `dialog.show()` 是否进浏览器 top layer（结论：不进） | — |
| `test-challenger-m4-2-live-host.js` | M4-2 挑战者实机核对：面板打开 / 持久化 / 主题 / 更新胶囊 / 720px 黄金宽度 / 零 pageerror | — |

## 3. 结论去哪里查

| 想查什么 | 看哪里 |
| :--- | :--- |
| 某个探针得出的结论 | `ISSUES.md`「实机测试脚本」两节 + 「已修复」表 |
| 当前真正的门禁是什么 | `test/README.md` §1–§3、`TEST_INFRA.md` §3 |
| 改动 `createPanel` 必跑哪些 | `TEST_INFRA.md` §3.1 |
