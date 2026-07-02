import { z } from "zod";

export const defaultEveAgentModel = "eve-filesystem";
export const eveAgentDirectory = "packages/agent-eve/agent";

export const EveAgentConfigSchema = z.object({
  model: z.string().min(1).default(defaultEveAgentModel)
});

export type EveAgentConfig = z.infer<typeof EveAgentConfigSchema>;

export type EveAgentRuntimeState = {
  configured: true;
  model: string;
  authoredSurface: string;
};

export function parseEveAgentConfig(input: Record<string, unknown>): EveAgentConfig {
  return EveAgentConfigSchema.parse({
    model: input.EVE_AGENT_MODEL || undefined
  });
}

export function getEveAgentRuntimeState(config: EveAgentConfig): EveAgentRuntimeState {
  return {
    configured: true,
    model: config.model,
    authoredSurface: eveAgentDirectory
  };
}

export function getEveAgentRuntimeStateFromEnv(input: Record<string, unknown>): EveAgentRuntimeState {
  return getEveAgentRuntimeState(parseEveAgentConfig(input));
}
