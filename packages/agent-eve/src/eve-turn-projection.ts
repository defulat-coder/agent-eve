import type {
  HandleMessageStreamEvent,
  InputOption,
  InputRequest,
} from "eve/client";
import type { AgentRunEvent } from "@agent-template/shared";

export type EveTurnProjection =
  | { status: "completed" | "waiting"; output: string }
  | { status: "failed"; reason: string };

export function projectEveTurn(
  events: readonly HandleMessageStreamEvent[],
): EveTurnProjection | undefined {
  const failed = findLastByType(events, "session.failed");
  if (failed) {
    return { status: "failed", reason: failed.data.message };
  }

  let boundary:
    | Extract<
        HandleMessageStreamEvent,
        { type: "session.waiting" | "session.completed" }
      >
    | undefined;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (
      event?.type === "session.waiting" ||
      event?.type === "session.completed"
    ) {
      boundary = event;
      break;
    }
  }
  if (!boundary) {
    return undefined;
  }

  return {
    status: boundary.type === "session.waiting" ? "waiting" : "completed",
    output: findEveOutput(events),
  };
}

export function projectEveStreamEvent(
  event: HandleMessageStreamEvent,
): AgentRunEvent[] {
  switch (event.type) {
    case "message.appended":
      return [{ kind: "text", text: event.data.messageSoFar }];
    case "message.completed":
      return typeof event.data.message === "string"
        ? [{ kind: "text", text: event.data.message }]
        : [];
    case "actions.requested":
      return event.data.actions.map((action) => ({
        kind: "tool-call",
        tool: readActionRequestName(action),
        input: formatEveOutput(action.input),
      }));
    case "action.result": {
      const tool = readActionResultName(event.data.result);
      return tool
        ? [
            {
              kind: "tool-result",
              tool,
              status: event.data.status,
              ...(event.data.error?.message
                ? { error: event.data.error.message }
                : {}),
            },
          ]
        : [];
    }
    case "input.requested":
      return [
        {
          kind: "input-requested",
          requests: event.data.requests.map(projectInputRequest),
        },
      ];
    case "authorization.required":
      return [
        {
          kind: "authorization",
          connection: event.data.name,
          status: "required",
          description: event.data.description,
          ...(event.data.authorization?.url
            ? { url: event.data.authorization.url }
            : {}),
          ...(event.data.authorization?.userCode
            ? { userCode: event.data.authorization.userCode }
            : {}),
          ...(event.data.authorization?.instructions
            ? { instructions: event.data.authorization.instructions }
            : {}),
        },
      ];
    case "authorization.completed":
      return [
        {
          kind: "authorization",
          connection: event.data.name,
          status: event.data.outcome,
        },
      ];
    case "subagent.called":
      return [
        {
          kind: "subagent",
          name: event.data.name,
          status: "started",
          sessionId: event.data.childSessionId,
        },
      ];
    case "subagent.started":
      return [
        {
          kind: "subagent",
          name: event.data.subagentName,
          status: "started",
        },
      ];
    case "subagent.completed":
      return [
        {
          kind: "subagent",
          name: event.data.subagentName,
          status: "completed",
        },
      ];
    case "compaction.requested":
      return [
        {
          kind: "compaction",
          status: "requested",
          ...(event.data.usageInputTokens === null
            ? {}
            : { inputTokens: event.data.usageInputTokens }),
        },
      ];
    case "compaction.completed":
      return [{ kind: "compaction", status: "completed" }];
    case "step.completed": {
      const usage = event.data.usage;
      return usage
        ? [
            {
              kind: "usage",
              ...(usage.inputTokens === undefined
                ? {}
                : { inputTokens: usage.inputTokens }),
              ...(usage.outputTokens === undefined
                ? {}
                : { outputTokens: usage.outputTokens }),
              ...(usage.cacheReadTokens === undefined
                ? {}
                : { cacheReadTokens: usage.cacheReadTokens }),
              ...(usage.cacheWriteTokens === undefined
                ? {}
                : { cacheWriteTokens: usage.cacheWriteTokens }),
              ...(usage.costUsd === undefined
                ? {}
                : { costUsd: usage.costUsd }),
            },
          ]
        : [];
    }
    case "session.waiting":
      return [{ kind: "waiting" }];
    case "step.failed":
    case "turn.failed":
    case "session.failed":
      return [{ kind: "error", message: event.data.message }];
    case "message.received":
    case "reasoning.appended":
    case "reasoning.completed":
    case "result.completed":
    case "session.completed":
    case "session.started":
    case "step.started":
    case "subagent.event":
    case "turn.completed":
    case "turn.started":
      return [];
  }
}

function projectInputRequest(request: InputRequest) {
  return {
    requestId: request.requestId,
    prompt: request.prompt,
    tool: request.action.toolName,
    ...(request.display ? { display: request.display } : {}),
    ...(request.allowFreeform === undefined
      ? {}
      : { allowFreeform: request.allowFreeform }),
    ...(request.options
      ? { options: request.options.map(projectInputOption) }
      : {}),
  };
}

function projectInputOption(option: InputOption) {
  return {
    id: option.id,
    label: option.label,
    ...(option.description ? { description: option.description } : {}),
    ...(option.style ? { style: option.style } : {}),
  };
}

function readActionRequestName(
  action: Extract<
    HandleMessageStreamEvent,
    { type: "actions.requested" }
  >["data"]["actions"][number],
) {
  switch (action.kind) {
    case "tool-call":
      return action.toolName;
    case "subagent-call":
      return `eve:subagent:${action.subagentName}`;
    case "remote-agent-call":
      return `eve:subagent:${action.remoteAgentName}`;
    case "load-skill":
      return "eve:load-skill";
  }
}

function readActionResultName(
  result: Extract<
    HandleMessageStreamEvent,
    { type: "action.result" }
  >["data"]["result"],
) {
  switch (result.kind) {
    case "tool-result":
      return result.toolName;
    case "subagent-result":
      return `eve:subagent:${result.subagentName}`;
    case "load-skill-result":
      return "eve:load-skill";
  }
}

function findEveOutput(events: readonly HandleMessageStreamEvent[]): string {
  const result = findLastByType(events, "result.completed");
  if (result) {
    return formatEveOutput(result.data.result);
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === "message.completed" && event.data.message !== null) {
      return event.data.message;
    }
    if (event?.type === "message.appended") {
      return event.data.messageSoFar;
    }
  }

  return "";
}

function findLastByType<TType extends HandleMessageStreamEvent["type"]>(
  events: readonly HandleMessageStreamEvent[],
  type: TType,
): Extract<HandleMessageStreamEvent, { type: TType }> | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === type) {
      return event as Extract<HandleMessageStreamEvent, { type: TType }>;
    }
  }

  return undefined;
}

function formatEveOutput(value: unknown): string {
  return typeof value === "string" ? value : (JSON.stringify(value) ?? "");
}
