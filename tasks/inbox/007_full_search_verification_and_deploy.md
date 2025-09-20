# Цель
Авто-проверка страницы выдачи поиска через БРАУЗЕР локально и на сервере, + API-проверка, + деплой статики. Повторять до зелёного результата. Сформировать отчёты.

## Входные данные
Репо: components-aggregator  
Страница: /loads/product_cart/deep-search-results.html  
Моки: /public/mock/search-<query>.json (и URL-encoded вариант имени)  
Сервер: host 89.104.69.77, user root, web-root /var/www/html (определи, если другой)

## Ограничения
Работать только: loads/product_cart/**, public/mock/**, reports/**, tasks/**.  
OPS (nginx/proxy/strapi) — запрещено.  
После каждого запуска — сам останавливай локальные процессы.

## План (сначала покажи, потом жди "Подтверждаю")
1) Подготовка:
   - Если нет Node 18+ — установить.
   - Установить Playwright Chromium: `npm i -D playwright && npx playwright install chromium`
   - Создать/обновить моки:
     - `public/mock/search-транзистор.json` (2N3904, BC547, UTF-8)
     - дубликат с URL-encoded именем файла:
       `public/mock/search-%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B8%D1%81%D1%82%D0%BE%D1%80.json`
   - Проверить, что deep-search-results.html корректно подхватывает моки (если API недоступно).

2) Локальная проверка в БРАУЗЕРЕ:
   - Поднять `py -m http.server 8080 -d .` (или node http-server) с watchdog.
   - Playwright: открыть `http://127.0.0.1:8080/loads/product_cart/deep-search-results.html?q=транзистор`,
     дождаться таблицы, проверить, что видно 2+ строки, сохранить:
       - `reports/local_search_results.html` (innerHTML контейнера)
       - `reports/local_search_results.png` (скрин)
   - Остановить локальный сервер.

3) API-проверка:
   - Если доступно /api/search — сделать `GET` для q=транзистор и сохранить в `reports/api_транзистор.json`.
   - Если нет — отметить в отчёте «API недоступно, используется MOCK».

4) Деплой статики:
   - Выгрузить статику на сервер (scp/rsync):
     - `loads/product_cart/**` → `${web-root}/loads/product_cart/`
     - `public/mock/**`      → `${web-root}/public/mock/`
   - Определи `${web-root}` если он иной, зафиксируй в отчёте.

5) Серверная проверка в БРАУЗЕРЕ:
   - Playwright: открыть `http://89.104.69.77/loads/product_cart/deep-search-results.html?q=транзистор`,
     дождаться данных, сохранить:
       - `reports/server_search_results.html`
       - `reports/server_search_results.png`

6) Повтор до зелени:
   - Если пусто/ошибка — выясни причину (не тот путь моков, кодировка, URL-encoding, неверный web-root),
     исправь, повтори шаги 2–5 до получения 2+ строк и одинакового результата локально и на сервере.

7) Отчёт и маркер:
   - `reports/DEPLOY_CHECKLIST_YYYYMMDD.md`: web-root, команды, ссылки, результат (OK/Issues).
   - Создай `tasks/outbox/007_full_search_verification_and_deploy.done` — 1-я строка: путь к отчёту.
   - Коммит и push: `deploy: search results + mocks + reports (YYYYMMDD)`.

## Критерии готовности (DoD)
- Локально и на сервере страница с `q=транзистор` показывает 2+ строк (минимум 2N3904, BC547).
- Есть 4 файла: `local_*.html/.png`, `server_*.html/.png`.
- Есть `api_транзистор.json` (или объяснение «API недоступно»).
- Есть чек-лист с командами и web-root.
- Есть `.done`-маркер для задачи.
