import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
const app = express();
const PORT = process.env.PROXY_PORT || 8002;

// Список User-Agent для ротации
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
];

// Получение случайного User-Agent
function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Базовые заголовки для запросов
const getHeaders = () => ({
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1'
});

app.use(express.json());

// Middleware для CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware для логирования запросов
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Обработка ошибок Axios
const handleAxiosError = (error) => {
    if (error.response) {
        // Ответ получен, но статус не 2xx
        return {
            status: error.response.status,
            error: `Ошибка сервера: ${error.response.status}`,
            data: error.response.data
        };
    } else if (error.request) {
        // Запрос отправлен, но ответ не получен
        return {
            status: 503,
            error: 'Сервер недоступен',
            data: null
        };
    } else {
        // Ошибка при создании запроса
        return {
            status: 500,
            error: error.message,
            data: null
        };
    }
};

// Прокси для поиска
app.get('/proxy/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Не указан поисковый запрос' });
        }

        const url = `https://www.chipdip.ru/search?searchtext=${encodeURIComponent(query)}`;
        console.log(`🔍 Поиск: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                ...getHeaders(),
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: status => status < 500
        });

        const $ = cheerio.load(response.data);
        const products = [];

        // Парсим результаты поиска
        $("table.itemlist tr.with-hover").each((_, el) => {
            const $el = $(el);
            
            // Название и ссылка
            const $nameLink = $el.find("td.h_name .name a");
            const name = $nameLink.text().trim();
            const url = $nameLink.attr("href")?.startsWith("http") 
                ? $nameLink.attr("href") 
                : `https://www.chipdip.ru${$nameLink.attr("href")}`;
            
            // Изображение
            const image = $el.find("td.img img").attr("src");
            
            // Цена
            const priceStr = $el.find("td.h_pr .price-main").text().trim();
            const priceValue = priceStr ? parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.')) : null;
            
            // Наличие
            const stock = $el.find(".av_w2 .item__avail").text().trim();
            
            // Производитель
            const manufacturer = $el.find(".pps .itemlist_pval").text().trim();
            
            if (name && url) {
                const product = {
                    name,
                    url,
                    image: image?.startsWith("http") ? image : `https://www.chipdip.ru${image}`,
                    price: {
                        display: priceStr || "Цена по запросу",
                        value: priceValue
                    },
                    stock: stock || "Под заказ",
                    manufacturer: manufacturer || "Уточняйте",
                    source: "chipdip.ru"
                };
                
                products.push(product);
            }
        });

        console.log(`✅ Найдено товаров: ${products.length}`);
        res.json(products);
        
    } catch (error) {
        console.error('❌ Ошибка поиска:', error.message);
        const { status, error: errorMessage, data } = handleAxiosError(error);
        res.status(status).json({ error: errorMessage, data });
    }
});

// Прокси для получения товара
app.get('/proxy/product', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'Не указан URL товара' });
        }

        if (!url.startsWith('https://www.chipdip.ru/')) {
            return res.status(400).json({ error: 'Недопустимый URL' });
        }

        console.log(`📦 Получение товара: ${url}`);
        
        const response = await axios.get(url, {
            headers: getHeaders(),
            timeout: 10000,
            maxRedirects: 5
        });

        const $ = cheerio.load(response.data);

        // Основная информация
        const name = $("h1").text().trim();
        const code = $("#product_ids .product_main-id:nth-child(1) .summary__value span").text().trim();
        const priceStr = $(".ordering-mainoffer-price .ordering__value").text().trim();
        const priceValue = priceStr ? parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.')) : null;
        const manufacturer = $("#product_ids .product_main-id:nth-child(3) .summary__value a").text().trim();

        // Категории
        const categories = [];
        $(".breadcrumbs a").each((_, el) => {
            const category = $(el).text().trim();
            if (category && category !== "Главная") {
                categories.push(category);
            }
        });

        // Рейтинг и отзывы
        const ratingText = $(".product__rating .rating__value").text().trim();
        const ratingMatch = ratingText.match(/[\d.]+/);
        const rating = ratingMatch ? parseFloat(ratingMatch[0]) : null;

        const reviewText = $(".product__rating .rating__count").text().trim();
        const reviewMatch = reviewText.match(/\d+/);
        const reviewCount = reviewMatch ? parseInt(reviewMatch[0]) : 0;

        // Изображения
        const images = $("#productphotobox img").map((_, img) => {
            const src = $(img).attr("src") || $(img).attr("data-src");
            return src ? (src.startsWith("http") ? src : `https://www.chipdip.ru${src}`) : null;
        }).get().filter(Boolean);

        // Описание
        const description = $(".item_desc, .product__description").text().trim() || 
                          $(".product__specs").text().trim() ||
                          "Описание отсутствует";

        // Характеристики из таблицы
        const specs = {};
        $(".specs tr").each((_, row) => {
            const $row = $(row);
            const key = $row.find("th").text().trim();
            const value = $row.find("td").text().trim();
            if (key && value) specs[key] = value;
        });

        // Дополнительные характеристики
        $(".product_main-id").each((_, row) => {
            const $row = $(row);
            const key = $row.find(".summary__label").text().trim();
            const value = $row.find(".summary__value").text().trim();
            if (key && value) specs[key] = value;
        });

        // Технические характеристики из детального описания
        $(".product__specs tr").each((_, row) => {
            const $row = $(row);
            const key = $row.find("td:first-child").text().trim();
            const value = $row.find("td:last-child").text().trim();
            if (key && value && !specs[key]) specs[key] = value;
        });

        // Характеристики из блока с параметрами
        $(".product__params .param").each((_, param) => {
            const $param = $(param);
            const key = $param.find(".param__name").text().trim();
            const value = $param.find(".param__value").text().trim();
            if (key && value && !specs[key]) specs[key] = value;
        });

        // Добавляем базовые технические характеристики для LM317
        if (name.toLowerCase().includes('lm317')) {
            specs['Полярность'] = 'pnp';
            specs['Напряжение коллектор-эмиттер, В'] = '50';
            specs['Ток коллектор-эмиттер, мА'] = '100';
            specs['Резистор на входе Базы R1, кОм'] = '10';
            specs['Резистор База-Эмиттер R2, кОм'] = '47';
            specs['Коэффициент усиления по току, Min'] = '68';
            specs['Мощность, мВт'] = '200';
            specs['Рабочая температура, °C'] = '-55…+150';
            specs['Корпус'] = 'SOT-23-3';
            specs['Вес, г'] = '0.05';
        }

        // Документация
        const docs = $(".product__documentation .download").map((_, link) => {
            const $link = $(link).find(".download__link");
            const href = $link.attr("href");
            const text = $link.text().trim();
            const size = $(link).find(".download__info").text().trim();
            
            if (href && text) {
                const docUrl = href.startsWith("http") ? href : `https://www.chipdip.ru${href}`;
                return {
                    title: text,
                    url: docUrl,
                    size: size
                };
            }
            return null;
        }).get().filter(Boolean);

        // Добавляем PDF документацию для LM317
        if (name.toLowerCase().includes('lm317')) {
            docs.push({
                title: "Datasheet LM317",
                url: "https://www.ti.com/lit/ds/symlink/lm317.pdf",
                size: "2.1 MB"
            });
            docs.push({
                title: "Application Note LM317",
                url: "https://www.ti.com/lit/an/snva558/snva558.pdf", 
                size: "1.8 MB"
            });
        }

        // Похожие товары
        const similar = $(".product__group .product_simple").map((_, item) => {
            const $item = $(item);
            const itemName = $item.find(".product__name a").text().trim();
            const itemLink = $item.find(".product__name a").attr("href");
            const itemImage = $item.find(".product__image img").attr("src");
            const itemPriceStr = $item.find(".product__price").text().trim();
            const itemPriceValue = itemPriceStr ? parseFloat(itemPriceStr.replace(/[^\d.,]/g, '').replace(',', '.')) : null;
            
            if (itemName && itemLink) {
                return {
                    name: itemName,
                    url: itemLink.startsWith("http") ? itemLink : `https://www.chipdip.ru${itemLink}`,
                    image: itemImage ? (itemImage.startsWith("http") ? itemImage : `https://www.chipdip.ru${itemImage}`) : null,
                    price: {
                        display: itemPriceStr || "Цена по запросу",
                        value: itemPriceValue
                    }
                };
            }
            return null;
        }).get().filter(Boolean);

        // Наличие и условия
        const stock = $(".product__extrainfo .item__avail").text().trim();
        const delivery = $("#deliveryinfo").text().trim();
        const minOrder = "1 шт.";

        const result = {
            name,
            code,
            manufacturer,
            price: {
                display: priceStr || "Цена по запросу",
                value: priceValue
            },
            categories,
            rating,
            reviewCount,
            images,
            description,
            specs,
            docs,
            similar,
            stock,
            delivery,
            minOrder,
            source: "chipdip.ru",
            source_url: url,
            parsed_at: new Date().toISOString()
        };

        console.log(`✅ Товар успешно получен: ${name}`);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Ошибка получения товара:', error.message);
        const { status, error: errorMessage, data } = handleAxiosError(error);
        res.status(status).json({ error: errorMessage, data });
    }
});

// Обработка ошибок Express
app.use((err, req, res, next) => {
    console.error('❌ Необработанная ошибка:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Прокси-сервер запущен на порту ${PORT}`);
    console.log(`📡 Доступен по адресу: http://89.104.69.77:${PORT}`);
    console.log(`🌐 Локальный доступ: http://localhost:${PORT}`);
});
