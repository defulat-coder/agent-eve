import { describe, expect, it } from "vitest";
import {
  claudeToolboxToolNames,
  createClaudeMcpServers,
  readClaudeMcpAllowedTools,
} from "./mcp.js";

describe("Claude runtime MCP config", () => {
  it("owns the Toolbox endpoint and allowlist", () => {
    expect(createClaudeMcpServers("http://toolbox:15000")).toEqual({
      toolbox: {
        type: "http",
        url: "http://toolbox:15000/mcp",
        tools: claudeToolboxToolNames.map((name) => ({
          name,
          permission_policy: "always_allow",
        })),
      },
    });
    expect(readClaudeMcpAllowedTools("http://toolbox:15000")).toEqual(
      claudeToolboxToolNames.map((name) => `mcp__toolbox__${name}`),
    );
  });

  it("does not duplicate an explicit MCP path", () => {
    expect(createClaudeMcpServers("http://toolbox:15000/mcp")).toMatchObject({
      toolbox: { url: "http://toolbox:15000/mcp" },
    });
  });

  it("disables Toolbox when the runtime has no endpoint", () => {
    expect(createClaudeMcpServers(undefined)).toEqual({});
    expect(readClaudeMcpAllowedTools(undefined)).toEqual([]);
  });
});
