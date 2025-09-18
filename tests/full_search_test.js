const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Случайные поисковые запросы для тестирования
const searchQueries = [
    'конденсатор',
    'резистор',
    'транзистор',
    'диод',
    'микросхема',
    'стабилизатор',
    'преобразователь',
    'датчик',
    'реле',
    'индуктивность'
];

// Функция для случайного выбора элемента из массива
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Функция для логирования
async function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}\n`;
    
    console.log(logMessage.trim());
    
    await fs.appendFile(
        path.join(__dirname, '..', 'test_results.log'),
        logMessage
    );
}

// Функция для тестирования поиска
async function testSearch(query) {
    try {
        const response = await axios.get(`http://localhost/api/search?q=${encodeURIComponent(query)}`);
        await log(`Поиск "${query}": Найдено ${response.data.results.length} товаров`);
        return response.data.results;
    } catch (error) {
        await log(`Ошибка поиска "${query}": ${error.message}`, 'error');
        return [];
    }
}

// Функция для тестирования карточки товара
async function testProductCard(product) {
    try {
        // Сначала получаем данные через API
        const apiResponse = await axios.get(`http://localhost/api/product?url=${encodeURIComponent(product.url)}`);
        
        if (!apiResponse.data || !apiResponse.data.data) {
            await log(`Товар ${product.name}: API вернул пустой ответ`, 'error');
            return false;
        }

        const productData = apiResponse.data.data;

        // Проверяем обязательные поля в API-ответе
        const requiredFields = ['name', 'manufacturer', 'price', 'description'];
        const missingFields = requiredFields.filter(field => !productData[field]);
        
        if (missingFields.length > 0) {
            await log(`Товар ${product.name}: в API отсутствуют поля ${missingFields.join(', ')}`, 'warning');
        } else {
            await log(`Товар ${product.name}: API вернул все обязательные поля`);
        }

        // Проверяем дополнительные данные в API-ответе
        if (productData.images && productData.images.length > 0) {
            await log(`Товар ${product.name}: API вернул ${productData.images.length} изображений`);
        }
        
        if (productData.docs && productData.docs.length > 0) {
            await log(`Товар ${product.name}: API вернул ${productData.docs.length} документов`);
        }

        // Теперь проверяем HTML-страницу
        const pageResponse = await axios.get(`http://localhost/product?url=${encodeURIComponent(product.url)}`);
        
        if (pageResponse.status !== 200) {
            await log(`Товар ${product.name}: ошибка получения HTML-страницы (статус ${pageResponse.status})`, 'error');
            return false;
        }

        if (!pageResponse.data || typeof pageResponse.data !== 'string') {
            await log(`Товар ${product.name}: HTML-страница вернула некорректный ответ`, 'error');
            return false;
        }

        await log(`Товар ${product.name}: HTML-страница успешно загружена`);
        return true;

    } catch (error) {
        await log(`Ошибка получения товара ${product.name}: ${error.message}`, 'error');
        return false;
    }
}

// Основная функция тестирования
async function runTests() {
    await log('🚀 Начало тестирования');
    
    let totalProducts = 0;
    let successfulProducts = 0;
    
    // Тестируем каждый поисковый запрос
    for (const query of searchQueries) {
        await log(`\n📝 Тестирование поискового запроса: ${query}`);
        
        const products = await testSearch(query);
        if (products.length === 0) {
            await log(`❌ Поиск не вернул результатов для "${query}"`, 'warning');
            continue;
        }

        // Берем случайный товар для тестирования
        const randomProduct = getRandomItem(products);
        totalProducts++;
        
        await log(`\n🔍 Тестирование карточки товара: ${randomProduct.name}`);
        const success = await testProductCard(randomProduct);
        if (success) successfulProducts++;

        // Небольшая пауза между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Итоговая статистика
    await log('\n📊 Итоги тестирования:');
    await log(`Всего протестировано товаров: ${totalProducts}`);
    await log(`Успешно протестировано: ${successfulProducts}`);
    await log(`Процент успеха: ${((successfulProducts / totalProducts) * 100).toFixed(2)}%`);
}

// Запускаем тесты
runTests().catch(async error => {
    await log(`❌ Критическая ошибка: ${error.message}`, 'error');
    process.exit(1);
});