# Главный скрипт автоматизации components-aggregator
param(
    [string]$Action = "all",
    [string]$ServerIP = "89.104.69.77"
)

Write-Host "🤖 Автоматизация components-aggregator"
Write-Host "Действие: $Action"
Write-Host "Сервер: $ServerIP"
Write-Host ""

switch ($Action) {
    "start" {
        Write-Host "🚀 Запуск локальных серверов..."
        .\start_servers.ps1
    }
    
    "update" {
        Write-Host "🔄 Обновление удаленного сервера..."
        .\update_remote_server.ps1 -ServerIP $ServerIP
    }
    
    "audit" {
        Write-Host "🔍 Запуск аудита..."
        .\run_audit.ps1
    }
    
    "test" {
        Write-Host "🧪 Тестирование API..."
        Write-Host "Тест прокси-сервера..."
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8002/proxy/search?q=LM317" -UseBasicParsing -TimeoutSec 10
            Write-Host "✅ Прокси-сервер: OK (статус: $($response.StatusCode))"
        } catch {
            Write-Host "❌ Прокси-сервер: ERROR - $_"
        }
        
        Write-Host "Тест основного сервера..."
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/api/search?q=LM317" -UseBasicParsing -TimeoutSec 10
            Write-Host "✅ Основной сервер: OK (статус: $($response.StatusCode))"
        } catch {
            Write-Host "❌ Основной сервер: ERROR - $_"
        }
    }
    
    "all" {
        Write-Host "🔄 Полный цикл автоматизации..."
        Write-Host "1. Запуск локальных серверов..."
        .\start_servers.ps1
        Write-Host ""
        
        Write-Host "2. Обновление удаленного сервера..."
        .\update_remote_server.ps1 -ServerIP $ServerIP
        Write-Host ""
        
        Write-Host "3. Запуск аудита..."
        .\run_audit.ps1
        Write-Host ""
        
        Write-Host "4. Тестирование..."
        .\automation.ps1 -Action "test"
    }
    
    default {
        Write-Host "❌ Неизвестное действие: $Action"
        Write-Host "Доступные действия:"
        Write-Host "  start  - Запуск локальных серверов"
        Write-Host "  update - Обновление удаленного сервера"
        Write-Host "  audit  - Запуск аудита"
        Write-Host "  test   - Тестирование API"
        Write-Host "  all    - Полный цикл автоматизации"
    }
}

Write-Host ""
Write-Host "✅ Автоматизация завершена"
