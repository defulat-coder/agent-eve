import type {
  HookCallback,
  HookInput,
  Options,
} from "@anthropic-ai/claude-agent-sdk";
import type { AgentInputResponse } from "@agent-template/shared";
import type { ClaudeContinuationPayload } from "./claude-continuation.js";
import { answerClaudeInputRequest } from "./claude-hitl.js";

export type ClaudeAuditEvent = {
  event: HookInput["hook_event_name"];
  sessionId: string;
  timestamp: string;
  tool?: string;
  toolUseId?: string;
};

export function createClaudeRuntimeHooks(input: {
  continuation: ClaudeContinuationPayload | undefined;
  responses: readonly AgentInputResponse[];
  onAudit: (event: ClaudeAuditEvent) => void;
}): NonNullable<Options["hooks"]> {
  return {
    PreToolUse: [
      {
        matcher: "AskUserQuestion",
        hooks: [createAskUserQuestionHook(input)],
      },
      { hooks: [createAuditHook(input.onAudit)] },
    ],
    PostToolUse: [{ hooks: [createAuditHook(input.onAudit)] }],
    PostToolUseFailure: [{ hooks: [createAuditHook(input.onAudit)] }],
    SessionStart: [{ hooks: [createAuditHook(input.onAudit)] }],
    SessionEnd: [{ hooks: [createAuditHook(input.onAudit)] }],
    PreCompact: [{ hooks: [createAuditHook(input.onAudit)] }],
    PostCompact: [{ hooks: [createAuditHook(input.onAudit)] }],
    SubagentStart: [{ hooks: [createAuditHook(input.onAudit)] }],
    SubagentStop: [{ hooks: [createAuditHook(input.onAudit)] }],
  };
}

function createAskUserQuestionHook({
  continuation,
  responses,
}: Pick<
  Parameters<typeof createClaudeRuntimeHooks>[0],
  "continuation" | "responses"
>): HookCallback {
  return async (hookInput, toolUseId) => {
    if (
      hookInput.hook_event_name !== "PreToolUse" ||
      hookInput.tool_name !== "AskUserQuestion" ||
      !toolUseId
    ) {
      return {};
    }

    if (
      continuation?.pendingToolUseId === toolUseId &&
      responses.length > 0
    ) {
      const updatedInput = answerClaudeInputRequest(
        toolUseId,
        toRecord(hookInput.tool_input),
        responses,
      );
      if (updatedInput) {
        return {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "allow",
            updatedInput,
          },
        };
      }
    }

    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "defer",
      },
    };
  };
}

function createAuditHook(onAudit: (event: ClaudeAuditEvent) => void): HookCallback {
  return async (hookInput, toolUseId) => {
    const tool = "tool_name" in hookInput ? hookInput.tool_name : undefined;
    onAudit({
      event: hookInput.hook_event_name,
      sessionId: hookInput.session_id,
      timestamp: new Date().toISOString(),
      ...(typeof tool === "string" ? { tool } : {}),
      ...(toolUseId ? { toolUseId } : {}),
    });
    return {};
  };
}

function toRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Claude AskUserQuestion input must be an object");
  }
  return input as Record<string, unknown>;
}
