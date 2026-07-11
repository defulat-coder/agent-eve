import Redis from "ioredis";
import type { ClaudeContinuationLeaseStore } from "./claude-session-continuations.js";

const stores = new Map<string, ClaudeContinuationLeaseStore>();

export function getRedisClaudeContinuationStore(
  redisUrl: string,
): ClaudeContinuationLeaseStore {
  const existing = stores.get(redisUrl);
  if (existing) {
    return existing;
  }

  const client = new Redis(redisUrl, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  let connectPromise: Promise<void> | undefined;
  async function ensureConnected() {
    if (client.status === "ready") return;
    connectPromise ??= client.connect();
    try {
      await connectPromise;
    } finally {
      connectPromise = undefined;
    }
  }
  const store: ClaudeContinuationLeaseStore = {
    async acquire(key, leaseId, ttlMs) {
      await ensureConnected();
      return (await client.set(key, leaseId, "PX", ttlMs, "NX")) === "OK";
    },
    async complete(key, leaseId, ttlMs) {
      await ensureConnected();
      return (
        Number(await client.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then redis.call('psetex', KEYS[1], ARGV[2], 'consumed'); return 1 else return 0 end",
          1,
          key,
          leaseId,
          String(ttlMs),
        )) === 1
      );
    },
    async release(key, leaseId) {
      await ensureConnected();
      return (
        Number(await client.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          key,
          leaseId,
        )) === 1
      );
    },
  };
  stores.set(redisUrl, store);
  return store;
}
