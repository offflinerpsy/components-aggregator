ID: 008
Title: Деплой и проверка результатов поиска на сервере (с мок-фолбэком)

Цель
- Страница `loads/product_cart/deep-search-results.html?q=транзистор` должна открываться на сервере и показывать ≥2 строки (2N3904, BC547).
- Если API недоступно — работает мок-фолбэк (данные из public/mock/**).

Шаги (СНАЧАЛА ПЛАН, жди «Подтверждаю»)
1) Выявить web-root (read-only):
   - `nginx -T | grep -i " root "` (или чтение /etc/nginx/sites-available/*)
   - Зафиксировать путь в отчёте (без правок конфигов).
2) Сформировать набор статики для деплоя:
   - loads/product_cart/deep-search-results.html
   - public/mock/* (только нужные json)
   - все зависимости страницы (если есть).
3) Деплой статики (scp/rsync; спроси логин, если не задан):
   - `<webroot>/loads/product_cart/`
   - `<webroot>/public/mock/`
   (создать директории при необходимости)
4) Серверная проверка:
   - URL: `http://89.104.69.77/loads/product_cart/deep-search-results.html?q=транзистор`
   - headless-браузер: сохранить HTML-снимок и скрин (ожидаем 2 строки 2N3904, BC547)
5) Если 403/404/не видно статику:
   - `reports/TASK_008_.../server_nginx_issue.md` — симптомы + вывод `nginx -T`
   - предложить патч `ops/nginx/loads-static.conf.patch` (location /loads/), НЕ применять, запросить `OPS-ALLOW`.
6) Сложить все артефакты в `reports/TASK_008_<timestamp>/`:
   - `server_search_results.html`, `server_search_results.png`
   - `api_транзистор.json` (если дергали API)
   - `DEPLOY_CHECKLIST.md` (команды, web-root, публичный URL, итог)
7) Коммит/пуш через Warden-Lite.

DoD
- ✅ Публичный URL открывается и показывает ≥2 строки (или)
- ❌ Блокер описан `server_nginx_issue.md` + предложен патч (без применения)
- Все артефакты — в `reports/TASK_008_<timestamp>/`
