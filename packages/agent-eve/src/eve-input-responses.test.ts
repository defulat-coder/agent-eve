import { describe, expect, it } from "vitest";
import { toEveInputResponses } from "./eve-input-responses.js";

describe("Eve input response adapter", () => {
  it("maps stable product responses to Eve native responses", () => {
    expect(
      toEveInputResponses([
        { kind: "selected-option", requestId: "request-1", optionId: "yes" },
        { kind: "text", requestId: "request-2", text: "补充说明" },
      ]),
    ).toEqual([
      { requestId: "request-1", optionId: "yes" },
      { requestId: "request-2", text: "补充说明" },
    ]);
  });

  it("fails explicitly when the runtime cannot represent multi-select", () => {
    expect(() =>
      toEveInputResponses([
        {
          kind: "selected-options",
          requestId: "request-1",
          optionIds: ["a", "b"],
        },
      ]),
    ).toThrow("do not support multi-select");
  });
});
