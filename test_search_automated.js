#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs').promises;

// Список тестовых запросов - реальные артикулы из каталогов (русский + английский)
const testQueries = [
    // Популярные микросхемы (работают на английском)
    'LM317', 'LM358', 'NE555', 'LM393', 'TL072', 'LM324',
    
    // Транзисторы
    '2N2222', 'BC547', 'IRF540', 'TIP122', 'BD139', 
    
    // Микроконтроллеры
    'STM32F103', 'ATmega328', 'ESP32', 'PIC16F',
    
    // Диоды и светодиоды
    '1N4007', 'BAT54', 'Schottky',
    
    // Специфичные компоненты
    'LDD-700L', 'LDD-350L', 'LDB-500L', 
    
    // Русские термины - категории товаров
    'резистор', 'конденсатор', 'транзистор', 'диод', 'светодиод',
    'микросхема', 'стабилизатор', 'регулятор', 'усилитель',
    'реле', 'кнопка', 'переключатель', 'разъем', 'соединитель',
    'трансформатор', 'дроссель', 'катушка', 'предохранитель',
    'потенциометр', 'переменный резистор', 'кварц', 'генератор',
    
    // Популярные серии на русском
    'КТ315', 'КТ817', '1Н4148', 'КР142ЕН', 'К561ЛА7',
    'КД522', 'АЛС324', 'КП303', 'КТ973',
    
    // Номиналы и характеристики
    '10кОм', '100мкФ', '1нФ', '5В', '12В', '220В',
    '1А', '10А', '0.5Вт', '1Вт', '5Вт',
    
    // Корпуса
    'TO-220', 'SO-8', 'DIP-8', 'SMD', 'QFP',
    
    // Проблемные/граничные случаи
    'a', 'аа', '123', 'xyz', '!!!', 'тест', 'абвгд',
    '', ' ', 'очень длинный запрос который не должен найти ничего конкретного'
];

const BASE_URL = 'http://89.104.69.77';
const LOG_FILE = 'search_test_results.log';
const DELAY_BETWEEN_TESTS = 2000; // 2 секунды между запросами

class SearchTester {
    constructor() {
        this.results = [];
        this.startTime = new Date();
        this.logStream = null;
    }

    async init() {
        await this.log(`🚀 Запуск автоматизированного тестирования поиска`);
        await this.log(`⏰ Время старта: ${this.startTime.toISOString()}`);
        await this.log(`🎯 Количество тестов: ${testQueries.length}`);
        await this.log(`🌐 Сервер: ${BASE_URL}`);
        await this.log(`⏱️ Задержка между тестами: ${DELAY_BETWEEN_TESTS}ms`);
        await this.log(`${'='.repeat(80)}\n`);
    }

    async log(message) {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${message}\n`;
        
        console.log(message);
        await fs.appendFile(LOG_FILE, logLine);
    }

    async testSearch(query) {
        const testStart = Date.now();
        const result = {
            query,
            success: false,
            responseTime: 0,
            resultCount: 0,
            error: null,
            timestamp: new Date().toISOString()
        };

        try {
            await this.log(`🔍 Тестирую запрос: "${query}"`);
            
            const response = await axios.get(`${BASE_URL}/api/search`, {
                params: { q: query },
                timeout: 30000,
                headers: {
                    'User-Agent': 'SearchTester/1.0'
                }
            });

            result.responseTime = Date.now() - testStart;
            
            if (response.status === 200 && response.data) {
                const data = response.data;
                result.success = true;
                result.resultCount = data.results ? data.results.length : 0;
                
                if (result.resultCount > 0) {
                    await this.log(`  ✅ Успех! Найдено ${result.resultCount} товаров за ${result.responseTime}ms`);
                    
                    // Логируем первые 3 результата для анализа
                    const sampleResults = data.results.slice(0, 3);
                    for (const item of sampleResults) {
                        await this.log(`    📦 ${item.name || 'БЕЗ НАЗВАНИЯ'} - ${item.price?.display || 'БЕЗ ЦЕНЫ'} (${item.manufacturer || 'БЕЗ ПРОИЗВОДИТЕЛЯ'})`);
                    }
                } else {
                    await this.log(`  ⚠️  Пустой результат за ${result.responseTime}ms`);
                }

                // Проверяем на баги
                await this.checkForBugs(query, data);
                
            } else {
                result.error = `Неожиданный статус: ${response.status}`;
                await this.log(`  ❌ Ошибка: ${result.error}`);
            }

        } catch (error) {
            result.responseTime = Date.now() - testStart;
            result.error = error.message;
            await this.log(`  💥 Исключение: ${error.message} (${result.responseTime}ms)`);
            
            if (error.response) {
                await this.log(`    HTTP Status: ${error.response.status}`);
                await this.log(`    Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
            }
        }

        this.results.push(result);
        await this.log(''); // Пустая строка для разделения
        return result;
    }

    async checkForBugs(query, data) {
        const bugs = [];
        
        if (!data.results || !Array.isArray(data.results)) {
            bugs.push('results не является массивом');
        } else {
            // Проверяем каждый товар на баги
            data.results.forEach((item, index) => {
                if (!item.name || item.name.trim() === '') {
                    bugs.push(`Товар #${index + 1}: отсутствует название`);
                }
                if (!item.price || !item.price.display) {
                    bugs.push(`Товар #${index + 1}: отсутствует цена`);
                }
                if (!item.url) {
                    bugs.push(`Товар #${index + 1}: отсутствует URL`);
                }
                if (!item.manufacturer || item.manufacturer.trim() === '') {
                    bugs.push(`Товар #${index + 1}: отсутствует производитель`);
                }
            });
        }

        if (bugs.length > 0) {
            await this.log(`  🐛 НАЙДЕНЫ БАГИ в запросе "${query}":`);
            for (const bug of bugs) {
                await this.log(`    - ${bug}`);
            }
        }
    }

    async runAllTests() {
        await this.init();
        
        for (let i = 0; i < testQueries.length; i++) {
            const query = testQueries[i];
            const progress = `${i + 1}/${testQueries.length}`;
            
            await this.log(`📊 Прогресс: ${progress} - Запрос "${query}"`);
            await this.testSearch(query);
            
            // Задержка между тестами
            if (i < testQueries.length - 1) {
                await this.log(`⏳ Пауза ${DELAY_BETWEEN_TESTS}ms...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TESTS));
            }
        }

        await this.generateReport();
    }

    async generateReport() {
        const endTime = new Date();
        const totalTime = endTime - this.startTime;
        
        const successful = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;
        const withResults = this.results.filter(r => r.resultCount > 0).length;
        const emptyResults = this.results.filter(r => r.success && r.resultCount === 0).length;
        
        const avgResponseTime = this.results
            .filter(r => r.responseTime > 0)
            .reduce((sum, r) => sum + r.responseTime, 0) / this.results.length;

        await this.log(`\n${'='.repeat(80)}`);
        await this.log(`📈 ИТОГОВЫЙ ОТЧЕТ`);
        await this.log(`${'='.repeat(80)}`);
        await this.log(`⏰ Время выполнения: ${Math.round(totalTime / 1000)}с`);
        await this.log(`📊 Всего тестов: ${this.results.length}`);
        await this.log(`✅ Успешных: ${successful} (${Math.round(successful / this.results.length * 100)}%)`);
        await this.log(`❌ Неудачных: ${failed} (${Math.round(failed / this.results.length * 100)}%)`);
        await this.log(`📦 С результатами: ${withResults} (${Math.round(withResults / this.results.length * 100)}%)`);
        await this.log(`🚫 Пустых результатов: ${emptyResults} (${Math.round(emptyResults / this.results.length * 100)}%)`);
        await this.log(`⚡ Среднее время ответа: ${Math.round(avgResponseTime)}ms`);

        // Топ самых медленных запросов
        const slowest = [...this.results]
            .sort((a, b) => b.responseTime - a.responseTime)
            .slice(0, 5);
        
        await this.log(`\n🐌 ТОП-5 САМЫХ МЕДЛЕННЫХ ЗАПРОСОВ:`);
        slowest.forEach((result, index) => {
            this.log(`  ${index + 1}. "${result.query}" - ${result.responseTime}ms`);
        });

        // Топ самых продуктивных запросов
        const mostResults = [...this.results]
            .sort((a, b) => b.resultCount - a.resultCount)
            .slice(0, 5);
        
        await this.log(`\n🏆 ТОП-5 ЗАПРОСОВ С НАИБОЛЬШИМ КОЛИЧЕСТВОМ РЕЗУЛЬТАТОВ:`);
        mostResults.forEach((result, index) => {
            this.log(`  ${index + 1}. "${result.query}" - ${result.resultCount} товаров`);
        });

        // Ошибки
        const errors = this.results.filter(r => r.error);
        if (errors.length > 0) {
            await this.log(`\n💥 ОШИБКИ (${errors.length}):`);
            errors.forEach(result => {
                this.log(`  "${result.query}": ${result.error}`);
            });
        }

        await this.log(`\n✅ Тестирование завершено! Логи сохранены в: ${LOG_FILE}`);
        await this.log(`📄 Для анализа результатов выполните: cat ${LOG_FILE} | grep "🐛\\|💥\\|⚠️"`);
    }
}

// Запуск тестирования
if (require.main === module) {
    const tester = new SearchTester();
    tester.runAllTests().catch(error => {
        console.error('💥 Критическая ошибка тестирования:', error);
        process.exit(1);
    });
}

module.exports = SearchTester;
