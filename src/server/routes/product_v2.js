import express from "express";
import { fetchText } from "../lib/http.js";
import { logJsonl } from "../lib/log.js";
import * as cheerio from "cheerio";

const router = express.Router();
const PROXY_BASE = process.env.PROXY_BASE || "http://localhost:8002";
const CACHE = new Map();
const TTL_MS = 24*3600*1000;

const getCache = k => {
  const r=CACHE.get(k);
  if(!r) return null;
  if(Date.now()-r.ts>TTL_MS){ CACHE.delete(k); return null; }
  return r.value;
};
const setCache = (k,v)=> CACHE.set(k,{ts:Date.now(),value:v});

router.get("/", async (req,res)=>{
  const src = String(req.query.url||"").trim();
  if(!src) return res.status(400).json({ error:"url required" });
  const key = `product:${src}`;
  const cached = getCache(key);
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
    return res.json(out); // частичный, но валидный
  }
});

export default router;
