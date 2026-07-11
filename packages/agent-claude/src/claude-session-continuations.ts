import { randomUUID } from "node:crypto";
import type { AgentContinuation } from "@agent-template/shared";
import {
  decodeClaudeContinuation,
  encodeClaudeContinuation,
  type ClaudeContinuationPayload,
} from "./claude-continuation.js";

export type ClaudeContinuationLeaseStore = {
  acquire(key: string, leaseId: string, ttlMs: number): Promise<boolean>;
  complete(key: string, leaseId: string, ttlMs: number): Promise<boolean>;
  release(key: string, leaseId: string): Promise<boolean>;
};

export type AcquiredClaudeContinuation = {
  payload: ClaudeContinuationPayload;
  complete(): Promise<void>;
  release(): Promise<void>;
};

export class ClaudeSessionContinuations {
  readonly #leaseMs: number;
  readonly #secret: string;
  readonly #store: ClaudeContinuationLeaseStore;
  readonly #ttlMs: number;

  constructor(options: {
    leaseMs: number;
    secret: string;
    store: ClaudeContinuationLeaseStore;
    ttlMs: number;
  }) {
    this.#leaseMs = options.leaseMs;
    this.#secret = options.secret;
    this.#store = options.store;
    this.#ttlMs = options.ttlMs;
  }

  issue(input: {
    sessionId: string;
    pendingToolUseId?: string;
  }): AgentContinuation {
    return encodeClaudeContinuation(
      {
        continuationId: randomUUID(),
        sessionId: input.sessionId,
        ...(input.pendingToolUseId
          ? { pendingToolUseId: input.pendingToolUseId }
          : {}),
      },
      this.#secret,
      this.#ttlMs,
    );
  }

  async acquire(
    continuation: AgentContinuation,
  ): Promise<AcquiredClaudeContinuation> {
    const payload = decodeClaudeContinuation(continuation, this.#secret);
    if (!payload) {
      throw new Error("Claude continuation is required");
    }

    const leaseId = randomUUID();
    const key = `agent-template:claude-continuation:${payload.continuationId}`;
    const remainingTtlMs = Math.max(1, payload.expiresAt - Date.now());
    const acquired = await this.#store.acquire(
      key,
      leaseId,
      Math.min(this.#leaseMs, remainingTtlMs),
    );
    if (!acquired) {
      throw new Error("Claude continuation is already in use or consumed");
    }

    let settled = false;
    return {
      payload,
      complete: async () => {
        if (settled) return;
        settled = true;
        const completed = await this.#store.complete(
          key,
          leaseId,
          remainingTtlMs,
        );
        if (!completed) {
          throw new Error("Claude continuation lease ownership was lost");
        }
      },
      release: async () => {
        if (settled) return;
        settled = true;
        await this.#store.release(key, leaseId);
      },
    };
  }
}

export function createInMemoryClaudeContinuationStore(): ClaudeContinuationLeaseStore {
  const records = new Map<string, { expiresAt: number; value: string }>();
  return {
    async acquire(key, leaseId, ttlMs) {
      const record = records.get(key);
      if (record && record.expiresAt > Date.now()) {
        return false;
      }
      records.set(key, { expiresAt: Date.now() + ttlMs, value: leaseId });
      return true;
    },
    async complete(key, leaseId, ttlMs) {
      const record = records.get(key);
      if (!record || record.value !== leaseId) {
        return false;
      }
      records.set(key, { expiresAt: Date.now() + ttlMs, value: "consumed" });
      return true;
    },
    async release(key, leaseId) {
      const record = records.get(key);
      if (!record || record.value !== leaseId) {
        return false;
      }
      records.delete(key);
      return true;
    },
  };
}
