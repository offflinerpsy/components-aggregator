import Handlebars from 'handlebars';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TemplateEngine {
    constructor() {
        this.templates = {};
        this.registerHelpers();
    }

    registerHelpers() {
        // Хелпер для отображения рейтинга в виде звезд
        Handlebars.registerHelper('times', function(n, options) {
            let accum = '';
            for(let i = 0; i < Math.floor(n); ++i) {
                accum += options.fn(i);
            }
            return accum;
        });

        // Хелпер для форматирования цены
        Handlebars.registerHelper('formatPrice', function(price) {
            if (!price || !price.value) return price?.display || 'Цена по запросу';
            return new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'RUB',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(price.value);
        });

        // Хелпер для форматирования даты
        Handlebars.registerHelper('formatDate', function(date) {
            if (!date) return '';
            return new Date(date).toLocaleString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        });
    }

    async loadTemplate(name) {
        if (this.templates[name]) {
            return this.templates[name];
        }

        const templatePath = path.join(__dirname, 'public', 'templates', `${name}.html`);
        try {
            const templateContent = await fs.readFile(templatePath, 'utf-8');
            this.templates[name] = Handlebars.compile(templateContent);
            return this.templates[name];
        } catch (error) {
            console.error(`Ошибка загрузки шаблона ${name}:`, error.message);
            throw error;
        }
    }

    async render(name, data) {
        try {
            const template = await this.loadTemplate(name);
            return template(data);
        } catch (error) {
            console.error(`Ошибка рендеринга шаблона ${name}:`, error.message);
            throw error;
        }
    }
}

export default new TemplateEngine();
