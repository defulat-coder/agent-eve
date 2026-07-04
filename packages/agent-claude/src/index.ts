import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRunEvent } from "@agent-template/shared";

export const defaultClaudeAgentModel = "kimi-for-coding";
export const defaultAnthropicBaseUrl = "https://api.kimi.com/coding/";

export const ClaudeAgentConfigSchema = z.object({
  apiKey: z.string().min(1).optional(),
  authToken: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).default(defaultClaudeAgentModel)
});

export type ClaudeAgentConfig = z.infer<typeof ClaudeAgentConfigSchema>;

export type ClaudeAgentRuntimeState = {
  configured: boolean;
  model: string;
};

export type ClaudeAgentRunInput = {
  prompt: string;
};

export type ClaudeAgentRunResult =
  | {
      status: "skipped";
      reason: string;
    }
  | {
      status: "completed";
      events: AgentRunEvent[];
      output: string;
      sessionId?: string;
    }
  | {
      status: "failed";
      events: AgentRunEvent[];
      reason: string;
      sessionId?: string;
    };

export function parseClaudeAgentConfig(input: Record<string, unknown>): ClaudeAgentConfig {
  return ClaudeAgentConfigSchema.parse({
    apiKey: input.ANTHROPIC_API_KEY || undefined,
    authToken: input.ANTHROPIC_AUTH_TOKEN || undefined,
    baseUrl: input.ANTHROPIC_BASE_URL || undefined,
    model: input.CLAUDE_AGENT_MODEL || input.ANTHROPIC_MODEL || undefined
  });
}

export function getClaudeAgentRuntimeState(config: ClaudeAgentConfig): ClaudeAgentRuntimeState {
  return {
    configured: Boolean(config.apiKey || config.authToken),
    model: config.model
  };
}

export function getClaudeAgentRuntimeStateFromEnv(input: Record<string, unknown>): ClaudeAgentRuntimeState {
  return getClaudeAgentRuntimeState(parseClaudeAgentConfig(input));
}

export async function loadClaudeAgentSdk() {
  return import("@anthropic-ai/claude-agent-sdk");
}

type ClaudeAgentSdk = {
  query(input: {
    prompt: string;
    options?: Record<string, unknown>;
  }): AsyncIterable<SDKMessage>;
};

export async function runClaudeAgent(
  input: ClaudeAgentRunInput,
  config: ClaudeAgentConfig,
  options: {
    loadSdk?: () => Promise<ClaudeAgentSdk>;
    onEvent?: (event: AgentRunEvent) => void;
  } = {}
): Promise<ClaudeAgentRunResult> {
  if (!config.apiKey && !config.authToken) {
    return { status: "skipped", reason: "ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is not configured" };
  }

  const sdk = await (options.loadSdk ?? loadClaudeAgentSdk)();
  const runEvents: AgentRunEvent[] = [];
  let result: Extract<SDKMessage, { type: "result" }> | undefined;
  let sessionId: string | undefined;

  for await (const message of sdk.query({
    prompt: input.prompt,
    options: {
      env: createClaudeAgentSubprocessEnv(config),
      maxTurns: 1,
      permissionMode: "dontAsk",
      persistSession: false,
      tools: [],
      ...(!config.baseUrl ? { model: config.model } : {})
    }
  })) {
    if ("session_id" in message) {
      sessionId = message.session_id;
    }

    for (const event of formatClaudeAgentProgressEvent(message)) {
      runEvents.push(event);
      options.onEvent?.(event);
    }

    if (message.type === "result") {
      result = message;
    }
  }

  if (!result) {
    const event = { kind: "error", message: "Claude Agent SDK did not return a result" } satisfies AgentRunEvent;
    options.onEvent?.(event);

    return {
      status: "failed",
      events: [...runEvents, event],
      reason: "Claude Agent SDK did not return a result",
      ...(sessionId ? { sessionId } : {})
    };
  }

  if (result.subtype !== "success" || result.is_error) {
    const reason = "errors" in result ? result.errors.join("\n") : result.result;
    const message = reason || "Claude Agent SDK run failed";
    const event = { kind: "error", message } satisfies AgentRunEvent;
    options.onEvent?.(event);

    return {
      status: "failed",
      events: [...runEvents, event],
      reason: message,
      ...(sessionId ? { sessionId } : {})
    };
  }

  const event = { kind: "done", result: result.result } satisfies AgentRunEvent;
  options.onEvent?.(event);

  return {
    status: "completed",
    events: [...runEvents, event],
    output: result.result,
    ...(sessionId ? { sessionId } : {})
  };
}

function formatClaudeAgentProgressEvent(message: SDKMessage): AgentRunEvent[] {
  if (message.type === "result") {
    return [];
  }

  return [{ kind: "unknown", text: JSON.stringify(message) ?? String(message) }];
}

function createClaudeAgentSubprocessEnv(config: ClaudeAgentConfig) {
  const claudeConfigDir = join(tmpdir(), "agent-template-claude-code");
  mkdirSync(claudeConfigDir, { recursive: true });

  const env = {
    ...process.env,
    CLAUDE_CODE_AUTO_COMPACT_WINDOW: "262144",
    CLAUDE_CONFIG_DIR: claudeConfigDir,
    ...(config.apiKey ? { ANTHROPIC_API_KEY: config.apiKey } : {}),
    ...(config.authToken ? { ANTHROPIC_AUTH_TOKEN: config.authToken } : {}),
    ...(config.baseUrl ? { ANTHROPIC_BASE_URL: config.baseUrl } : {}),
    ...(!config.baseUrl
      ? {
          ANTHROPIC_DEFAULT_HAIKU_MODEL: config.model,
          ANTHROPIC_DEFAULT_OPUS_MODEL: config.model,
          ANTHROPIC_DEFAULT_SONNET_MODEL: config.model,
          ANTHROPIC_MODEL: config.model
        }
      : {})
  };

  if (config.baseUrl) {
    delete env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
    delete env.ANTHROPIC_DEFAULT_OPUS_MODEL;
    delete env.ANTHROPIC_DEFAULT_SONNET_MODEL;
    delete env.ANTHROPIC_MODEL;
  }

  return env;
}
