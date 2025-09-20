# -*- coding: ascii -*-
from fastapi import FastAPI, Form, Query
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse
from pathlib import Path
import subprocess, html, urllib.parse, os

ROOT  = Path(__file__).resolve().parents[2]   # repo root
TASKS = ROOT / "tasks"
INBOX = TASKS / "inbox"
OUTBX = TASKS / "outbox"
RULES = TASKS / "RULES.md"
for d in (TASKS, INBOX, OUTBX): d.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Warden-Lite")

def run_git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, shell=False)

def safe_path(rel: str) -> Path:
    p = (ROOT / rel).resolve()
    if ROOT not in p.parents and p != ROOT: 
        raise ValueError("path outside repo")
    return p

def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace")

def list_tasks():
    items = []
    done_map = {}
    for d in OUTBX.glob("*.done"):
        base = d.stem  # task id
        first = read_text(d).splitlines()[:1]
        done_map[base] = (d, (first[0] if first else "").strip())
    for p in sorted(INBOX.glob("*.md")):
        base = p.stem
        name = p.name
        is_done = base in done_map
        report = done_map.get(base, (None, ""))[1]
        link_rep = f"/view?path={urllib.parse.quote(report)}" if report else ""
        badge = f"<span class='badge-done'>done</span>" if is_done else "<span class='badge-todo'>todo</span>"
        rep_html = f" <a href='{link_rep}'>report</a>" if report else ""
        items.append(f"<li>{badge} <a href='/task?name={name}'>{html.escape(name)}</a>{rep_html} "
                     f"<a class='mini' href='/done/form?name={name}'>mark-done</a></li>")
    if not items:
        items.append("<li>no tasks</li>")
    return "\n".join(items)

def git_widget():
    status  = run_git("status","-sb").stdout.strip()
    branch  = run_git("rev-parse","--abbrev-ref","HEAD").stdout.strip()
    head    = run_git("rev-parse","--short","HEAD").stdout.strip()
    ahead = behind = ""
    # ahead/behind if tracking exists
    track = run_git("rev-parse","--abbrev-ref","--symbolic-full-name","@{u}")
    if track.returncode==0:
        lr = run_git("rev-list","--left-right","--count","@{u}...HEAD").stdout.strip().split()
        if len(lr)==2: behind, ahead = lr[0], lr[1]
    last = run_git("log","-1","--pretty=%h %ad %an %s","--date=iso").stdout.strip()
    changed = run_git("diff-tree","--no-commit-id","--name-status","-r","HEAD").stdout.strip()
    gh = os.getenv("GITHUB_URL","")  # optional link
    gh_html = f"<a href='{gh}' target='_blank'>GitHub</a> | " if gh else ""
    return f"""
    <div class='panel'>
      <div class='panel-title'>Git summary</div>
      <div class='mono'>{gh_html}branch: {html.escape(branch)} | HEAD: {html.escape(head)} | ahead:{html.escape(ahead)} behind:{html.escape(behind)}</div>
      <div class='mono'>last: {html.escape(last)}</div>
      <details><summary>status</summary><pre class='mono'>{html.escape(status)}</pre></details>
      <details><summary>HEAD files</summary><pre class='mono'>{html.escape(changed or "no changes")}</pre></details>
      <form method='post' action='/git/pull' style='display:inline'><button>git pull</button></form>
      <form method='post' action='/git/push' style='display:inline'><input name='message' value='warden: update tasks' /><button>git add/commit/push</button></form>
    </div>
    """

CSS = """
<style>
:root{
  --bg:#0e0f12; --card:#16181d; --text:#e8e9ec; --muted:#9aa4ad; --accent:#35a0ff; --ok:#22c55e; --warn:#f59e0b;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial}
a{color:var(--accent);text-decoration:none}
h1,h2,h3{margin:8px 0}
.container{max-width:1100px;margin:0 auto;padding:16px}
.card{background:var(--card);border-radius:10px;padding:16px;margin-bottom:12px;box-shadow:0 0 0 1px #20232b}
textarea,input{width:100%;background:#0b0c0f;color:var(--text);border:1px solid #2a2f39;border-radius:8px;padding:10px}
button{background:#1f6feb;border:none;color:#fff;padding:8px 12px;border-radius:8px;cursor:pointer;margin-top:6px}
button:hover{filter:brightness(1.1)}
ul{padding-left:18px}
.badge-done{background:var(--ok);color:#031; padding:2px 8px;border-radius:999px;font-size:12px;margin-right:6px}
.badge-todo{background:#394150;color:#dbe3ea; padding:2px 8px;border-radius:999px;font-size:12px;margin-right:6px}
.mono{font-family:ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap}
.panel{background:var(--card);padding:12px;border-radius:10px;margin:10px 0;border:1px solid #242a33}
.panel-title{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.mini{font-size:12px;margin-left:8px}
pre{white-space:pre-wrap}
hr{border:0;border-top:1px solid #242a33;margin:14px 0}
</style>
"""

@app.get("/", response_class=HTMLResponse)
def index(open: str | None = Query(default=None)):
    rules = "# GLOBAL RULES\n" if not RULES.exists() else read_text(RULES)
    tasks_html = list_tasks()
    viewer = ""
    if open:
        try:
            p = safe_path(open)
            viewer = f"<div class='card'><div class='panel-title'>View: {html.escape(open)}</div><pre class='mono'>{html.escape(read_text(p))}</pre></div>"
        except Exception as e:
            viewer = f"<div class='card'><pre class='mono'>open error: {html.escape(str(e))}</pre></div>"
    page = f"""
    {CSS}
    <div class='container'>
      <h1>Warden-Lite</h1>

      <div class='card'>
        <h3>Global rules</h3>
        <form method='post' action='/rules/save'>
          <textarea name='body' rows='14'>{html.escape(rules)}</textarea><br>
          <button type='submit'>Save rules</button>
        </form>
      </div>

      <div class='card'>
        <h3>Create task</h3>
        <form method='post' action='/task'>
          <input name='name' placeholder='007_full_search_verification_and_deploy.md' required><br><br>
          <textarea name='body' rows='16' placeholder='Task markdown' required></textarea><br>
          <button type='submit'>Create</button>
        </form>
      </div>

      <div class='card'>
        <h3>Tasks</h3>
        <ul>{tasks_html}</ul>
      </div>

      {git_widget()}
      {viewer}
    </div>
    """
    return page

@app.get("/task", response_class=PlainTextResponse)
def read_task(name: str):
    p = INBOX / name
    if not p.exists():
        return PlainTextResponse("not found", status_code=404)
    return read_text(p)

@app.post("/task")
def create_task(name: str = Form(...), body: str = Form(...)):
    (INBOX / name).write_text(body, encoding="utf-8")
    return RedirectResponse("/", status_code=303)

@app.get("/done/form", response_class=HTMLResponse)
def done_form(name: str):
    base = Path(name).stem
    return f"""
    {CSS}<div class='container card'>
      <h3>Mark done: {html.escape(name)}</h3>
      <form method='post' action='/done/save'>
        <input type='hidden' name='name' value='{html.escape(name)}'/>
        <input name='report' placeholder='reports/DEPLOY_CHECKLIST_YYYYMMDD.md' required/>
        <button type='submit'>Save</button>
      </form>
    </div>"""

@app.post("/done/save")
def done_save(name: str = Form(...), report: str = Form(...)):
    base = Path(name).stem
    (OUTBX / f"{base}.done").write_text((report or "").strip() + "\n", encoding="utf-8")
    return RedirectResponse("/", status_code=303)

@app.get("/view", response_class=HTMLResponse)
def view(path: str):
    p = safe_path(path)
    return f"{CSS}<div class='container card'><pre class='mono'>{html.escape(read_text(p))}</pre></div>"

@app.get("/rules", response_class=PlainTextResponse)
def rules_get():
    return "" if not RULES.exists() else read_text(RULES)

@app.post("/rules/save")
def rules_save(body: str = Form(...)):
    RULES.write_text(body, encoding="utf-8")
    return RedirectResponse("/", status_code=303)

@app.post("/git/pull", response_class=PlainTextResponse)
def git_pull():
    out = []
    out += ["$ git pull"]
    r = run_git("pull")
    out += [r.stderr or r.stdout]
    return "\n".join(out)

@app.post("/git/push", response_class=PlainTextResponse)
def git_push(message: str = Form("warden: update tasks")):
    out = []
    a = run_git("add","-A"); out += ["$ git add -A", a.stderr or a.stdout or ""]
    c = run_git("commit","-m",message)
    if c.returncode!=0: out += ["$ git commit","(no changes or error)","", c.stderr or c.stdout or ""]
    else: out += ["$ git commit", c.stdout]
    # what exactly in HEAD
    head = run_git("rev-parse","--short","HEAD").stdout.strip()
    files = run_git("diff-tree","--no-commit-id","--name-status","-r","HEAD").stdout
    p = run_git("push"); out += ["$ git push", p.stderr or p.stdout or ""]
    out += ["", f"HEAD {head}", "FILES:", files or "(none)"]
    return "\n".join(out)
