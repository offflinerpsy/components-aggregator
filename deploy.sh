#!/bin/bash

echo "🚀 Деплой Components Aggregator на сервер..."

# Копируем файлы на сервер
scp server.js root@89.104.69.77:/var/www/aggregator/
scp proxy.js root@89.104.69.77:/var/www/aggregator/
scp chipdip.js root@89.104.69.77:/var/www/aggregator/
scp db.js root@89.104.69.77:/var/www/aggregator/
scp template.js root@89.104.69.77:/var/www/aggregator/
scp package.json root@89.104.69.77:/var/www/aggregator/
scp -r public/ root@89.104.69.77:/var/www/aggregator/

# Подключаемся к серверу и обновляем
ssh root@89.104.69.77 << 'EOF'
cd /var/www/aggregator

# Останавливаем старые процессы
pkill -f "node server.js" || true
pkill -f "node proxy.js" || true

# Устанавливаем зависимости
npm install

# Запускаем прокси в фоне
nohup node proxy.js > proxy.log 2>&1 &

# Ждем немного
sleep 2

# Запускаем основной сервер
nohup node server.js > server.log 2>&1 &

echo "✅ Сервер запущен!"
echo "📱 Веб-интерфейс: http://89.104.69.77:3000"
echo "🔍 Логи сервера: tail -f /var/www/aggregator/server.log"
echo "🔍 Логи прокси: tail -f /var/www/aggregator/proxy.log"
EOF

echo "🎉 Деплой завершен!"
