import {
  ConsistentHashStrategy,
  ModNStrategy,
  ShardedStore,
  type ShardingStrategy,
} from "./sharding";

const KEYS = 10_000;
const keys = Array.from({ length: KEYS }, (_, i) => `user:${i}`);
const INITIAL_SHARDS = ["shard-A", "shard-B", "shard-C", "shard-D"];

const section = (title: string) => console.log(`\n=== ${title} ===`);
const percent = (part: number, total: number) =>
  `${((part / total) * 100).toFixed(1)}%`;

function createStore(strategy: ShardingStrategy): ShardedStore<string> {
  const store = new ShardedStore<string>(strategy, INITIAL_SHARDS);
  keys.forEach((key) => store.put(key, `value of ${key}`));
  return store;
}

section("1. put / get");
{
  const store = new ShardedStore<string>(new ConsistentHashStrategy(), INITIAL_SHARDS);
  for (const key of ["user:1", "user:2", "order:77", "session:abc"]) {
    store.put(key, `value of ${key}`);
    console.log(`put ${key.padEnd(12)} -> ${store.locate(key)}`);
  }
  console.log("get user:2       =", store.get("user:2"));
  console.log("get unknown-key  =", store.get("unknown-key"));
}

section("2. Distribution of 10 000 keys: mod N");
const modN = createStore(new ModNStrategy());
console.log(modN.visualize());

section("3. Distribution of 10 000 keys: consistent hashing (150 virtual nodes)");
const ring = createStore(new ConsistentHashStrategy(150));
console.log(ring.visualize());

section("4. Adding a shard (shard-E)");
{
  const a = modN.addShard("shard-E");
  const b = ring.addShard("shard-E");
  console.log(`mod N              moved ${a.moved}/${a.total} keys (${percent(a.moved, a.total)})`);
  console.log(`consistent hashing moved ${b.moved}/${b.total} keys (${percent(b.moved, b.total)})`);
  console.log("\nconsistent hashing after adding:");
  console.log(ring.visualize());
}

section("5. Removing a shard (shard-B)");
{
  const a = modN.removeShard("shard-B");
  const b = ring.removeShard("shard-B");
  console.log(`mod N              moved ${a.moved}/${a.total} keys (${percent(a.moved, a.total)})`);
  console.log(`consistent hashing moved ${b.moved}/${b.total} keys (${percent(b.moved, b.total)})`);
  console.log("\nconsistent hashing after removing:");
  console.log(ring.visualize());
}

section("6. Data is intact after rebalancing");
{
  const lostRing = keys.filter((k) => ring.get(k) !== `value of ${k}`).length;
  const lostModN = keys.filter((k) => modN.get(k) !== `value of ${k}`).length;
  console.log(`consistent hashing: readable ${keys.length - lostRing}/${keys.length}, lost: ${lostRing}`);
  console.log(`mod N:              readable ${keys.length - lostModN}/${keys.length}, lost: ${lostModN}`);
}

section("7. Effect of virtual nodes on balance (4 shards)");
for (const vnodes of [1, 10, 50, 150, 500]) {
  const store = createStore(new ConsistentHashStrategy(vnodes));
  const counts = Object.values(store.distribution());
  const mean = KEYS / counts.length;
  const maxDev = Math.max(...counts.map((c) => Math.abs(c - mean) / mean));
  console.log(
    `virtual nodes = ${String(vnodes).padStart(3)} | max deviation from ideal: ${(maxDev * 100).toFixed(1)}%`,
  );
}
