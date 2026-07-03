import { z } from "zod";
import { AgentRuntimeEnvSchema } from "@agent-template/agent";

export const WorkerEnvSchema = AgentRuntimeEnvSchema.extend({
  REDIS_URL: z.string().url().default("redis://localhost:56379")
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

export function loadWorkerEnv(input: Record<string, string | undefined> = process.env): WorkerEnv {
  return WorkerEnvSchema.parse(input);
}
