# Быстрый старт

## 1. Подготовка окружения
```bash
# Клонировать проект
git clone <repository_url>
cd aggregator_project

# Установить зависимости
npm install
```

## 2. Настройка сервера
```bash
# Подключение к серверу
ssh root@89.104.69.77

# Создание директорий
mkdir -p /var/www/aggregator/src/parsers
mkdir -p /var/www/aggregator/public/templates
```

## 3. Запуск локального прокси
```bash
# В локальной консоли
node proxy.js
```

## 4. Запуск сервера
```bash
# На сервере
cd /var/www/aggregator
node server.js
```

## 5. Проверка работоспособности
```bash
# Тест поиска
curl "http://localhost:3000/api/search?q=LDB-500L"

# Тест карточки товара
curl "http://localhost:3000/api/product?url=https://www.chipdip.ru/product/ldb-500l-dc-led-driver-16vt-vh-9-36v-vyh-2-32v-mean-well-9000523602"
```

## Основные файлы
- `proxy.js` - локальный прокси для обхода ограничений
- `server.js` - основной API сервер
- `src/parsers/chipdip.js` - парсер ChipDip.ru
- `public/templates/product.html` - шаблон карточки товара

## Важные заметки
1. Всегда запускайте локальный прокси перед работой с парсером
2. Используйте SSH-ключ для доступа к серверу
3. Проверяйте логи сервера при отладке
