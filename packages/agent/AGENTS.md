# packages/agent 协作指南

## 职责

`packages/agent` 是 Agent runtime 公共边界，负责解析 runtime env、选择 runtime，并执行 Agent run 的公共 contract。

## 能力边界

- `AgentRuntimeEnvSchema` / `parseAgentRuntimeEnv` 统一维护 Agent runtime 相关环境变量。
- `getAgentRuntimeStateFromEnv` 返回当前 runtime、配置状态和模型。
- `runAgent` 是 Chat SSE 和 Worker 共同调用的 Agent run execution seam，负责 run input validation、runtime dispatch 和 execution result assembly。
- 具体实现委派给 `@agent-template/agent-claude` 或 `@agent-template/agent-eve`。
- runtime adapter 已产生的 Agent run event 通过 `AgentRunResult.events` 透出；这里不新增持久化。
- `TOOLBOX_URL` 只在选择 Claude 时透传给对应 runtime；Eve 进程从自己的环境读取连接配置。公共 selector 不维护 MCP allowlist 或 client lifecycle。

## 不应该做

- 不在这里处理 HTTP 请求。
- 不在这里处理 BullMQ job 生命周期。
- 不把具体业务 prompt 或产品逻辑写进公共 agent package。
- 不从 request payload 或 job payload 覆盖 runtime；runtime 只读 `AGENT_RUNTIME`。
- 不要求本地开发必须配置 `ANTHROPIC_API_KEY`。
- 不把未配置 runtime 伪装成已执行成功；返回 `status: "skipped"`。
- 不把 Toolbox server 当成第三套 Agent runtime；它是 Claude/Eve 各自连接的外部 Tool provider。

## 验证

```bash
pnpm --filter @agent-template/agent lint
pnpm --filter @agent-template/agent test
pnpm --filter @agent-template/agent typecheck
pnpm --filter @agent-template/agent build
```
