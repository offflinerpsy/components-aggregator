cat > HANDOVER.md <<'MD'
# HANDOVER / CONTROL
ANCHOR: WARDEN+OPENHANDS

- Workdir: /workspace
- Read first: ONE-README-FOR-CURSOR.md, PROJECT_STATUS.md
- Allowed to edit: /workspace/loads/product_cart/**, /workspace/parsers/**, /workspace/tasks/**
- OPS (nginx, proxy, strapi) — FORBIDDEN без явного OPS-ALLOW.
- Current focus: search_fallback → /api/search + канон Product + вывод в шаблоны.
- Front: /loads/product_cart/deep-search-results.html, /loads/product_cart/deep-product-template.html.
MD

git add HANDOVER.md
git commit -m "docs: handover anchor for OpenHands sessions"
git push
