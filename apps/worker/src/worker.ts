import { loadWorkerEnv } from "./env.js";
import { createAgentWorkerProcess, registerWorkerShutdown } from "./process.js";

const workerProcess = createAgentWorkerProcess({ env: loadWorkerEnv() });
registerWorkerShutdown(workerProcess);
