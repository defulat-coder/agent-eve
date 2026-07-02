import Fastify, { type FastifyInstance } from "fastify";
import { createLoggerOptions } from "@agent-template/logger";
import { loadEnv, type Env } from "./env.js";
import { getHealth } from "./health.js";
import { createAgentJobIntake, type AgentJobIntake } from "./agent-job-intake.js";

export type BuildAppOptions = {
  env?: Env;
  checkExternal?: boolean;
  agentJobIntake?: AgentJobIntake;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const env = options.env ?? loadEnv();
  const checkExternal = options.checkExternal ?? env.NODE_ENV !== "test";
  const agentJobIntake = options.agentJobIntake ?? createAgentJobIntake({ redisUrl: env.REDIS_URL });
  const app = Fastify({ logger: createLoggerOptions({ service: "api" }) });

  app.get("/health", async () => getHealth(env, { checkExternal }));

  app.post("/agent/jobs", async (request, reply) => {
    const result = await agentJobIntake.enqueue(request.body);
    return reply.code(202).send(result);
  });

  return app;
}
