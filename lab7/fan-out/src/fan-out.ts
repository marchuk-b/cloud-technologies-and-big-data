const END = Symbol("fan-out-end");

export type FanOutTask<T, R> = (task: T) => R | Promise<R>;

export interface FanOutHandle<T, R> {
  submit(task: T): void;
  results(): AsyncGenerator<R, void, undefined>;
  close(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Fan-out (demultiplexer): one queue is processed by N worker coroutines.
 *
 * Usage:
 *   const queue = fanOut(async (task) => task * 2, 3);
 *   queue.submit(1);
 *   queue.submit(2);
 *   await queue.close();
 *   for await (const result of queue.results()) {
 *     console.log(result);
 *   }
 */
export function fanOut<T, R>(
  process: FanOutTask<T, R>,
  workers = 1,
): FanOutHandle<T, R> {
  if (!Number.isInteger(workers) || workers < 1) {
    throw new RangeError("workers must be a positive integer");
  }

  const queue: T[] = [];
  const bufferedResults: R[] = [];
  const waitingForTask: Array<() => void> = [];
  const waitingForResult: Array<
    (result: IteratorResult<R, void>) => void
  > = [];

  let closed = false;
  let finished = false;
  let activeWorkers = 0;

  const enqueueResult = (result: R) => {
    const waiter = waitingForResult.shift();
    if (waiter) {
      waiter({ done: false, value: result });
    } else {
      bufferedResults.push(result);
    }
  };

  const nextTask = async (): Promise<T | typeof END> => {
    while (queue.length === 0 && !closed) {
      await new Promise<void>((resolve) => {
        waitingForTask.push(resolve);
      });
    }

    if (queue.length > 0) {
      return queue.shift()!;
    }

    return END;
  };

  const worker = async () => {
    try {
      while (true) {
        const task = await nextTask();
        if (task === END) {
          return;
        }

        const result = await process(task);
        enqueueResult(result);
      }
    } finally {
      activeWorkers -= 1;

      if (activeWorkers === 0) {
        finished = true;
        for (const waiter of waitingForResult.splice(0)) {
          waiter({ done: true, value: undefined as never });
        }
      }
    }
  };

  const workerPromises = Array.from({ length: workers }, () => {
    activeWorkers += 1;
    return worker();
  });

  const submit = (task: T) => {
    if (closed) {
      throw new Error("fanOut is closed: no more tasks can be submitted");
    }

    queue.push(task);
    waitingForTask.shift()?.();
  };

  const results = async function* (): AsyncGenerator<R, void, undefined> {
    while (true) {
      if (bufferedResults.length > 0) {
        yield bufferedResults.shift()!;
        continue;
      }

      if (finished) {
        return;
      }

      const next = await new Promise<IteratorResult<R, void>>((resolve) => {
        waitingForResult.push(resolve);
      });

      if (next.done) {
        return;
      }

      yield next.value;
    }
  };

  const close = async () => {
    if (closed) {
      return;
    }

    closed = true;
    while (waitingForTask.length > 0) {
      waitingForTask.shift()?.();
    }

    await Promise.allSettled(workerPromises);
  };

  return {
    submit,
    results,
    close,
    shutdown: close,
  };
}