// audit/bot/runner.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const kv = {};
for (let i=0;i<args.length;i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const k = a.replace(/^--/,'').split('=')[0];
    const v = (args[i+1] && !args[i+1].startsWith('--')) ? args[i+1] : true;
    kv[k]=v;
  }
}
const MODE = String(kv.mode||'http'); // http | render
const OUTDIR = String(kv.out||path.join(__dirname,'..','logs','run-'+Date.now()));
const LIMIT = parseInt(String(kv.limit||'0'),10)||0;

const cfgPath = path.join(__dirname,'config.json');
const schemaPath = path.join(__dirname,'schema.json');
const extraRulesPath = path.join(__dirname,'rules-extra.json'); // <- NEW
if (!fs.existsSync(cfgPath)) {
  console.error(`[ERR] Missing config.json. Copy config.example.json to config.json and edit.`);
  process.exit(1);
}
const CFG = JSON.parse(fs.readFileSync(cfgPath,'utf8'));
const SCHEMA = JSON.parse(fs.readFileSync(schemaPath,'utf8'));
const EXTRA = fs.existsSync(extraRulesPath)
  ? JSON.parse(fs.readFileSync(extraRulesPath,'utf8'))
  : null;
fs.mkdirSync(OUTDIR, { recursive: true });

const q = [...CFG.SEEDS];
const seen = new Set();
let processed = 0;

const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

async function fetchHttp(url) {
  const { request } = await import('undici');
  const res = await request(url, { maxRedirections: 5 });
  const text = await res.body.text();
  return { status: res.statusCode, html: text };
}

async function fetchRendered(url) {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: CFG.HEADLESS !== false, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(CFG.TIMEOUT_MS || 20000);
  await page.goto(url, { waitUntil: 'networkidle2' });
  const html = await page.content();
  await browser.close();
  return { status: 200, html };
}

function extractFields(html) {
  const result = {
    mpn: null, title: null, manufacturer: null,
    image: null, images: [], datasheets: [], specs: {}
  };
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  result.title = t ? t[1].trim() : null;

  const img = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (img) { result.image = img[1]; }
  const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/ig)].map(m=>m[1]);
  result.images = imgs;

  const pdfs = [...html.matchAll(/<a[^>]+href=["']([^"']+\.pdf)["'][^>]*>/ig)].map(m=>m[1]);
  result.datasheets = pdfs;

  const metaMpn = html.match(/itemprop=["']mpn["'][^>]*content=["']([^"']+)["']/i) || html.match(/name=["']mpn["'][^>]*content=["']([^"']+)["']/i);
  if (metaMpn) result.mpn = metaMpn[1].trim();
  const lblMpn = html.match(/MPN[:\s]*([A-Z0-9\-\._]+)/i);
  if (!result.mpn && lblMpn) result.mpn = lblMpn[1];

  const manuf = html.match(/itemprop=["']brand["'][^>]*content=["']([^"']+)["']/i) || html.match(/Производител[ья][:\s]*<\/[^>]*>\s*([^<]{2,40})</i);
  if (manuf) result.manufacturer = manuf[1].trim();

  const specs = {};
  const specRows = [...html.matchAll(/<(li|tr)[^>]*>\s*([^<>{]{1,40})[:\s]*<\/?(td|span|b|strong)?[^>]*>\s*([^<>]{1,100})<\/(li|tr)>/ig)];
  for (const m of specRows.slice(0,80)) {
    const k = (m[2]||'').toLowerCase().trim();
    const v = (m[4]||'').trim();
    if (k && v && !specs[k]) specs[k] = v;
  }
  result.specs = specs;

  return result;
}

// NEW: apply extra CSS selector rules via cheerio (non-destructive merge)
async function applyExtraRules(html, data) {
  if (!EXTRA) return data;
  const cheerio = (await import('cheerio')).default;
  const $ = cheerio.load(html);

  const safeText = (x)=> (x||'').trim() || null;
  const mergeSet = (arr, val)=> {
    if (!val) return arr;
    const add = Array.isArray(val) ? val : [val];
    const s = new Set([...(arr||[]), ...add.filter(Boolean)]);
    return [...s];
  };

  // title / mpn / manufacturer
  if (EXTRA.title?.selector && !data.title) {
    const el = $(EXTRA.title.selector).first();
    const t = EXTRA.title.attr ? el.attr(EXTRA.title.attr) : el.text();
    data.title = safeText(t) || data.title;
  }
  if (EXTRA.mpn?.selector && !data.mpn) {
    const el = $(EXTRA.mpn.selector).first();
    let t = EXTRA.mpn.attr ? el.attr(EXTRA.mpn.attr) : el.text();
    t = safeText(t);
    if (t && EXTRA.mpn.match) {
      const m = new RegExp(EXTRA.mpn.match, 'i').exec(t);
      if (m && m[1]) t = m[1];
    }
    data.mpn = t || data.mpn;
  }
  if (EXTRA.manufacturer?.selector && !data.manufacturer) {
    const el = $(EXTRA.manufacturer.selector).first();
    const t = EXTRA.manufacturer.attr ? el.attr(EXTRA.manufacturer.attr) : el.text();
    data.manufacturer = safeText(t) || data.manufacturer;
  }

  // images
  if (EXTRA.images?.selector) {
    const list = [];
    $(EXTRA.images.selector).each((_, el)=>{
      const v = EXTRA.images.attr ? $(el).attr(EXTRA.images.attr) : $(el).text();
      const u = safeText(v);
      if (u) list.push(u);
    });
    data.images = mergeSet(data.images, list);
    if (!data.image && data.images.length) data.image = data.images[0];
  }

  // datasheets (pdf)
  if (EXTRA.datasheets?.selector) {
    const list = [];
    $(EXTRA.datasheets.selector).each((_, el)=>{
      const v = EXTRA.datasheets.attr ? $(el).attr(EXTRA.datasheets.attr) : $(el).text();
      const u = safeText(v);
      if (u && (!EXTRA.datasheets.endsWith || u.toLowerCase().endsWith(EXTRA.datasheets.endsWith))) {
        list.push(u);
      }
    });
    data.datasheets = mergeSet(data.datasheets, list);
  }

  // specs: { "Входное напряжение": { selector, attr? } , ... }
  if (EXTRA.specs && typeof EXTRA.specs === 'object') {
    for (const [key, rule] of Object.entries(EXTRA.specs)) {
      if (!rule?.selector) continue;
      const el = $(rule.selector).first();
      let v = rule.attr ? el.attr(rule.attr) : el.text();
      v = safeText(v);
      if (v && rule.match) {
        const m = new RegExp(rule.match, 'i').exec(v);
        if (m && m[1]) v = m[1];
      }
      if (v && !data.specs[key]) data.specs[key] = v;
    }
  }
  return data;
}

function validate(result, SCHEMA) {
  const errs = [];
  for (const k of SCHEMA.required_fields) {
    if (!result[k] || (Array.isArray(result[k]) && result[k].length===0)) errs.push(`missing:${k}`);
  }
  if (SCHEMA.pdf_required && (!result.datasheets || result.datasheets.length===0)) errs.push('missing:pdf');
  if ((SCHEMA.image_min||0)>0 && (!result.images || result.images.length < SCHEMA.image_min)) errs.push('missing:images');
  const have = Object.keys(result.specs||{});
  const needed = SCHEMA.spec_keys_min||[];
  const hit = needed.filter(k => have.some(h => h.includes(k)));
  if (hit.length < Math.min(3, needed.length)) errs.push('weak:specs');
  return errs;
}

async function main(){
  const base = CFG.BASE_URL.replace(/\/+$/,'');
  const outFile = path.join(OUTDIR, 'results.jsonl');
  const stream = fs.createWriteStream(outFile, { flags: 'a' });

  while (q.length) {
    if (LIMIT && processed >= LIMIT) break;
    const p = q.shift();
    const url = p.startsWith('http') ? p : base + p;
    if (seen.has(url)) continue;
    seen.add(url);

    let html = '', status = 0, mode = MODE;
    try {
      if (MODE === 'render') {
        ({ status, html } = await fetchRendered(url));
      } else {
        ({ status, html } = await fetchHttp(url));
        mode = 'http';
      }
      let data = extractFields(html);
      data = await applyExtraRules(html, data); // <- NEW
      const errs = validate(data, SCHEMA);
      const donor = CFG.DONOR_MAP && CFG.DONOR_MAP[p] ? CFG.DONOR_MAP[p] : null;
      const row = { ts:new Date().toISOString(), url, mode, status, data, errs, donor };
      stream.write(JSON.stringify(row) + "\n");
    } catch (e) {
      const row = { ts:new Date().toISOString(), url, mode, status, error: String(e && e.message || e) };
      stream.write(JSON.stringify(row) + "\n");
    } finally {
      processed++;
      await sleep(100);
    }
  }
  stream.end();
  console.log(`[DONE] Processed=${processed}, log=${outFile}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
