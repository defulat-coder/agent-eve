import { describe, expect, it } from "vitest";
import { defaultClaudeAgentModel, getClaudeAgentRuntimeStateFromEnv } from "./index.js";

describe("Claude Agent runtime", () => {
  it("does not require an Anthropic API key", () => {
    const state = getClaudeAgentRuntimeStateFromEnv({});

    expect(state.configured).toBe(false);
    expect(state.model).toBe(defaultClaudeAgentModel);
  });
});
