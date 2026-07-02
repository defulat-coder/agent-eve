import { getAgentRuntimeStateFromEnv, type AgentRuntimeName } from "@agent-template/agent";
import { AgentJobPayloadSchema } from "@agent-template/shared";

export type AgentJobResult = {
  accepted: true;
  promptLength: number;
  runtime: AgentRuntimeName;
  configured: boolean;
  model: string;
};

export async function handleAgentJob(
  payload: unknown,
  env: Record<string, unknown>
): Promise<AgentJobResult> {
  const parsed = AgentJobPayloadSchema.parse(payload);
  const agentState = getAgentRuntimeStateFromEnv(env);

  return {
    accepted: true,
    promptLength: parsed.prompt.length,
    runtime: agentState.runtime,
    configured: agentState.configured,
    model: agentState.model
  };
}
