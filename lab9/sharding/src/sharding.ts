/**
 * Хеш-функція: FNV-1a + фіналізатор murmur3 (розмішує біти, тому
 * схожі ключі на кшталт "user:1", "user:2" розподіляються рівномірно).
 * Повертає беззнакове 32-бітне число.
 */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Стратегії розподілу ключів
// ---------------------------------------------------------------------------

export interface ShardingStrategy {
  readonly shards: string[];
  addShard(id: string): void;
  removeShard(id: string): void;
  /** Повертає id шарда, відповідального за ключ. */
  getShard(key: string): string;
}

/** Простий `hash(key) mod N`. Змінення N перемаплює майже всі ключі. */
export class ModNStrategy implements ShardingStrategy {
  private ids: string[] = [];

  get shards(): string[] {
    return [...this.ids];
  }

  addShard(id: string): void {
    if (this.ids.includes(id)) throw new Error(`Shard "${id}" already exists`);
    this.ids.push(id);
  }

  removeShard(id: string): void {
    const index = this.ids.indexOf(id);
    if (index === -1) throw new Error(`Shard "${id}" does not exist`);
    this.ids.splice(index, 1);
  }

  getShard(key: string): string {
    const id = this.ids[hash32(key) % this.ids.length];
    if (id === undefined) throw new Error("No shards available");
    return id;
  }
}

interface RingPoint {
  point: number;
  shard: string;
}

/**
 * Consistent hashing (кільце) з віртуальними вузлами.
 * Кожен шард займає `virtualNodes` точок на кільці; ключ належить першій
 * точці за годинниковою стрілкою від його хеша. При додаванні/видаленні шарда
 * перемаплюється лише ~1/N ключів.
 */
export class ConsistentHashStrategy implements ShardingStrategy {
  private ring: RingPoint[] = [];
  private ids = new Set<string>();

  constructor(private readonly virtualNodes = 150) {
    if (!Number.isInteger(virtualNodes) || virtualNodes < 1) {
      throw new RangeError("virtualNodes must be a positive integer");
    }
  }

  get shards(): string[] {
    return [...this.ids];
  }

  addShard(id: string): void {
    if (this.ids.has(id)) throw new Error(`Shard "${id}" already exists`);
    this.ids.add(id);
    for (let i = 0; i < this.virtualNodes; i++) {
      this.ring.push({ point: hash32(`${id}#${i}`), shard: id });
    }
    this.ring.sort(
      (a, b) =>
        a.point - b.point || (a.shard < b.shard ? -1 : a.shard > b.shard ? 1 : 0),
    );
  }

  removeShard(id: string): void {
    if (!this.ids.delete(id)) throw new Error(`Shard "${id}" does not exist`);
    this.ring = this.ring.filter((p) => p.shard !== id);
  }

  getShard(key: string): string {
    if (this.ring.length === 0) throw new Error("No shards available");
    const h = hash32(key);
    const ring = this.ring;

    // бінарний пошук першої точки >= h
    let lo = 0;
    let hi = ring.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (ring[mid]!.point < h) lo = mid + 1; // mid завжди в [0, length)
      else hi = mid;
    }
    return ring[lo % ring.length]!.shard; // кільце замикається
  }
}

// ---------------------------------------------------------------------------
// In-memory сховище з шардами
// ---------------------------------------------------------------------------

export interface RebalanceResult {
  /** Скільки ключів змінили шард. */
  moved: number;
  /** Скільки ключів було перевірено. */
  total: number;
}

export class ShardedStore<V = unknown> {
  private nodes = new Map<string, Map<string, V>>();

  constructor(
    private readonly strategy: ShardingStrategy,
    shardIds: string[] = [],
  ) {
    for (const id of shardIds) {
      this.strategy.addShard(id);
      this.nodes.set(id, new Map());
    }
  }

  // ---------- дані ----------

  put(key: string, value: V): void {
    this.node(this.strategy.getShard(key)).set(key, value);
  }

  get(key: string): V | undefined {
    return this.node(this.strategy.getShard(key)).get(key);
  }

  has(key: string): boolean {
    return this.node(this.strategy.getShard(key)).has(key);
  }

  delete(key: string): boolean {
    return this.node(this.strategy.getShard(key)).delete(key);
  }

  get size(): number {
    let total = 0;
    for (const data of this.nodes.values()) total += data.size;
    return total;
  }

  /** Id шарда, на якому зараз має лежати ключ. */
  locate(key: string): string {
    return this.strategy.getShard(key);
  }

  // ---------- шарди ----------

  get shardIds(): string[] {
    return [...this.nodes.keys()];
  }

  /** Додає шард і переносить на нього ключі, які тепер йому належать. */
  addShard(id: string): RebalanceResult {
    if (this.nodes.has(id)) throw new Error(`Shard "${id}" already exists`);
    this.strategy.addShard(id);
    this.nodes.set(id, new Map());
    return this.rebalance();
  }

  /** Видаляє шард, а його ключі розподіляє між рештою. */
  removeShard(id: string): RebalanceResult {
    if (!this.nodes.has(id)) throw new Error(`Shard "${id}" does not exist`);
    if (this.nodes.size === 1) throw new Error("Cannot remove the last shard");

    this.strategy.removeShard(id);
    const result = this.rebalance(); // вузол ще в Map, тому його ключі переїдуть
    this.nodes.delete(id);
    return result;
  }

  // ---------- розподіл ----------

  /** Кількість ключів на кожному шарді. */
  distribution(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, data] of this.nodes) result[id] = data.size;
    return result;
  }

  /** Текстова гістограма розподілу ключів по шардах (для консолі/логів). */
  visualize(barWidth = 40): string {
    const dist = this.distribution();
    const total = this.size;
    const max = Math.max(1, ...Object.values(dist));
    const nameWidth = Math.max(...Object.keys(dist).map((id) => id.length));

    const lines = Object.entries(dist).map(([id, count]) => {
      const bar = "█".repeat(Math.round((count / max) * barWidth));
      const percent = total ? ((count / total) * 100).toFixed(1) : "0.0";
      return `${id.padEnd(nameWidth)} | ${bar.padEnd(barWidth)} ${count} (${percent}%)`;
    });

    return [`Keys: ${total}, shards: ${this.nodes.size}`, ...lines].join("\n");
  }

  // ---------- внутрішнє ----------

  private node(id: string): Map<string, V> {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Shard "${id}" does not exist`);
    return node;
  }

  /** Переносить ключі, які за поточною стратегією лежать не на своєму шарді. */
  private rebalance(): RebalanceResult {
    const moves: { key: string; value: V; from: string; to: string }[] = [];
    let total = 0;

    for (const [from, data] of this.nodes) {
      for (const [key, value] of data) {
        total++;
        const to = this.strategy.getShard(key);
        if (to !== from) moves.push({ key, value, from, to });
      }
    }

    for (const { key, value, from, to } of moves) {
      this.node(from).delete(key);
      this.node(to).set(key, value);
    }
    return { moved: moves.length, total };
  }
}