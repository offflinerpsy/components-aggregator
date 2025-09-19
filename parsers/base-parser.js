import axios from 'axios';
import * as cheerio from 'cheerio';

export class BaseParser {
    constructor(name, baseUrl) {
        this.name = name;
        this.baseUrl = baseUrl;
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119.0.0.0 Safari/537.36";
    }

    // Нормализация цены
    normalizePrice(priceStr, currency = 'USD') {
        if (!priceStr) return null;
        const matches = priceStr.match(/[\d.,]+/);
        if (!matches) return null;
        return {
            price: parseFloat(matches[0].replace(",", ".")),
            currency: currency
        };
    }

    // Нормализация количества в наличии
    normalizeStock(stockStr) {
        if (!stockStr) return { inStock: 0, lead: null };
        
        const stock = stockStr.toLowerCase();
        if (stock.includes('нет') || stock.includes('no') || stock.includes('out')) {
            return { inStock: 0, lead: null };
        }
        
        const match = stock.match(/(\d+)/);
        if (match) {
            return { inStock: parseInt(match[1]), lead: null };
        }
        
        return { inStock: 0, lead: stockStr };
    }

    // Нормализация валюты
    normalizeCurrency(currencyStr) {
        if (!currencyStr) return 'USD';
        const currency = currencyStr.toUpperCase();
        const currencyMap = {
            '$': 'USD',
            '€': 'EUR',
            '₽': 'RUB',
            'RUB': 'RUB',
            'USD': 'USD',
            'EUR': 'EUR'
        };
        return currencyMap[currency] || 'USD';
    }

    // Базовый поиск (переопределяется в наследниках)
    async search(query) {
        throw new Error(`Search method not implemented for ${this.name}`);
    }

    // Базовое получение товара (переопределяется в наследниках)
    async getProduct(url) {
        throw new Error(`GetProduct method not implemented for ${this.name}`);
    }
}
