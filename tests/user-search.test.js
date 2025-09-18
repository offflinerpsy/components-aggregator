const axios = require('axios');

// Тестовые товары от пользователя
const testProducts = [
    'LDD-350L',
    'LDD-700L',
    'преобразователь для светодиодного освещения'
];

// Конфигурация
const config = {
    mainUrl: 'http://localhost:8080',
    timeout: 10000
};

// Функция для тестирования поиска
async function testUserSearch(query) {
    try {
        console.log(`\n🔍 Тестирование поиска: "${query}"`);

        const response = await axios.get(`${config.mainUrl}/api/search`, {
            params: { q: query },
            timeout: config.timeout
        });

        console.log(`✅ Статус ответа: ${response.status}`);
        console.log(`📦 Найдено результатов: ${response.data.results?.length || 0}`);

        if (response.data.results && response.data.results.length > 0) {
            console.log('📋 Первые 3 результата:');
            response.data.results.slice(0, 3).forEach((product, index) => {
                console.log(`  ${index + 1}. ${product.name}`);
                console.log(`     Цена: ${product.price.display}`);
                console.log(`     Наличие: ${product.stock}`);
                console.log(`     URL: ${product.url}`);
            });
        } else {
            console.log('❌ Результаты не найдены');
        }

        return response.data;

    } catch (error) {
        console.error(`❌ Ошибка при тестировании "${query}":`, error.message);
        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Данные:', error.response.data);
        }
        return null;
    }
}

// Запуск тестов
async function runUserTests() {
    console.log('🚀 Начало тестирования пользовательских запросов');
    
    for (const product of testProducts) {
        await testUserSearch(product);
        // Пауза между запросами
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ Тестирование завершено');
}

// Запуск тестов
runUserTests().catch(error => {
    console.error('❌ Критическая ошибка:', error);
});
