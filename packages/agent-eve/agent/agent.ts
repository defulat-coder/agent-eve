import { defineAgent, type AgentDefinition } from "eve";
import { createEveAnthropicModel } from "../src/config";

const agent: AgentDefinition = defineAgent({
  model: createEveAnthropicModel(process.env)
});

export default agent;
