import { z } from "zod";

export const AgentJobNameSchema = z.literal("agent.run");

export const AgentJobPayloadSchema = z.object({
  prompt: z.string().min(1),
  requestedAt: z.string().datetime()
});

export type AgentJobName = z.infer<typeof AgentJobNameSchema>;
export type AgentJobPayload = z.infer<typeof AgentJobPayloadSchema>;

export const agentQueueName = "agent-jobs";
