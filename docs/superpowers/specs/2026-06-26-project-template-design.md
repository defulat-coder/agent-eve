# Project Template Design

## Goal

Initialize a reusable TypeScript monorepo template with a Next.js web app, a Fastify API, shared packages, local PostgreSQL and Redis infrastructure, and a consistent pnpm/Turborepo developer workflow.

## Architecture

The repository uses a pnpm workspace managed by Turborepo. Runtime applications live in `apps/`, reusable workspace packages live in `packages/`, and local service dependencies are started through Docker Compose.

The template has three applications:

- `apps/web`: Next.js App Router frontend using React, TypeScript, Tailwind CSS, shadcn/ui conventions, and Vitest.
- `apps/api`: Fastify HTTP API using TypeScript, Prisma, PostgreSQL, Redis, BullMQ queue producers, Zod validation, Pino logging, and Vitest.
- `apps/worker`: BullMQ background worker using TypeScript, Redis, shared logger, and Claude Agent SDK integration entry points.

Shared code is split by responsibility:

- `packages/ui`: shadcn/ui-style shared React components and UI utilities.
- `packages/db`: Prisma schema, Prisma Client generation, and database access exports.
- `packages/logger`: Pino logger factory and app-specific logger helpers.
- `packages/agent`: Claude Agent SDK wrapper module that centralizes future agent calls without baking in business behavior.
- `packages/shared`: Zod schemas and inferred TypeScript types shared across web and API.

## Developer Workflow

The root workspace exposes these commands:

- `pnpm dev`: run web, API, and worker development servers through Turborepo.
- `pnpm build`: build all workspace projects.
- `pnpm lint`: run lint checks across all workspace projects.
- `pnpm typecheck`: run TypeScript checks across all workspace projects.
- `pnpm test`: run Vitest across testable workspace projects.
- `pnpm db:generate`: generate Prisma Client from `packages/db/prisma/schema.prisma`.
- `pnpm db:migrate`: run Prisma migrations for local development.

Local infrastructure is included:

- `docker-compose.yml` starts PostgreSQL and Redis.
- `.env.example` documents `DATABASE_URL`, `REDIS_URL`, API host/port, frontend API URL, and Claude API configuration placeholders.

## Frontend Behavior

The frontend starts as a real app shell, not a marketing page. The first screen shows project status from the API health endpoint and basic template metadata. UI copy is concise and suitable for a developer-facing internal template.

The frontend includes:

- App Router structure under `apps/web/app`.
- Tailwind CSS configuration.
- Shared UI imports from `@project-template/ui`.
- A minimal reusable `Button` component matching shadcn/ui patterns in `packages/ui`.
- A Vitest test for a small UI utility or component behavior.

## Backend Behavior

The backend starts a Fastify server with:

- `GET /health` returning service status, timestamp, database connectivity, Redis connectivity, and queue metadata.
- Pino logger imported from `@project-template/logger`.
- Zod-based environment parsing.
- Prisma Client imported from `@project-template/db`.
- Redis connection setup.
- BullMQ queue producer setup with a simple typed queue module.
- Agent package configuration state imported from `@project-template/agent`.

The API should boot even when Claude API credentials are absent. Missing Claude credentials are reported as configuration state, not a startup failure.

## Worker Behavior

The worker starts a BullMQ processor for the shared agent queue. It imports logger behavior from `@project-template/logger` and agent behavior from `@project-template/agent`. The initial processor records template-oriented job execution metadata without assuming a business domain.

## Testing

The scaffold includes lightweight tests that prove the workspace is wired correctly:

- API tests cover health response shape without requiring external Claude credentials.
- Worker tests cover job handler behavior without requiring Redis.
- UI tests cover shared UI utilities.
- Shared package tests cover Zod schema parsing and inferred types.
- Web tests cover a component or utility in the Next.js app.

Database and Redis checks are implemented in runtime health logic and documented for local verification through Docker Compose.

## Constraints

- Use pnpm workspaces and Turborepo.
- Use TypeScript throughout.
- Keep generated code minimal and template-oriented.
- Avoid business-domain assumptions.
- Include local PostgreSQL and Redis via Docker Compose.
- Do not require a Claude API key for local boot.
- Use `apps/web`, `apps/api`, `apps/worker`, `packages/ui`, `packages/db`, `packages/logger`, `packages/agent`, and `packages/shared` as the project skeleton.
- Keep frontend copy in Chinese where it is user-facing, while preserving technical identifiers such as Next.js, Fastify, Prisma, Redis, BullMQ, and Claude Agent SDK.
