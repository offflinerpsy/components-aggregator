# Скрипт запуска серверов
Write-Host "🚀 Запуск серверов components-aggregator..."

# Устанавливаем переменные окружения
$env:PORT = "3000"
$env:PROXY_PORT = "8002"

# Запускаем прокси-сервер
Write-Host "📡 Запуск прокси-сервера на порту 8002..."
Start-Process -FilePath "node" -ArgumentList "proxy.js" -WindowStyle Hidden

# Ждем 3 секунды
Start-Sleep -Seconds 3

# Запускаем основной сервер
Write-Host "🌐 Запуск основного сервера на порту 3000..."
Start-Process -FilePath "node" -ArgumentList "server.js" -WindowStyle Hidden

# Ждем 5 секунд
Start-Sleep -Seconds 5

# Проверяем статус
Write-Host "✅ Проверка статуса серверов..."
$proxyStatus = try { Invoke-WebRequest -Uri "http://localhost:8002/proxy/search?q=test" -UseBasicParsing -TimeoutSec 10; "OK" } catch { "ERROR" }
$serverStatus = try { Invoke-WebRequest -Uri "http://localhost:3000/api/search?q=test" -UseBasicParsing -TimeoutSec 10; "OK" } catch { "ERROR" }

Write-Host "📊 Статус серверов:"
Write-Host "  Прокси (8002): $proxyStatus"
Write-Host "  Основной (3000): $serverStatus"

if ($proxyStatus -eq "OK" -and $serverStatus -eq "OK") {
    Write-Host "🎉 Все серверы запущены успешно!"
    Write-Host "🌐 Основной сервер: http://localhost:3000"
    Write-Host "📡 Прокси-сервер: http://localhost:8002"
    Write-Host "🔍 Тест поиска: http://localhost:3000/api/search?q=LM317"
} else {
    Write-Host "❌ Ошибка запуска серверов"
}
