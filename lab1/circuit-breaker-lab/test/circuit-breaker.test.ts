import { describe, it, expect, vi } from "vitest";
import { CircuitBreaker } from "../src/circuit-breaker";

describe("CircuitBreaker", () => {

    it("should open after 3 consecutive failures", async () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 3,
            halfOpenMaxCalls: 2,
            openStateDuration: 5000,
            timeoutPerCall: 1000,
        });

        const failingFunction = async () => {
            throw new Error("Something went wrong");
        };

        await expect(breaker.call(failingFunction)).rejects.toThrow();
        await expect(breaker.call(failingFunction)).rejects.toThrow();
        await expect(breaker.call(failingFunction)).rejects.toThrow();

        expect(breaker.state()).toBe("OPEN");
    });


    it("should not execute the function while OPEN", async () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 1,
            halfOpenMaxCalls: 2,
            openStateDuration: 5000,
            timeoutPerCall: 1000,
        });

        const failingFunction = async () => {
            throw new Error("Something went wrong");
        };

        // Force the breaker into OPEN
        await expect(breaker.call(failingFunction)).rejects.toThrow();

        expect(breaker.state()).toBe("OPEN");

        // Function we want to check
        const mockFunction = vi.fn();

        await breaker.call(mockFunction);

        expect(mockFunction).not.toHaveBeenCalled();
        expect(breaker.state()).toBe("OPEN");
    });


    it("should transition from OPEN to HALF_OPEN after openStateDuration", async () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 1,
            halfOpenMaxCalls: 2,
            openStateDuration: 50,
            timeoutPerCall: 1000,
        });

        const failingFunction = async () => {
            throw new Error("Something went wrong");
        };

        // Make the breaker OPEN
        await expect(breaker.call(failingFunction)).rejects.toThrow();

        expect(breaker.state()).toBe("OPEN");

        // Wait until openStateDuration expires
        await new Promise(resolve => setTimeout(resolve, 60));

        // This call should move the breaker to HALF_OPEN
        const successfulFunction = async () => {
            return "SUCCESS";
        };

        await breaker.call(successfulFunction);

        // With your current implementation, one successful probe
        // leaves the breaker in HALF_OPEN because halfOpenMaxCalls = 2
        expect(breaker.state()).toBe("HALF_OPEN");
    });

    it("should transition from HALF_OPEN to OPEN after a failed probe", async () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 1,
            halfOpenMaxCalls: 2,
            openStateDuration: 50,
            timeoutPerCall: 1000,
        });

        const failingFunction = async () => {
            throw new Error("Something went wrong");
        };

        // CLOSED → OPEN
        await expect(breaker.call(failingFunction)).rejects.toThrow();

        expect(breaker.state()).toBe("OPEN");

        // Wait until the circuit can enter HALF_OPEN
        await new Promise(resolve => setTimeout(resolve, 60));

        // OPEN → HALF_OPEN → failed probe → OPEN
        await expect(breaker.call(failingFunction)).rejects.toThrow();

        expect(breaker.state()).toBe("OPEN");
    });

    it("should timeout when the function takes longer than timeoutPerCall", async () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 3,
            halfOpenMaxCalls: 2,
            openStateDuration: 5000,
            timeoutPerCall: 50,
        });

        const slowFunction = async () => {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve("SUCCESS");
                }, 100);
            });
        };

        await expect(breaker.call(slowFunction)).rejects.toBe(
            "ERROR. TIME IS OUT"
        );

        expect(breaker.state()).toBe("CLOSED");
    });

    it("should reset consecutive failures after a successful call", async () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 3,
            halfOpenMaxCalls: 2,
            openStateDuration: 5000,
            timeoutPerCall: 1000,
        });

        const failingFunction = async () => {
            throw new Error("Something went wrong");
        };

        const successfulFunction = async () => {
            return "SUCCESS";
        };

        // 2 consecutive failures
        await expect(breaker.call(failingFunction)).rejects.toThrow();
        await expect(breaker.call(failingFunction)).rejects.toThrow();

        expect(breaker.state()).toBe("CLOSED");

        // Successful call should reset the failure counter
        await expect(breaker.call(successfulFunction)).resolves.toBe("SUCCESS");

        // 2 more failures should NOT open the breaker,
        // because the previous success reset the counter
        await expect(breaker.call(failingFunction)).rejects.toThrow();
        await expect(breaker.call(failingFunction)).rejects.toThrow();

        expect(breaker.state()).toBe("CLOSED");
    });

});