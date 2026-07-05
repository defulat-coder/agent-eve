# packages/agent-claude 协作指南

## 职责

`packages/agent-claude` 是 Claude Agent SDK backed runtime，负责 Claude 配置解析和 SDK 懒加载。

## 能力边界

- `parseClaudeAgentConfig` 只读取 Claude runtime 相关环境变量。
- `getClaudeAgentRuntimeStateFromEnv` 返回 API key 配置状态和模型。
- `loadClaudeAgentSdk` 保持懒加载，避免无 key 时影响本地启动。
- Kimi Code 通过 Anthropic-compatible env 接入：`ANTHROPIC_BASE_URL=https://api.kimi.com/coding/`、`ANTHROPIC_MODEL=kimi-for-coding`、`ANTHROPIC_API_KEY`。
- 传给 Claude Agent SDK subprocess 的 `env` 必须合并 `process.env`，不要替换掉 `PATH`、`HOME` 等运行时变量。
- Toolbox server 通过项目根目录 `.mcp.json` 和 `.claude/settings.json` 接入；runtime 代码只负责把 `TOOLBOX_URL` / `TOOLBOX_TOOLSET` 传给 Claude Code subprocess，不直接 import `apps/toolbox/tools.yaml`，也不内联 `mcpServers`。

## 不应该做

- 不处理 HTTP 请求或 BullMQ job 生命周期。
- 不实现 runtime selector；selector 留在 `@agent-template/agent`。
- 不写具体业务 prompt。
- 不把 Kimi API Key 写入仓库。
- 不把 PostgreSQL 连接信息放进 Claude runtime 配置；数据库权限留在 Toolbox server。
- 不凭记忆直接写 Claude Agent SDK API；以官方文档和已安装包类型为准。

## 官方参考

- Claude Code Docs: `https://code.claude.com/docs`
- Claude Agent SDK overview: `https://code.claude.com/docs/en/agent-sdk/overview`
- Claude Agent SDK TypeScript options: `https://code.claude.com/docs/en/agent-sdk/typescript`
- Claude Code settings: `https://code.claude.com/docs/en/settings`
- Claude Code MCP: `https://code.claude.com/docs/en/mcp`
- Claude Code permissions: `https://code.claude.com/docs/en/permissions`
- Kimi Code docs: `https://www.kimi.com/code/docs/`

## 验证

```bash
pnpm --filter @agent-template/agent-claude lint
pnpm --filter @agent-template/agent-claude test
pnpm --filter @agent-template/agent-claude typecheck
pnpm --filter @agent-template/agent-claude build
```
