# Separate Agent Runtime Packages

The template includes both a Claude Agent runtime and an Eve Agent runtime, but a deployment chooses one runtime through `AGENT_RUNTIME`. We keep the implementations in separate workspace packages (`packages/agent-claude` and `packages/agent-eve`) and reserve `packages/agent` for the shared runtime contract and selection boundary, so dependencies and authored surfaces stay independent while API and Worker code depend on one stable Agent boundary.

We rejected a root-level `agent/` directory because it represents a single Eve-style app more than a reusable monorepo package, and we rejected putting both implementations in `packages/agent` because that would hide runtime-specific dependencies behind one package name.
