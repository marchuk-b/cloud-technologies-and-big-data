import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Debouncer } from "../src/debouncer";

describe("Debounce", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should call fn once after a series of calls", () => {
        const debouncer = new Debouncer({
            delay: 1000,
            leading: false,
            trailing: true
        });

        const fn = vi.fn();
        const debounced = debouncer.debounce(fn);

        debounced("Hello");
        debounced("World");
        debounced("!");

        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("!");
    });

    it("should call immediately with leading=true", () => {
        const debouncer = new Debouncer({
            delay: 1000,
            leading: true,
            trailing: false
        });

        const fn = vi.fn();
        const debounced = debouncer.debounce(fn);

        debounced("Hello");
        debounced("World");
        debounced("!");

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("Hello");
    });

    it("should allow another leading call after the delay", () => {
        const debouncer = new Debouncer({
            delay: 1000,
            leading: true,
            trailing: false
        });

        const fn = vi.fn();
        const debounced = debouncer.debounce(fn);

        debounced("Hello");

        expect(fn).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);

        debounced("World");

        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenLastCalledWith("World");
    });

    it("should call leading immediately and trailing after the delay", () => {
        const debouncer = new Debouncer({
            delay: 1000,
            leading: true,
            trailing: true
        });

        const fn = vi.fn();
        const debounced = debouncer.debounce(fn);

        debounced("Hello");
        debounced("World");
        debounced("!");

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("Hello");

        vi.advanceTimersByTime(1000);

        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenLastCalledWith("!");
    });

    it("should not call fn when leading and trailing are false", () => {
        const debouncer = new Debouncer({
            delay: 1000,
            leading: false,
            trailing: false
        });

        const fn = vi.fn();
        const debounced = debouncer.debounce(fn);

        debounced("Hello");
        debounced("World");

        vi.advanceTimersByTime(1000);

        expect(fn).not.toHaveBeenCalled();
    });

    it("should cancel pending call on dispose", () => {
        const debouncer = new Debouncer({
            delay: 1000,
            leading: false,
            trailing: true
        });

        const fn = vi.fn();
        const debounced = debouncer.debounce(fn);

        debounced("Hello");

        debouncer.dispose();

        vi.advanceTimersByTime(1000);

        expect(fn).not.toHaveBeenCalled();
    });
});