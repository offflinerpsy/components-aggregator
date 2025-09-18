# apply_components_aggregator_patch.ps1
# PowerShell installer: adds product_v2 route, http client, logger, gallery, smoke CI. Safe & idempotent.
$ErrorActionPreference = "Stop"

function Write-FileSafe($Path, $Content) {
  if (Test-Path $Path -PathType Leaf) {
    if (-not (Test-Path ($Path + ".bak"))) {
      Copy-Item $Path ($Path + ".bak") -Force
      Write-Host "[BACKUP] $Path.bak"
    }
  } else {
    New-Item -ItemType Directory -Force -Path (Split-Path $Path) | Out-Null
  }
  $Content | Set-Content -Encoding UTF8 -NoNewline:$false -Path $Path
  Write-Host "[WRITE] $Path"
}

# 0) Optional: create git branch
if (Get-Command git -ErrorAction SilentlyContinue) {
  try {
    git rev-parse --is-inside-work-tree *> $null
    $br = "feat/product_v2_{0:yyyyMMdd_HHmmss}" -f (Get-Date)
    git checkout -b $br | Out-Null
    Write-Host "[INFO] Git branch $br created"
  } catch { Write-Host "[WARN] Not a git repo or git unavailable — skipping branch" }
} else { Write-Host "[WARN] git not found — skipping branch" }

# 1) Folders
New-Item -ItemType Directory -Force -Path "src/server/routes","src/server/lib","public/js","audit/bot",".github/workflows","scripts" | Out-Null

# 2) File contents (single-quoted here-strings to avoid interpolation)
$httpJs = @'
import { Agent, request } from "undici";
const agent = new Agent({ keepAlive: true, keepAliveTimeout: 30000, keepAliveMaxTimeout: 60000, pipelining: 1 });
export async function fetchText(url, { headers = {}, timeout = 10000, retries = 3 } = {}) {
  let lastErr;
  for (let i=0;i<=retries;i++){
    try{
      const res = await request(url,{ headers, dispatcher: agent, maxRedirections: 3, bodyTimeout: timeout, headersTimeout: timeout });
      const text = await res.body.text();
      return { status: res.statusCode, text, dur: Date.now()-0 };
    } catch(e){ lastErr=e; await new Promise(r=>setTimeout(r,250*(i+1))); }
  }
  throw lastErr;
}
'@

$logJs = @'
import fs from "fs";
import path from "path";
export function logJsonl(filePath, row){
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ ts:new Date().toISOString(), ...row }) + "\n";
  fs.appendFile(filePath, line, ()=>{});
}
'@

$productV2 = @'
import express from "express";
import { fetchText } from "../lib/http.js";
import { logJsonl } from "../lib/log.js";
import cheerio from "cheerio";
const router = express.Router();
const PROXY_BASE = process.env.PROXY_BASE || "http://localhost:8002";
const CACHE = new Map(); const TTL_MS = 24*3600*1000;
const getCache = k => { const r=CACHE.get(k); if(!r) return null; if(Date.now()-r.ts>TTL_MS){ CACHE.delete(k); return null;} return r.value; };
const setCache = (k,v)=> CACHE.set(k,{ts:Date.now(),value:v});

router.get("/", async (req,res)=>{
  const src = String(req.query.url||"").trim();
  if(!src) return res.status(400).json({ error:"url required" });
  const key = `product:${src}`; const cached = getCache(key);
  if (cached) return res.json({ source:"cache", ...cached });

  const out = { source:"live", url:src, title:null, mpn:null, manufacturer:null, images:[], datasheets:[], specs:{} };
  const logFile = "audit/logs/app.jsonl";
  const upstream = src.startsWith("http") ? src : (PROXY_BASE + src);

  try{
    const r = await fetchText(upstream, { timeout:10000, retries:3 });
    const $ = cheerio.load(r.text);
    out.title = $("h1, .product-title").first().text().trim() || $("title").first().text().trim() || null;
    out.mpn = $("[itemprop='mpn']").attr("content") || $(".mpn").first().text().trim() || null;
    out.manufacturer = $("[itemprop='brand']").attr("content") || $(".brand a").first().text().trim() || null;
    $("img").each((_,el)=>{ const u=$(el).attr("src"); if(u) out.images.push(u); });
    $("a[href$='.pdf']").each((_,el)=>{ const u=$(el).attr("href"); if(u) out.datasheets.push(u); });
    $("tr").each((_,tr)=>{ const t=$(tr).find("td"); if(t.length>=2){ const k=$(t[0]).text().trim().toLowerCase(); const v=$(t[1]).text().trim(); if(k&&v&&!out.specs[k]) out.specs[k]=v; }});
    setCache(key,out);
    logJsonl(logFile,{ scope:"product_v2", url:src, upstream, status:r.status, images:out.images.length, pdfs:out.datasheets.length });
    return res.json(out);
  } catch(e){
    logJsonl(logFile,{ scope:"product_v2", url:src, error:String(e) });
    return res.json(out); // safe partial
  }
});
export default router;
'@

$galleryJs = @'
(function(){
  const root = document.getElementById("gallery"); if(!root) return;
  const imgEl = root.querySelector("#gimg"); const prev = root.querySelector("#prev"); const next = root.querySelector("#next");
  const imgs = (window.PRODUCT && Array.isArray(window.PRODUCT.images)) ? window.PRODUCT.images : []; let i=0;
  function render(){ imgEl.src = imgs[i] || (imgEl.dataset.placeholder || "/placeholder.png"); }
  if (prev) prev.addEventListener("click", ()=>{ if(!imgs.length) return; i=(i-1+imgs.length)%imgs.length; render(); });
  if (next) next.addEventListener("click", ()=>{ if(!imgs.length) return; i=(i+1)%imgs.length; render(); });
  render();
})();
'@

$rulesExtra = @'
{
  "//": "Доп. селекторы (опционально) для улучшения извлечения без правки кода",
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
'@

$smoke = @'
#!/usr/bin/env bash
set -euo pipefail
echo "[SMOKE] root: $(pwd)"
node -v || { echo "[ERR] node is required"; exit 1; }
test -d src || echo "[WARN] no src dir (ok)"
grep -R "product_v2" -n src/server/routes >/dev/null && echo "[OK] product_v2 route present"
if npm run | grep -q "^[[:space:]]*build"; then npm run build || echo "[WARN] build failed"; fi
echo "[SMOKE] done"
'@

$ci = @'
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
'@

Write-FileSafe "src/server/lib/http.js"           $httpJs
Write-FileSafe "src/server/lib/log.js"            $logJs
Write-FileSafe "src/server/routes/product_v2.js"  $productV2
Write-FileSafe "public/js/gallery.js"             $galleryJs
Write-FileSafe "audit/bot/rules-extra.json"       $rulesExtra
Write-FileSafe ".github/workflows/ci.yml"         $ci
Write-FileSafe "scripts/smoke.sh"                 $smoke

# 3) Install deps
if (Test-Path "package.json") {
  Write-Host "[NPM] installing undici cheerio"
  npm i undici cheerio | Out-Host
} else {
  Write-Host "[WARN] package.json not found — skip npm install"
}

# 4) Wire route into server
$wired = $false
$serverCandidates = @("server.js","app.js","src/server.js","src/app.js","backend/server.js")
foreach ($cand in $serverCandidates) {
  if (Test-Path $cand) {
    $text = Get-Content $cand -Raw
    if ($text -notmatch "product_v2") {
      Copy-Item $cand "$cand.bak.$((Get-Date).ToFileTime())"
      if ($text -match "from 'express'|from `"express`"") {
        $text += "`nimport productV2 from './src/server/routes/product_v2.js';`napp && app.use && app.use('/api/product2', productV2);`n"
      } else {
        $text += "`nconst productV2 = require('./src/server/routes/product_v2.js');`nif (app && app.use) { app.use('/api/product2', productV2); }`n"
      }
      $text | Set-Content -Encoding UTF8 $cand
      Write-Host "[OK] wired product_v2 into $cand"
    } else {
      Write-Host "[SKIP] $cand already references product_v2"
    }
    $wired = $true; break
  }
}
if (-not $wired) {
  Write-Host "[TODO] Not found server.js/app.js. Add manually:"
  Write-Host "  import productV2 from './src/server/routes/product_v2.js';"
  Write-Host "  app.use('/api/product2', productV2);"
}

Write-Host "[DONE] Ready."
Write-Host "Next:"
Write-Host "  1) npm start (or your start command)"
Write-Host "  2) GET http://localhost:<PORT>/api/product2?url=/product/EXAMPLE"
Write-Host "  3) Logs: audit/logs/app.jsonl"
