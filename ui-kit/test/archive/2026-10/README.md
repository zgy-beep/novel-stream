# test/archive/2026-10

2026-10 系统性 review / 多 Agent 审计期间写的一次性探针，已从 `test/` 根目录移出以减少噪声。

归档判据：**没有任何脚本、`package.json` 或文档引用**（`README` / `ISSUES` / `CHANGELOG` / `TEST_INFRA` / `AI-GUIDE` 全文检索为 0 命中）。

同批的另外 13 个探针（`st-focus-probe` / `st-glass-probe` / `st-layer-probe` / `st-perf-*` / `st-review-diag` / `st-review-repro*` 等）**保留在 `test/` 原位**，因为 `ISSUES.md` / `CHANGELOG.md` 把它们作为缺陷复现证据引用，移动会断掉历史链。

运行方式（需要 `playwright-core`，本机从 WorkBuddy 托管 node workspace 注入）：

```bash
export NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules"
node test/archive/2026-10/st-review-diag-n03.js <输出目录>
```

需要真实 SillyTavern 宿主（`http://127.0.0.1:8000`）与 Chrome。
