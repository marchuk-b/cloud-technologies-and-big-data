# Sharding Lab

Навчальний проєкт для дослідження патерна **Sharding (розподіл даних за шардами)**.

## Мета

- зрозуміти принцип роботи шардінгу;
- розподілити ключі між кількома шардами;
- порівняти простий `mod N` розподіл та `consistent hashing`;
- реалізувати in-memory сховище з автоматичним ребалансом;
- перевірити стабільність при додаванні та видаленні шардів.

## Що таке sharding

Sharding — це техніка розподілу даних між кількома вузлами або частинами системи, щоб зменшити навантаження на один екземпляр і покращити масштабованість.

Це корисно для:

- обробки великих обсягів даних;
- горизонтального масштабування систем;
- зменшення навантаження на окремий сервер або базу даних;
- розподілення ключів між кількома сховищами;
- більш стабільної роботи при зміні кількості вузлів.

## Як працює реалізація

У цьому проєкті шардінг реалізовано у файлі `src/sharding.ts`.

Основні компоненти:

- `hash32(input)` — хеш-функція для перетворення ключа в 32-бітне число;
- `ModNStrategy` — простий розподіл `hash(key) mod N`;
- `ConsistentHashStrategy` — колове хешування з віртуальними вузлами;
- `ShardedStore<V>` — in-memory сховище, що розподіляє дані між шардами.

Інтерфейс:

```typescript
export interface ShardingStrategy {
  readonly shards: string[];
  addShard(id: string): void;
  removeShard(id: string): void;
  getShard(key: string): string;
}

class ShardedStore<V = unknown> {
  constructor(strategy: ShardingStrategy, shardIds?: string[]);
  put(key: string, value: V): void;
  get(key: string): V | undefined;
  has(key: string): boolean;
  delete(key: string): boolean;
  locate(key: string): string;
  addShard(id: string): RebalanceResult;
  removeShard(id: string): RebalanceResult;
  distribution(): Record<string, number>;
  visualize(barWidth?: number): string;
}
```

Функція:

- визначає шард для кожного ключа;
- зберігає дані тільки на відповідному шарді;
- при додаванні або видаленні шарда виконує ребалансування;
- зберігає всі значення після переміщення;
- демонструє розподіл ключів через `distribution()` і `visualize()`.

### Основні сценарії

1. `простий розподіл ключів`  
   `ModNStrategy` використовує `hash(key) % N`, тому зміна кількості шардів змінює майже всі відображення.

2. `стабільний розподіл у системі з масштабуванням`  
   `ConsistentHashStrategy` мінімізує кількість переміщених ключів при зміні кількості шардів.

3. `додавання нового шару`  
   Коли додається новий шард, тільки частина ключів переміщується до нього.

4. `видалення шару`  
   Ключі, які належали видаленому шару, перерозподіляються між іншими вузлами.

5. `дані повинні залишатися цілісними`  
   Після ребалансування всі ключі зберігаються і доступні за тими ж самими `put/get` операціями.

## Приклад

```typescript
import { ConsistentHashStrategy, ShardedStore } from "./src/sharding";

const store = new ShardedStore<string>(new ConsistentHashStrategy(150), [
  "shard-A",
  "shard-B",
  "shard-C",
]);

store.put("user:1", "alice");
store.put("order:42", "processed");

console.log(store.locate("user:1"));
console.log(store.get("user:1"));
console.log(store.visualize());
```

У цьому прикладі ключі розподіляються між шарами, а при зміні кількості шардів обчислюється лише частина переміщених даних.

## Підготовка

1. Завантажте репозиторій та перейдіть у папку проєкту:

```bash
git clone https://github.com/marchuk-b/cloud-technologies-and-big-data.git
cd lab9/sharding
```

2. Встановіть залежності:

```bash
npm install
```

## Запуск demo

Для запуску демонстраційного прикладу використовуйте:

```bash
npm run dev
```

Демонстраційний приклад знаходиться у файлі `src/sharding_demo.ts`.

## Структура проєкту

```text
sharding/
├── src/
│   ├── sharding.ts
│   └── sharding_demo.ts
├── test/
│   └── sharding.test.ts
├── package.json
├── tsconfig.json
├── README.md
└── node_modules/
```

## Тести

Тести перевіряють:

- детермінованість хеш-функції `hash32`;
- коректність `put/get/delete` у `ShardedStore`;
- збалансованість розподілу даних за шардами;
- правильну роботу при додаванні та видаленні шардів;
- стабільність `consistent hashing` порівняно з `mod N`.

Запуск тестів:

```bash
npm run test
```

Перевірка збірки TypeScript:

```bash
npm run build
```
