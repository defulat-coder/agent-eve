import { z } from "zod";
import { Client } from "eve/client";
import type {
  HandleMessageStreamEvent,
  InputResponse,
  SessionState,
} from "eve/client";
import type {
  AgentContinuation,
  AgentInputResponse,
  AgentRunEvent,
} from "@agent-template/shared";
import { defaultEveAgentModel, readEveAgentModel } from "./config.js";
import {
  decodeEveContinuation,
  encodeEveContinuation,
} from "./eve-continuation.js";
import {
  projectEveStreamEvent,
  projectEveTurn,
} from "./eve-turn-projection.js";
import { isLoopbackEveHost } from "./trust-policy.js";

export const eveAgentDirectory = "packages/agent-eve/agent";
export const defaultEveAgentMaxReconnectAttempts = 5;
export const defaultEveAgentRequestTimeoutMs = 120_000;
export {
  defaultEveAgentModel,
  readEveAgentModel,
  readEveAnthropicBaseURL,
} from "./config.js";

export const EveAgentConfigSchema = z.object({
  host: z.string().url().optional(),
  maxReconnectAttempts: z
    .number()
    .int()
    .nonnegative()
    .default(defaultEveAgentMaxReconnectAttempts),
  model: z.string().min(1).default(defaultEveAgentModel),
  requestTimeoutMs: z
    .number()
    .int()
    .positive()
    .default(defaultEveAgentRequestTimeoutMs),
  serviceToken: z.string().min(1).optional(),
});

export type EveAgentConfig = z.infer<typeof EveAgentConfigSchema>;

export type EveAgentRuntimeState = {
  configured: boolean;
  model: string;
  authoredSurface: string;
  host?: string;
};

export type EveAgentRunInput = {
  prompt?: string | undefined;
  continuation?: AgentContinuation | undefined;
  responses?: AgentInputResponse[] | undefined;
};

export type EveAgentRunResult =
  | {
      status: "skipped";
      reason: string;
    }
  | {
      status: "completed" | "waiting";
      events: AgentRunEvent[];
      output: string;
      sessionId: string;
      continuation?: AgentContinuation;
    }
  | {
      status: "failed";
      events: AgentRunEvent[];
      reason: string;
      sessionId?: string;
      continuation?: AgentContinuation;
    };

type EveClientSession = {
  readonly state: SessionState;
  send(input: {
    message?: string;
    inputResponses?: readonly InputResponse[];
    signal?: AbortSignal;
  }): Promise<EveMessageResponse>;
};

type EveClient = {
  session(state?: SessionState): EveClientSession;
};

type EveMessageResponse = AsyncIterable<HandleMessageStreamEvent> & {
  continuationToken: string | undefined;
  sessionId: string;
};

export function parseEveAgentConfig(
  input: Record<string, unknown>,
): EveAgentConfig {
  return EveAgentConfigSchema.parse({
    host: readNonEmptyString(input.EVE_AGENT_HOST),
    maxReconnectAttempts: readNumber(
      input.EVE_AGENT_MAX_RECONNECT_ATTEMPTS,
      defaultEveAgentMaxReconnectAttempts,
    ),
    model: readEveAgentModel(input),
    requestTimeoutMs: readNumber(
      input.EVE_AGENT_REQUEST_TIMEOUT_MS,
      defaultEveAgentRequestTimeoutMs,
    ),
    serviceToken: readNonEmptyString(input.EVE_AGENT_SERVICE_TOKEN),
  });
}

export function getEveAgentRuntimeState(
  config: EveAgentConfig,
): EveAgentRuntimeState {
  return {
    configured: Boolean(
      config.host && (isLoopbackEveHost(config.host) || config.serviceToken),
    ),
    model: config.model,
    authoredSurface: eveAgentDirectory,
    ...(config.host ? { host: config.host } : {}),
  };
}

export function getEveAgentRuntimeStateFromEnv(
  input: Record<string, unknown>,
): EveAgentRuntimeState {
  return getEveAgentRuntimeState(parseEveAgentConfig(input));
}

export async function runEveAgent(
  input: EveAgentRunInput,
  config: EveAgentConfig,
  options: {
    createClient?: (host: string, config: EveAgentConfig) => EveClient;
    onEvent?: (event: AgentRunEvent) => void;
  } = {},
): Promise<EveAgentRunResult> {
  if (!config.host) {
    return { status: "skipped", reason: "EVE_AGENT_HOST is not configured" };
  }

  if (!isLoopbackEveHost(config.host) && !config.serviceToken) {
    return {
      status: "skipped",
      reason:
        "EVE_AGENT_SERVICE_TOKEN is required for a non-loopback Eve Agent host",
    };
  }

  let initialState: SessionState | undefined;
  try {
    initialState = decodeEveContinuation(input.continuation);
  } catch (caught) {
    return createFailedResult(formatCaughtError(caught), options.onEvent);
  }

  const client = (options.createClient ?? createEveClient)(config.host, config);
  const session = client.session(initialState);
  const rawEvents: HandleMessageStreamEvent[] = [];
  const events: AgentRunEvent[] = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  let response: EveMessageResponse | undefined;

  try {
    response = await session.send({
      ...(input.prompt ? { message: input.prompt } : {}),
      ...(input.responses
        ? { inputResponses: input.responses as readonly InputResponse[] }
        : {}),
      signal: controller.signal,
    });

    for await (const rawEvent of response) {
      rawEvents.push(rawEvent);
      for (const event of projectEveStreamEvent(rawEvent)) {
        emitEvent(events, event, options.onEvent);
      }
    }
  } catch (caught) {
    const reason = formatCaughtError(caught);
    emitErrorOnce(events, reason, options.onEvent);
    const continuation = encodeEveContinuation(session.state);

    return {
      status: "failed",
      events,
      reason,
      ...(response?.sessionId ? { sessionId: response.sessionId } : {}),
      ...(continuation ? { continuation } : {}),
    };
  } finally {
    clearTimeout(timeout);
  }

  const projected = projectEveTurn(rawEvents);
  const continuation = encodeEveContinuation(session.state);

  if (!projected) {
    const reason = "Eve Agent stream ended without a session boundary";
    emitErrorOnce(events, reason, options.onEvent);
    return {
      status: "failed",
      events,
      reason,
      sessionId: response.sessionId,
      ...(continuation ? { continuation } : {}),
    };
  }

  if (projected.status === "failed") {
    emitErrorOnce(events, projected.reason, options.onEvent);
    return {
      status: "failed",
      events,
      reason: projected.reason,
      sessionId: response.sessionId,
      ...(continuation ? { continuation } : {}),
    };
  }

  if (projected.output) {
    emitEvent(
      events,
      { kind: "done", result: projected.output },
      options.onEvent,
    );
  }

  return {
    status: projected.status,
    events,
    output: projected.output,
    sessionId: response.sessionId,
    ...(continuation ? { continuation } : {}),
  };
}

function createEveClient(host: string, config: EveAgentConfig): EveClient {
  return new Client({
    host,
    maxReconnectAttempts: config.maxReconnectAttempts,
    preserveCompletedSessions: true,
    redirect: "error",
    ...(config.serviceToken
      ? {
          headers: {
            "x-agent-template-eve-token": config.serviceToken,
          },
        }
      : {}),
  });
}

function createFailedResult(
  reason: string,
  onEvent: ((event: AgentRunEvent) => void) | undefined,
): EveAgentRunResult {
  const event = { kind: "error", message: reason } satisfies AgentRunEvent;
  onEvent?.(event);
  return { status: "failed", events: [event], reason };
}

function emitEvent(
  events: AgentRunEvent[],
  event: AgentRunEvent,
  onEvent: ((event: AgentRunEvent) => void) | undefined,
) {
  events.push(event);
  onEvent?.(event);
}

function emitErrorOnce(
  events: AgentRunEvent[],
  message: string,
  onEvent: ((event: AgentRunEvent) => void) | undefined,
) {
  if (
    !events.some((event) => event.kind === "error" && event.message === message)
  ) {
    emitEvent(events, { kind: "error", message }, onEvent);
  }
}

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown, fallback: number) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return typeof value === "number" ? value : Number(value);
}

function formatCaughtError(caught: unknown) {
  if (caught instanceof Error && caught.name === "AbortError") {
    return "Eve Agent request timed out";
  }

  return caught instanceof Error ? caught.message : "Eve Agent request failed";
}
