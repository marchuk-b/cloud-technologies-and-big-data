interface TimeoutOptions {
    timeoutMs: number;
}

export class Timeouter {
    constructor(private options: TimeoutOptions) {}

    public withTimeout<T>(
        fn: () => Promise<T>
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error("Operation timed out"));
            }, this.options.timeoutMs);

            fn()
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }
}