# 004_search_api_wire_mock — связка фронта с /api/search (без OPS)

Goal
Сделать аккуратную обвязку фронта к API. Если API недоступно — мок с тем же контрактом.

Paths (edit-only)
loads/product_cart/assets/search-client.js (новый)
public/mock/search-*.json, public/mock/product-*.json (по необходимости)
reports/**

Spec
- export async function search({ q, page=1, pageSize=20 }): возвращает { items, total, page, pageSize }.
- Порядок:
  1) Пытаемся fetch('/api/search?...').
  2) Если 4xx/5xx/нет ответа → читаем mock (если есть), либо отдаём {items:[], total:0,...} с пометкой в консоли и пишем блокеры.

Deliverables
- loads/product_cart/assets/search-client.js
- reports/API_WIRE_STATUS_<date>.md — где получилось, где нет.
- reports/API_BLOCKERS_<date>.md — конкретные причины (CORS, 404 и т.п.).

Acceptance
- Страница списка и карточка используют единую обвязку.
- При падении API UI не ломается; мягкий fallback.
