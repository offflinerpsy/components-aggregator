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

// API v2
app.use('/api/product2', productV2);

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

// API поиска
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }

        console.log(`🔍 Поиск: ${query}`);
        const results = await chipdip.search(query);
        
        res.json({
            success: true,
            query,
            results: results,
            count: results.length
        });
    } catch (error) {
        console.error('❌ Ошибка поиска:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// API товара
app.get('/api/product', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        console.log(`📦 Получение товара: ${url}`);
        const product = await chipdip.getProduct(url);
        
        res.json({
            success: true,
            url,
            data: product
        });
    } catch (error) {
        console.error('❌ Ошибка получения товара:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Главная страница
app.get('/', async (req, res) => {
    try {
        const html = await template.render('index', {
            title: 'Components Aggregator',
            description: 'Агрегатор электронных компонентов'
        });
        res.send(html);
    } catch (error) {
        console.error('❌ Ошибка рендеринга главной страницы:', error);
        res.status(500).send('Internal server error');
    }
});

// Страница поиска
app.get('/search.html', async (req, res) => {
    try {
        const query = req.query.q || '';
        let results = [];
        
        if (query) {
            console.log(`🔍 Поиск: ${query}`);
            results = await chipdip.search(query);
        }

        const html = await template.render('search', {
            title: `Поиск: ${query}`,
            query,
            results
        });
        res.send(html);
    } catch (error) {
        console.error('❌ Ошибка рендеринга страницы поиска:', error);
        res.status(500).send('Internal server error');
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 Главная страница: http://localhost:${PORT}`);
    console.log(`🔍 Поиск: http://localhost:${PORT}/search.html?q=LM317`);
    console.log(`📦 API товара: http://localhost:${PORT}/api/product?url=/product/lm317t`);
    console.log(`📦 API v2: http://localhost:${PORT}/api/product2?url=/product/lm317t`);
});
