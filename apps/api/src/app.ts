import Fastify, { type FastifyInstance } from "fastify";
import { AgentJobPayloadSchema } from "@project-template/shared";
import { createLoggerOptions } from "@project-template/logger";
import { loadEnv, type Env } from "./env.js";
import { getHealth } from "./health.js";
import { createAgentQueue } from "./queue.js";

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
    const payload = AgentJobPayloadSchema.parse(request.body);
    const queue = createAgentQueue(env.REDIS_URL);

    try {
      const job = await queue.add("agent.run", payload);
      return reply.code(202).send({ id: job.id, queue: queue.name });
    } finally {
      await queue.close();
    }
  });

  return app;
}
