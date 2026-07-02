import { describe, expect, it } from "vitest";
import { defaultAgentRuntimeName, defaultClaudeAgentModel, getAgentRuntimeStateFromEnv } from "./index.js";

describe("Agent runtime selector", () => {
  it("defaults to the Claude Agent runtime", () => {
    const state = getAgentRuntimeStateFromEnv({});

    expect(state.runtime).toBe(defaultAgentRuntimeName);
    expect(state.configured).toBe(false);
    expect(state.model).toBe(defaultClaudeAgentModel);
  });

  it("selects the Eve Agent runtime from AGENT_RUNTIME", () => {
    const state = getAgentRuntimeStateFromEnv({ AGENT_RUNTIME: "eve" });

    expect(state.runtime).toBe("eve");
    expect(state.configured).toBe(true);
  });
});
