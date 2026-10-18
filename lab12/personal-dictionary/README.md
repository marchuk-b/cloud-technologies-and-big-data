# Docker Compose: healthcheck

Навчальний проєкт для дослідження механізму `healthcheck` у Docker Compose.

## Мета

- зрозуміти, що таке healthcheck у Docker;
- налаштувати перевірку готовності сервісів;
- гарантувати, що `app` запускається лише після готовності Redis;
- перевірити роботу сервісів через `docker compose ps` і `docker compose logs`;
- навчитися контролювати статус контейнерів у складі багатоконтейнерного застосунку.

## Що таке healthcheck

`healthcheck` — це команда або процедура, яку Docker виконує всередині контейнера, щоб перевірити, чи сервіс справно працює. Якщо перевірка повертає помилку, контейнер вважається нездоровим.

У цьому проєкті:
- Redis перевіряється командою `redis-cli ping`;
- веб-сервер перевіряється через HTTP-запит до `http://127.0.0.1:8080/`.

Це дозволяє Docker Compose знати, коли сервіс готовий до використання, і гарантує, що залежний сервіс не стартує занадто рано.

## Як працює реалізація

У файлі `docker-compose.yaml` створені два сервіси:

```yaml
services:
  app:
    build: ./app
    ports:
      - "8080:8080"
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:8080/"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 5s

  redis:
    image: redis:alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s
```

Основні моменти:

- `healthcheck` для Redis перевіряє, чи інстанс Redis готовий приймати команди;
- `healthcheck` для `app` перевіряє доступність HTTP-сервера;
- `depends_on: condition: service_healthy` гарантує запуск `app` тільки після успішної перевірки Redis.

## Підготовка

1. Переконайтеся, що Docker і Docker Compose встановлені та запущені.
2. Перейдіть до папки проєкту:

```bash
cd lab12/personal-dictionary
```

3. Перевірте структуру проєкту:

```bash
ls
```

## Запуск demo

Для запуску застосунку використовується команда:

```bash
docker compose up --build
```

Після запуску сервіс має бути доступний за адресою:

```text
http://localhost:8080
```

## Перевірка роботи

### 1. Перегляд стану сервісів

```bash
docker compose ps
```

Тут треба звернути увагу на статус `healthy` для контейнерів з налаштованим `healthcheck`.

### 2. Перегляд логів

```bash
docker compose logs
```

### 3. Перевірка HTTP-відповіді

```bash
curl http://localhost:8080
```

### 4. Перевірка API для додавання слова

```bash
curl -X POST http://localhost:8080/words \
  -H "Content-Type: application/json" \
  -d '{"word":"Docker","definition":"Platform for containerization"}'
```

### 5. Отримання всіх словників

```bash
curl http://localhost:8080/words
```

## Зупинка та очищення

Щоб зупинити і видалити контейнери:

```bash
docker compose down
```

## Короткий набір команд

```bash
docker compose up --build
docker compose ps
docker compose logs
curl http://localhost:8080
docker compose down
```

## Структура проєкту

```text
personal-dictionary/
├── app/
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── public/
│       └── index.html
├── docker-compose.yaml
└── README.md
```

## Результат

Після запуску проєкту `docker compose ps` показує, що обидва сервіси працюють, а `healthcheck` підтверджує їхню готовність. Це дозволяє уникнути запуску веб-додатку до того, як Redis стане доступним, і забезпечує стабільну роботу багатоконтейнерного застосунку.
