# OPEN-DECISIONS · novel-stream MVP（v2.0.0）

> 只追加 + 就地关闭（OPEN → RESOLVED，补 Resolution 字段）。关闭的项可升格 ADR。
> 三类固定 slug：waiting-on-external-condition / design-decision-to-evaluate / existing-design-boundary

| Date | Source | Open Item | Related Constraints | Current Leaning | Blocked By | Resolves When | Status |
|------|--------|-----------|---------------------|-----------------|------------|---------------|--------|
| 2026-10-20 | Phase 0 | ui-kit 资产引入方式：vendor 进仓库 vs CDN 动态加载 | 酒馆扩展从 GitHub 一键安装；用户可能离线/内网 | vendor 四件套进 `ui-kit/` 子目录（版本锁定 v2.2.0） | 设计师给出正式建议 | Spec 定稿 | **RESOLVED**（2026-10-20 总监裁断：采纳设计师建议，vendor 整个 ui-kit 目录除 .git——含 README/preview/CHANGELOG/test，因 Kit 自带 test-ui-kit.js 读取这些文件做版本一致性与编码断言；升级=整目录覆盖+跑 Kit 测试） |
| 2026-10-20 | Phase 0 | 服务端自动落盘（plugins/auto-save）是否回归 | 用户已确认 MVP 砍掉服务端；需 config.yaml + 重启酒馆，门槛高 | v2.1 候选，看 MVP 用户反馈 | 等 MVP 上线后反馈 | 有 ≥3 个用户反馈「要自动落盘」 | OPEN |
| 2026-10-20 | Phase 0 | 导出成功/失败反馈是否允许用 NVUI.showToast | 用户砍掉了「Toast」功能（指连载更新提示）；导出是核心操作的唯一反馈 | 允许 1 次性导出反馈 toast（非连载提示），用 kit 的 showToast | 总监裁断 | Spec 定稿 | **RESOLVED**（2026-10-20 总监裁断：允许。`type: success/danger`、`role=status`、默认 3.2s 自动消失；与「文件」页持久状态行并存，toast 不是唯一反馈通道） |
| 2026-10-20 | 用户裁断 | ui-kit 资产引入方式改在线优先（推翻同日 vendor 决议） | Kit 由上游独立维护、持续迭代；用户可能离线/内网的约束仍在 | jsDelivr CDN `@2` 锚点在线优先（自动跟随 2.x，破坏性变更不进入），超时/失败回退本地 vendor 副本；Kit 缺陷不修本地、提上游 issue | 无 | — | **RESOLVED**（2026-10-20 用户裁断：在线优先 + vendor 兜底。落地于 index.js 顶部加载器：JS/CSS 均 CDN 优先、10s 超时回退 import.meta.url 解析的本地路径；升级不再依赖整目录覆盖，本地副本仅兜底不打补丁） |
