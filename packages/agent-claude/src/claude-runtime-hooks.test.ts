import { describe, expect, it, vi } from "vitest";
import { createClaudeRuntimeHooks } from "./claude-runtime-hooks.js";

describe("Claude runtime hooks", () => {
  it("defers a new AskUserQuestion without recording its input", async () => {
    const onAudit = vi.fn();
    const hooks = createClaudeRuntimeHooks({
      continuation: undefined,
      responses: [],
      onAudit,
    });
    const callback = hooks.PreToolUse?.[0]?.hooks[0];

    await expect(
      callback?.(
        {
          cwd: "/tmp",
          hook_event_name: "PreToolUse",
          session_id: "session-1",
          tool_input: { questions: [] },
          tool_name: "AskUserQuestion",
          tool_use_id: "tool-1",
          transcript_path: "/tmp/transcript",
        },
        "tool-1",
        { signal: new AbortController().signal },
      ),
    ).resolves.toMatchObject({
      hookSpecificOutput: { permissionDecision: "defer" },
    });
    expect(onAudit).not.toHaveBeenCalled();
  });

  it("allows a deferred question with structured answers", async () => {
    const hooks = createClaudeRuntimeHooks({
      continuation: {
        expiresAt: Date.now() + 1_000,
        pendingToolUseId: "tool-1",
        sessionId: "session-1",
      },
      responses: [{ requestId: "tool-1:0", optionId: "0" }],
      onAudit: vi.fn(),
    });
    const callback = hooks.PreToolUse?.[0]?.hooks[0];

    await expect(
      callback?.(
        {
          cwd: "/tmp",
          hook_event_name: "PreToolUse",
          session_id: "session-1",
          tool_input: {
            questions: [
              {
                question: "继续吗？",
                options: [{ label: "继续" }, { label: "停止" }],
              },
            ],
          },
          tool_name: "AskUserQuestion",
          tool_use_id: "tool-1",
          transcript_path: "/tmp/transcript",
        },
        "tool-1",
        { signal: new AbortController().signal },
      ),
    ).resolves.toMatchObject({
      hookSpecificOutput: {
        permissionDecision: "allow",
        updatedInput: { answers: { "继续吗？": "继续" } },
      },
    });
  });

  it("audits lifecycle metadata without prompt, input or output content", async () => {
    const onAudit = vi.fn();
    const hooks = createClaudeRuntimeHooks({
      continuation: undefined,
      responses: [],
      onAudit,
    });
    const callback = hooks.PreToolUse?.[1]?.hooks[0];

    await callback?.(
      {
        cwd: "/tmp",
        hook_event_name: "PreToolUse",
        session_id: "session-1",
        tool_input: { secret: "must-not-be-logged" },
        tool_name: "mcp__toolbox__list-agent-runs",
        tool_use_id: "tool-1",
        transcript_path: "/tmp/transcript",
      },
      "tool-1",
      { signal: new AbortController().signal },
    );

    expect(onAudit).toHaveBeenCalledWith({
      event: "PreToolUse",
      sessionId: "session-1",
      timestamp: expect.any(String),
      tool: "mcp__toolbox__list-agent-runs",
      toolUseId: "tool-1",
    });
    expect(JSON.stringify(onAudit.mock.calls)).not.toContain("must-not-be-logged");
  });
});
