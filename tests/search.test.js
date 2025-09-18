const axios = require('axios');
const winston = require('winston');

// Настройка логгера
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'search.log' })
    ]
});

// Тестовые товары с ChipDip
const testProducts = [
    'STM32F103C8T6',
    'ATmega328P-PU',
    'ESP32-WROOM-32',
    'MAX7219',
    'DS18B20',
    'LM317T',
    'HC-SR04',
    'LCD1602',
    'MQ-2',
    'NE555'
];

// Конфигурация
const config = {
    proxyUrl: 'http://localhost:8002',
    mainUrl: 'http://localhost:8000',
    timeout: 10000
};

// Функция для тестирования поиска
async function testSearch(query) {
    try {
        logger.info(`Тестирование поиска: ${query}`);

        // 1. Поиск через прокси
        const proxyResponse = await axios.get(`${config.proxyUrl}/proxy/search`, {
            params: { q: query },
            timeout: config.timeout
        });

        logger.info(`Найдено результатов: ${proxyResponse.data.length}`);

        if (proxyResponse.data.length === 0) {
            logger.error(`Поиск не дал результатов для: ${query}`);
            return;
        }

        // 2. Проверка первого результата
        const firstProduct = proxyResponse.data[0];
        logger.info(`Проверка товара: ${firstProduct.name}`);

        // 3. Получение детальной информации о товаре
        const productResponse = await axios.get(`${config.proxyUrl}/proxy/product`, {
            params: { url: firstProduct.url },
            timeout: config.timeout
        });

        const product = productResponse.data;

        // 4. Проверка обязательных полей
        const requiredFields = ['name', 'code', 'price', 'description', 'specs'];
        const missingFields = requiredFields.filter(field => !product[field]);

        if (missingFields.length > 0) {
            logger.error(`Отсутствуют обязательные поля для ${query}: ${missingFields.join(', ')}`);
        }

        // 5. Проверка изображений
        if (!product.images || product.images.length === 0) {
            logger.warn(`Нет изображений для товара: ${query}`);
        }

        // 6. Проверка цены
        if (!product.price.value && !product.price.display) {
            logger.error(`Отсутствует цена для товара: ${query}`);
        }

        // 7. Проверка наличия
        if (!product.stock) {
            logger.warn(`Нет информации о наличии для товара: ${query}`);
        }

        logger.info(`Тест завершен успешно для: ${query}`);
        return product;

    } catch (error) {
        logger.error('Ошибка при тестировании', {
            query,
            error: error.message,
            response: error.response?.data
        });
    }
}

// Запуск тестов
async function runTests() {
    logger.info('Начало тестирования');
    
    const results = [];
    for (const product of testProducts) {
        try {
            const result = await testSearch(product);
            results.push({
                query: product,
                success: !!result,
                data: result
            });
            // Пауза между запросами
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            logger.error(`Ошибка при тестировании ${product}`, error);
        }
    }

    // Анализ результатов
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info('Тестирование завершено', {
        total: testProducts.length,
        successful,
        failed,
        successRate: `${(successful / testProducts.length * 100).toFixed(1)}%`
    });
}

// Запуск тестов
runTests().catch(error => {
    logger.error('Критическая ошибка при выполнении тестов', error);
});
