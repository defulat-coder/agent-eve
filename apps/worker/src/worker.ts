import { Worker } from "bullmq";
import { createLogger } from "@project-template/logger";
import { agentQueueName, type AgentJobPayload } from "@project-template/shared";
import { loadWorkerEnv } from "./env.js";
import { handleAgentJob } from "./job-handler.js";

const env = loadWorkerEnv();
const logger = createLogger({ service: "worker" });
const parsedRedisUrl = new URL(env.REDIS_URL);
const connection = {
  host: parsedRedisUrl.hostname,
  port: parsedRedisUrl.port ? Number(parsedRedisUrl.port) : 6379,
  maxRetriesPerRequest: null
};

const worker = new Worker<AgentJobPayload>(
  agentQueueName,
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "processing agent job");
    return handleAgentJob(job.data, env);
  },
  { connection }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "agent job completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "agent job failed");
});

process.on("SIGTERM", async () => {
  await worker.close();
});
