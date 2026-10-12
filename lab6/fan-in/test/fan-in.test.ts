import { describe, it, expect } from "vitest";
import { fanIn, type Result } from "../src/fan-in";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function* source<T>(items: T[], delayMs = 0): AsyncGenerator<T> {
  for (const item of items) {
    if (delayMs) await sleep(delayMs);
    yield item;
  }
}

async function* failingSource<T>(
  items: T[],
  error: Error,
  delayMs = 0,
): AsyncGenerator<T> {
  for (const item of items) {
    if (delayMs) await sleep(delayMs);
    yield item;
  }
  if (delayMs) await sleep(delayMs);
  throw error;
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

const values = <T>(rs: Result<T>[]) =>
  rs.filter((r): r is Extract<Result<T>, { ok: true }> => r.ok);

describe("fanIn", () => {
  it("merges two streams and keeps per-stream order", async () => {
    const result = await collect(
      fanIn<string>([source(["a1", "a2", "a3"], 5), source(["b1", "b2", "b3"], 7)]),
    );
    const vals = values(result).map((r) => r.value);

    expect(vals).toHaveLength(6);
    expect(vals.filter((v) => v.startsWith("a"))).toEqual(["a1", "a2", "a3"]);
    expect(vals.filter((v) => v.startsWith("b"))).toEqual(["b1", "b2", "b3"]);
  });

  it("merges three streams and keeps per-stream order", async () => {
    const result = await collect(
      fanIn<number>([
        source([1, 2, 3, 4], 3),
        source([10, 20, 30], 5),
        source([100, 200], 8),
      ]),
    );
    const vals = values(result);

    expect(vals).toHaveLength(9);
    for (const [idx, expected] of [
      [0, [1, 2, 3, 4]],
      [1, [10, 20, 30]],
      [2, [100, 200]],
    ] as const) {
      expect(vals.filter((r) => r.source === idx).map((r) => r.value)).toEqual(
        expected,
      );
    }
  });

  it("is non-blocking: a fast stream is not held up by a slow one", async () => {
    const result = await collect(
      fanIn<string>([source(["slow"], 60), source(["f1", "f2", "f3"], 1)]),
    );
    const vals = values(result).map((r) => r.value);

    // all fast items arrive before the slow one
    expect(vals).toEqual(["f1", "f2", "f3", "slow"]);
  });

  it("completes after all inputs complete", async () => {
    const it = fanIn<number>([source([1], 5), source([2, 3], 5)]);
    const result = await collect(it);
    expect(result).toHaveLength(3);
    expect(await it.next()).toEqual({ done: true, value: undefined });
  });

  it("completes immediately for empty input list", async () => {
    expect(await collect(fanIn<number>([]))).toEqual([]);
  });

  it("completes when all inputs are empty", async () => {
    expect(await collect(fanIn<number>([source([]), source([])]))).toEqual([]);
  });

  it("an error in one input does not block the others", async () => {
    const boom = new Error("boom");
    const result = await collect(
      fanIn<string, Error>([
        failingSource(["a1"], boom, 3),
        source(["b1", "b2", "b3"], 5),
      ]),
    );

    const errors = result.filter((r) => !r.ok);
    expect(errors).toEqual([{ ok: false, error: boom, source: 0 }]);

    const vals = values(result);
    expect(vals.filter((r) => r.source === 0).map((r) => r.value)).toEqual(["a1"]);
    expect(vals.filter((r) => r.source === 1).map((r) => r.value)).toEqual([
      "b1",
      "b2",
      "b3",
    ]);
  });

  it("completes even if every input fails", async () => {
    const result = await collect(
      fanIn<number, Error>([
        failingSource([], new Error("e1")),
        failingSource([], new Error("e2")),
      ]),
    );
    expect(result.every((r) => !r.ok)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("closes active inputs when the consumer stops early", async () => {
    let closed = false;
    async function* infinite() {
      try {
        let i = 0;
        while (true) {
          await sleep(1);
          yield i++;
        }
      } finally {
        closed = true;
      }
    }

    let count = 0;
    for await (const _ of fanIn<number>([infinite(), source([1, 2, 3], 2)])) {
      if (++count === 5) break;
    }
    expect(closed).toBe(true);
  });
});