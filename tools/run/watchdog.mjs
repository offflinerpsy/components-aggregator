#!/usr/bin/env node
import { spawn } from "node:child_process";

function parseArg(name, def) {
  const ix = process.argv.indexOf(`--${name}`);
  if (ix >= 0 && process.argv[ix+1]) return Number(process.argv[ix+1]);
  return def;
}
const idle = parseArg("idle", 20);        // сек без нового вывода
const timeout = parseArg("timeout", 180); // общая крышка
const sep = process.argv.indexOf("--");
if (sep < 0 || !process.argv[sep+1]) {
  console.error("Usage: node watchdog.mjs --idle 20 --timeout 180 -- cmd args...");
  process.exit(2);
}
const cmd = process.argv[sep+1];
const args = process.argv.slice(sep+2);

const child = spawn(cmd, args, { stdio: ["ignore","pipe","pipe"], shell: process.platform==="win32" });
let last = Date.now();
let done = false;
const successPatterns = [/press any key/i, /done/i, /completed/i, /all tests passed/i];

const timerTotal = setTimeout(() => {
  if (done) return;
  console.error("[watchdog] timeout, killing...");
  child.kill("SIGINT");
  setTimeout(()=>child.kill("SIGKILL"), 3000);
}, timeout*1000);

const timerIdle = setInterval(() => {
  if (done) return;
  if (Date.now() - last > idle*1000) {
    console.error("[watchdog] idle, killing...");
    child.kill("SIGINT");
    setTimeout(()=>child.kill("SIGKILL"), 3000);
  }
}, 1000);

function onData(buf) {
  const s = buf.toString();
  process.stdout.write(s);
  last = Date.now();
  if (successPatterns.some(rx=>rx.test(s))) {
    console.error("[watchdog] success pattern -> stopping");
    child.kill("SIGINT");
  }
}
child.stdout.on("data", onData);
child.stderr.on("data", onData);
child.on("exit", (code) => {
  done = true;
  clearTimeout(timerTotal);
  clearInterval(timerIdle);
  process.exit(code ?? 0);
});
