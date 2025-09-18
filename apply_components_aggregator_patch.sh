#!/usr/bin/env bash
set -euo pipefail

echo "==> Components Aggregator: safe installer (product_v2 + http client + smoke + logs)"

# 0) Sanity
ROOT="$(pwd)"
ts() { date +"%Y-%m-%d %H:%M:%S"; }

# 1) Git branch (optional, safe)
if command -v git >/dev/null 2>&1; then
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 && {
    BR="feat/product_v2_$(date +%Y%m%d_%H%M%S)"
    echo "[INFO] Creating branch $BR"
    git checkout -b "$BR" || true
  } || echo "[WARN] Not a git repo; proceeding without branch"
else
  echo "[WARN] git not found; proceeding without branch"
fi

# 2) Create folders
mkdir -p src/server/routes src/server/lib public/js audit/bot .github/workflows scripts

# 3) Do not clobber: helper to write a file if not exists; otherwise make .bak once
writenew() {
  local path="$1"; shift
  if [ -e "$path" ]; then
    if [ ! -e "${path}.bak" ]; then cp -a "$path" "${path}.bak"; echo "[BACKUP] ${path}.bak"; fi
  fi
  cat > "$path" <<'EOF'
$CONTENT$
EOF
  echo "[WRITE] $path"
}

# 4) Files content (here-docs via env substitution)
# 4.1 http.js
CONTENT=$(cat <<'JS'
// src/server/lib/http.js
import { Agent, request } from 'undici';

const agent = new Agent({ keepAlive: true, keepAliveTimeout: 30_000, keepAliveMaxTimeout: 60_000, pipelining: 1 });

export async function fetchText(url, { headers = {}, timeout = 10_000, retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const started = Date.now();
    try {
      const res = await request(url, { headers, dispatcher: agent, maxRedirections: 3, bodyTimeout: timeout, headersTimeout: timeout });
      const text = await res.body.text();
      return { status: res.statusCode, text, dur: Date.now() - started };
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastErr;
}
JS
)
CONTENT="${CONTENT}"
writenew "src/server/lib/http.js"

# 4.2 log.js
CONTENT=$(cat <<'JS'
// src/server/lib/log.js
import fs from 'fs';
import path from 'path';

export function logJsonl(filePath, row) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n';
  fs.appendFile(filePath, line, () => {});
}
JS
)
CONTENT="${CONTENT}"
writenew "src/server/lib/log.js"

# 4.3 product_v2.js
CONTENT=$(cat <<'JS'
// src/server/routes/product_v2.js
// Express router that fetches a product page via upstream proxy, parses partial data, returns safe JSON.
import express from 'express';
import { fetchText } from '../lib/http.js';
import { logJsonl } from '../lib/log.js';
import cheerio from 'cheerio';

const router = express.Router();
const PROXY_BASE = process.env.PROXY_BASE || 'http://localhost:8002';

// In-memory cache (TTL)
const CACHE = new Map();
const TTL_MS = 24 * 3600 * 1000;

function getCache(key) {
  const rec = CACHE.get(key);
  if (!rec) return null;
  if (Date.now() - rec.ts > TTL_MS) { CACHE.delete(key); return null; }
  return rec.value;
}
function setCache(key, value) { CACHE.set(key, { ts: Date.now(), value }); }

router.get('/', async (req, res) => {
  const src = String(req.query.url || '').trim();
  if (!src) return res.status(400).json({ error: 'url required' });
  const key = `product:${src}`;
  const cached = getCache(key);
  if (cached) return res.json({ source: 'cache', ...cached });

  const out = { source: 'live', url: src, title: null, mpn: null, manufacturer: null, images: [], datasheets: [], specs: {} };
  const logFile = 'audit/logs/app.jsonl';
  const upstream = src.startsWith('http') ? src : PROXY_BASE + src;

  try {
    const r = await fetchText(upstream, { timeout: 10_000, retries: 3 });
    const html = r.text;
    const $ = cheerio.load(html);

    out.title = $('h1, .product-title').first().text().trim() || $('title').first().text().trim() || null;
    out.mpn = $('[itemprop="mpn"]').attr('content') || $('.mpn').first().text().trim() || null;
    out.manufacturer = $('[itemprop="brand"]').attr('content') || $('.brand a').first().text().trim() || null;

    $('img').each((_, el) => { const u = $(el).attr('src'); if (u) out.images.push(u); });
    $('a[href$=".pdf"]').each((_, el) => { const u = $(el).attr('href'); if (u) out.datasheets.push(u); });

    $('tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length >= 2) {
        const k = $(tds[0]).text().trim().toLowerCase();
        const v = $(tds[1]).text().trim();
        if (k && v && !out.specs[k]) out.specs[k] = v;
      }
    });

    setCache(key, out);
    logJsonl(logFile, { scope: 'product_v2', url: src, upstream, status: r.status, images: out.images.length, pdfs: out.datasheets.length });
    return res.json(out);
  } catch (e) {
    logJsonl(logFile, { scope: 'product_v2', url: src, error: String(e) });
    return res.json(out); // safe partial
  }
});

export default router;
JS
)
CONTENT="${CONTENT}"
writenew "src/server/routes/product_v2.js"

# 4.4 gallery.js
CONTENT=$(cat <<'JS'
// public/js/gallery.js
// Minimal slider without dependencies. Expects window.PRODUCT.images array.
(function(){
  const root = document.getElementById('gallery');
  if (!root) return;
  const imgEl = root.querySelector('#gimg');
  const prev = root.querySelector('#prev');
  const next = root.querySelector('#next');
  const imgs = (window.PRODUCT && Array.isArray(window.PRODUCT.images)) ? window.PRODUCT.images : [];
  let i = 0;
  function render(){ imgEl.src = imgs[i] || (imgEl.dataset.placeholder || '/placeholder.png'); }
  if (prev) prev.addEventListener('click', ()=>{ if (!imgs.length) return; i=(i-1+imgs.length)%imgs.length; render(); });
  if (next) next.addEventListener('click', ()=>{ if (!imgs.length) return; i=(i+1)%imgs.length; render(); });
  render();
})();
JS
)
CONTENT="${CONTENT}"
writenew "public/js/gallery.js"

# 4.5 rules-extra.json
CONTENT=$(cat <<'JSON'
{
  "//": "Optional CSS selectors to improve extraction without changing parser code",
  "title": { "selector": "h1.product-title" },
  "mpn":   { "selector": "[data-mpn], .mpn", "attr": "data-mpn", "match": "([A-Za-z0-9._-]{3,})" },
  "manufacturer": { "selector": ".brand a" },
  "images": { "selector": ".gallery img, .product-images img", "attr": "src" },
  "datasheets": { "selector": "a[href$='.pdf']", "attr": "href", "endsWith": ".pdf" },
  "specs": {
    "корпус": { "selector": "tr:has(td:contains('Корпус')) td:nth-child(2)" },
    "полярность": { "selector": "tr:has(td:contains('Полярность')) td:nth-child(2)" }
  }
}
JSON
)
CONTENT="${CONTENT}"
writenew "audit/bot/rules-extra.json"

# 4.6 smoke.sh
CONTENT=$(cat <<'SH'
#!/usr/bin/env bash
set -euo pipefail
echo "[SMOKE] root: $(pwd)"
node -v || { echo "[ERR] node is required"; exit 1; }
test -d src || echo "[WARN] no src dir (ok)"
grep -R "product_v2" -n src/server/routes >/dev/null && echo "[OK] product_v2 route present"
if npm run | grep -q '^ *build'; then npm run build || echo "[WARN] build failed"; fi
echo "[SMOKE] done"
SH
)
CONTENT="${CONTENT}"
writenew "scripts/smoke.sh"
chmod +x scripts/smoke.sh

# 4.7 CI (optional)
if [ ! -f ".github/workflows/ci.yml" ]; then
  cat > .github/workflows/ci.yml <<'YML'
name: CI (smoke)
on:
  pull_request:
  push:
    branches: [ main ]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install deps (if package.json exists)
        run: |
          if [ -f package.json ]; then
            if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then npm ci; else npm i; fi
          else
            echo "no package.json"
          fi
      - name: Smoke
        run: bash scripts/smoke.sh
YML
  echo "[WRITE] .github/workflows/ci.yml"
fi

# 5) Dependencies
if [ -f package.json ]; then
  echo "[NPM] installing undici cheerio"
  npm i undici cheerio >/dev/null 2>&1 || npm i undici cheerio
else
  echo "[WARN] package.json not found; skip npm install"
fi

# 6) Try to auto-wire route into server.js/app.js
WIRE_OK=0
for CAND in server.js app.js src/server.js src/app.js backend/server.js; do
  if [ -f "$CAND" ]; then
    if ! grep -q "product_v2" "$CAND"; then
      echo "[INFO] Attempting to wire route into $CAND"
      cp -a "$CAND" "${CAND}.bak.$(date +%s)"
      if grep -q "from 'express'" "$CAND"; then
        awk '1; END{ print "import productV2 from '\''./src/server/routes/product_v2.js'\'';"; print "app && app.use && app.use('\''/api/product2'\'', productV2);" }' "$CAND" > "${CAND}.tmp" && mv "${CAND}.tmp" "$CAND" && WIRE_OK=1
      else
        printf "
const productV2 = require('./src/server/routes/product_v2.js');
if (app && app.use) { app.use('/api/product2', productV2); }
" >> "$CAND" && WIRE_OK=1
      fi
      echo "[OK] Wired product_v2 into $CAND (backup saved)"
      break
    else
      echo "[SKIP] $CAND already references product_v2"
      WIRE_OK=1
      break
    fi
  fi
done

if [ $WIRE_OK -eq 0 ]; then
  cat <<'MSG'
[TODO] Не нашёл server.js/app.js для авто-подключения.
Добавь вручную в основной сервер:
  // ESM
  import productV2 from './src/server/routes/product_v2.js';
  app.use('/api/product2', productV2);
или (CommonJS)
  const productV2 = require('./src/server/routes/product_v2.js');
  app.use('/api/product2', productV2);
MSG
fi

echo "[DONE] Installer finished."
echo "Next steps:"
echo "  1) npm start (или команда старта сервера)"
echo "  2) Открой: GET http://localhost:PORT/api/product2?url=/product/EXAMPLE"
echo "  3) Логи: audit/logs/app.jsonl"
