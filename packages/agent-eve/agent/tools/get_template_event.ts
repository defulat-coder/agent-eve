import { defineTool } from "eve/tools";
import { z } from "zod";
import { callHostTool, summarizeHostToolResult } from "../lib/mcp_host";

export default defineTool({
  description: "Get one template business event from the Host-managed Toolbox MCP server.",
  inputSchema: z.object({
    eventId: z.string().min(1)
  }),
  async execute(input) {
    return callHostTool("get-template-event", input);
  },
  toModelOutput: summarizeHostToolResult
});
