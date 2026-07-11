import { describe, expect, it } from "vitest";
import { summarizeClaudeToolInput } from "./claude-tool-event-policy.js";

describe("Claude tool event policy", () => {
  it("keeps only Toolbox field names", () => {
    const summary = summarizeClaudeToolInput(
      "mcp__toolbox__get-ecommerce-order-detail",
      {
        order_id: "ORD-secret",
        nested: { customer_email: "secret@example.com" },
      },
    );

    expect(summary).toBe('{"fields":["nested","order_id"]}');
    expect(summary).not.toContain("ORD-secret");
    expect(summary).not.toContain("secret@example.com");
  });

  it("summarizes questions without exposing their content", () => {
    expect(
      summarizeClaudeToolInput("AskUserQuestion", {
        questions: [{ question: "包含敏感客户信息" }],
      }),
    ).toBe('{"questions":1}');
  });

  it("redacts unknown tools by default", () => {
    expect(summarizeClaudeToolInput("future-tool", { token: "secret" })).toBe(
      "[redacted]",
    );
  });
});
