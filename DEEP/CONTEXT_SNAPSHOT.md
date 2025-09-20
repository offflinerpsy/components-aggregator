# DEEP — Context Snapshot (v1)

## What we’re building
Components Aggregator: поиск и агрегация электронных компонентов.
Фронт: шаблоны поиска/карточки в loads/product_cart/**.
API: /api/search с фолбэк к парсерам и мокам.
Панель контроля: WardenLite (локально, FastAPI).

## Current state (TL;DR)
- Поиск/список: deep-search-results.html (локально и статикой на сервер).
- Моки: public/mock/search-<query>.json (UTF-8, только абсолютный /public/mock/... путь).
- Отчёты: eports/TASK_<ID>_YYYYMMDD_HHMMSS/ (+ HTML/PNG/JSON/MD).
- Статусная модель: pending → in-progress → ready → verified → pushed.
- Git-кнопки в панели: Add/Commit/Push/Pull (см. tooltips).
- Watchdog: автозакрытие «висящих» процессов/команд, правило CANCEL — включено в Global Rules.

## Rules (cursor/.cursorrules — выжимка)
- RU answers. Code changes → **unified diff only** (один fenced блок, ≤200 строк).
- Если код не нужен → ≤5 буллетов, ≤120 символов, без воды/извинений.
- Перед массовыми правками → список файлов-кандидатов (≤10) и короткий план.
- Paths of interest: /loads/product_cart/**, /parsers/**, /tasks/**, /reports/**.
- For long logs → хвост 150–300 строк + 3 шага фикса.
- Always UTF-8, no BOM issues; mock URL только абсолютный /public/mock/....

## WardenLite — как мы работаем
- Создать задачу → агент работает → складывает отчёты в eports/TASK_<ID>_.../ → ставит eady.
- Кнопка **Verify**: снимаем локальный/серверный скрин/HTML, проверяем DoD → erified или locked.
- **Push** после erified (или вручную, если надо срочно).
- В карточке задачи: ссылка на «главный отчёт», признаки pushed/sha.

## DoD (фронт)
- Локально: страница с q=транзистор выводит ≥2 строки (2N3904, BC547).
- Сервер: та же страница показывает те же строки (PNG/HTML приложены).
- Отчёты на месте и связаны ссылками.
- При недоступном API — фолбэк на моки, UI не ломается.

## Servers & checks
- Prod URL (пример): http://89.104.69.77/loads/product_cart/deep-search-results.html?q=транзистор
- Если 404/charset проблемы — приложить headers+HTML в отчёт.
- Nginx не правим без OPS-ALLOW. Патчи готовим отдельно, документируем.

## Next
- Восстановить карточку товара, довести Verify-автоматизацию (headless), навести прозрачный UI с подсказками.
- Держать контекст коротким: каждый чат — одна фича, ссылаться на этот файл при старте.

