# Claude production runtime

`agent/` 是独立的 Claude Code filesystem-authored surface，`src/` 是平台执行适配。生产基线包括：

- `CLAUDE.md` 保存稳定行为约束，`.claude/skills/` 保存按需加载的业务 Skill。
- `.mcp.json` 只声明 Toolbox HTTP MCP；`.claude/settings.json` 持有精确 allowlist 和 fail-closed 权限。
- 内建 Shell、文件读写、任意外网和 Subagent 工具不进入模型工具面；Skill 内联 Shell 已关闭。
- SDK run 有显式 turn、USD、超时和自动 compaction 上限。
- session transcript 持久化到 `CLAUDE_AGENT_STATE_DIR`，公共协议只返回带签名、可过期的不透明 continuation。
- continuation 通过 Redis 原子 lease 防止跨 replica 并发与重放，完成后轮换新 token。
- `AskUserQuestion` 使用官方 `PreToolUse: defer` 流程退出当前进程，经 Web 收集结构化回答后 `resume` 原 session。
- SDK message 被投影为统一的 Tool、HITL、Subagent、Compaction、Usage 和错误事件。
- lifecycle audit 只记录事件、session、Tool 名称和 Tool use ID，不记录 prompt、Tool input 或 output。

## 运行配置

| 变量 | 默认值 | 用途 |
| --- | ---: | --- |
| `CLAUDE_AGENT_STATE_DIR` | OS 临时目录 | Claude transcript 和 session 状态；生产必须挂载持久卷 |
| `CLAUDE_AGENT_CONTINUATION_SECRET` | API credential | continuation HMAC；生产建议使用独立的 32+ 字符 secret |
| `CLAUDE_AGENT_CONTINUATION_LEASE_MS` | `150000` | 单次续接持有 Redis lease 的最长时间 |
| `CLAUDE_AGENT_CONTINUATION_TTL_MS` | `604800000` | continuation 有效期，默认 7 天 |
| `CLAUDE_AGENT_MAX_TURNS` | `100` | 单次 SDK query 最大 agentic turns |
| `CLAUDE_AGENT_MAX_BUDGET_USD` | `5` | 单次 SDK query 最大账单预算 |
| `CLAUDE_AGENT_REQUEST_TIMEOUT_MS` | `120000` | 单次平台请求总超时 |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | `262144` | Claude Code 自动压缩窗口 |

`CLAUDE_AGENT_STATE_DIR` 必须在所有可能续接同一会话的 API replica 间共享。若未设置独立 continuation secret，runtime 会使用当前 Anthropic credential 签名；credential 轮换会让已有 continuation 失效。

## 验证

```bash
pnpm --filter @agent-template/agent-claude lint
pnpm --filter @agent-template/agent-claude test
pnpm --filter @agent-template/agent-claude typecheck
pnpm --filter @agent-template/agent-claude build
pnpm --filter @agent-template/agent-claude claude:eval
pnpm --filter @agent-template/agent-claude claude:eval:list
```

`claude:eval:live` 会调用真实模型和 Toolbox，要求有效凭证、本地 Toolbox/PostgreSQL 以及显式 `CLAUDE_AGENT_LIVE_EVAL=1`，不属于无凭证静态门禁。
