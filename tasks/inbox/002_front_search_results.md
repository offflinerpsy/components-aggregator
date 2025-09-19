# 002_front_search_results — выдача поиска (без серверных правок)

Goal
Сверстать и подключить страницу списка результатов под DEEP (Tailwind, резина, RU-колонки).

Paths (edit-only)
loads/product_cart/deep-search-results.html
loads/product_cart/assets/** (если нужны утилиты)

API contract (read-only)
GET /api/search?q=<term>&page=<n>&pageSize=<n>
Response: { items: Product[], total: number, page: number, pageSize: number }
Product: {
  mpn: string
  description?: string
  availability?: { inStock?: boolean, lead?: string|number }
  pricing?: { qty: number, price: number, currency: string }[]
  package?: string
  packaging?: string
  url?: string
  suppliers?: { name: string, url?: string }[]
}

UI (требования)
- Таблица по центру контейнера, max-w-screen-lg, gap нормальный.
- Заголовки колонок на русском, с чёткими границами таблицы:
  Колонки: MPN, Наличие, Цена, Описание, Корпус, Упаковка.
- **Цена**: нормальный текст (пример: `от 0.12 USD / 100 шт`), не кнопки.
- Подсветка терма (из ?q=...) только точных вхождений слова; спецсимволы экранировать.
- “Показать ещё”: если (page * pageSize < total) — показываем кнопку, по клику грузим page+1 и доклеиваем строки, пока не выработаем total.
- Адаптив: на <640px скрывать менее важные колонки (например Корпус/Упаковка), но не MPN/Цена.
- Без левых секций: без сайдбара, без Related, без Select All/Select и т.п.

Data source
- Сначала пробуем /api/search.
- Если недоступно: подгрузить mock из public/mock/search-<term>.json (создать public/mock/ при необходимости) и зафиксировать это в отчёте.

Deliverables
- Обновлённый loads/product_cart/deep-search-results.html
- reports/RESULTS_UI_CHECKLIST_<date>.md — чек-лист что сделано/что скрыли на мобиле, какой fallback источника данных.
- reports/API_BLOCKERS_<date>.md — если API не отвечает, список наблюдений (URL запроса, коды, CORS и т.д.)
- Скриншот (если возможно) в reports/screens/ (обычный printscreen ок).

Constraints
- Никаких серверных правок. OPS-ALLOW отсутствует.

Acceptance
- Заголовки русские, таблица с границами видима, центрирование корректное.
- “Показать ещё” работает и исчезает, когда данных больше нет.
- Подсветка корректно экранирует `[]()+*?.\|{}^$-` и подсвечивает только искомое слово.
- На мобиле таблица читабельна (MPN/Цена не скрыты).
