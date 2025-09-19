import chipdip from '../chipdip.js';
import lcsc from './lcsc-parser.js';
import tme from './tme-parser.js';
import farnell from './farnell-parser.js';
import jlcpcb from './jlcpcb-parser.js';
import future from './future-parser.js';
import oemstrade from './oemstrade-parser.js';
import { mergeSearchResults } from './merge.js';
import { normalizeProduct } from './normalize.js';

class SearchAggregator {
    constructor() {
        this.parsers = [
            lcsc,
            tme,
            farnell,
            jlcpcb,
            future,
            oemstrade
        ];
    }

    async search(query, options = {}) {
        const { page = 1, pageSize = 20, useFallback = true } = options;
        
        try {
            console.log(`🔍 Агрегированный поиск: ${query} (страница ${page}, размер ${pageSize})`);
            
            // 1. Сначала пробуем ChipDip
            let chipdipResults = await chipdip.search(query);
            console.log(`📦 ChipDip: найдено ${chipdipResults.length} товаров`);
            
            // Нормализуем результаты ChipDip в канон
            let results = chipdipResults.map(item => this.normalizeChipDipResult(item));
            
            // 2. Если результатов мало или пусто, используем фолбэк к парсерам
            if (useFallback && results.length < 5) {
                console.log(`🔄 Используем фолбэк к парсерам (найдено только ${results.length} товаров)`);
                
                const fallbackResults = await this.searchFallback(query);
                console.log(`📦 Фолбэк: найдено ${fallbackResults.length} товаров`);
                
                // Объединяем результаты
                const allResults = [...results, ...fallbackResults];
                results = mergeSearchResults(allResults);
                console.log(`📦 После слияния: ${results.length} товаров`);
            }
            
            // 3. Применяем пагинацию
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedResults = results.slice(startIndex, endIndex);
            
            return {
                items: paginatedResults,
                total: results.length,
                page,
                pageSize,
                hasMore: endIndex < results.length
            };
            
        } catch (error) {
            console.error('❌ Ошибка агрегированного поиска:', error);
            return {
                items: [],
                total: 0,
                page,
                pageSize,
                hasMore: false,
                error: error.message
            };
        }
    }

    async searchFallback(query) {
        const promises = this.parsers.map(parser => 
            parser.search(query).catch(error => {
                console.error(`❌ Ошибка парсера ${parser.name}:`, error.message);
                return [];
            })
        );
        
        const results = await Promise.all(promises);
        return results.flat();
    }

    normalizeChipDipResult(item) {
        // Извлекаем MPN из названия или URL
        const mpn = this.extractMPN(item.name || '');
        
        // Парсим цену
        const pricing = [];
        if (item.price && item.price.value) {
            pricing.push({
                qty: 1,
                price: item.price.value,
                currency: 'RUB',
                supplier: 'ChipDip'
            });
        }
        
        // Парсим наличие
        const availability = this.parseChipDipStock(item.stock || '');
        
        // Извлекаем корпус из названия
        const packageInfo = this.extractPackage(item.name || '');
        
        return {
            mpn,
            description: item.name || '',
            images: item.image ? [item.image] : [],
            datasheets: [],
            availability,
            pricing,
            package: packageInfo,
            packaging: null,
            url: item.url || null,
            suppliers: [{
                name: 'ChipDip',
                url: 'https://www.chipdip.ru',
                inStock: availability.inStock,
                pricing: pricing
            }],
            technical_specs: {
                manufacturer: item.manufacturer || null
            }
        };
    }

    extractMPN(name) {
        // Простая логика извлечения MPN из названия
        const words = name.split(/\s+/);
        for (const word of words) {
            if (word.match(/^[A-Z0-9-]+$/)) {
                return word;
            }
        }
        return name.split(/\s+/)[0] || '';
    }

    parseChipDipStock(stockStr) {
        if (!stockStr) return { inStock: 0, lead: null };
        
        const stock = stockStr.toLowerCase();
        if (stock.includes('нет') || stock.includes('no')) {
            return { inStock: 0, lead: null };
        }
        
        const match = stock.match(/(\d+)\s*шт/);
        if (match) {
            return { inStock: parseInt(match[1]), lead: null };
        }
        
        return { inStock: 0, lead: stockStr };
    }

    extractPackage(name) {
        const packagePatterns = [
            /TO-?(\d+)/i,
            /SOT-?(\d+)/i,
            /DIP-?(\d+)/i,
            /SOIC-?(\d+)/i,
            /QFN-?(\d+)/i,
            /BGA-?(\d+)/i,
            /TSSOP-?(\d+)/i,
            /MSOP-?(\d+)/i,
            /DFN-?(\d+)/i,
            /LFCSP-?(\d+)/i
        ];
        
        for (const pattern of packagePatterns) {
            const match = name.match(pattern);
            if (match) {
                return match[0];
            }
        }
        
        return null;
    }
}

export default new SearchAggregator();
