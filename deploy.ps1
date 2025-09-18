Write-Host "🚀 Деплой Components Aggregator на сервер..." -ForegroundColor Green

# Копируем файлы на сервер
Write-Host "📤 Копируем файлы..." -ForegroundColor Yellow
scp server.js root@89.104.69.77:/var/www/aggregator/
scp proxy.js root@89.104.69.77:/var/www/aggregator/
scp chipdip.js root@89.104.69.77:/var/www/aggregator/
scp db.js root@89.104.69.77:/var/www/aggregator/
scp template.js root@89.104.69.77:/var/www/aggregator/
scp package.json root@89.104.69.77:/var/www/aggregator/
scp -r public/ root@89.104.69.77:/var/www/aggregator/

Write-Host "🔄 Перезапускаем сервисы на сервере..." -ForegroundColor Yellow

# Команды для выполнения на сервере
$commands = @"
cd /var/www/aggregator
pkill -f "node server.js" || true
pkill -f "node proxy.js" || true
npm install
nohup node proxy.js > proxy.log 2>&1 &
sleep 2
nohup node server.js > server.log 2>&1 &
echo "✅ Сервер запущен!"
"@

# Выполняем команды на сервере
ssh root@89.104.69.77 $commands

Write-Host "🎉 Деплой завершен!" -ForegroundColor Green
Write-Host "📱 Веб-интерфейс: http://89.104.69.77:3000" -ForegroundColor Cyan
Write-Host "🔍 Проверка логов: ssh root@89.104.69.77 'tail -f /var/www/aggregator/server.log'" -ForegroundColor Gray
