import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseParser } from './base-parser.js';

export class JLCPCBParser extends BaseParser {
    constructor() {
        super('JLCPCB', 'https://jlcpcb.com');
    }

    async search(query) {
        try {
            console.log(`🔍 JLCPCB поиск: ${query}`);
            
            const searchUrl = `${this.baseUrl}/parts/search?keyword=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, {
                timeout: 10000,
                headers: { 'User-Agent': this.userAgent }
            });

            const $ = cheerio.load(response.data);
            const products = [];

            $('.part-item').each((_, element) => {
                const $el = $(element);
                const mpn = $el.find('.part-number').text().trim();
                const description = $el.find('.description').text().trim();
                const priceStr = $el.find('.price').text().trim();
                const stockStr = $el.find('.stock').text().trim();
                const url = this.baseUrl + $el.find('a').attr('href');

                if (mpn) {
                    const price = this.normalizePrice(priceStr, 'USD');
                    const stock = this.normalizeStock(stockStr);

                    products.push({
                        mpn,
                        description,
                        pricing: price ? [{ qty: 1, price: price.price, currency: price.currency }] : [],
                        availability: stock,
                        package: $el.find('.package').text().trim() || null,
                        packaging: $el.find('.packaging').text().trim() || null,
                        url,
                        suppliers: [{
                            name: 'JLCPCB',
                            url: this.baseUrl,
                            inStock: stock.inStock,
                            pricing: price ? [{ qty: 1, price: price.price, currency: price.currency }] : []
                        }]
                    });
                }
            });

            return products;
        } catch (error) {
            console.error(`❌ Ошибка JLCPCB поиска:`, error.message);
            return [];
        }
    }
}

export default new JLCPCBParser();
