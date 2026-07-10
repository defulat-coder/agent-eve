# Claude Filesystem-Authored Surface

## Status

Accepted

The Claude Agent runtime uses `packages/agent-claude/agent/` as an isolated Claude Code project root. Stable instructions live in `CLAUDE.md`, project settings and exact Tool permissions live in `.claude/settings.json`, reusable business capabilities live in `.claude/skills/`, and the runtime-owned Toolbox connection lives in `.mcp.json`.

Claude Agent SDK sets `cwd` to that directory, loads only the project setting source, enables discovered Skills, and lets Claude Code resolve the filesystem MCP configuration. The runtime locates the authored surface by walking upward from its process working directory, with `CLAUDE_AGENT_ROOT` as an explicit deployment override; this remains stable when API or Worker bundles inline the runtime package. TypeScript remains an execution adapter for credentials, path and endpoint resolution, SDK streaming, and shared `AgentRunEvent` conversion; it does not duplicate the authored prompt, MCP server definition, or Tool allowlist.

We rejected a repository-root Claude project because it would mix production Agent instructions with engineering collaboration rules, and we rejected programmatic `mcpServers` plus `strictMcpConfig` because those options explicitly bypass the official project `.mcp.json` surface.
