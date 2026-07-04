import { z } from "zod";
import { Client, type MessageResult } from "eve/client";
import type { AgentRunEvent } from "@agent-template/shared";
import { defaultEveAgentModel, readEveAgentModel } from "./config.js";

export const eveAgentDirectory = "packages/agent-eve/agent";
export { defaultEveAgentModel, readEveAgentModel, readEveAnthropicBaseURL } from "./config.js";

export const EveAgentConfigSchema = z.object({
  host: z.string().min(1).optional(),
  model: z.string().min(1).default(defaultEveAgentModel)
});

export type EveAgentConfig = z.infer<typeof EveAgentConfigSchema>;

export type EveAgentRuntimeState = {
  configured: boolean;
  model: string;
  authoredSurface: string;
  host?: string;
};

export type EveAgentRunInput = {
  prompt: string;
};

export type EveAgentRunResult =
  | {
      status: "skipped";
      reason: string;
    }
  | {
      status: "completed";
      events: AgentRunEvent[];
      output: string;
      sessionId: string;
    }
  | {
      status: "failed";
      events: AgentRunEvent[];
      reason: string;
      sessionId?: string;
    };

type EveClient = {
  session(): {
    send(input: string): Promise<{
      result(): Promise<MessageResult>;
    }>;
  };
};

export function parseEveAgentConfig(input: Record<string, unknown>): EveAgentConfig {
  return EveAgentConfigSchema.parse({
    host: typeof input.EVE_AGENT_HOST === "string" && input.EVE_AGENT_HOST.length > 0 ? input.EVE_AGENT_HOST : undefined,
    model: readEveAgentModel(input)
  });
}

export function getEveAgentRuntimeState(config: EveAgentConfig): EveAgentRuntimeState {
  return {
    configured: Boolean(config.host),
    model: config.model,
    authoredSurface: eveAgentDirectory,
    ...(config.host ? { host: config.host } : {})
  };
}

export function getEveAgentRuntimeStateFromEnv(input: Record<string, unknown>): EveAgentRuntimeState {
  return getEveAgentRuntimeState(parseEveAgentConfig(input));
}

export async function runEveAgent(
  input: EveAgentRunInput,
  config: EveAgentConfig,
  options: {
    createClient?: (host: string) => EveClient;
    onEvent?: (event: AgentRunEvent) => void;
  } = {}
): Promise<EveAgentRunResult> {
  if (!config.host) {
    return { status: "skipped", reason: "EVE_AGENT_HOST is not configured" };
  }

  const client = (options.createClient ?? ((host: string) => new Client({ host })))(config.host);
  const response = await client.session().send(input.prompt);
  const result = await response.result();
  const events = result.events.map(formatEveAgentEvent);

  if (result.status === "failed") {
    const reason = result.message ?? "Eve Agent runtime failed";
    const event = { kind: "error", message: reason } satisfies AgentRunEvent;
    [...events, event].forEach((runEvent) => options.onEvent?.(runEvent));

    return {
      status: "failed",
      events: [...events, event],
      reason,
      sessionId: result.sessionId
    };
  }

  const output = result.message ?? formatEveOutput(result.data);
  const event = { kind: "done", result: output } satisfies AgentRunEvent;
  [...events, event].forEach((runEvent) => options.onEvent?.(runEvent));

  return {
    status: "completed",
    events: [...events, event],
    output,
    sessionId: result.sessionId
  };
}

function formatEveAgentEvent(event: unknown): AgentRunEvent {
  if (!isRecord(event) || typeof event.type !== "string") {
    return { kind: "unknown", text: formatEveOutput(event) };
  }

  if (event.type === "message.completed" && isRecord(event.data) && typeof event.data.message === "string") {
    return { kind: "text", text: event.data.message };
  }

  return { kind: "unknown", text: formatEveOutput(event) };
}

function formatEveOutput(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value) ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
