import { z } from "zod";
import {
  defaultClaudeAgentModel,
  getClaudeAgentRuntimeStateFromEnv,
  loadClaudeAgentSdk
} from "@agent-template/agent-claude";
import { defaultEveAgentModel, getEveAgentRuntimeStateFromEnv } from "@agent-template/agent-eve";
import { AgentJobPayloadSchema } from "@agent-template/shared";

export { defaultClaudeAgentModel, defaultEveAgentModel, loadClaudeAgentSdk };

export const defaultAgentRuntimeName = "claude";
export const AgentRuntimeNameSchema = z.enum(["claude", "eve"]);

export const AgentRuntimeEnvSchema = z.object({
  AGENT_RUNTIME: AgentRuntimeNameSchema.default(defaultAgentRuntimeName),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_AGENT_MODEL: z.string().default(defaultClaudeAgentModel),
  EVE_AGENT_MODEL: z.string().default(defaultEveAgentModel)
});

export type AgentRuntimeName = z.infer<typeof AgentRuntimeNameSchema>;
export type AgentRuntimeEnv = z.infer<typeof AgentRuntimeEnvSchema>;

export type AgentRuntimeState = {
  runtime: AgentRuntimeName;
  configured: boolean;
  model: string;
};

export type AgentJobResult = {
  accepted: true;
  promptLength: number;
  runtime: AgentRuntimeName;
  configured: boolean;
  model: string;
};

export function parseAgentRuntimeEnv(input: Record<string, unknown>): AgentRuntimeEnv {
  return AgentRuntimeEnvSchema.parse(input);
}

export function getAgentRuntimeStateFromEnv(input: Record<string, unknown>): AgentRuntimeState {
  const env = parseAgentRuntimeEnv(input);
  const runtime = env.AGENT_RUNTIME;

  if (runtime === "eve") {
    return {
      runtime,
      ...getEveAgentRuntimeStateFromEnv(env)
    };
  }

  return {
    runtime,
    ...getClaudeAgentRuntimeStateFromEnv(env)
  };
}

export async function runAgentJob(payload: unknown, env: Record<string, unknown>): Promise<AgentJobResult> {
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
