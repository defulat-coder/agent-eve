# packages/agent 协作指南

## 职责

`packages/agent` 是 Agent runtime 公共边界，负责解析 runtime env、选择 runtime，并执行 Agent job 的公共 contract。

## 能力边界

- `AgentRuntimeEnvSchema` / `parseAgentRuntimeEnv` 统一维护 Agent runtime 相关环境变量。
- `getAgentRuntimeStateFromEnv` 返回当前 runtime、配置状态和模型。
- `runAgentJob` 是 Worker 调用的 Agent job execution seam，负责 queued payload validation 和 runtime dispatch。
- 具体实现委派给 `@agent-template/agent-claude` 或 `@agent-template/agent-eve`。

## 不应该做

- 不在这里处理 HTTP 请求。
- 不在这里处理 BullMQ job 生命周期。
- 不把具体业务 prompt 或产品逻辑写进公共 agent package。
- 不从 job payload 覆盖 runtime；runtime 只读 `AGENT_RUNTIME`。
- 不要求本地开发必须配置 `ANTHROPIC_API_KEY`。

## 验证

```bash
pnpm --filter @agent-template/agent lint
pnpm --filter @agent-template/agent test
pnpm --filter @agent-template/agent typecheck
pnpm --filter @agent-template/agent build
```
