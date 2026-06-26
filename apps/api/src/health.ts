import { getAgentConfigState, parseAgentConfig } from "@project-template/agent";
import { createHealthStatus, agentQueueName, type DependencyState, type HealthStatus } from "@project-template/shared";
import { createRedisPingConnection } from "./queue.js";
import type { Env } from "./env.js";

export type HealthOptions = {
  checkExternal: boolean;
};

async function checkDatabase(enabled: boolean): Promise<DependencyState> {
  if (!enabled) {
    return { status: "skipped", message: "external checks disabled" };
  }

  try {
    const { prisma } = await import("@project-template/db");
    await withTimeout(prisma.$queryRaw`SELECT 1`, 800, "PostgreSQL check timed out");
    return { status: "ok", message: "PostgreSQL reachable" };
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message : "PostgreSQL check failed";

    return {
      status: "error",
      message
    };
  }
}

async function checkRedis(redisUrl: string, enabled: boolean): Promise<DependencyState> {
  if (!enabled) {
    return { status: "skipped", message: "external checks disabled" };
  }

  const redis = createRedisPingConnection(redisUrl);
  redis.on("error", () => {
    // Health checks report Redis errors in the response instead of emitting noisy client errors.
  });

  try {
    await withTimeout(redis.connect().then(() => redis.ping()), 800, "Redis check timed out");
    return { status: "ok", message: "Redis reachable" };
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message : "Redis check failed";

    return {
      status: "error",
      message
    };
  } finally {
    redis.disconnect();
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function getHealth(env: Env, options: HealthOptions): Promise<HealthStatus> {
  const [database, redis] = await Promise.all([
    checkDatabase(options.checkExternal),
    checkRedis(env.REDIS_URL, options.checkExternal)
  ]);
  const agentConfig = parseAgentConfig(env);
  const status = database.status === "error" || redis.status === "error" ? "degraded" : "ok";

  return createHealthStatus({
    service: "api",
    status,
    timestamp: new Date().toISOString(),
    database,
    redis,
    queue: {
      name: agentQueueName,
      status: redis.status === "error" ? "unavailable" : "ready"
    },
    claude: getAgentConfigState(agentConfig)
  });
}
