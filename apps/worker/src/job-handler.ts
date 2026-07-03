import { runAgentJob, type AgentJobResult } from "@agent-template/agent";

export type { AgentJobResult };

export async function handleAgentJob(
  payload: unknown,
  env: Record<string, unknown>
): Promise<AgentJobResult> {
  return runAgentJob(payload, env);
}
