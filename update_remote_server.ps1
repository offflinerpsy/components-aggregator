# Скрипт обновления удаленного сервера
param(
    [string]$ServerIP = "89.104.69.77",
    [string]$User = "root"
)

Write-Host "🔄 Обновление сервера $ServerIP..."

# Команды для выполнения на сервере
$commands = @(
    "cd /root/components-aggregator",
    "git pull",
    "npm install",
    "pkill -f 'node server.js' || true",
    "pkill -f 'node proxy.js' || true",
    "PORT=3000 nohup node server.js > server.log 2>&1 &",
    "PROXY_PORT=8002 nohup node proxy.js > proxy.log 2>&1 &",
    "sleep 5",
    "echo 'Серверы обновлены и запущены'"
)

# Объединяем команды в одну строку
$commandString = $commands -join " && "

Write-Host "📤 Выполнение команд на сервере..."
try {
    $result = ssh $User@$ServerIP $commandString
    Write-Host "✅ Команды выполнены успешно"
    Write-Host $result
} catch {
    Write-Host "❌ Ошибка выполнения команд: $_"
}

# Проверяем доступность серверов
Write-Host "🔍 Проверка доступности серверов..."
$proxyStatus = try { 
    $response = Invoke-WebRequest -Uri "http://$ServerIP`:8002/proxy/search?q=test" -UseBasicParsing -TimeoutSec 10
    "OK (статус: $($response.StatusCode))"
} catch { 
    "ERROR: $_" 
}

$serverStatus = try { 
    $response = Invoke-WebRequest -Uri "http://$ServerIP`:3000/api/search?q=test" -UseBasicParsing -TimeoutSec 10
    "OK (статус: $($response.StatusCode))"
} catch { 
    "ERROR: $_" 
}

Write-Host "📊 Статус серверов на $ServerIP`:"
Write-Host "  Прокси (8002): $proxyStatus"
Write-Host "  Основной (3000): $serverStatus"

if ($proxyStatus -like "OK*" -and $serverStatus -like "OK*") {
    Write-Host "🎉 Серверы обновлены и работают!"
} else {
    Write-Host "⚠️ Проблемы с доступностью серверов"
}
