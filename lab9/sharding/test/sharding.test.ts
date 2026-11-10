import { describe, it, expect } from "vitest";
import {
  ConsistentHashStrategy,
  ModNStrategy,
  ShardedStore,
  hash32,
  type ShardingStrategy,
} from "../src/sharding";

/** Детермінований генератор псевдовипадкових чисел (щоб тести були стабільними). */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randomKeys = (n: number, seed = 42): string[] => {
  const rnd = mulberry32(seed);
  return Array.from(
    { length: n },
    (_, i) => `key-${i}-${Math.floor(rnd() * 1e9).toString(36)}`,
  );
};

const SHARDS = ["shard-1", "shard-2", "shard-3", "shard-4"];

const filled = (
  strategy: ShardingStrategy,
  keys: string[],
  ids: string[] = SHARDS,
) => {
  const store = new ShardedStore<number>(strategy, ids);
  keys.forEach((key, i) => store.put(key, i));
  return store;
};

/** Хі-квадрат статистика відхилення від рівномірного розподілу. */
const chiSquare = (counts: number[]) => {
  const expected = counts.reduce((a, b) => a + b, 0) / counts.length;
  return counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
};

/** Коефіцієнт варіації: стандартне відхилення / середнє. */
const variation = (counts: number[]) => {
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance =
    counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / counts.length;
  return Math.sqrt(variance) / mean;
};

describe("hash32", () => {
  it("is deterministic and returns an unsigned 32-bit integer", () => {
    expect(hash32("user:1")).toBe(hash32("user:1"));
    expect(hash32("user:1")).not.toBe(hash32("user:2"));

    for (const key of randomKeys(100)) {
      const h = hash32(key);
      expect(Number.isInteger(h) && h >= 0 && h <= 0xffffffff).toBe(true);
    }
  });
});

const strategies: [string, () => ShardingStrategy][] = [
  ["mod N", () => new ModNStrategy()],
  ["consistent hashing", () => new ConsistentHashStrategy(150)],
];

for (const [name, makeStrategy] of strategies) {
  describe(`correctness (${name})`, () => {
    it("get returns the value stored by put", () => {
      const keys = randomKeys(500);
      const store = filled(makeStrategy(), keys);

      keys.forEach((key, i) => expect(store.get(key)).toBe(i));
      expect(store.get("missing-key")).toBeUndefined();
      expect(store.size).toBe(500);
    });

    it("put overwrites the value and delete removes it", () => {
      const store = new ShardedStore<string>(makeStrategy(), SHARDS);
      store.put("k", "v1");
      store.put("k", "v2");

      expect(store.get("k")).toBe("v2");
      expect(store.size).toBe(1);

      expect(store.delete("k")).toBe(true);
      expect(store.get("k")).toBeUndefined();
    });

    it("keeps all data after adding and removing a shard", () => {
      const keys = randomKeys(1000);
      const store = filled(makeStrategy(), keys);

      store.addShard("shard-5");
      store.removeShard("shard-1");

      keys.forEach((key, i) => expect(store.get(key)).toBe(i));
      expect(store.size).toBe(1000);
      expect(store.shardIds).toEqual(["shard-2", "shard-3", "shard-4", "shard-5"]);
    });
  });
}

describe("distribution uniformity (10 000 random keys, 4 shards)", () => {
  const keys = randomKeys(10_000);

  it("mod N: chi-square test does not reject uniformity (p = 0.001)", () => {
    const counts = Object.values(filled(new ModNStrategy(), keys).distribution());
    // критичне значення χ² для df = 3 та p = 0.001
    expect(chiSquare(counts)).toBeLessThan(16.27);
  });

  it("consistent hashing: every shard is within 25% of the ideal share", () => {
    const counts = Object.values(
      filled(new ConsistentHashStrategy(200), keys).distribution(),
    );
    const ideal = keys.length / SHARDS.length;
    const maxDeviation = Math.max(...counts.map((c) => Math.abs(c - ideal) / ideal));

    expect(maxDeviation).toBeLessThan(0.25);
  });

  it("consistent hashing: more virtual nodes give a more even distribution", () => {
    const cv = (virtualNodes: number) =>
      variation(
        Object.values(
          filled(new ConsistentHashStrategy(virtualNodes), keys).distribution(),
        ),
      );

    expect(cv(200)).toBeLessThan(cv(1));
  });
});

describe("stability when the number of shards changes", () => {
  const keys = randomKeys(10_000);

  it("consistent hashing: adding a shard moves ~1/N keys, only onto the new shard", () => {
    const store = filled(new ConsistentHashStrategy(200), keys);
    const before = new Map(keys.map((k) => [k, store.locate(k)]));

    const { moved, total } = store.addShard("shard-5");

    const changed = keys.filter((k) => store.locate(k) !== before.get(k));
    expect(total).toBe(keys.length);
    expect(moved).toBe(changed.length);
    expect(moved / total).toBeGreaterThan(0.05);
    expect(moved / total).toBeLessThan(0.35); // очікувано ≈ 1/5 = 20%
    expect(changed.every((k) => store.locate(k) === "shard-5")).toBe(true);
  });

  it("consistent hashing: removing a shard moves only its own keys", () => {
    const store = filled(new ConsistentHashStrategy(200), keys);
    const before = new Map(keys.map((k) => [k, store.locate(k)]));
    const ownedByRemoved = keys.filter((k) => before.get(k) === "shard-2");

    const { moved, total } = store.removeShard("shard-2");

    expect(moved).toBe(ownedByRemoved.length);
    expect(moved / total).toBeLessThan(0.4); // очікувано ≈ 1/4 = 25%
    const unaffected = keys.filter((k) => before.get(k) !== "shard-2");
    expect(unaffected.every((k) => store.locate(k) === before.get(k))).toBe(true);
  });

  it("mod N remaps most keys, far more than consistent hashing", () => {
    const modN = filled(new ModNStrategy(), keys).addShard("shard-5");
    const ring = filled(new ConsistentHashStrategy(200), keys).addShard("shard-5");

    const modNShare = modN.moved / modN.total; // очікувано ≈ 4/5 = 80%
    const ringShare = ring.moved / ring.total;

    expect(modNShare).toBeGreaterThan(0.6);
    expect(ringShare).toBeLessThan(modNShare / 2);
  });
});

describe("ShardedStore", () => {
  it("rejects invalid shard operations", () => {
    const store = new ShardedStore<number>(new ConsistentHashStrategy(), ["a"]);

    expect(() => store.addShard("a")).toThrow("already exists");
    expect(() => store.removeShard("zzz")).toThrow("does not exist");
    expect(() => store.removeShard("a")).toThrow("last shard");
    expect(() => new ShardedStore<number>(new ModNStrategy()).put("k", 1)).toThrow(
      "No shards",
    );
  });

  it("visualize() lists every shard with its key count", () => {
    const store = filled(new ConsistentHashStrategy(), randomKeys(1000));
    const output = store.visualize();

    for (const [id, count] of Object.entries(store.distribution())) {
      expect(output).toContain(id);
      expect(output).toContain(String(count));
    }
    expect(output).toContain("Keys: 1000");
  });
});