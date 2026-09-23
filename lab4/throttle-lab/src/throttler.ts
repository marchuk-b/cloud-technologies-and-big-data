interface ThrottlerOptions {
    rate: {
        maxCallsNumber: number;
        delay: number;
    };
    leading: boolean;
    trailing: boolean;
}

export class Throttler {
    constructor(private options: ThrottlerOptions) {}

    public throttle<T extends (...args: any[]) => void>(
        fn: T
    ): (...args: Parameters<T>) => void {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let callsInCurrentPeriod = 0;

        const queue: Array<() => void> = [];

        const processQueue = (): void => {
            callsInCurrentPeriod = 0;

            while (
                queue.length > 0 &&
                callsInCurrentPeriod < this.options.rate.maxCallsNumber
            ) {
                const call = queue.shift();

                if (call) {
                    call();
                    callsInCurrentPeriod++;
                }
            }

            if (queue.length > 0) {
                timeoutId = setTimeout(
                    processQueue,
                    this.options.rate.delay
                );
            } else {
                timeoutId = null;
            }
        };

        return (...args: Parameters<T>): void => {
            const call = (): void => fn(...args);

            if (
                this.options.leading &&
                callsInCurrentPeriod < this.options.rate.maxCallsNumber
            ) {
                call();
                callsInCurrentPeriod++;
            } else if (this.options.trailing) {
                queue.push(call);
            }

            if (
                timeoutId === null &&
                (
                    callsInCurrentPeriod >= this.options.rate.maxCallsNumber ||
                    queue.length > 0
                )
            ) {
                timeoutId = setTimeout(
                    processQueue,
                    this.options.rate.delay
                );
            }
        };
    }
}