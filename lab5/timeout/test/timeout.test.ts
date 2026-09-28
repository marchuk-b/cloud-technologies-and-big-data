import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Timeouter } from "../src/timeouter.ts";

describe("Timeouter", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns result when operation completes before timeout", async () => {
        const timeouter = new Timeouter({
            timeoutMs: 1000
        });

        const fn = vi.fn(async () => {
            return "success";
        });

        const promise = timeouter.withTimeout(fn);

        await expect(promise).resolves.toBe("success");

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("throws timeout error when operation exceeds timeout", async () => {
        const timeouter = new Timeouter({
            timeoutMs: 1000
        });

        const fn = vi.fn(
            () =>
                new Promise<string>(resolve => {
                    setTimeout(() => {
                        resolve("success");
                    }, 2000);
                })
        );

        const promise = timeouter.withTimeout(fn);

        vi.advanceTimersByTime(1000);

        await expect(promise).rejects.toThrow(
            "Operation timed out"
        );

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("returns operation result if it completes exactly before timeout", async () => {
        const timeouter = new Timeouter({
            timeoutMs: 1000
        });

        const fn = vi.fn(
            () =>
                new Promise<string>(resolve => {
                    setTimeout(() => {
                        resolve("success");
                    }, 500);
                })
        );

        const promise = timeouter.withTimeout(fn);

        vi.advanceTimersByTime(500);

        await expect(promise).resolves.toBe("success");
    });

    it("propagates original error from operation", async () => {
        const timeouter = new Timeouter({
            timeoutMs: 1000
        });

        const error = new Error("Something went wrong");

        const fn = vi.fn(async () => {
            throw error;
        });

        const promise = timeouter.withTimeout(fn);

        await expect(promise).rejects.toBe(error);
    });

    it("does not timeout when operation finishes before timeout", async () => {
        const timeouter = new Timeouter({
            timeoutMs: 5000
        });

        const fn = vi.fn(
            () =>
                new Promise<string>(resolve => {
                    setTimeout(() => {
                        resolve("done");
                    }, 1000);
                })
        );

        const promise = timeouter.withTimeout(fn);

        vi.advanceTimersByTime(1000);

        await expect(promise).resolves.toBe("done");
    });


    it("clears timeout when operation finishes", async () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

        const timeouter = new Timeouter({
            timeoutMs: 1000
        });

        const fn = vi.fn(async () => {
            return "success";
        });

        const promise = timeouter.withTimeout(fn);

        await expect(promise).resolves.toBe("success");

        expect(clearTimeoutSpy).toHaveBeenCalled();

        clearTimeoutSpy.mockRestore();
    });
});