type pauseStrategyType =
    | { type: "constant"; delay: number }
    | { type: "exponential"; delay: number }
    | { type: "exponentialJitter"; delay: number };

interface RetrierOptions {
    maxAttempts: number,
    pauseStrategy: pauseStrategyType,
    retryOn: (error: unknown) => boolean
}

export class Retrier {
    constructor(private options: RetrierOptions) {}

    public async execute<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: unknown;

        for (let attempt = 0; attempt < this.options.maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                if (!this.options.retryOn(error)) {
                    throw error;
                }

                if (attempt < this.options.maxAttempts - 1) {
                    const delay = this.getDelay(attempt);

                    await new Promise(resolve =>
                        setTimeout(resolve, delay)
                    );
                }
            }
        }

        throw lastError;
    }

    private getDelay(attempt: number): number {
        const { type, delay } = this.options.pauseStrategy;

        switch (type) {
            case "constant":
                return delay;

            case "exponential":
                return delay * 2 ** attempt;

            case "exponentialJitter":
                return Math.random() * (delay * 2 ** attempt);
        }
    }
}