import { describe, expect, it } from "vitest";
import {
  defaultAgentRuntimeName,
  defaultClaudeAgentModel,
  defaultEveAgentModel,
  getAgentRuntimeStateFromEnv,
  parseAgentRuntimeEnv
} from "./index.js";

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

  it("keeps runtime-specific env config behind the Agent runtime env interface", () => {
    expect(parseAgentRuntimeEnv({})).toMatchObject({
      AGENT_RUNTIME: defaultAgentRuntimeName,
      CLAUDE_AGENT_MODEL: defaultClaudeAgentModel,
      EVE_AGENT_MODEL: defaultEveAgentModel
    });

    expect(getAgentRuntimeStateFromEnv({ AGENT_RUNTIME: "eve", EVE_AGENT_MODEL: "eve-custom" })).toMatchObject({
      runtime: "eve",
      model: "eve-custom"
    });
  });
});
