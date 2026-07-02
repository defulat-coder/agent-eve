import { z } from "zod";
import {
  defaultClaudeAgentModel,
  getClaudeAgentRuntimeStateFromEnv,
  loadClaudeAgentSdk
} from "@agent-template/agent-claude";
import { getEveAgentRuntimeStateFromEnv } from "@agent-template/agent-eve";

export { defaultClaudeAgentModel, loadClaudeAgentSdk };

export const defaultAgentRuntimeName = "claude";
export const AgentRuntimeNameSchema = z.enum(["claude", "eve"]);

export const AgentRuntimeConfigSchema = z.object({
  runtime: AgentRuntimeNameSchema.default(defaultAgentRuntimeName)
});

export type AgentRuntimeName = z.infer<typeof AgentRuntimeNameSchema>;
export type AgentRuntimeConfig = z.infer<typeof AgentRuntimeConfigSchema>;

export type AgentRuntimeState = {
  runtime: AgentRuntimeName;
  configured: boolean;
  model: string;
};

export function parseAgentRuntimeConfig(input: Record<string, unknown>): AgentRuntimeConfig {
  return AgentRuntimeConfigSchema.parse({
    runtime: input.AGENT_RUNTIME || undefined
  });
}

export function getAgentRuntimeStateFromEnv(input: Record<string, unknown>): AgentRuntimeState {
  const { runtime } = parseAgentRuntimeConfig(input);

  if (runtime === "eve") {
    return {
      runtime,
      ...getEveAgentRuntimeStateFromEnv(input)
    };
  }

  return {
    runtime,
    ...getClaudeAgentRuntimeStateFromEnv(input)
  };
}
