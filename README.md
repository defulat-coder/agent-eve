# Project Template

一个基于 pnpm Workspace 和 Turborepo 的 TypeScript 项目模板，包含 Next.js 前端、Fastify API、BullMQ Worker、Prisma/PostgreSQL、Redis、Claude Agent SDK、Zod、Pino 和 Vitest。

## 技术栈

- 前端：pnpm + TypeScript + Next.js + React + Tailwind CSS + shadcn/ui + Vitest
- 后端：TypeScript + Fastify + Prisma + PostgreSQL + Redis + BullMQ + Claude Agent SDK + Zod + Pino + Vitest
- 工程化：pnpm Workspace + Turborepo

## 快速开始

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:generate
pnpm dev
```

默认服务：

- Web: http://localhost:3000
- API: http://localhost:4000
- Health: http://localhost:4000/health
- PostgreSQL: localhost:55432
- Redis: localhost:56379

## 常用命令

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:migrate
```

## 目录结构

```text
apps/
  web/       Next.js + React + Tailwind CSS
  api/       Fastify HTTP API
  worker/    BullMQ 后台任务进程
packages/
  ui/        shadcn/ui 风格共享组件
  db/        Prisma schema 和 Prisma Client
  logger/    Pino logger 封装
  agent/     Claude Agent SDK 封装
  shared/    共享 Zod schema 和 TypeScript 类型
```

Claude Agent SDK 的 API Key 通过 `ANTHROPIC_API_KEY` 配置。未配置时，API 仍可启动，`/health` 会显示 Claude 配置状态。
