import { z } from "zod";
import {
  defaultClaudeAgentModel,
  getClaudeAgentRuntimeStateFromEnv,
  loadClaudeAgentSdk,
  parseClaudeAgentConfig,
  runClaudeAgent,
} from "@agent-template/agent-claude";
import {
  defaultEveAgentModel,
  getEveAgentRuntimeStateFromEnv,
  parseEveAgentConfig,
  runEveAgent,
} from "@agent-template/agent-eve";
import {
  AgentRunInputSchema,
  type AgentRunEvent,
  type AgentRunResult,
} from "@agent-template/shared";

export { defaultClaudeAgentModel, defaultEveAgentModel, loadClaudeAgentSdk };
export type { AgentRunResult };

export const defaultAgentRuntimeName = "claude";
export const AgentRuntimeNameSchema = z.enum(["claude", "eve"]);

export const AgentRuntimeEnvSchema = z.object({
  AGENT_RUNTIME: AgentRuntimeNameSchema.default(defaultAgentRuntimeName),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_AUTH_TOKEN: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().url().optional(),
  ANTHROPIC_MODEL: z.string().default(defaultClaudeAgentModel),
  CLAUDE_AGENT_CONTINUATION_SECRET: z.string().optional(),
  CLAUDE_AGENT_CONTINUATION_LEASE_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
  CLAUDE_AGENT_CONTINUATION_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
  CLAUDE_AGENT_MAX_BUDGET_USD: z.coerce.number().positive().optional(),
  CLAUDE_AGENT_MAX_TURNS: z.coerce.number().int().positive().optional(),
  CLAUDE_AGENT_MODEL: z.string().default(defaultClaudeAgentModel),
  CLAUDE_AGENT_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
  CLAUDE_AGENT_STATE_DIR: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  EVE_AGENT_HOST: z.string().optional(),
  EVE_AGENT_MAX_RECONNECT_ATTEMPTS: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional(),
  EVE_AGENT_MODEL: z.string().default(defaultEveAgentModel),
  EVE_AGENT_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  EVE_AGENT_SERVICE_TOKEN: z.string().optional(),
  TOOLBOX_URL: z.string().url().optional(),
});

export type AgentRuntimeName = z.infer<typeof AgentRuntimeNameSchema>;
export type AgentRuntimeEnv = z.infer<typeof AgentRuntimeEnvSchema>;

export type AgentRuntimeState = {
  runtime: AgentRuntimeName;
  configured: boolean;
  model: string;
};

export type RunAgentOptions = {
  runClaude?: typeof runClaudeAgent;
  runEve?: typeof runEveAgent;
  onEvent?: (event: AgentRunEvent) => void;
};

export function parseAgentRuntimeEnv(
  input: Record<string, unknown>,
): AgentRuntimeEnv {
  return AgentRuntimeEnvSchema.parse(input);
}

export function getAgentRuntimeStateFromEnv(
  input: Record<string, unknown>,
): AgentRuntimeState {
  const env = parseAgentRuntimeEnv(input);
  const runtime = env.AGENT_RUNTIME;

  if (runtime === "eve") {
    return {
      runtime,
      ...getEveAgentRuntimeStateFromEnv(env),
    };
  }

  return {
    runtime,
    ...getClaudeAgentRuntimeStateFromEnv(env),
  };
}

export async function runAgent(
  input: unknown,
  env: Record<string, unknown>,
  options: RunAgentOptions = {},
): Promise<AgentRunResult> {
  const parsed = AgentRunInputSchema.parse(input);
  const runtimeEnv = parseAgentRuntimeEnv(env);
  const agentState = getAgentRuntimeStateFromEnv(runtimeEnv);

  const eventOptions = options.onEvent ? { onEvent: options.onEvent } : {};
  let run: Awaited<ReturnType<typeof runEveAgent | typeof runClaudeAgent>>;

  if (agentState.runtime === "eve") {
    run = await (options.runEve ?? runEveAgent)(
      parsed,
      parseEveAgentConfig(runtimeEnv),
      eventOptions,
    );
  } else {
    run = await (options.runClaude ?? runClaudeAgent)(
      parsed,
      parseClaudeAgentConfig(runtimeEnv),
      eventOptions,
    );
  }

  return {
    promptLength: parsed.prompt?.length ?? 0,
    runtime: agentState.runtime,
    configured: agentState.configured,
    model: agentState.model,
    status: run.status,
    ...("events" in run ? { events: [...run.events] } : {}),
    ...("output" in run ? { output: run.output } : {}),
    ...("reason" in run ? { reason: run.reason } : {}),
    ...("sessionId" in run ? { sessionId: run.sessionId } : {}),
    ...("continuation" in run ? { continuation: run.continuation } : {}),
  };
}
