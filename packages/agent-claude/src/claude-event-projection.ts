import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRunEvent } from "@agent-template/shared";

const partialTextEventMinDelta = 200;

export class ClaudeEventProjection {
  readonly #toolNames = new Map<string, string>();
  #partialText = "";
  #lastPartialTextEventLength = 0;

  project(message: SDKMessage): AgentRunEvent[] {
    const events: AgentRunEvent[] = [];

    if (isClaudePartialTextStart(message)) {
      this.#partialText = "";
      this.#lastPartialTextEventLength = 0;
    }

    const delta = readClaudePartialTextDelta(message);
    if (delta !== undefined) {
      this.#partialText += delta;
      if (
        this.#lastPartialTextEventLength === 0 ||
        this.#partialText.length - this.#lastPartialTextEventLength >=
          partialTextEventMinDelta
      ) {
        events.push({ kind: "text", text: this.#partialText });
        this.#lastPartialTextEventLength = this.#partialText.length;
      }
    }

    if (
      message.type === "result" &&
      this.#partialText.length > this.#lastPartialTextEventLength
    ) {
      events.push({ kind: "text", text: this.#partialText });
      this.#resetPartialText();
    }

    if (message.type === "assistant") {
      events.push(...this.#projectAssistantMessage(message));
      this.#resetPartialText();
    } else if (message.type === "user") {
      events.push(...this.#projectUserMessage(message));
    } else if (message.type === "result") {
      events.push(projectUsage(message));
    } else if (message.type === "system") {
      events.push(...this.#projectSystemMessage(message));
    } else if (message.type === "auth_status" && message.error) {
      events.push({
        kind: "authorization",
        connection: "claude",
        status: "failed",
        description: message.error,
      });
    } else if (
      message.type === "rate_limit_event" &&
      message.rate_limit_info.status === "rejected"
    ) {
      events.push({ kind: "error", message: "Claude rate limit rejected the run" });
    }

    return events;
  }

  #projectAssistantMessage(
    message: Extract<SDKMessage, { type: "assistant" }>,
  ): AgentRunEvent[] {
    const events: AgentRunEvent[] = [];
    const content = message.message.content;
    if (!Array.isArray(content)) {
      return events;
    }

    for (const item of content) {
      if (item.type === "text") {
        events.push({ kind: "text", text: item.text });
      } else if (item.type === "tool_use") {
        this.#toolNames.set(item.id, item.name);
        events.push({
          kind: "tool-call",
          tool: item.name,
          input: JSON.stringify(item.input ?? {}),
        });
      }
    }

    return events;
  }

  #projectUserMessage(
    message: Extract<SDKMessage, { type: "user" }>,
  ): AgentRunEvent[] {
    const events: AgentRunEvent[] = [];
    const content = message.message.content;
    if (!Array.isArray(content)) {
      return events;
    }

    for (const item of content) {
      if (item.type !== "tool_result") {
        continue;
      }

      events.push({
        kind: "tool-result",
        tool: this.#toolNames.get(item.tool_use_id) ?? item.tool_use_id,
        status: item.is_error ? "failed" : "completed",
      });
    }

    return events;
  }

  #projectSystemMessage(
    message: Extract<SDKMessage, { type: "system" }>,
  ): AgentRunEvent[] {
    switch (message.subtype) {
      case "init":
        return message.mcp_servers
          .filter((server) => server.status !== "connected")
          .map((server) => ({
            kind: "authorization" as const,
            connection: server.name,
            status: "failed" as const,
            description: `MCP server status: ${server.status}`,
          }));
      case "status":
        return message.status === "compacting"
          ? [{ kind: "compaction", status: "requested" }]
          : [];
      case "compact_boundary":
        return [
          {
            kind: "compaction",
            status: "completed",
            inputTokens: message.compact_metadata.pre_tokens,
          },
        ];
      case "permission_denied":
        return [
          {
            kind: "tool-result",
            tool: message.tool_name,
            status: "rejected",
            error: message.message,
          },
        ];
      case "task_started":
        return message.skip_transcript
          ? []
          : [
              {
                kind: "subagent",
                name: message.subagent_type ?? message.description,
                status: "started",
              },
            ];
      case "task_notification":
        return message.skip_transcript
          ? []
          : [
              {
                kind: "subagent",
                name: message.summary || message.task_id,
                status: "completed",
              },
            ];
      case "mirror_error":
        return [{ kind: "error", message: message.error }];
      case "model_refusal_no_fallback":
        return [{ kind: "error", message: message.content }];
      case "session_state_changed":
        return message.state === "requires_action" ? [{ kind: "waiting" }] : [];
      default:
        return [];
    }
  }

  #resetPartialText() {
    this.#partialText = "";
    this.#lastPartialTextEventLength = 0;
  }
}

function projectUsage(
  message: Extract<SDKMessage, { type: "result" }>,
): AgentRunEvent {
  return {
    kind: "usage",
    ...(message.usage.input_tokens === undefined
      ? {}
      : { inputTokens: message.usage.input_tokens }),
    ...(message.usage.output_tokens === undefined
      ? {}
      : { outputTokens: message.usage.output_tokens }),
    ...(message.usage.cache_read_input_tokens === undefined
      ? {}
      : { cacheReadTokens: message.usage.cache_read_input_tokens }),
    ...(message.usage.cache_creation_input_tokens === undefined
      ? {}
      : { cacheWriteTokens: message.usage.cache_creation_input_tokens }),
    ...(message.total_cost_usd === undefined
      ? {}
      : { costUsd: message.total_cost_usd }),
  };
}

function readClaudePartialTextDelta(message: SDKMessage): string | undefined {
  if (
    message.type !== "stream_event" ||
    message.event.type !== "content_block_delta" ||
    message.event.delta.type !== "text_delta"
  ) {
    return undefined;
  }

  return message.event.delta.text;
}

function isClaudePartialTextStart(message: SDKMessage) {
  return (
    message.type === "stream_event" &&
    message.event.type === "content_block_start" &&
    message.event.content_block.type === "text"
  );
}
