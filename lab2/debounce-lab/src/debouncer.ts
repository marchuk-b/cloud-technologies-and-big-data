interface DebouncerOptions {
    delay: number;
    leading: boolean;
    trailing: boolean;
}

export class Debouncer {
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    private isInvoked = false;
    private hasPendingCall = false;

    constructor(private options: DebouncerOptions) {}

    public debounce<T extends (...args: any[]) => void>(fn: T): (...args: Parameters<T>) => void {
        return (...args: Parameters<T>) => {
            const callNow = this.options.leading && !this.isInvoked;

            // A call happened after the leading call
            if (this.isInvoked) {
                this.hasPendingCall = true;
            }

            if (callNow) {
                fn(...args);
                this.isInvoked = true;
            }

            if (this.timeoutId !== null) {
                clearTimeout(this.timeoutId);
            }

            this.timeoutId = setTimeout(() => {
                if (
                    this.options.trailing &&
                    (!this.options.leading || this.hasPendingCall)
                ) {
                    fn(...args);
                }

                this.timeoutId = null;
                this.isInvoked = false;
                this.hasPendingCall = false;
            }, this.options.delay);
        };
    }

    public dispose(): void {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
        }

        this.timeoutId = null;
        this.isInvoked = false;
        this.hasPendingCall = false;
    }
}