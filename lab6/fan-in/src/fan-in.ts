export type Stream<T> = AsyncIterable<T>;

export type Result<T, E = unknown> =
  | { ok: true; value: T; source: number }
  | { ok: false; error: E; source: number };

type Settled<T> =
  | { index: number; kind: "next"; res: IteratorResult<T> }
  | { index: number; kind: "error"; error: unknown };

/**
 * Merges several streams into one.
 *
 * - Non-blocking: whichever input produces an item first is emitted first.
 * - Per-input order is preserved (the next item of an input is requested only
 *   after the previous one has been emitted); order between inputs is not defined.
 * - Errors are wrapped into `Result` (`ok: false`). An input that throws is
 *   considered finished, the other inputs keep going.
 * - The output completes when all inputs have completed (or failed).
 * - If the consumer stops early (break / return / throw), all still-active
 *   inputs are closed via `iterator.return()`.
 */
export async function* fanIn<T, E = unknown>(
  inputs: Stream<T>[],
): AsyncGenerator<Result<T, E>, void, undefined> {
  const iterators = inputs.map((s) => s[Symbol.asyncIterator]());

  const pull = async (index: number): Promise<Settled<T>> => {
    try {
      return { index, kind: "next", res: await iterators[index]!.next() };
    } catch (error) {
      return { index, kind: "error", error };
    }
  };

  const pending = new Map<number, Promise<Settled<T>>>();
  iterators.forEach((_, i) => pending.set(i, pull(i)));

  try {
    while (pending.size > 0) {
      const s = await Promise.race(pending.values());

      // delete + set below moves the input to the end of the Map, so
      // Promise.race doesn't always favour the same fast input (fairness).
      pending.delete(s.index);

      if (s.kind === "error") {
        yield { ok: false, error: s.error as E, source: s.index };
      } else if (!s.res.done) {
        pending.set(s.index, pull(s.index));
        yield { ok: true, value: s.res.value, source: s.index };
      }
      // done === true -> input finished, just stays removed
    }
  } finally {
    // Only reached with pending inputs if the consumer stopped early.
    await Promise.allSettled(
      [...pending.keys()].map((i) => iterators[i]?.return?.()),
    );
  }
}