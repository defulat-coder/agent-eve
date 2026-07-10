# Host-Managed MCP

## Status

Superseded by [ADR 0006: Agent-Owned MCP Connections](./0006-agent-owned-mcp-connections.md)

Agent Template will treat MCP Host as a platform capability owned by the application, not by a specific Agent runtime. MCP client lifecycle, server registry, primitive discovery, tool calls, resources, and MCP Apps handling should live behind a shared `packages/mcp-host` boundary and be exposed through `apps/api` to `apps/web`; `packages/agent-claude` and `packages/agent-eve` remain runtime adapters.

This avoids long-term divergence where Claude and Eve each own separate MCP connections, permissions, and UI handling. The migration is staged: first introduce the shared Host boundary without breaking existing runtime-specific Toolbox integrations, then move Toolbox calls to the Host-managed MCP path so Web Chat can render MCP Apps and interactive outputs consistently.
