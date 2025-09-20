const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testLocalSearch() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Открываем страницу...');
    await page.goto('http://127.0.0.1:8080/loads/product_cart/product_cart/deep-search-results.html?q=транзистор');
    
    console.log('Ждем загрузки таблицы...');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    console.log('Проверяем количество строк...');
    const rows = await page.$$('table tbody tr');
    console.log(`Найдено строк: ${rows.length}`);
    
    if (rows.length >= 2) {
      console.log('✅ Успех: найдено 2+ строк');
      
      // Сохраняем HTML
      const html = await page.innerHTML('main');
      fs.writeFileSync('reports/local_search_results.html', html, 'utf8');
      console.log('HTML сохранен в reports/local_search_results.html');
      
      // Сохраняем скриншот
      await page.screenshot({ path: 'reports/local_search_results.png' });
      console.log('Скриншот сохранен в reports/local_search_results.png');
      
      return true;
    } else {
      console.log('❌ Ошибка: найдено меньше 2 строк');
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

testLocalSearch().then(success => {
  process.exit(success ? 0 : 1);
});
