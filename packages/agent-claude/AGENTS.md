# packages/agent-claude 协作指南

## 职责

`packages/agent-claude` 是 Claude Agent SDK backed runtime；`agent/` 是独立、可提交的 Claude Code authored surface。

## 能力边界

- `parseClaudeAgentConfig` 只读取 Claude runtime 相关环境变量。
- `getClaudeAgentRuntimeStateFromEnv` 返回 API key 配置状态和模型。
- `loadClaudeAgentSdk` 保持懒加载，避免无 key 时影响本地启动。
- SDK `cwd` 固定指向 `agent/`，并只加载 project setting source；默认从运行目录向上定位 monorepo，可用 `CLAUDE_AGENT_ROOT` 显式覆盖部署路径。不要让生产 Agent 读取仓库根部的工程协作配置。
- `agent/CLAUDE.md` 放每次会话加载的稳定指令；`agent/.claude/settings.json` 放权限和 project settings；`agent/.claude/skills/` 放按需加载的业务 Skill。
- `CLAUDE_AGENT_STATE_DIR` 保存可续接 transcript；生产部署必须使用 API replica 共享的持久存储，并限制目录权限。
- 公共 `AgentContinuation` 只携带签名 token；Claude session ID、deferred Tool ID 和签名细节留在 adapter 内。
- `AskUserQuestion` 使用 `PreToolUse` defer/resume；不要用常驻 Promise 等待 Web 用户，也不要把 SDK session ID 发给客户端。
- `CLAUDE_AGENT_MAX_TURNS`、`CLAUDE_AGENT_MAX_BUDGET_USD` 和 `CLAUDE_AGENT_REQUEST_TIMEOUT_MS` 必须保留 fail-closed 上限。
- programmatic hooks 只记录 lifecycle metadata，不记录 prompt、Tool input/output 或客户数据。
- Kimi Code 通过 Anthropic-compatible env 接入：`ANTHROPIC_BASE_URL=https://api.kimi.com/coding/`、`ANTHROPIC_MODEL=kimi-for-coding`、`ANTHROPIC_API_KEY`。
- 传给 Claude Agent SDK subprocess 的 `env` 必须合并 `process.env`，不要替换掉 `PATH`、`HOME` 等运行时变量。
- Toolbox HTTP connection 放在 `agent/.mcp.json`；精确 Tool allowlist 放在 `agent/.claude/settings.json`。`TOOLBOX_URL` 由 runtime 规范化后以 `CLAUDE_TOOLBOX_MCP_URL` 注入 Claude subprocess。
- 项目级业务 Skill 放在 `agent/.claude/skills/`；Claude Agent SDK 必须启用 project setting source 和 skills，Skill 调用 `mcp__toolbox__<tool>`。
- 电商业务 Skill 由 `@agent-template/toolbox` authoring CLI 同步，不手工维护两份副本，也不安装官方生成的数据库直连脚本。

## 不应该做

- 不处理 HTTP 请求或 BullMQ job 生命周期。
- 不实现 runtime selector；selector 留在 `@agent-template/agent`。
- 不写具体业务 prompt。
- 不把 Kimi API Key 写入仓库。
- 不把 PostgreSQL 连接信息放进 Claude runtime 配置；数据库权限留在 Toolbox server。
- 不在 `src/` 中重新维护 prompt、MCP server 或 Tool allowlist；这些配置属于 `agent/` authored surface。
- 不使用 `bypassPermissions`；新增内建 Tool 时同时更新 `tools`、project allow/deny 和安全 Eval。
- 不在仓库根创建生产 Agent 的 `.claude/` 或 `CLAUDE.md`；根目录属于工程协作上下文。
- 不凭记忆直接写 Claude Agent SDK API；以官方文档和已安装包类型为准。

## 官方参考

- Claude Code Docs: `https://code.claude.com/docs`
- Claude Agent SDK overview: `https://code.claude.com/docs/en/agent-sdk/overview`
- Claude Agent SDK TypeScript options: `https://code.claude.com/docs/en/agent-sdk/typescript`
- Claude Code settings: `https://code.claude.com/docs/en/settings`
- Claude Code MCP: `https://code.claude.com/docs/en/mcp`
- MCP protocol introduction: `https://modelcontextprotocol.io/docs/getting-started/intro`
- Claude Code permissions: `https://code.claude.com/docs/en/permissions`
- Kimi Code docs: `https://www.kimi.com/code/docs/`

## 验证

```bash
pnpm --filter @agent-template/agent-claude lint
pnpm --filter @agent-template/agent-claude test
pnpm --filter @agent-template/agent-claude typecheck
pnpm --filter @agent-template/agent-claude build
```
