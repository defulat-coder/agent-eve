import { describe, expect, it } from "vitest";
import {
  answerClaudeInputRequest,
  projectClaudeInputRequests,
} from "./claude-hitl.js";

const input = {
  questions: [
    {
      question: "选择统计口径？",
      header: "口径",
      multiSelect: false,
      options: [
        { label: "GMV", description: "退款前金额" },
        { label: "净销售额", description: "扣除退款" },
      ],
    },
  ],
};

describe("Claude HITL projection", () => {
  it("projects AskUserQuestion into runtime-neutral input requests", () => {
    expect(projectClaudeInputRequests("tool-1", input)).toEqual([
      {
        allowFreeform: true,
        display: "select",
        options: [
          { id: "0", label: "GMV", description: "退款前金额" },
          { id: "1", label: "净销售额", description: "扣除退款" },
        ],
        prompt: "选择统计口径？",
        requestId: "tool-1:0",
        tool: "AskUserQuestion",
      },
    ]);
  });

  it("maps platform option ids back to Claude question labels", () => {
    expect(
      answerClaudeInputRequest("tool-1", input, [
        { requestId: "tool-1:0", optionId: "1" },
      ]),
    ).toEqual({
      questions: input.questions,
      answers: { "选择统计口径？": "净销售额" },
    });
  });

  it("waits until every question has a response", () => {
    expect(answerClaudeInputRequest("tool-1", input, [])).toBeUndefined();
  });

  it("maps multiple selections to the label list expected by Claude", () => {
    const multiSelectInput = {
      questions: [
        {
          question: "选择渠道？",
          multiSelect: true,
          options: [{ label: "Web" }, { label: "门店" }],
        },
      ],
    };

    expect(projectClaudeInputRequests("tool-2", multiSelectInput)[0]).toMatchObject({
      multiSelect: true,
    });
    expect(
      answerClaudeInputRequest("tool-2", multiSelectInput, [
        { requestId: "tool-2:0", optionIds: ["0", "1"] },
      ]),
    ).toMatchObject({ answers: { "选择渠道？": "Web, 门店" } });
  });
});
