import { fanIn } from "./fan-in";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...args: unknown[]) =>
  console.log(`[${String(Date.now() - t0).padStart(4)}ms]`, ...args);

async function* source<T>(name: string, items: T[], delayMs: number): AsyncGenerator<T> {
  try {
    for (const item of items) {
      await sleep(delayMs);
      yield item;
    }
  } finally {
    log(`  (${name} closed)`);
  }
}

async function* failingSource<T>(
  name: string,
  items: T[],
  delayMs: number,
): AsyncGenerator<T> {
  for (const item of items) {
    await sleep(delayMs);
    yield item;
  }
  await sleep(delayMs);
  throw new Error(`${name} failed`);
}

async function* infinite(name: string, delayMs: number): AsyncGenerator<number> {
  try {
    let i = 0;
    while (true) {
      await sleep(delayMs);
      yield i++;
    }
  } finally {
    log(`  (${name} closed)`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  section("1. Merge 3 streams (different speeds)");
  for await (const r of fanIn<string>([
    source("A", ["A1", "A2", "A3"], 100),
    source("B", ["B1", "B2"], 150),
    source("C", ["C1", "C2", "C3", "C4"], 60),
  ])) {
    if (r.ok) log(`from #${r.source}:`, r.value);
  }
  log("output stream completed");

  section("2. Non-blocking: slow stream does not delay the fast one");
  for await (const r of fanIn<string>([
    source("slow", ["slow-1"], 500),
    source("fast", ["fast-1", "fast-2", "fast-3"], 50),
  ])) {
    if (r.ok) log(`from #${r.source}:`, r.value);
  }

  section("3. Error in one input does not block the others");
  for await (const r of fanIn<string, Error>([
    failingSource("A", ["A1", "A2"], 80),
    source("B", ["B1", "B2", "B3", "B4"], 70),
  ])) {
    if (r.ok) log(`from #${r.source}:`, r.value);
    else log(`ERROR from #${r.source}:`, r.error.message);
  }

  section("4. All inputs fail -> output still completes");
  for await (const r of fanIn<number, Error>([
    failingSource("X", [], 20),
    failingSource("Y", [1], 30),
  ])) {
    if (r.ok) log(`from #${r.source}:`, r.value);
    else log(`ERROR from #${r.source}:`, r.error.message);
  }
  log("output stream completed");

  section("5. Empty inputs list / empty streams");
  let n = 0;
  for await (const _ of fanIn<number>([])) n++;
  log("no inputs -> items:", n);
  n = 0;
  for await (const _ of fanIn<number>([source("E1", [], 10), source("E2", [], 10)])) n++;
  log("empty streams -> items:", n);

  section("6. Early break closes the remaining inputs");
  let count = 0;
  for await (const r of fanIn<number>([
    infinite("infinite-1", 40),
    infinite("infinite-2", 55),
  ])) {
    if (r.ok) log(`from #${r.source}:`, r.value);
    if (++count === 6) {
      log("consumer breaks");
      break;
    }
  }
  await sleep(50);

  section("7. Per-stream order check");
  const seen: Record<number, number[]> = { 0: [], 1: [], 2: [] };
  for await (const r of fanIn<number>([
    source("S0", [1, 2, 3, 4, 5], 20),
    source("S1", [1, 2, 3, 4, 5], 33),
    source("S2", [1, 2, 3, 4, 5], 47),
  ])) {
    if (r.ok) seen[r.source]?.push(r.value);
  }
  const ordered = Object.values(seen).every(
    (arr) => arr.length === 5 && arr.every((v, i) => v === i + 1),
  );
  log(seen);
  log(ordered ? "PASS: order preserved per stream" : "FAIL: order broken");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  return;
});