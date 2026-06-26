import Fastify, { type FastifyInstance } from "fastify";
import { createLoggerOptions } from "@project-template/logger";
import { loadEnv, type Env } from "./env.js";
import { getHealth } from "./health.js";
import { enqueueAgentJob } from "./agent-job-intake.js";

export type BuildAppOptions = {
  env?: Env;
  checkExternal?: boolean;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const env = options.env ?? loadEnv();
  const checkExternal = options.checkExternal ?? env.NODE_ENV !== "test";
  const app = Fastify({ logger: createLoggerOptions({ service: "api" }) });

  app.get("/health", async () => getHealth(env, { checkExternal }));

  app.post("/agent/jobs", async (request, reply) => {
    const result = await enqueueAgentJob(request.body, { redisUrl: env.REDIS_URL });
    return reply.code(202).send(result);
  });

  return app;
}
