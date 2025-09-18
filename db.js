import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database extends EventEmitter {
    constructor() {
        super();
        this.db = new sqlite3.Database(path.join(__dirname, 'cache.db'), (err) => {
            if (err) {
                console.error('❌ Ошибка при подключении к БД:', err.message);
            } else {
                console.log('✅ Подключено к БД SQLite');
                this.initDatabase();
            }
        });
    }

    initDatabase() {
        const queries = [
            // Таблица для кэширования результатов поиска
            `CREATE TABLE IF NOT EXISTS search_cache (
                query TEXT PRIMARY KEY,
                results TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_updating BOOLEAN DEFAULT 0
            )`,
            
            // Таблица для кэширования карточек товаров
            `CREATE TABLE IF NOT EXISTS product_cache (
                url TEXT PRIMARY KEY,
                data TEXT,
                sku TEXT,
                source TEXT,
                price_history TEXT,
                stock_history TEXT,
                import_ready BOOLEAN DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_updating BOOLEAN DEFAULT 0,
                UNIQUE(sku, source)
            )`,
            
            // Таблица для хранения изображений
            `CREATE TABLE IF NOT EXISTS images (
                url TEXT PRIMARY KEY,
                product_url TEXT,
                type TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(product_url) REFERENCES product_cache(url)
            )`,
            
            // Таблица для хранения документации
            `CREATE TABLE IF NOT EXISTS documents (
                url TEXT PRIMARY KEY,
                product_url TEXT,
                title TEXT,
                size TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(product_url) REFERENCES product_cache(url)
            )`
        ];

        queries.forEach(query => {
            this.db.run(query, err => {
                if (err) {
                    console.error('❌ Ошибка при создании таблицы:', err.message);
                }
            });
        });
    }

    // Сохранение результатов поиска в кэш
    async cacheSearchResults(query, results, isBackground = false) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(
                'INSERT OR REPLACE INTO search_cache (query, results, timestamp, is_updating) VALUES (?, ?, CURRENT_TIMESTAMP, 0)'
            );
            
            stmt.run([query, JSON.stringify(results)], err => {
                if (err) {
                    console.error('❌ Ошибка при сохранении результатов поиска:', err.message);
                    reject(err);
                } else {
                    if (isBackground) {
                        console.log(`🔄 Обновлены результаты поиска в фоне: ${query}`);
                        this.emit('search_updated', { query, results });
                    }
                    resolve();
                }
            });
            
            stmt.finalize();
        });
    }

    // Получение результатов поиска из кэша
    async getSearchResults(query, { maxAge = 3600, allowStale = true } = {}) {
        return new Promise((resolve, reject) => {
            // Сначала пытаемся получить свежие данные
            this.db.get(
                'SELECT results, timestamp, is_updating FROM search_cache WHERE query = ?',
                [query],
                async (err, row) => {
                    if (err) {
                        console.error('❌ Ошибка при получении результатов поиска:', err.message);
                        reject(err);
                        return;
                    }

                    if (!row) {
                        resolve(null);
                        return;
                    }

                    const age = Math.floor((Date.now() - new Date(row.timestamp).getTime()) / 1000);
                    const isStale = age > maxAge;

                    // Если данные свежие или разрешены устаревшие данные
                    if (!isStale || allowStale) {
                        const results = JSON.parse(row.results);
                        
                        // Если данные устарели и не обновляются, запускаем фоновое обновление
                        if (isStale && !row.is_updating) {
                            this.db.run(
                                'UPDATE search_cache SET is_updating = 1 WHERE query = ?',
                                [query]
                            );
                            this.emit('search_stale', { query, age });
                        }

                        resolve({
                            results,
                            isStale,
                            age,
                            timestamp: row.timestamp
                        });
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    // Сохранение карточки товара в кэш
    async cacheProduct(url, data, isBackground = false) {
        return new Promise((resolve, reject) => {
            console.log(`💾 Сохранение товара в кэш: ${url}`);
            console.log(`📦 Данные товара:`, typeof data, data?.name);
            
            const stmt = this.db.prepare(
                'INSERT OR REPLACE INTO product_cache (url, data, sku, source, price_history, stock_history, import_ready, timestamp, is_updating) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0)'
            );
            
            const productData = {
                ...data,
                sku: data.code || null,
                source: data.source || 'chipdip',
                price_history: JSON.stringify([{
                    price: data.price?.value,
                    timestamp: new Date().toISOString()
                }]),
                stock_history: JSON.stringify([{
                    stock: data.stock,
                    timestamp: new Date().toISOString()
                }]),
                import_ready: true
            };

            stmt.run([
                url,
                JSON.stringify(productData),
                productData.sku,
                productData.source,
                productData.price_history,
                productData.stock_history,
                productData.import_ready
            ], async err => {
                if (err) {
                    console.error('❌ Ошибка при сохранении карточки товара:', err.message);
                    reject(err);
                    return;
                }

                try {
                    // Сохраняем изображения
                    if (data.images?.length > 0) {
                        await this.cacheImages(url, data.images);
                    }
                    
                    // Сохраняем документы
                    if (data.docs?.length > 0) {
                        await this.cacheDocs(url, data.docs);
                    }

                    if (isBackground) {
                        console.log(`🔄 Обновлена карточка товара в фоне: ${url}`);
                        this.emit('product_updated', { url, data });
                    }

                    resolve();
                } catch (error) {
                    console.error('❌ Ошибка при сохранении связанных данных:', error);
                    reject(error);
                }
            });
            
            stmt.finalize();
        });
    }

    // Сохранение изображений
    async cacheImages(productUrl, images) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(
                'INSERT OR REPLACE INTO images (url, product_url, type, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
            );
            
            let completed = 0;
            images.forEach(imgUrl => {
                stmt.run([imgUrl, productUrl, 'product'], err => {
                    if (err) {
                        console.error('❌ Ошибка при сохранении изображения:', err.message);
                        reject(err);
                        return;
                    }
                    completed++;
                    if (completed === images.length) {
                        resolve();
                    }
                });
            });
            
            stmt.finalize();
        });
    }

    // Сохранение документов
    async cacheDocs(productUrl, docs) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(
                'INSERT OR REPLACE INTO documents (url, product_url, title, size, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
            );
            
            let completed = 0;
            docs.forEach(doc => {
                stmt.run([doc.url, productUrl, doc.title, doc.size], err => {
                    if (err) {
                        console.error('❌ Ошибка при сохранении документа:', err.message);
                        reject(err);
                        return;
                    }
                    completed++;
                    if (completed === docs.length) {
                        resolve();
                    }
                });
            });
            
            stmt.finalize();
        });
    }

    // Получение карточки товара из кэша
    async getProduct(url, { maxAge = 3600, allowStale = true } = {}) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT data, timestamp, is_updating FROM product_cache WHERE url = ?',
                [url],
                async (err, row) => {
                    if (err) {
                        console.error('❌ Ошибка при получении карточки товара:', err.message);
                        reject(err);
                        return;
                    }

                    if (!row) {
                        resolve(null);
                        return;
                    }

                    const age = Math.floor((Date.now() - new Date(row.timestamp).getTime()) / 1000);
                    const isStale = age > maxAge;

                    // Если данные свежие или разрешены устаревшие данные
                    if (!isStale || allowStale) {
                        const data = JSON.parse(row.data);

                        // Если данные устарели и не обновляются, запускаем фоновое обновление
                        if (isStale && !row.is_updating) {
                            this.db.run(
                                'UPDATE product_cache SET is_updating = 1 WHERE url = ?',
                                [url]
                            );
                            this.emit('product_stale', { url, age });
                        }

                        resolve({
                            data,
                            isStale,
                            age,
                            timestamp: row.timestamp
                        });
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    // Очистка устаревших записей
    async cleanup(maxAge = 86400) { // maxAge в секундах, по умолчанию 24 часа
        return new Promise((resolve, reject) => {
            const queries = [
                'DELETE FROM search_cache WHERE (strftime("%s", "now") - strftime("%s", timestamp)) > ? AND is_updating = 0',
                'DELETE FROM product_cache WHERE (strftime("%s", "now") - strftime("%s", timestamp)) > ? AND is_updating = 0',
                'DELETE FROM images WHERE (strftime("%s", "now") - strftime("%s", timestamp)) > ?',
                'DELETE FROM documents WHERE (strftime("%s", "now") - strftime("%s", timestamp)) > ?'
            ];

            let completed = 0;
            let deletedCount = 0;

            queries.forEach(query => {
                this.db.run(query, [maxAge], function(err) {
                    if (err) {
                        console.error('❌ Ошибка при очистке кэша:', err.message);
                        reject(err);
                    } else {
                        deletedCount += this.changes;
                        completed++;
                        if (completed === queries.length) {
                            console.log(`🧹 Очищено ${deletedCount} устаревших записей`);
                            resolve(deletedCount);
                        }
                    }
                });
            });
        });
    }

    // Сброс флага обновления
    async resetUpdatingFlag(type, key) {
        return new Promise((resolve, reject) => {
            const table = type === 'search' ? 'search_cache' : 'product_cache';
            const keyField = type === 'search' ? 'query' : 'url';

            this.db.run(
                `UPDATE ${table} SET is_updating = 0 WHERE ${keyField} = ?`,
                [key],
                err => {
                    if (err) {
                        console.error(`❌ Ошибка при сбросе флага обновления для ${type}:`, err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // Получение статистики кэша
    async getCacheStats() {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM search_cache) as searches,
                    (SELECT COUNT(*) FROM product_cache) as products,
                    (SELECT COUNT(*) FROM images) as images,
                    (SELECT COUNT(*) FROM documents) as documents,
                    (SELECT COUNT(*) FROM search_cache WHERE is_updating = 1) as updating_searches,
                    (SELECT COUNT(*) FROM product_cache WHERE is_updating = 1) as updating_products,
                    (SELECT AVG(strftime('%s', 'now') - strftime('%s', timestamp)) FROM search_cache) as avg_search_age,
                    (SELECT AVG(strftime('%s', 'now') - strftime('%s', timestamp)) FROM product_cache) as avg_product_age
            `, (err, row) => {
                if (err) {
                    console.error('❌ Ошибка при получении статистики кэша:', err.message);
                    reject(err);
                } else {
                    resolve({
                        counts: {
                            searches: row.searches,
                            products: row.products,
                            images: row.images,
                            documents: row.documents,
                            total: row.searches + row.products + row.images + row.documents
                        },
                        updating: {
                            searches: row.updating_searches,
                            products: row.updating_products
                        },
                        avgAge: {
                            searches: Math.floor(row.avg_search_age || 0),
                            products: Math.floor(row.avg_product_age || 0)
                        }
                    });
                }
            });
        });
    }

    // Закрытие соединения с БД
    close() {
        return new Promise((resolve, reject) => {
            this.db.close(err => {
                if (err) {
                    console.error('❌ Ошибка при закрытии БД:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Соединение с БД закрыто');
                    resolve();
                }
            });
        });
    }
}

export default new Database();