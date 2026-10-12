import { describe, expect, it } from "vitest";
import { fanOut } from "../src/fan-out";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("fanOut", () => {
  it("uses multiple workers to finish slower tasks faster than a single worker", async () => {
    const singleWorker = fanOut<number, number>(async (value) => {
      await sleep(75);
      return value * 2;
    }, 1);

    const multiWorker = fanOut<number, number>(async (value) => {
      await sleep(75);
      return value * 2;
    }, 3);

    for (const value of [1, 2, 3, 4, 5, 6]) {
      singleWorker.submit(value);
      multiWorker.submit(value);
    }

    const singleStart = Date.now();
    await singleWorker.close();
    const singleResults: number[] = [];
    for await (const result of singleWorker.results()) {
      singleResults.push(result);
    }
    const singleTime = Date.now() - singleStart;

    const multiStart = Date.now();
    await multiWorker.close();
    const multiResults: number[] = [];
    for await (const result of multiWorker.results()) {
      multiResults.push(result);
    }
    const multiTime = Date.now() - multiStart;

    expect(singleResults).toHaveLength(6);
    expect(multiResults).toHaveLength(6);
    expect(multiTime).toBeLessThan(singleTime);
  });

  it("does not process the same task more than once", async () => {
    const seen = new Map<number, number>();
    const queue = fanOut<number, number>(async (task) => {
      await sleep(10);
      seen.set(task, (seen.get(task) ?? 0) + 1);
      return task + 1;
    }, 4);

    for (const task of [10, 20, 30, 40, 50, 60]) {
      queue.submit(task);
    }

    const results: number[] = [];
    await queue.close();
    for await (const result of queue.results()) {
      results.push(result);
    }

    expect(results).toHaveLength(6);
    expect([...seen.values()].every((count) => count === 1)).toBe(true);
    expect([...seen.keys()].sort((a, b) => a - b)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("closes gracefully after no more tasks and rejects late submissions", async () => {
    const queue = fanOut<number, number>(async (task) => {
      await sleep(20);
      return task * 2;
    }, 2);

    for (const task of [3, 6, 9]) {
      queue.submit(task);
    }

    await queue.close();
    const results: number[] = [];
    for await (const result of queue.results()) {
      results.push(result);
    }

    expect(results.sort((a, b) => a - b)).toEqual([6, 12, 18]);
    expect(() => queue.submit(42)).toThrow("fanOut is closed");
  });
});
