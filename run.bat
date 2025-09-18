@echo off
title Components Aggregator Launcher
echo ========================================
echo    Components Aggregator v1.0
echo ========================================
echo.

echo [1/4] Очистка старых процессов...
taskkill /F /IM node.exe >nul 2>&1

echo [2/4] Запуск прокси-сервера (порт 8002)...
start "Proxy Server - ChipDip" cmd /k "echo Прокси-сервер запущен && node proxy.js"

echo [3/4] Ожидание запуска прокси (5 сек)...
timeout /t 5 /nobreak >nul

echo [4/4] Запуск основного сервера (порт 8080)...
start "Main Server - Components Aggregator" cmd /k "echo Основной сервер запущен && node server.js"

echo.
echo ========================================
echo     Система запущена успешно!
echo ========================================
echo  Прокси:     http://localhost:8002
echo  Веб-сайт:   http://localhost:8080
echo ========================================
echo.

timeout /t 3 /nobreak >nul
echo Открываю браузер...
start http://localhost:8080

echo.
echo Нажмите любую клавишу для выхода...
pause >nul
