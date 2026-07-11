import { z } from "zod";
import type {
  AgentInputRequest,
  AgentInputResponse,
} from "@agent-template/shared";

const ClaudeQuestionSchema = z.object({
  question: z.string().min(1),
  header: z.string().optional(),
  multiSelect: z.boolean().optional(),
  options: z.array(
    z.object({
      label: z.string().min(1),
      description: z.string().optional(),
    }),
  ),
});

const ClaudeAskUserQuestionInputSchema = z.object({
  questions: z.array(ClaudeQuestionSchema).min(1).max(4),
});

export function projectClaudeInputRequests(
  toolUseId: string,
  input: Record<string, unknown>,
): AgentInputRequest[] {
  const parsed = ClaudeAskUserQuestionInputSchema.parse(input);

  return parsed.questions.map((question, questionIndex) => ({
    requestId: createRequestId(toolUseId, questionIndex),
    prompt: question.question,
    tool: "AskUserQuestion",
    display: "select",
    allowFreeform: true,
    ...(question.multiSelect ? { multiSelect: true } : {}),
    options: question.options.map((option, optionIndex) => ({
      id: String(optionIndex),
      label: option.label,
      ...(option.description ? { description: option.description } : {}),
    })),
  }));
}

export function answerClaudeInputRequest(
  toolUseId: string,
  input: Record<string, unknown>,
  responses: readonly AgentInputResponse[],
): Record<string, unknown> | undefined {
  const parsed = ClaudeAskUserQuestionInputSchema.parse(input);
  const answers: Record<string, string> = {};

  for (const [questionIndex, question] of parsed.questions.entries()) {
    const response = responses.find(
      (candidate) =>
        candidate.requestId === createRequestId(toolUseId, questionIndex),
    );
    if (!response) {
      return undefined;
    }

    if (response.text) {
      answers[question.question] = response.text;
      continue;
    }

    if (response.optionIds) {
      const labels = response.optionIds.map((id) => {
        const optionIndex = Number(id);
        const option = Number.isInteger(optionIndex)
          ? question.options[optionIndex]
          : undefined;
        if (!option) {
          throw new Error(
            `Invalid response for Claude input request ${response.requestId}`,
          );
        }
        return option.label;
      });
      answers[question.question] = labels.join(", ");
      continue;
    }

    const optionIndex = Number(response.optionId);
    const option = Number.isInteger(optionIndex)
      ? question.options[optionIndex]
      : undefined;
    if (!option) {
      throw new Error(`Invalid response for Claude input request ${response.requestId}`);
    }

    answers[question.question] = option.label;
  }

  return { questions: parsed.questions, answers };
}

function createRequestId(toolUseId: string, questionIndex: number) {
  return `${toolUseId}:${questionIndex}`;
}
