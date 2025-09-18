const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Конфигурация
const BASE_URL = 'http://89.104.69.77';
const TEST_RESULTS_FILE = 'test_full_flow_results.json';
const LOG_FILE = 'test_full_flow.log';

// Логирование
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Тестовые запросы (100 случайных)
const testQueries = [
    // Популярные микросхемы
    'LM317', 'LM358', 'NE555', 'LM393', 'TL072', 'LM324', 'LM386', 'LM7805', 'LM7812', 'LM7912',
    'TL431', 'LM2596', 'LM2577', 'LM2575', 'LM2595', 'LM2678', 'LM2679', 'LM2680', 'LM2681', 'LM2682',
    
    // Транзисторы
    '2N2222', 'BC547', 'IRF540', 'TIP122', 'BD139', '2N3904', '2N3906', 'BC557', 'IRFZ44N', 'IRF3205',
    'TIP31C', 'TIP32C', 'BD135', 'BD136', 'MJE13003', 'MJE13005', 'MJE13007', 'MJE13009', 'MJE13011', 'MJE13013',
    
    // Микроконтроллеры
    'STM32F103', 'ATmega328', 'ESP32', 'PIC16F', 'ATmega2560', 'STM32F407', 'STM32F429', 'ATmega168', 'PIC18F', 'ATmega32',
    'STM32F030', 'STM32F031', 'STM32F051', 'STM32F072', 'STM32F091', 'STM32F100', 'STM32F101', 'STM32F102', 'STM32F103', 'STM32F105',
    
    // Диоды и светодиоды
    '1N4007', 'BAT54', 'Schottky', '1N4148', '1N5819', '1N5822', '1N5825', '1N5827', '1N5829', '1N5831',
    'LED', 'RGB', 'WS2812', 'WS2812B', 'APA102', 'SK6812', 'LPD8806', 'TM1809', 'TM1804', 'TM1803',
    
    // Резисторы и конденсаторы
    'резистор', 'конденсатор', '10кОм', '100мкФ', '1нФ', '5В', '12В', '220В', '1А', '10А',
    '0.5Вт', '1Вт', '5Вт', '10Вт', '25Вт', '50Вт', '100Вт', '200Вт', '500Вт', '1000Вт',
    
    // Корпуса
    'TO-220', 'SO-8', 'DIP-8', 'SMD', 'QFP', 'BGA', 'LQFP', 'TQFP', 'QFN', 'DFN',
    'SOT-23', 'SOT-89', 'SOT-223', 'TO-92', 'TO-126', 'TO-247', 'TO-3P', 'TO-220FP', 'TO-252', 'TO-263',
    
    // Специфичные компоненты
    'LDD-700L', 'LDD-350L', 'LDB-500L', 'LDD-1000L', 'LDD-1500L', 'LDD-2000L', 'LDD-2500L', 'LDD-3000L', 'LDD-3500L', 'LDD-4000L',
    'LDB-100L', 'LDB-200L', 'LDB-300L', 'LDB-400L', 'LDB-600L', 'LDB-700L', 'LDB-800L', 'LDB-900L', 'LDB-1000L', 'LDB-1100L',
    
    // Русские термины
    'стабилизатор', 'регулятор', 'усилитель', 'реле', 'кнопка', 'переключатель', 'разъем', 'соединитель', 'трансформатор', 'дроссель',
    'катушка', 'предохранитель', 'потенциометр', 'переменный резистор', 'кварц', 'генератор', 'осциллятор', 'фильтр', 'аттенюатор', 'усилитель'
];

// Результаты тестов
const testResults = {
    startTime: new Date().toISOString(),
    totalTests: 0,
    successfulTests: 0,
    failedTests: 0,
    errors: [],
    details: []
};

// Функция для тестирования одного запроса
async function testQuery(query, index) {
    const testId = `TEST_${index + 1}`;
    log(`\n${testId}: Тестируем запрос "${query}"`);
    
    const testDetail = {
        testId,
        query,
        startTime: new Date().toISOString(),
        steps: []
    };
    
    try {
        // Шаг 1: Поиск товаров
        log(`${testId}: Шаг 1 - Выполняем поиск`);
        const searchResponse = await axios.get(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`, {
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ComponentsAggregator-Test/1.0'
            }
        });
        
        testDetail.steps.push({
            step: 'search',
            status: 'success',
            responseTime: searchResponse.headers['x-response-time'] || 'unknown',
            resultsCount: searchResponse.data.results ? searchResponse.data.results.length : 0
        });
        
        log(`${testId}: Найдено ${searchResponse.data.results ? searchResponse.data.results.length : 0} товаров`);
        
        if (!searchResponse.data.results || searchResponse.data.results.length === 0) {
            testDetail.status = 'no_results';
            testDetail.endTime = new Date().toISOString();
            testResults.details.push(testDetail);
            return;
        }
        
        // Шаг 2: Проверяем HTML страницу поиска
        log(`${testId}: Шаг 2 - Проверяем HTML страницу поиска`);
        try {
            const searchPageResponse = await axios.get(`${BASE_URL}/search.html?q=${encodeURIComponent(query)}`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'ComponentsAggregator-Test/1.0'
                }
            });
            
            const hasSearchBox = searchPageResponse.data.includes('search-box');
            const hasResults = searchPageResponse.data.includes('resultsContainer');
            const hasTailwind = searchPageResponse.data.includes('tailwindcss');
            
            testDetail.steps.push({
                step: 'search_page_html',
                status: 'success',
                hasSearchBox,
                hasResults,
                hasTailwind,
                pageSize: searchPageResponse.data.length
            });
            
            log(`${testId}: HTML страница загружена (${searchPageResponse.data.length} байт)`);
        } catch (error) {
            testDetail.steps.push({
                step: 'search_page_html',
                status: 'error',
                error: error.message
            });
            log(`${testId}: Ошибка загрузки HTML страницы: ${error.message}`);
        }
        
        // Шаг 3: Тестируем первый товар
        const firstProduct = searchResponse.data.results[0];
        if (firstProduct && firstProduct.url) {
            log(`${testId}: Шаг 3 - Тестируем карточку товара "${firstProduct.title || 'Без названия'}"`);
            
            try {
                const productResponse = await axios.get(`${BASE_URL}/api/product?url=${encodeURIComponent(firstProduct.url)}`, {
                    timeout: 15000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'ComponentsAggregator-Test/1.0'
                    }
                });
                
                testDetail.steps.push({
                    step: 'product_api',
                    status: 'success',
                    productTitle: productResponse.data.title || 'Без названия',
                    hasImage: !!productResponse.data.image,
                    hasPrice: !!productResponse.data.price,
                    hasDescription: !!productResponse.data.description
                });
                
                log(`${testId}: Товар загружен: ${productResponse.data.title || 'Без названия'}`);
            } catch (error) {
                testDetail.steps.push({
                    step: 'product_api',
                    status: 'error',
                    error: error.message
                });
                log(`${testId}: Ошибка загрузки товара: ${error.message}`);
            }
            
            // Шаг 4: Проверяем HTML страницу товара
            log(`${testId}: Шаг 4 - Проверяем HTML страницу товара`);
            try {
                const productPageResponse = await axios.get(`${BASE_URL}/product.html?url=${encodeURIComponent(firstProduct.url)}`, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'ComponentsAggregator-Test/1.0'
                    }
                });
                
                const hasProductCard = productPageResponse.data.includes('productCard');
                const hasImageGallery = productPageResponse.data.includes('imageGallery');
                const hasTailwind = productPageResponse.data.includes('tailwindcss');
                const hasBreadcrumbs = productPageResponse.data.includes('breadcrumb');
                
                testDetail.steps.push({
                    step: 'product_page_html',
                    status: 'success',
                    hasProductCard,
                    hasImageGallery,
                    hasTailwind,
                    hasBreadcrumbs,
                    pageSize: productPageResponse.data.length
                });
                
                log(`${testId}: HTML страница товара загружена (${productPageResponse.data.length} байт)`);
            } catch (error) {
                testDetail.steps.push({
                    step: 'product_page_html',
                    status: 'error',
                    error: error.message
                });
                log(`${testId}: Ошибка загрузки HTML страницы товара: ${error.message}`);
            }
        }
        
        testDetail.status = 'success';
        testResults.successfulTests++;
        
    } catch (error) {
        testDetail.status = 'error';
        testDetail.error = error.message;
        testResults.failedTests++;
        testResults.errors.push({
            testId,
            query,
            error: error.message
        });
        
        log(`${testId}: ОШИБКА: ${error.message}`);
    }
    
    testDetail.endTime = new Date().toISOString();
    testResults.details.push(testDetail);
    testResults.totalTests++;
}

// Основная функция тестирования
async function runFullFlowTest() {
    log('🚀 Запуск полного тестирования флоу поиска');
    log(`📊 Будет протестировано ${testQueries.length} запросов`);
    
    // Очищаем файлы
    if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
    if (fs.existsSync(TEST_RESULTS_FILE)) fs.unlinkSync(TEST_RESULTS_FILE);
    
    // Тестируем каждый запрос
    for (let i = 0; i < testQueries.length; i++) {
        await testQuery(testQueries[i], i);
        
        // Небольшая пауза между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Сохраняем промежуточные результаты каждые 10 тестов
        if ((i + 1) % 10 === 0) {
            testResults.endTime = new Date().toISOString();
            fs.writeFileSync(TEST_RESULTS_FILE, JSON.stringify(testResults, null, 2));
            log(`💾 Промежуточные результаты сохранены (${i + 1}/${testQueries.length})`);
        }
    }
    
    // Финальные результаты
    testResults.endTime = new Date().toISOString();
    testResults.successRate = ((testResults.successfulTests / testResults.totalTests) * 100).toFixed(2);
    
    // Сохраняем результаты
    fs.writeFileSync(TEST_RESULTS_FILE, JSON.stringify(testResults, null, 2));
    
    // Выводим итоговый отчет
    log('\n📊 ИТОГОВЫЙ ОТЧЕТ:');
    log(`✅ Успешных тестов: ${testResults.successfulTests}`);
    log(`❌ Неудачных тестов: ${testResults.failedTests}`);
    log(`📈 Процент успеха: ${testResults.successRate}%`);
    log(`⏱️ Время выполнения: ${testResults.startTime} - ${testResults.endTime}`);
    
    if (testResults.errors.length > 0) {
        log('\n🚨 ОШИБКИ:');
        testResults.errors.forEach(error => {
            log(`  - ${error.testId} (${error.query}): ${error.error}`);
        });
    }
    
    log(`\n📁 Результаты сохранены в: ${TEST_RESULTS_FILE}`);
    log(`📝 Лог сохранен в: ${LOG_FILE}`);
    
    return testResults;
}

// Запуск тестирования
if (require.main === module) {
    runFullFlowTest()
        .then(results => {
            console.log('\n🎉 Тестирование завершено!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Критическая ошибка:', error);
            process.exit(1);
        });
}

module.exports = { runFullFlowTest, testQuery };
