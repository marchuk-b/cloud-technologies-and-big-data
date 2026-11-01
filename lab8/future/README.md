# Future Lab

Навчальний проєкт для дослідження асинхронної абстракції **Future**.

## Мета

- зрозуміти модель асинхронного значення, яке стане доступним пізніше;
- реалізувати `Future` з read-only API;
- відокремити логіку завершення від логіки читання результату;
- реалізувати таймаути та обробку помилок;
- перевірити коректну роботу станів і комбінаторів `all`/`race`.

## Що таке Future

Future — це об’єкт, який представляє результат асинхронної операції, що буде доступний у майбутньому. Подібно до `Promise`, він дозволяє:

- виконувати асинхронний код;
- відстежувати стан (`pending`, `fulfilled`, `rejected`);
- приєднувати обробники через `then`, `catch`, `onError`;
- контролювати таймаут і завершення.

Такі абстракції часто використовуються в:

- event-driven системах;
- реактивних потоках даних;
- оркестрації асинхронних задач;
- UI / серверних сценаріях із затримками.

## Як працює реалізація

У цьому проєкті реалізовано клас `Future<T>` у файлі `src/future.ts`.

Основні методи:

- `Future.submit(fn)` — запускає функцію асинхронно й повертає `Future` результату;
- `Future.deferred()` — створює `Future` разом із функціями `resolve` та `reject`;
- `then(...)`, `catch(...)`, `onError(...)` — ланцюжковий API;
- `get(timeoutMs?)` — повертає `Promise` з результатом або відхиляє з `TimeoutError`;
- `Future.all([...])` та `Future.race([...])` — комбінатори для кількох `Future`.

Інтерфейс:

```typescript
class Future<T> implements PromiseLike<T> {
  static submit<T>(fn: () => T | PromiseLike<T>): Future<T>;
  static deferred<T>(): {
    future: Future<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Future<R1 | R2>;
  catch<R = never>(onRejected: (reason: unknown) => R | PromiseLike<R>): Future<T | R>;
  onError<R = never>(onRejected: (reason: unknown) => R | PromiseLike<R>): Future<T | R>;
  get(timeoutMs?: number): Promise<T>;
  static all<const L extends readonly Future<unknown>[]>(futures: L): Future<...>;
  static race<const L extends readonly Future<unknown>[]>(futures: L): Future<...>;
}
```

Функція:

- зберігає стан лише один раз: `pending -> fulfilled | rejected`;
- не дозволяє змінити результат після завершення;
- надає read-only API для клієнтського коду;
- підтримує таймаути без скасування самого `Future`;
- забезпечує коректне поширення помилок.

### Основні сценарії

1. `асинхронна функція повертає значення`  
   `Future` переходить зі стану `pending` у `fulfilled`, і клієнт може отримати результат через `await` або `get()`.

2. `асинхронна функція видає помилку`  
   `Future` переходить у стан `rejected`, а `catch()` / `onError()` дозволяють обробити помилку.

3. `Future не повинен завершуватися двічі`  
   Після першого завершення всі наступні спроби `resolve`/`reject` ігноруються.

4. `timeout спрацьовує, якщо результат не надійшов вчасно`  
   `get(timeoutMs)` повертає `TimeoutError`, але сам `Future` залишається в `pending` до реального завершення.

5. `Future.all` і `Future.race` працюють коректно для наборів асинхронних значень`  
   `all` зберігає порядок входів, `race` повертає перше завершене значення.

## Приклад

```typescript
import { Future } from "./src/future";

const future = Future.submit(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return "done";
});

const result = await future.get(500);
console.log(result); // "done"
```

Розширений сценарій із зовнішнім завершенням:

```typescript
const { future, resolve } = Future.deferred<number>();

resolve(42);

console.log(await future.get()); // 42
```

У цьому прикладі показано, як асинхронна операція бере результат пізніше та як об’єкт `Future` контролює її завершення.

## Підготовка

1. Завантажте репозиторій та перейдіть у папку проєкту:

```bash
git clone https://github.com/marchuk-b/cloud-technologies-and-big-data.git
cd lab8/future
```

2. Встановіть залежності:

```bash
npm install
```

## Запуск demo

Для запуску локального демо використовуйте:

```bash
npm run dev
```

Демонстраційний приклад знаходиться у файлі `src/future.ts`.

## Структура проєкту

```text
future/
├── src/
│   └── future.ts
├── test/
│   └── future.test.ts
├── package.json
├── tsconfig.json
├── README.md
└── node_modules/
```

## Тести

Тести перевіряють:

- перехід між станами `pending` -> `fulfilled`/`rejected`;
- правильну роботу `then`, `catch` і `onError`;
- `Future.all` з підтримкою порядку;
- `Future.race` з поверненням першого завершення;
- timeout-обробку через `get(timeoutMs)`;
- ігнорування повторного завершення.

Запуск тестів:

```bash
npm run test
```

Перевірка збірки TypeScript:

```bash
npm run build
```
