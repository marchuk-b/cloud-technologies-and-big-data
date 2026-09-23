import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Throttler } from "../src/throttler";

describe("Throttler", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("executes no more than maxCallsNumber per interval", () => {
        const fn = vi.fn();

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 3,
                delay: 1000
            },
            leading: true,
            trailing: false
        });

        const throttled = throttler.throttle(fn);

        throttled();
        throttled();
        throttled();
        throttled();
        throttled();

        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("allows new calls after the interval", () => {
        const fn = vi.fn();

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 3,
                delay: 1000
            },
            leading: true,
            trailing: false
        });

        const throttled = throttler.throttle(fn);

        throttled();
        throttled();
        throttled();
        throttled();

        expect(fn).toHaveBeenCalledTimes(3);

        vi.advanceTimersByTime(1000);

        throttled();

        expect(fn).toHaveBeenCalledTimes(4);
    });

    it("drops excess calls when trailing is false", () => {
        const fn = vi.fn();

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 2,
                delay: 1000
            },
            leading: true,
            trailing: false
        });

        const throttled = throttler.throttle(fn);

        throttled("A");
        throttled("B");
        throttled("C");
        throttled("D");

        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenNthCalledWith(1, "A");
        expect(fn).toHaveBeenNthCalledWith(2, "B");
    });

    it("queues excess calls when trailing is true", () => {
        const fn = vi.fn();

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 2,
                delay: 1000
            },
            leading: true,
            trailing: true
        });

        const throttled = throttler.throttle(fn);

        throttled("A");
        throttled("B");
        throttled("C");
        throttled("D");

        expect(fn).toHaveBeenCalledTimes(2);

        vi.advanceTimersByTime(1000);

        expect(fn).toHaveBeenCalledTimes(4);
    });

    it("preserves the order of queued calls", () => {
        const fn = vi.fn();

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 2,
                delay: 1000
            },
            leading: true,
            trailing: true
        });

        const throttled = throttler.throttle(fn);

        throttled("A");
        throttled("B");
        throttled("C");
        throttled("D");
        throttled("E");

        expect(fn).toHaveBeenCalledTimes(2);

        vi.advanceTimersByTime(1000);

        expect(fn).toHaveBeenCalledTimes(4);
        expect(fn).toHaveBeenNthCalledWith(3, "C");
        expect(fn).toHaveBeenNthCalledWith(4, "D");

        vi.advanceTimersByTime(1000);

        expect(fn).toHaveBeenCalledTimes(5);
        expect(fn).toHaveBeenNthCalledWith(5, "E");
    });

    it("processes queued calls in batches according to the rate limit", () => {
        const fn = vi.fn();

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 2,
                delay: 1000
            },
            leading: true,
            trailing: true
        });

        const throttled = throttler.throttle(fn);

        throttled(1);
        throttled(2);
        throttled(3);
        throttled(4);
        throttled(5);
        throttled(6);

        // First batch
        expect(fn).toHaveBeenCalledTimes(2);

        // Second batch
        vi.advanceTimersByTime(1000);

        expect(fn).toHaveBeenCalledTimes(4);

        // Third batch
        vi.advanceTimersByTime(1000);

        expect(fn).toHaveBeenCalledTimes(6);
    });

    it("does not execute calls immediately when leading is false", () => {
        const fn = vi.fn();

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 2,
                delay: 1000
            },
            leading: false,
            trailing: true
        });

        const throttled = throttler.throttle(fn);

        throttled("A");
        throttled("B");

        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);

        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenNthCalledWith(1, "A");
        expect(fn).toHaveBeenNthCalledWith(2, "B");
    });

    it("queues calls when leading is false and trailing is true", () => {
        const fn = vi.fn();

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 2,
                delay: 1000
            },
            leading: false,
            trailing: true
        });

        const throttled = throttler.throttle(fn);

        throttled(1);
        throttled(2);
        throttled(3);
        throttled(4);

        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);

        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenNthCalledWith(1, 1);
        expect(fn).toHaveBeenNthCalledWith(2, 2);

        vi.advanceTimersByTime(1000);

        expect(fn).toHaveBeenCalledTimes(4);
        expect(fn).toHaveBeenNthCalledWith(3, 3);
        expect(fn).toHaveBeenNthCalledWith(4, 4);
    });

    it("drops all calls when leading and trailing are false", () => {
        const fn = vi.fn();

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 3,
                delay: 1000
            },
            leading: false,
            trailing: false
        });

        const throttled = throttler.throttle(fn);

        throttled();
        throttled();
        throttled();
        throttled();
        throttled();

        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);

        expect(fn).not.toHaveBeenCalled();
    });

    it("passes arguments to the original function", () => {
        const fn = vi.fn();

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 2,
                delay: 1000
            },
            leading: true,
            trailing: false
        });

        const throttled = throttler.throttle(fn);

        throttled("hello", 123);

        expect(fn).toHaveBeenCalledWith("hello", 123);
    });

    it("works with a function that returns void", () => {
        const fn = vi.fn(() => {
            console.log("executed");
        });

        const throttler = new Throttler({
            rate: {
                maxCallsNumber: 1,
                delay: 1000
            },
            leading: true,
            trailing: false
        });

        const throttled = throttler.throttle(fn);

        throttled();
        throttled();

        expect(fn).toHaveBeenCalledTimes(1);
    });
});
