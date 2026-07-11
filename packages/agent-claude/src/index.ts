import { chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type {
  Options as ClaudeSdkOptions,
  SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { createLogger } from "@agent-template/logger";
import type {
  AgentContinuation,
  AgentInputResponse,
  AgentRunEvent,
} from "@agent-template/shared";
import { resolveClaudeAgentRoot } from "./authored-surface.js";
import type { ClaudeContinuationPayload } from "./claude-continuation.js";
import { ClaudeEventProjection } from "./claude-event-projection.js";
import { projectClaudeInputRequests } from "./claude-hitl.js";
import {
  createClaudeRuntimeHooks,
  type ClaudeAuditEvent,
} from "./claude-runtime-hooks.js";
import {
  ClaudeSessionContinuations,
  type ClaudeContinuationLeaseStore,
} from "./claude-session-continuations.js";
import { getRedisClaudeContinuationStore } from "./redis-claude-continuation-store.js";

export const defaultClaudeAgentModel = "kimi-for-coding";
export const defaultAnthropicBaseUrl = "https://api.kimi.com/coding/";
export const defaultClaudeAgentMaxTurns = 100;
export const defaultClaudeAgentMaxBudgetUsd = 5;
export const defaultClaudeAgentRequestTimeoutMs = 120_000;
export const defaultClaudeContinuationTtlMs = 7 * 24 * 60 * 60 * 1_000;
export const defaultClaudeContinuationLeaseMs = 150_000;
export const defaultClaudeAutoCompactWindow = 262_144;
export const defaultClaudeToolboxUrl = "http://localhost:15000";
export const defaultClaudeRedisUrl = "redis://localhost:16379";
export const defaultClaudeAgentStateDirectory = join(
  tmpdir(),
  "agent-template-claude-code",
);

const logger = createLogger({ service: "agent-claude" });

export const ClaudeAgentConfigSchema = z.object({
  apiKey: z.string().min(1).optional(),
  authToken: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).default(defaultClaudeAgentModel),
  agentRoot: z.string().min(1).optional(),
  toolboxUrl: z.string().url().optional(),
  stateDirectory: z
    .string()
    .min(1)
    .default(defaultClaudeAgentStateDirectory),
  continuationSecret: z.string().min(32).optional(),
  continuationLeaseMs: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultClaudeContinuationLeaseMs),
  continuationTtlMs: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultClaudeContinuationTtlMs),
  maxTurns: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultClaudeAgentMaxTurns),
  maxBudgetUsd: z.coerce
    .number()
    .positive()
    .default(defaultClaudeAgentMaxBudgetUsd),
  requestTimeoutMs: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultClaudeAgentRequestTimeoutMs),
  autoCompactWindow: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultClaudeAutoCompactWindow),
  redisUrl: z.string().url().default(defaultClaudeRedisUrl),
});

export type ClaudeAgentConfig = z.input<typeof ClaudeAgentConfigSchema>;
type ResolvedClaudeAgentConfig = z.output<typeof ClaudeAgentConfigSchema>;

export type ClaudeAgentRuntimeState = {
  configured: boolean;
  model: string;
};

export type ClaudeAgentRunInput = {
  prompt?: string | undefined;
  continuation?: AgentContinuation | undefined;
  responses?: AgentInputResponse[] | undefined;
};

export type ClaudeAgentRunResult =
  | { status: "skipped"; reason: string }
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

export function parseClaudeAgentConfig(
  input: Record<string, unknown>,
): ResolvedClaudeAgentConfig {
  return ClaudeAgentConfigSchema.parse({
    apiKey: input.ANTHROPIC_API_KEY || undefined,
    authToken: input.ANTHROPIC_AUTH_TOKEN || undefined,
    baseUrl: input.ANTHROPIC_BASE_URL || undefined,
    model: input.CLAUDE_AGENT_MODEL || input.ANTHROPIC_MODEL || undefined,
    agentRoot: input.CLAUDE_AGENT_ROOT || undefined,
    toolboxUrl: input.TOOLBOX_URL || undefined,
    stateDirectory: input.CLAUDE_AGENT_STATE_DIR || undefined,
    continuationSecret: input.CLAUDE_AGENT_CONTINUATION_SECRET || undefined,
    continuationLeaseMs:
      input.CLAUDE_AGENT_CONTINUATION_LEASE_MS || undefined,
    continuationTtlMs: input.CLAUDE_AGENT_CONTINUATION_TTL_MS || undefined,
    maxTurns: input.CLAUDE_AGENT_MAX_TURNS || undefined,
    maxBudgetUsd: input.CLAUDE_AGENT_MAX_BUDGET_USD || undefined,
    requestTimeoutMs: input.CLAUDE_AGENT_REQUEST_TIMEOUT_MS || undefined,
    autoCompactWindow: input.CLAUDE_CODE_AUTO_COMPACT_WINDOW || undefined,
    redisUrl: input.REDIS_URL || undefined,
  });
}

export function getClaudeAgentRuntimeState(
  input: ClaudeAgentConfig,
): ClaudeAgentRuntimeState {
  const config = ClaudeAgentConfigSchema.parse(input);
  return {
    configured: Boolean(config.apiKey || config.authToken),
    model: config.model,
  };
}

export function getClaudeAgentRuntimeStateFromEnv(
  input: Record<string, unknown>,
): ClaudeAgentRuntimeState {
  return getClaudeAgentRuntimeState(parseClaudeAgentConfig(input));
}

export async function loadClaudeAgentSdk() {
  return import("@anthropic-ai/claude-agent-sdk");
}

type ClaudeAgentSdk = {
  query(input: {
    prompt: string;
    options?: ClaudeSdkOptions;
  }): AsyncIterable<SDKMessage>;
};

export async function runClaudeAgent(
  input: ClaudeAgentRunInput,
  unresolvedConfig: ClaudeAgentConfig,
  runOptions: {
    loadSdk?: () => Promise<ClaudeAgentSdk>;
    continuationStore?: ClaudeContinuationLeaseStore;
    onAudit?: (event: ClaudeAuditEvent) => void;
    onEvent?: (event: AgentRunEvent) => void;
  } = {},
): Promise<ClaudeAgentRunResult> {
  const config = ClaudeAgentConfigSchema.parse(unresolvedConfig);
  const continuationSecret =
    config.continuationSecret ?? config.authToken ?? config.apiKey;

  if (!config.apiKey && !config.authToken) {
    return {
      status: "skipped",
      reason: "ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is not configured",
    };
  }

  const continuations = new ClaudeSessionContinuations({
    leaseMs: config.continuationLeaseMs,
    secret: continuationSecret!,
    store:
      runOptions.continuationStore ??
      getRedisClaudeContinuationStore(config.redisUrl),
    ttlMs: config.continuationTtlMs,
  });
  let continuation: ClaudeContinuationPayload | undefined;
  let continuationLease:
    | Awaited<ReturnType<ClaudeSessionContinuations["acquire"]>>
    | undefined;
  try {
    continuationLease = input.continuation
      ? await continuations.acquire(input.continuation)
      : undefined;
    continuation = continuationLease?.payload;
  } catch (caught) {
    return createFailedResult(formatCaughtError(caught), runOptions.onEvent);
  }

  if (input.responses?.length && !continuation?.pendingToolUseId) {
    await continuationLease?.release();
    return createFailedResult(
      "Claude input responses require a pending deferred tool",
      runOptions.onEvent,
    );
  }

  let sdk: ClaudeAgentSdk;
  try {
    ensureStateDirectory(config.stateDirectory);
    sdk = await (runOptions.loadSdk ?? loadClaudeAgentSdk)();
  } catch (caught) {
    await continuationLease?.release();
    return createFailedResult(formatCaughtError(caught), runOptions.onEvent);
  }
  const events: AgentRunEvent[] = [];
  const projection = new ClaudeEventProjection();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  let result: Extract<SDKMessage, { type: "result" }> | undefined;
  let sessionId = continuation?.sessionId;

  try {
    for await (const message of sdk.query({
      prompt: input.prompt ?? "",
      options: createClaudeQueryOptions({
        config,
        continuation,
        controller,
        responses: input.responses ?? [],
        onAudit: runOptions.onAudit ?? writeClaudeAuditEvent,
      }),
    })) {
      if ("session_id" in message) {
        sessionId = message.session_id;
      }
      for (const event of projection.project(message)) {
        emitEvent(events, event, runOptions.onEvent);
      }
      if (message.type === "result") {
        result = message;
      }
    }
  } catch (caught) {
    const reason = controller.signal.aborted
      ? `Claude Agent request timed out after ${config.requestTimeoutMs}ms`
      : formatCaughtError(caught);
    emitErrorOnce(events, reason, runOptions.onEvent);
    const leaseError = await completeContinuationLease(continuationLease);
    if (leaseError) {
      emitErrorOnce(events, leaseError, runOptions.onEvent);
    }
    return {
      status: "failed",
      events,
      reason,
      ...(sessionId ? { sessionId } : {}),
      ...createContinuationResult(
        sessionId,
        continuation?.pendingToolUseId,
        continuations,
      ),
    };
  } finally {
    clearTimeout(timeout);
  }

  const leaseError = await completeContinuationLease(continuationLease);
  if (leaseError) {
    emitErrorOnce(events, leaseError, runOptions.onEvent);
    return {
      status: "failed",
      events,
      reason: leaseError,
      ...(sessionId ? { sessionId } : {}),
    };
  }

  if (!result || !sessionId) {
    const reason = "Claude Agent SDK did not return a result with a session";
    emitErrorOnce(events, reason, runOptions.onEvent);
    return { status: "failed", events, reason };
  }

  if (isDeferredResult(result)) {
    try {
      emitEvent(
        events,
        {
          kind: "input-requested",
          requests: projectClaudeInputRequests(
            result.deferred_tool_use.id,
            result.deferred_tool_use.input,
          ),
        },
        runOptions.onEvent,
      );
      emitEvent(events, { kind: "waiting" }, runOptions.onEvent);
    } catch (caught) {
      const reason = formatCaughtError(caught);
      emitErrorOnce(events, reason, runOptions.onEvent);
      return { status: "failed", events, reason, sessionId };
    }

    return {
      status: "waiting",
      events,
      output: result.result,
      sessionId,
      ...createContinuationResult(
        sessionId,
        result.deferred_tool_use.id,
        continuations,
      ),
    };
  }

  if (result.subtype !== "success" || result.is_error) {
    const reason =
      "errors" in result ? result.errors.join("\n") : result.result;
    const message = reason || "Claude Agent SDK run failed";
    emitErrorOnce(events, message, runOptions.onEvent);
    return {
      status: "failed",
      events,
      reason: message,
      sessionId,
      ...createContinuationResult(
        sessionId,
        undefined,
        continuations,
      ),
    };
  }

  emitEvent(
    events,
    { kind: "done", result: result.result },
    runOptions.onEvent,
  );
  return {
    status: "completed",
    events,
    output: result.result,
    sessionId,
    ...createContinuationResult(
      sessionId,
      undefined,
      continuations,
    ),
  };
}

function createClaudeQueryOptions(input: {
  config: ResolvedClaudeAgentConfig;
  continuation: ClaudeContinuationPayload | undefined;
  controller: AbortController;
  responses: readonly AgentInputResponse[];
  onAudit: (event: ClaudeAuditEvent) => void;
}): ClaudeSdkOptions {
  return {
    abortController: input.controller,
    cwd: resolveClaudeAgentRoot(input.config.agentRoot),
    env: createClaudeAgentSubprocessEnv(input.config),
    hooks: createClaudeRuntimeHooks({
      continuation: input.continuation,
      responses: input.responses,
      onAudit: input.onAudit,
    }),
    includePartialMessages: true,
    maxBudgetUsd: input.config.maxBudgetUsd,
    maxTurns: input.config.maxTurns,
    permissionMode: "dontAsk",
    persistSession: true,
    settingSources: ["project"],
    skills: "all",
    systemPrompt: { type: "preset", preset: "claude_code" },
    tools: ["AskUserQuestion"],
    ...(input.continuation ? { resume: input.continuation.sessionId } : {}),
    ...(!input.config.baseUrl ? { model: input.config.model } : {}),
  };
}

function createClaudeAgentSubprocessEnv(config: ResolvedClaudeAgentConfig) {
  const env: Record<string, string | undefined> = {
    ...process.env,
    CLAUDE_AGENT_SDK_CLIENT_APP: "agent-template/1.0.0",
    CLAUDE_CODE_AUTO_COMPACT_WINDOW: String(config.autoCompactWindow),
    CLAUDE_CONFIG_DIR: config.stateDirectory,
    CLAUDE_TOOLBOX_MCP_URL: toMcpEndpoint(
      config.toolboxUrl ?? defaultClaudeToolboxUrl,
    ),
    ...(config.apiKey ? { ANTHROPIC_API_KEY: config.apiKey } : {}),
    ...(config.authToken ? { ANTHROPIC_AUTH_TOKEN: config.authToken } : {}),
    ...(config.baseUrl ? { ANTHROPIC_BASE_URL: config.baseUrl } : {}),
    ...(!config.baseUrl
      ? {
          ANTHROPIC_DEFAULT_HAIKU_MODEL: config.model,
          ANTHROPIC_DEFAULT_OPUS_MODEL: config.model,
          ANTHROPIC_DEFAULT_SONNET_MODEL: config.model,
          ANTHROPIC_MODEL: config.model,
        }
      : {}),
  };

  delete env.CLAUDE_AGENT_CONTINUATION_SECRET;
  delete env.TOOLBOX_URL;
  if (config.baseUrl) {
    delete env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
    delete env.ANTHROPIC_DEFAULT_OPUS_MODEL;
    delete env.ANTHROPIC_DEFAULT_SONNET_MODEL;
    delete env.ANTHROPIC_MODEL;
  }

  return env;
}

function createContinuationResult(
  sessionId: string | undefined,
  pendingToolUseId: string | undefined,
  continuations: ClaudeSessionContinuations,
): { continuation?: AgentContinuation } {
  if (!sessionId) {
    return {};
  }
  return {
    continuation: continuations.issue({
      sessionId,
      ...(pendingToolUseId ? { pendingToolUseId } : {}),
    }),
  };
}

async function completeContinuationLease(
  lease:
    | Awaited<ReturnType<ClaudeSessionContinuations["acquire"]>>
    | undefined,
) {
  if (!lease) return undefined;
  try {
    await lease.complete();
    return undefined;
  } catch (caught) {
    return formatCaughtError(caught);
  }
}

function isDeferredResult(
  result: Extract<SDKMessage, { type: "result" }>,
): result is Extract<SDKMessage, { type: "result" }> & {
  subtype: "success";
  result: string;
  deferred_tool_use: { id: string; name: string; input: Record<string, unknown> };
} {
  return (
    result.subtype === "success" &&
    result.stop_reason === "tool_deferred" &&
    result.deferred_tool_use?.name === "AskUserQuestion"
  );
}

function ensureStateDirectory(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

function toMcpEndpoint(toolboxUrl: string) {
  const normalized = toolboxUrl.replace(/\/+$/, "");
  return normalized.endsWith("/mcp") ? normalized : `${normalized}/mcp`;
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
  reason: string,
  onEvent: ((event: AgentRunEvent) => void) | undefined,
) {
  if (
    events.some((event) => event.kind === "error" && event.message === reason)
  ) {
    return;
  }
  emitEvent(events, { kind: "error", message: reason }, onEvent);
}

function createFailedResult(
  reason: string,
  onEvent: ((event: AgentRunEvent) => void) | undefined,
): ClaudeAgentRunResult {
  const event = { kind: "error", message: reason } satisfies AgentRunEvent;
  onEvent?.(event);
  return { status: "failed", events: [event], reason };
}

function writeClaudeAuditEvent(event: ClaudeAuditEvent) {
  logger.info(event, "Claude Agent lifecycle");
}

function formatCaughtError(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}
