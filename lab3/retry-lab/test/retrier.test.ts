import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Retrier } from "../src/retrier";

describe("Retry", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns result on first attempt", async () => {
        const retrier = new Retrier({
            maxAttempts: 3,
            pauseStrategy: {
                type: "constant",
                delay: 2000
            },
            retryOn: () => true
        });

        const fn = vi.fn().mockResolvedValue("success");

        const result = await retrier.execute(fn);

        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("succeeds on the third attempt", async () => {
        const retrier = new Retrier({
            maxAttempts: 3,
            pauseStrategy: {
                type: "constant",
                delay: 2000
            },
            retryOn: () => true
        });

        const fn = vi.fn()
            .mockRejectedValueOnce(new Error("temporary"))
            .mockRejectedValueOnce(new Error("temporary"))
            .mockResolvedValue("success");

        const promise = retrier.execute(fn);

        await vi.runAllTimersAsync();

        await expect(promise).resolves.toBe("success");
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("throws after maxAttempts", async () => {
    const error = new Error("failed");

    const retrier = new Retrier({
        maxAttempts: 3,
        pauseStrategy: {
            type: "constant",
            delay: 2000
        },
        retryOn: () => true
    });

    const fn = vi.fn().mockRejectedValue(error);

    const promise = retrier.execute(fn);

    const expectation = expect(promise).rejects.toBe(error);

    await vi.runAllTimersAsync();

    await expectation;

    expect(fn).toHaveBeenCalledTimes(3);
});
    it("does not retry non-retryable errors", async () => {
        const error = new Error("fatal");

        const retrier = new Retrier({
            maxAttempts: 3,
            pauseStrategy: {
                type: "constant",
                delay: 2000
            },
            retryOn: () => false
        });

        const fn = vi.fn().mockRejectedValue(error);

        await expect(retrier.execute(fn)).rejects.toBe(error);

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("uses constant delay between attempts", async () => {
        const retrier = new Retrier({
            maxAttempts: 3,
            pauseStrategy: {
                type: "constant",
                delay: 2000
            },
            retryOn: () => true
        });

        const fn = vi.fn()
            .mockRejectedValueOnce(new Error("temporary"))
            .mockRejectedValueOnce(new Error("temporary"))
            .mockResolvedValue("success");

        const promise = retrier.execute(fn);

        // First attempt happens immediately
        await vi.advanceTimersByTimeAsync(1999);
        expect(fn).toHaveBeenCalledTimes(1);

        // First 2000ms delay passed
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(2);

        // Second 2000ms delay
        await vi.advanceTimersByTimeAsync(2000);

        await expect(promise).resolves.toBe("success");
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("uses exponential delay", async () => {
        const retrier = new Retrier({
            maxAttempts: 3,
            pauseStrategy: {
                type: "exponential",
                delay: 1000
            },
            retryOn: () => true
        });

        const fn = vi.fn()
            .mockRejectedValueOnce(new Error("temporary"))
            .mockRejectedValueOnce(new Error("temporary"))
            .mockResolvedValue("success");

        const promise = retrier.execute(fn);

        // First delay: 1000ms
        await vi.advanceTimersByTimeAsync(999);
        expect(fn).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(2);

        // Second delay: 2000ms
        await vi.advanceTimersByTimeAsync(1999);
        expect(fn).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(1);

        await expect(promise).resolves.toBe("success");
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("uses exponential jitter", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.5);

        const retrier = new Retrier({
            maxAttempts: 3,
            pauseStrategy: {
                type: "exponentialJitter",
                delay: 1000
            },
            retryOn: () => true
        });

        const fn = vi.fn()
            .mockRejectedValueOnce(new Error("temporary"))
            .mockResolvedValue("success");

        const promise = retrier.execute(fn);

        // 1000 * 0.5 = 500ms
        await vi.advanceTimersByTimeAsync(499);
        expect(fn).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);

        await expect(promise).resolves.toBe("success");
        expect(fn).toHaveBeenCalledTimes(2);

        vi.restoreAllMocks();
    });
});