# Agent Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable TypeScript Agent platform template with Next.js web, Fastify API, BullMQ worker, shared packages, PostgreSQL, Redis, Claude Agent SDK, Zod, Pino, and Vitest.

**Architecture:** Use `apps/web`, `apps/api`, and `apps/worker` as runtime applications. Use `packages/ui`, `packages/db`, `packages/logger`, `packages/agent`, and `packages/shared` as reusable workspace packages. Use Docker Compose for local PostgreSQL and Redis on project-specific host ports to avoid common local conflicts.

**Tech Stack:** pnpm Workspace, Turborepo, TypeScript, Next.js, React, Tailwind CSS, shadcn/ui conventions, Fastify, Prisma 7, PostgreSQL, Redis, BullMQ, `@anthropic-ai/claude-agent-sdk`, Zod, Pino, Vitest.

## Global Constraints

- Use pnpm workspaces and Turborepo.
- Use TypeScript throughout.
- Keep generated code minimal and template-oriented.
- Avoid business-domain assumptions.
- Include local PostgreSQL and Redis via Docker Compose.
- Do not require a Claude API key for local boot.
- Use `apps/web`, `apps/api`, `apps/worker`, `packages/ui`, `packages/db`, `packages/logger`, `packages/agent`, and `packages/shared`.
- Keep frontend copy in Chinese where it is user-facing, while preserving technical identifiers such as Next.js, Fastify, Prisma, Redis, BullMQ, and Claude Agent SDK.

---

### Task 1: Workspace Foundation

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `README.md`

**Interfaces:**
- Produces root scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`.
- Produces local services: PostgreSQL on host port `15432`, Redis on host port `16379`.

- [x] Create root workspace manifests and Docker Compose infrastructure.
- [x] Install dependencies and generate `pnpm-lock.yaml`.
- [x] Document quick start and workspace layout in `README.md`.

### Task 2: Shared Packages

**Files:**
- Create: `packages/shared`
- Create: `packages/logger`
- Create: `packages/agent`
- Create: `packages/db`
- Create: `packages/ui`

**Interfaces:**
- `@agent-template/shared`: `HealthStatusSchema`, `AgentJobPayloadSchema`, `agentQueueName`.
- `@agent-template/logger`: `createLogger`, `createLoggerOptions`.
- `@agent-template/agent`: `parseAgentConfig`, `getAgentConfigState`, `loadClaudeAgentSdk`.
- `@agent-template/db`: Prisma schema, Prisma config, `prisma` client export.
- `@agent-template/ui`: shadcn/ui-style `Button` and `cn`.

- [x] Add shared Zod schemas and tests.
- [x] Add Pino logger package and tests.
- [x] Add Claude Agent SDK wrapper and tests.
- [x] Add Prisma 7 package with `prisma.config.ts`.
- [x] Add shared UI package with shadcn/ui-style Button.

### Task 3: Runtime Applications

**Files:**
- Create: `apps/api`
- Create: `apps/worker`
- Create: `apps/web`

**Interfaces:**
- `apps/api`: Fastify server, `GET /health`, `POST /agent/jobs`.
- `apps/worker`: BullMQ processor for `agent-jobs`.
- `apps/web`: Next.js dashboard that reads API health and displays stack status.

- [x] Add Fastify API with fast health checks that degrade cleanly when PostgreSQL/Redis are unavailable.
- [x] Add BullMQ worker with pure job handler tests.
- [x] Add Next.js App Router frontend with Chinese user-facing copy.

### Task 4: Verification

**Files:**
- Modify: workspace package scripts and configs as needed.

**Verification commands:**

```bash
pnpm db:generate
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

**Runtime checks:**

```bash
pnpm --filter @agent-template/api dev
pnpm --filter @agent-template/web dev
curl -sS http://localhost:14000/health
curl -sS -I http://localhost:13000
```

- [x] `pnpm db:generate` passes with Prisma 7.
- [x] `pnpm lint` passes.
- [x] `pnpm test` passes.
- [x] `pnpm typecheck` passes.
- [x] `pnpm build` passes.
- [x] API and Web dev servers start.
- [x] API health returns quickly when Docker services are unavailable.
- [x] Web homepage returns HTTP 200.
- [ ] `docker compose up -d` and `pnpm db:migrate` require the local Docker daemon to be running.
