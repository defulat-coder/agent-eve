# 架构候选 backlog

来源：`improve-codebase-architecture` 评审，按 `codebase-design` 的 module / interface / depth / seam / adapter / leverage / locality 词汇维护。

## 候选

| 状态 | 议题 | 强度 | 下一步 |
| --- | --- | --- | --- |
| completed | 收拢 Agent job intake module | Strong | API route 已穿过 `AgentJobIntake` interface，BullMQ lifecycle 留在 implementation 内 |
| pending | 压窄 Worker runtime seam | Worth exploring | 减少测试对 BullMQ event 和 job shape 的 leakage |
| pending | 收拢 Queue runtime knowledge | Worth exploring | 等 queue 装配继续增长后再集中 Redis/BullMQ 规则 |
| deferred | 集中 Health display locality | Speculative | 等第二个页面或测试重复使用 health panel 映射 |

## 执行规则

- 每轮只处理一个可执行候选。
- 每轮必须做聚焦验证。
- 每轮完成后用中文 Conventional Commit 提交。

## 已完成

### 收拢 Agent job intake module

- 日期：2026-07-02
- locality：`/agent/jobs` route 不再知道 Redis URL 或 BullMQ queue lifecycle。
- leverage：route-level 测试可替换 `AgentJobIntake` adapter。
- 聚焦验证：`pnpm --filter @agent-template/api lint`、`pnpm --filter @agent-template/api typecheck`、`pnpm --filter @agent-template/api test`
