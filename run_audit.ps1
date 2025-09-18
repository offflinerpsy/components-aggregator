# Скрипт запуска аудита
Write-Host "🔍 Запуск системы аудита..."

# Проверяем наличие файлов аудита
if (-not (Test-Path "audit/bot/runner.js")) {
    Write-Host "❌ Файлы аудита не найдены. Копируем из .git папки..."
    if (Test-Path "C:\Users\Makkaroshka\.git\audit\bot") {
        xcopy "C:\Users\Makkaroshka\.git\audit\bot" ".\audit\bot\" /E /I /Y
        Write-Host "✅ Файлы аудита скопированы"
    } else {
        Write-Host "❌ Исходные файлы аудита не найдены"
        exit 1
    }
}

# Запускаем аудит
Write-Host "🚀 Запуск аудита..."
try {
    $result = node audit/bot/runner.js
    Write-Host "✅ Аудит завершен:"
    Write-Host $result
    
    # Показываем последние результаты
    $logDir = Get-ChildItem "audit/logs" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($logDir) {
        $resultsFile = Join-Path $logDir.FullName "results.jsonl"
        if (Test-Path $resultsFile) {
            Write-Host "📊 Результаты аудита:"
            Get-Content $resultsFile | ForEach-Object {
                $json = $_ | ConvertFrom-Json
                Write-Host "  $($json.url): $($json.status) - $($json.error)"
            }
        }
    }
} catch {
    Write-Host "❌ Ошибка запуска аудита: $_"
}
