import { describe, expect, it } from "vitest";
import { enqueueAgentJob } from "./agent-job-intake.js";

describe("enqueueAgentJob", () => {
  it("validates, enqueues, and closes the Agent job queue", async () => {
    const calls: unknown[] = [];
    const result = await enqueueAgentJob(
      {
        prompt: "Summarize this template",
        requestedAt: "2026-06-26T00:00:00.000Z"
      },
      {
        redisUrl: "redis://localhost:56379",
        createQueue: (redisUrl) => {
          calls.push(["createQueue", redisUrl]);

          return {
            name: "agent-jobs",
            async add(name, payload) {
              calls.push(["add", name, payload]);
              return { id: "job-1" };
            },
            async close() {
              calls.push(["close"]);
            }
          };
        }
      }
    );

    expect(result).toEqual({ id: "job-1", queue: "agent-jobs" });
    expect(calls).toEqual([
      ["createQueue", "redis://localhost:56379"],
      [
        "add",
        "agent.run",
        {
          prompt: "Summarize this template",
          requestedAt: "2026-06-26T00:00:00.000Z"
        }
      ],
      ["close"]
    ]);
  });
});
