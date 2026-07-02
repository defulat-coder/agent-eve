import { describe, expect, it } from "vitest";
import { eveAgentDirectory, getEveAgentRuntimeStateFromEnv } from "./index.js";

describe("Eve Agent runtime", () => {
  it("points at the package-local authored surface", () => {
    const state = getEveAgentRuntimeStateFromEnv({});

    expect(state.configured).toBe(true);
    expect(state.authoredSurface).toBe(eveAgentDirectory);
  });
});
