import axios from 'axios';
import cheerio from "cheerio";
import path from "path";
import { promises as fs } from "fs";
import db from "./db.js";

class ChipDipParser {
    constructor() {
        this.baseUrl = "https://www.chipdip.ru";
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119.0.0.0 Safari/537.36";

        // Подписываемся на события устаревания кэша
        db.on('search_stale', async ({ query, age }) => {
            console.log(`🔄 Обновление поискового запроса в фоне: ${query} (возраст: ${age}с)`);
            try {
                const results = await this.fetchSearchResults(query);
                await db.cacheSearchResults(query, results, true);
                await db.resetUpdatingFlag('search', query);
            } catch (error) {
                console.error('❌ Ошибка фонового обновления поиска:', error);
                await db.resetUpdatingFlag('search', query);
            }
        });

        db.on('product_stale', async ({ url, age }) => {
            console.log(`🔄 Обновление карточки товара в фоне: ${url} (возраст: ${age}с)`);
            try {
                const product = await this.fetchProduct(url);
                await db.cacheProduct(url, product, true);
                await db.resetUpdatingFlag('product', url);
            } catch (error) {
                console.error('❌ Ошибка фонового обновления товара:', error);
                await db.resetUpdatingFlag('product', url);
            }
        });
    }

    // Преобразование цены в числовой формат
    parsePrice(priceStr) {
        if (!priceStr) return null;
        const matches = priceStr.match(/[\d.,]+/);
        if (!matches) return null;
        return parseFloat(matches[0].replace(",", "."));
    }

    // Получение категорий товара
    parseCategories($) {
        const categories = [];
        $(".breadcrumbs a").each((_, el) => {
            const category = $(el).text().trim();
            if (category && category !== "Главная") {
                categories.push(category);
            }
        });
        return categories;
    }

    // Получение рейтинга товара
    parseRating($) {
        const ratingText = $(".product__rating .rating__value").text().trim();
        const ratingMatch = ratingText.match(/[\d.]+/);
        return ratingMatch ? parseFloat(ratingMatch[0]) : null;
    }

    // Получение количества отзывов
    parseReviewCount($) {
        const reviewText = $(".product__rating .rating__count").text().trim();
        const reviewMatch = reviewText.match(/\d+/);
        return reviewMatch ? parseInt(reviewMatch[0]) : 0;
    }

    // Расчет релевантности товара для поискового запроса
    calculateRelevance(product, searchTerms) {
        let score = 0;
        const text = [
            product.name,
            product.manufacturer,
            product.code
        ].join(' ').toLowerCase();

        // Проверяем точное совпадение с артикулом
        if (product.code && searchTerms.some(term => product.code.toLowerCase() === term)) {
            score += 1000; // Высокий приоритет для точного совпадения артикула
        }

        // Проверяем частичное совпадение с артикулом
        if (product.code && searchTerms.some(term => product.code.toLowerCase().includes(term))) {
            score += 500;
        }

        // Проверяем совпадение с названием и производителем
        searchTerms.forEach(term => {
            // Точное совпадение слова
            const wordMatch = new RegExp(`\\b${term}\\b`, 'i');
            if (text.match(wordMatch)) {
                score += 100;
            }
            
            // Частичное совпадение
            if (text.includes(term)) {
                score += 50;
            }
        });

        // Бонус за короткое название (предполагаем, что оно более релевантно)
        score += Math.max(0, 100 - product.name.length);

        // Бонус за наличие цены
        if (product.price && product.price.value) {
            score += 10;
        }

        // Бонус за наличие товара
        if (product.stock && !product.stock.toLowerCase().includes('нет')) {
            score += 20;
        }

        return score;
    }

    // Поиск товаров
    async search(query) {
        try {
            console.log(`🔍 Поиск: ${query}`);
            
            // Проверяем кэш
            const cached = await db.getSearchResults(query, { maxAge: 3600, allowStale: true });
            if (cached) {
                console.log(`📦 Найдено в кэше ${cached.results.length} товаров (возраст: ${cached.age}с)`);
                if (cached.isStale) {
                    console.log('⚠️ Данные устарели, будут обновлены в фоне');
                }
                return cached.results;
            }
            
            // Если нет в кэше или устарел, делаем запрос
            const results = await this.fetchSearchResults(query);
            
            // Сохраняем в кэш
            if (results.length > 0) {
                await db.cacheSearchResults(query, results);
                console.log(`💾 Результаты сохранены в кэш`);
            }
            
            return results;
            
        } catch (error) {
            console.error("❌ Ошибка поиска:", error.message);
            if (error.response) {
                console.error("Статус ответа:", error.response.status);
                console.error("Данные ответа:", error.response.data);
            }
            return [];
        }
    }

    // Получение товара
    async getProduct(url) {
        try {
            console.log(`📦 Получение товара: ${url}`);
            
            // Проверяем кэш
            const cached = await db.getProduct(url, { maxAge: 3600, allowStale: true });
            if (cached) {
                console.log(`📦 Товар найден в кэше (возраст: ${cached.age}с)`);
                if (cached.isStale) {
                    console.log('⚠️ Данные устарели, будут обновлены в фоне');
                }
                return cached.data;
            }
            
            // Если нет в кэше или устарел, делаем запрос
            const product = await this.fetchProduct(url);
            
            // Сохраняем в кэш
            try {
                await db.cacheProduct(url, product);
                console.log(`💾 Товар сохранен в кэш: ${product.name}`);
            } catch (error) {
                console.error('❌ Ошибка при сохранении товара в кэш:', error);
            }
            
            return product;
            
        } catch (error) {
            console.error("❌ Ошибка получения товара:", error.message);
            if (error.response) {
                console.error("Статус ответа:", error.response.status);
                console.error("Данные ответа:", error.response.data);
            }
            return null;
        }
    }

    // Запрос результатов поиска
    async fetchSearchResults(query) {
        const searchUrl = `${this.baseUrl}/search?searchtext=${encodeURIComponent(query)}`;
        console.log(`🌐 URL поиска: ${searchUrl}`);
        
        // Используем внешний прокси
        const response = await axios.get(`http://localhost:8002/proxy/search?q=${encodeURIComponent(query)}`, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log(`✅ Получен ответ от прокси`);
        
        // Прокси возвращает уже готовый JSON с товарами
        const products = response.data;
        console.log(`✅ Найдено товаров: ${products.length}`);
        
        // Сортируем результаты по релевантности
        if (products.length > 0) {
            const searchTerms = query.toLowerCase().split(/\s+/);
            
            products.sort((a, b) => {
                const aScore = this.calculateRelevance(a, searchTerms);
                const bScore = this.calculateRelevance(b, searchTerms);
                return bScore - aScore;
            });
        }
        
        return products;
    }

    // Запрос карточки товара
    async fetchProduct(url) {
        // Используем внешний прокси
        const response = await axios.get(`http://localhost:8002/proxy/product?url=${encodeURIComponent(url)}`, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log(`✅ Получен ответ от прокси`);
        
        // Прокси возвращает уже готовый JSON с данными товара
        const product = response.data;
        console.log("✨ Получен товар:", product.name);
        console.log("🔍 Тип данных:", typeof product);
        
        // Убеждаемся, что все поля корректно сериализуются
        if (typeof product === 'object' && product !== null) {
            try {
                const cleanProduct = JSON.parse(JSON.stringify(product));
                console.log("✅ Товар успешно очищен");
                return cleanProduct;
            } catch (error) {
                console.error("❌ Ошибка при очистке товара:", error);
                return product;
            }
        }
        
        return product;
    }
}

export default new ChipDipParser();