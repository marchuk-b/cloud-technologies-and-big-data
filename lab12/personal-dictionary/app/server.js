const express = require('express');
const redis = require('redis');
const path = require('path');

const app = express();
const port = 8080;

app.use(express.json());

// Підключення до Redis (ім'я хоста 'redis' з docker-compose)
const client = redis.createClient({ url: 'redis://redis:6379' });
client.connect().catch(console.error);

app.use(express.static(path.join(__dirname, 'public')));

// API для додавання нового слова
app.post('/words', async (req, res) => {
    const { word, definition } = req.body;
    if (!word || !definition) {
        return res.status(400).json({ error: 'Потрібні слово та визначення' });
    }
    // Зберігаємо слово в словник у Redis (використовуємо Hash)
    await client.hSet('my_dictionary', word, definition);
    res.json({ success: true });
});

// API для отримання всіх слів
app.get('/words', async (req, res) => {
    const words = await client.hGetAll('my_dictionary');
    res.json(words);
});

app.listen(port, () => {
    console.log(`App running on http://localhost:${port}`);
});