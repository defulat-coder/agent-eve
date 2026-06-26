import { describe, expect, it } from "vitest";
import { getAgentConfigState, parseAgentConfig } from "./index.js";

describe("agent config", () => {
  it("does not require an Anthropic API key", () => {
    const config = parseAgentConfig({});
    const state = getAgentConfigState(config);

    expect(state.configured).toBe(false);
    expect(state.model).toBe("claude-sonnet-4-5");
  });
});
