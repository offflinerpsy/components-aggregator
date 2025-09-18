const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class PDFCache {
    constructor() {
        this.cacheDir = path.join(__dirname, 'public', 'cache', 'pdf');
        this.init();
    }

    async init() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            console.log('✅ PDF кэш инициализирован');
        } catch (error) {
            console.error('❌ Ошибка инициализации PDF кэша:', error);
        }
    }

    generateFileName(url) {
        const hash = crypto.createHash('md5').update(url).digest('hex');
        return `${hash}.pdf`;
    }

    async downloadPDF(url) {
        const fileName = this.generateFileName(url);
        const filePath = path.join(this.cacheDir, fileName);

        try {
            // Проверяем кэш
            try {
                await fs.access(filePath);
                console.log(`📄 PDF найден в кэше: ${fileName}`);
                return `/cache/pdf/${fileName}`;
            } catch {
                // Файла нет в кэше
            }

            // Скачиваем PDF
            console.log(`📥 Скачиваем PDF: ${url}`);
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'arraybuffer'
            });

            // Сохраняем в кэш
            await fs.writeFile(filePath, response.data);
            console.log(`💾 PDF сохранен в кэш: ${fileName}`);

            return `/cache/pdf/${fileName}`;
        } catch (error) {
            console.error(`❌ Ошибка загрузки PDF ${url}:`, error);
            throw error;
        }
    }
}

module.exports = new PDFCache();
