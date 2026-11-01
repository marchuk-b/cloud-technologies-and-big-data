export type FutureState = "pending" | "fulfilled" | "rejected";

type Unwrap<F> = F extends Future<infer U> ? U : never;

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Future did not complete within ${timeoutMs} ms`);
    this.name = "TimeoutError";
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Результат, який стане доступним пізніше.
 *
 * - Створюється через `Future.submit(fn)` або `Future.deferred()`.
 * - Стан встановлюється лише один раз: pending -> fulfilled | rejected.
 * - Клієнт бачить лише read-only API (`then`, `catch`/`onError`, `get`),
 *   а завершити Future може тільки той, хто його створив.
 * - Реалізує `PromiseLike<T>`, тому працює з `await`.
 */
export class Future<T> implements PromiseLike<T> {
  private readonly promise: Promise<T>;
  // Навмисно без T у типі: інакше Future<string> не можна присвоїти Future<unknown>
  private resolvePromise!: (value: unknown) => void;
  private rejectPromise!: (reason: unknown) => void;

  private _state: FutureState = "pending";
  private locked = false; // true, щойно Future почали завершувати

  private constructor() {
    this.promise = new Promise<T>((res, rej) => {
      this.resolvePromise = res as (value: unknown) => void;
      this.rejectPromise = rej;
    });
  }

  // ---------- створення ----------

  /** Запускає `fn` асинхронно й повертає Future з її результатом. */
  static submit<T>(fn: () => T | PromiseLike<T>): Future<T> {
    const future = new Future<T>();
    Promise.resolve()
      .then(() => fn())
      .then(
        (value) => future.settleResolved(value),
        (error) => future.settleRejected(error),
      );
    return future;
  }

  /**
   * Для подієвих сценаріїв: Future + функції, якими його завершують.
   * Future залишається read-only для клієнтського коду.
   */
  static deferred<T>(): {
    future: Future<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  } {
    const future = new Future<T>();
    return {
      future,
      resolve: (value) => future.settleResolved(value),
      reject: (reason) => future.settleRejected(reason),
    };
  }

  // ---------- стан ----------

  get state(): FutureState {
    return this._state;
  }
  get isPending(): boolean {
    return this._state === "pending";
  }
  get isFulfilled(): boolean {
    return this._state === "fulfilled";
  }
  get isRejected(): boolean {
    return this._state === "rejected";
  }

  // ---------- споживання ----------

  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Future<R1 | R2> {
    return Future.from(this.promise.then(onFulfilled, onRejected));
  }

  catch<R = never>(
    onRejected: (reason: unknown) => R | PromiseLike<R>,
  ): Future<T | R> {
    return this.then<T, R>(undefined, onRejected);
  }

  /** Псевдонім для `catch`. */
  onError<R = never>(
    onRejected: (reason: unknown) => R | PromiseLike<R>,
  ): Future<T | R> {
    return this.catch(onRejected);
  }

  /**
   * Повертає Promise зі значенням Future.
   * Якщо задано `timeoutMs` і Future не завершився вчасно — відхиляє з
   * `TimeoutError`. Сам Future при цьому не скасовується і лишається pending.
   */
  get(timeoutMs?: number): Promise<T> {
    if (timeoutMs === undefined) return this.promise;
    if (!(timeoutMs >= 0)) {
      return Promise.reject(new RangeError("timeoutMs must be >= 0"));
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new TimeoutError(timeoutMs)),
        timeoutMs,
      );
      this.promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  // ---------- комбінатори ----------

  /** Чекає на всі Future; результат зберігає порядок вхідного масиву. */
  static all<const L extends readonly Future<unknown>[]>(
    futures: L,
  ): Future<{ -readonly [K in keyof L]: Unwrap<L[K]> }> {
    const promises = futures.map((f) => f.promise);
    return Future.from(
      Promise.all(promises) as Promise<{ -readonly [K in keyof L]: Unwrap<L[K]> }>,
    );
  }

  /** Результат (або помилка) першого Future, що завершився. */
  static race<const L extends readonly Future<unknown>[]>(
    futures: L,
  ): Future<Unwrap<L[number]>> {
    const promises = futures.map((f) => f.promise);
    return Future.from(Promise.race(promises) as Promise<Unwrap<L[number]>>);
  }

  // ---------- внутрішнє ----------

  private static from<T>(promise: PromiseLike<T>): Future<T> {
    const future = new Future<T>();
    future.settleResolved(promise);
    return future;
  }

  private settleResolved(value: T | PromiseLike<T>): void {
    if (this.locked) return; // стан встановлюється лише раз
    this.locked = true;

    if (isThenable(value)) {
      (value as PromiseLike<T>).then(
        (v) => this.commit("fulfilled", v),
        (e) => this.commit("rejected", e),
      );
    } else {
      this.commit("fulfilled", value);
    }
  }

  private settleRejected(reason: unknown): void {
    if (this.locked) return;
    this.locked = true;
    this.commit("rejected", reason);
  }

  private commit(state: "fulfilled" | "rejected", payload: unknown): void {
    this._state = state;
    if (state === "fulfilled") this.resolvePromise(payload);
    else this.rejectPromise(payload);
  }
}