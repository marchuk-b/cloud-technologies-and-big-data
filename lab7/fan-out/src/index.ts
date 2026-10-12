export { type FanOutHandle } from "./fan-out";
import { fanOut } from "./fan-out";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const queue = fanOut<number, number>(async (task) => {
    await sleep(80);
    return task * 2;
  }, 3);

  for (const value of [1, 2, 3, 4, 5, 6]) {
    queue.submit(value);
  }

  await queue.close(); // signal: no more tasks

  const results: number[] = [];
  for await (const value of queue.results()) {
    results.push(value);
  }

  console.log("fanOut results:", results);
}

main().catch((error) => {
  console.error("fanOut demo failed:", error);
});