import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import chipdip from './chipdip.js';
import db from './db.js';
import template from './template.js';
import productV2 from './src/server/routes/product_v2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 80;

// Статические файлы
app.use(express.static('public'));

// Дополнительные страницы
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/about', (req, res) => {
    res.send('<h1>О нас</h1><p>Страница в разработке</p><a href="/">← Назад</a>');
});

app.get('/delivery', (req, res) => {
    res.send('<h1>Доставка</h1><p>Страница в разработке</p><a href="/">← Назад</a>');
});

app.get('/contacts', (req, res) => {
    res.send('<h1>Контакты</h1><p>Страница в разработке</p><a href="/">← Назад</a>');
});

// API для поиска
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.status(400).json({
                error: 'Введите минимум 2 символа для поиска',
                query,
                results: [],
                total: 0,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`🔍 Поиск: ${query}`);

        // Проверяем кэш
        const cachedResults = await db.getSearchResults(query, { maxAge: 3600, allowStale: true });
        if (cachedResults) {
            console.log(`📦 Найдено в кэше ${cachedResults.results.length} товаров (возраст: ${cachedResults.age}с)`);
            
            // Если данные устарели, запускаем фоновое обновление
            if (cachedResults.isStale) {
                console.log('⚠️ Данные устарели, обновляем в фоне');
                chipdip.search(query).catch(err => {
                    console.error('❌ Ошибка фонового обновления:', err);
                });
            }
            
            return res.json({
                query,
                results: cachedResults.results,
                total: cachedResults.results.length,
                timestamp: cachedResults.timestamp,
                from_cache: true,
                age: cachedResults.age
            });
        }

        // Если нет в кэше или устарел, делаем запрос
        const results = await chipdip.search(query);
        
        res.json({
            query,
            results,
            total: results.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Ошибка поиска:', error);
        res.status(500).json({
            error: 'Ошибка при поиске товаров',
            details: error.message,
            query: req.query.q,
            results: [],
            total: 0,
            timestamp: new Date().toISOString()
        });
    }
});

// API для получения товара
app.get('/api/product', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'Не указан URL товара' });
        }

        if (!url.startsWith('https://www.chipdip.ru/')) {
            return res.status(400).json({ error: 'Недопустимый URL' });
        }

        console.log(`📦 Получение товара: ${url}`);

        // Проверяем кэш
        const cachedProduct = await db.getProduct(url, { maxAge: 3600, allowStale: true });
        if (cachedProduct) {
            console.log(`📦 Товар найден в кэше (возраст: ${cachedProduct.age}с)`);
            
            // Если данные устарели, запускаем фоновое обновление
            if (cachedProduct.isStale) {
                console.log('⚠️ Данные устарели, обновляем в фоне');
                chipdip.getProduct(url).catch(err => {
                    console.error('❌ Ошибка фонового обновления:', err);
                });
            }
            
            return res.json({
                data: cachedProduct.data,
                timestamp: cachedProduct.timestamp,
                from_cache: true,
                age: cachedProduct.age
            });
        }

        // Если нет в кэше или устарел, делаем запрос
        const product = await chipdip.getProduct(url);
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        res.json({
            data: product,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Ошибка получения товара:', error);
        res.status(500).json({
            error: 'Ошибка при получении товара',
            details: error.message
        });
    }
});

// Страница товара
app.get('/product', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.redirect('/');
        }

        const product = await chipdip.getProduct(url);
        if (!product) {
            return res.status(404).send('Товар не найден');
        }

        const html = await template.render('product', product);
        res.send(html);

    } catch (error) {
        console.error('❌ Ошибка рендеринга страницы товара:', error);
        res.status(500).send('Ошибка при загрузке страницы товара');
    }
});

// Страница поиска
app.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.redirect('/');
        }

        const results = await chipdip.search(query);
        res.sendFile(path.join(__dirname, 'public', 'search.html'));

    } catch (error) {
        console.error('❌ Ошибка рендеринга страницы поиска:', error);
        res.status(500).send('Ошибка при загрузке страницы поиска');
    }
});

// Очистка устаревшего кэша каждый час
setInterval(async () => {
    try {
        const stats = await db.getCacheStats();
        console.log('📊 Статистика кэша до очистки:', stats);
        
        const deleted = await db.cleanup(3600); // 1 час
        console.log(`🧹 Удалено ${deleted} устаревших записей`);
        
        const newStats = await db.getCacheStats();
        console.log('📊 Статистика кэша после очистки:', newStats);
    } catch (error) {
        console.error('❌ Ошибка очистки кэша:', error);
    }
}, 3600000); // Каждый час

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📡 Доступен по адресу: http://89.104.69.77:${PORT}`);
    console.log(`🌐 Локальный доступ: http://localhost:${PORT}`);
});
