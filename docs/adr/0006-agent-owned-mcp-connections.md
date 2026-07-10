# Agent-Owned MCP Connections

## Status

Accepted

Agent Template keeps each Agent MCP connection inside the Agent runtime that uses it: Claude owns its project-scoped HTTP MCP config and allowlist, while Eve owns its filesystem-first MCP connection and allowlist. This supersedes ADR 0003 and ADR 0005 because a platform MCP registry, API proxy, and MCP App bridge add an independent lifecycle without a current cross-runtime product requirement; the duplicated allowlists are intentional runtime policy and must be updated together when Toolbox tools change. ADR 0007 records Claude's filesystem representation.
