Write-Host "🔄 Перезапуск серверов..."

# Остановка процессов на портах
$ports = @(8000, 8001, 8002)
foreach ($port in $ports) {
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
    if ($process) {
        Write-Host "📍 Освобождаем порт $port"
        Stop-Process -Id $process -Force
    }
}

# Очистка кэша
if (Test-Path "cache.db") {
    Write-Host "🗑️ Удаляем старый кэш"
    Remove-Item "cache.db" -Force
}

# Запуск основного сервера
Write-Host "🚀 Запуск основного сервера..."
Start-Process powershell -ArgumentList "-NoProfile -Command `"node server.js`"" -WindowStyle Hidden

# Запуск прокси-сервера
Write-Host "🚀 Запуск прокси-сервера..."
Start-Process powershell -ArgumentList "-NoProfile -Command `"node proxy.js`"" -WindowStyle Hidden

Write-Host "✅ Серверы перезапущены"
Write-Host "📡 Основной сервер: http://localhost:8000"
Write-Host "📡 Прокси-сервер: http://localhost:8002"