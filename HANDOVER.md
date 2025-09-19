# HANDOVER / CONTROL
ANCHOR: WARDEN+OPENHANDS

- Workdir: /workspace (локально монтируется C:\Users\Makkaroshka\Documents\GitHub\components-aggregator)
- Read first: ONE-README-FOR-CURSOR.md, PROJECT_STATUS.md
- Allowed to edit: /workspace/loads/product_cart/**, /workspace/parsers/**, /workspace/tasks/**
- OPS (nginx, proxy, strapi) — FORBIDDEN без явного OPS-ALLOW из Warden.
- Current focus: search_fallback → /api/search (ChipDip→fallback к парсерам) + канон Product + вывод в шаблоны.
- Front: /loads/product_cart/deep-search-results.html (список) и /loads/product_cart/deep-product-template.html (карточка).
