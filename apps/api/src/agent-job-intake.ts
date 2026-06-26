import { agentJobName, AgentJobPayloadSchema, type AgentJobName, type AgentJobPayload } from "@project-template/shared";
import { createAgentQueue } from "./queue.js";

export type AgentJobAccepted = {
  id: string | undefined;
  queue: string;
};

type AgentJobQueue = {
  name: string;
  add(name: AgentJobName, payload: AgentJobPayload): Promise<{ id: string | undefined }>;
  close(): Promise<unknown>;
};

export type EnqueueAgentJobOptions = {
  redisUrl: string;
  createQueue?: (redisUrl: string) => AgentJobQueue;
};

export async function enqueueAgentJob(input: unknown, options: EnqueueAgentJobOptions): Promise<AgentJobAccepted> {
  const payload = AgentJobPayloadSchema.parse(input);
  const queue = (options.createQueue ?? createAgentQueue)(options.redisUrl);

  try {
    const job = await queue.add(agentJobName, payload);
    return { id: job.id, queue: queue.name };
  } finally {
    await queue.close();
  }
}
