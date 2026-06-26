import { Queue } from "bullmq";
import IORedis from "ioredis";
import { agentQueueName, type AgentJobPayload } from "@project-template/shared";

export function createRedisPingConnection(redisUrl: string) {
  return new IORedis(redisUrl, {
    connectTimeout: 500,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: null
  });
}

export function createBullMqConnectionOptions(redisUrl: string) {
  const parsed = new URL(redisUrl);
  const options: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
    maxRetriesPerRequest: null;
  } = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    maxRetriesPerRequest: null
  };

  if (parsed.username) {
    options.username = decodeURIComponent(parsed.username);
  }

  if (parsed.password) {
    options.password = decodeURIComponent(parsed.password);
  }

  if (parsed.pathname.length > 1) {
    options.db = Number(parsed.pathname.slice(1));
  }

  return options;
}

export function createAgentQueue(redisUrl: string) {
  return new Queue<AgentJobPayload>(agentQueueName, {
    connection: createBullMqConnectionOptions(redisUrl)
  });
}
