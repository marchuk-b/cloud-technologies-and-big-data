import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Future, TimeoutError } from "../src/future";

/** Future, який виконається з `value` через `ms` мс (віртуального часу). */
const delayed = <T>(value: T, ms: number) =>
  Future.submit(
    () => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms)),
  );

/** Future, який відхилиться з `error` через `ms` мс. */
const delayedFail = (error: Error, ms: number) =>
  Future.submit(
    () =>
      new Promise<never>((_, reject) => setTimeout(() => reject(error), ms)),
  );

describe("Future", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("successful execution", () => {
    it("returns the value of a sync function (also via await)", async () => {
      const future = Future.submit(() => 42);
      expect(await future.get()).toBe(42);
      expect(await Future.submit(() => "awaited")).toBe("awaited");
    });

    it("moves from pending to fulfilled", async () => {
      const future = delayed("done", 100);
      expect(future.state).toBe("pending");

      await vi.advanceTimersByTimeAsync(100);

      expect(await future.get()).toBe("done");
      expect(future.state).toBe("fulfilled");
    });

    it("then() transforms the value and can be chained", async () => {
      const result = Future.submit(() => 2)
        .then((x) => x * 10)
        .then((x) => `value=${x}`);
      expect(await result.get()).toBe("value=20");
    });

    it("deferred(): can be completed from outside", async () => {
      const { future, resolve } = Future.deferred<string>();
      expect(future.isPending).toBe(true);

      setTimeout(() => resolve("event happened"), 1500);
      await vi.advanceTimersByTimeAsync(1500);

      expect(await future.get()).toBe("event happened");
    });
  });

  describe("error propagation", () => {
    it("get() rejects with the error thrown by a sync function", async () => {
      const future = Future.submit(() => {
        throw new Error("boom");
      });
      await expect(future.get()).rejects.toThrow("boom");
      expect(future.state).toBe("rejected");
    });

    it("rejects when an async function rejects", async () => {
      const future = delayedFail(new Error("async boom"), 50);
      const assertion = expect(future.get()).rejects.toThrow("async boom");
      await vi.advanceTimersByTimeAsync(50);
      await assertion;
    });

    it("error propagates through then() chain", async () => {
      const onFulfilled = vi.fn();
      const chained = Future.submit(() => {
        throw new Error("boom");
      }).then(onFulfilled);

      await expect(chained.get()).rejects.toThrow("boom");
      expect(onFulfilled).not.toHaveBeenCalled();
    });

    it("catch() and onError() receive the error and can recover", async () => {
      const failing = () =>
        Future.submit<string>(() => {
          throw new Error("boom");
        });

      const viaCatch = failing().catch((e) => (e as Error).message);
      const viaOnError = failing().onError(() => "fallback");

      expect(await viaCatch.get()).toBe("boom");
      expect(await viaOnError.get()).toBe("fallback");
    });
  });

  it("settles only once", async () => {
    const { future, resolve, reject } = Future.deferred<number>();
    resolve(1);
    resolve(2);
    reject(new Error("late"));

    expect(await future.get()).toBe(1);
    expect(future.state).toBe("fulfilled");
  });

  describe("Future.all", () => {
    it("waits for all futures and keeps the input order", async () => {
      const all = Future.all([
        delayed("slow", 300),
        delayed(2, 100),
        delayed(true, 200),
      ]);

      await vi.advanceTimersByTimeAsync(200);
      expect(all.isPending).toBe(true); // найповільніший ще не готовий

      await vi.advanceTimersByTimeAsync(100);
      expect(await all.get()).toEqual(["slow", 2, true]);
    });

    it("rejects as soon as one future rejects", async () => {
      const all = Future.all([
        delayed("ok", 500),
        delayedFail(new Error("one failed"), 100),
      ]);
      const assertion = expect(all.get()).rejects.toThrow("one failed");

      await vi.advanceTimersByTimeAsync(100);
      await assertion;
    });
  });

  describe("Future.race", () => {
    it("returns the first completed value", async () => {
      const race = Future.race([
        delayed("slow", 300),
        delayed("fast", 100),
        delayed("medium", 200),
      ]);

      await vi.advanceTimersByTimeAsync(100);
      expect(await race.get()).toBe("fast");
    });

    it("rejects if the first completed future rejects", async () => {
      const race = Future.race([
        delayed("slow", 300),
        delayedFail(new Error("fast failure"), 50),
      ]);
      const assertion = expect(race.get()).rejects.toThrow("fast failure");

      await vi.advanceTimersByTimeAsync(50);
      await assertion;
    });
  });

  describe("get(timeout)", () => {
    it("rejects with TimeoutError when the future is too slow", async () => {
      const future = delayed("late", 1000);
      const assertion = expect(future.get(200)).rejects.toMatchObject({
        name: "TimeoutError",
        timeoutMs: 200,
      });

      await vi.advanceTimersByTimeAsync(200);
      await assertion;
    });

    it("returns the value when the future completes in time", async () => {
      const future = delayed("in time", 100);
      const result = future.get(500);

      await vi.advanceTimersByTimeAsync(100);
      expect(await result).toBe("in time");
    });

    it("clears the timer after the future completes", async () => {
      await Future.submit(() => "ok").get(1000);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("timeout does not cancel the future", async () => {
      const future = delayed("eventually", 1000);
      const assertion = expect(future.get(100)).rejects.toBeInstanceOf(
        TimeoutError,
      );

      await vi.advanceTimersByTimeAsync(100);
      await assertion;
      expect(future.isPending).toBe(true);

      await vi.advanceTimersByTimeAsync(900);
      expect(await future.get()).toBe("eventually");
    });
  });
});