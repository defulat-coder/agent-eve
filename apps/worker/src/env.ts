import { z } from "zod";

export const WorkerEnvSchema = z.object({
  REDIS_URL: z.string().url().default("redis://localhost:56379"),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_AGENT_MODEL: z.string().default("claude-sonnet-4-5")
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

export function loadWorkerEnv(input: Record<string, string | undefined> = process.env): WorkerEnv {
  return WorkerEnvSchema.parse(input);
}
