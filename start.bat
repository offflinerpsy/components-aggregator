@echo off
echo 🚀 Запуск Components Aggregator...

echo 🧹 Очистка процессов...
taskkill /F /IM node.exe >nul 2>&1

echo 📦 Запуск прокси-сервера...
start "Proxy Server" /MIN cmd /k "node proxy.js"

echo ⏳ Ждем 3 секунды...
timeout /t 3 >nul

echo 🌐 Запуск основного сервера...
start "Main Server" /MIN cmd /k "node server.js"

echo ⏳ Ждем 3 секунды...
timeout /t 3 >nul

echo ✅ Серверы запущены!
echo 📡 Прокси-сервер: http://localhost:8002
echo 📡 Основной сервер: http://localhost:8080
echo 🌐 Веб-интерфейс: http://localhost:8080

echo 🧪 Тестирование поиска...
curl -s "http://localhost:8002/proxy/search?q=LDD-350L" | findstr "LDD-350L" >nul
if %errorlevel%==0 (
    echo ✅ Прокси работает!
) else (
    echo ❌ Прокси не работает!
)

echo.
echo Нажмите любую клавишу для открытия браузера...
pause >nul
start http://localhost:8080
