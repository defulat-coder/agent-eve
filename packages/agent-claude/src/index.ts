import { z } from "zod";

export const defaultClaudeAgentModel = "claude-sonnet-4-5";

export const ClaudeAgentConfigSchema = z.object({
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1).default(defaultClaudeAgentModel)
});

export type ClaudeAgentConfig = z.infer<typeof ClaudeAgentConfigSchema>;

export type ClaudeAgentRuntimeState = {
  configured: boolean;
  model: string;
};

export function parseClaudeAgentConfig(input: Record<string, unknown>): ClaudeAgentConfig {
  return ClaudeAgentConfigSchema.parse({
    apiKey: input.ANTHROPIC_API_KEY || undefined,
    model: input.CLAUDE_AGENT_MODEL || undefined
  });
}

export function getClaudeAgentRuntimeState(config: ClaudeAgentConfig): ClaudeAgentRuntimeState {
  return {
    configured: Boolean(config.apiKey),
    model: config.model
  };
}

export function getClaudeAgentRuntimeStateFromEnv(input: Record<string, unknown>): ClaudeAgentRuntimeState {
  return getClaudeAgentRuntimeState(parseClaudeAgentConfig(input));
}

export async function loadClaudeAgentSdk() {
  return import("@anthropic-ai/claude-agent-sdk");
}
