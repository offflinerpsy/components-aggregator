from fastapi import FastAPI, Form, Query
from fastapi.responses import HTMLResponse, PlainTextResponse, Response, RedirectResponse
from pathlib import Path
import subprocess, html, mimetypes, re

ROOT = Path(__file__).resolve().parents[2]
TASKS = ROOT / "tasks"
INBOX = TASKS / "inbox"
OUTBOX = TASKS / "outbox"
RULES = TASKS / "RULES.md"
REPORTS = ROOT / "reports"
for d in (TASKS, INBOX, OUTBOX, REPORTS):
    d.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Warden-Lite")

def run_git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, shell=False)

def dark_wrap(body_html: str) -> str:
    css = """
    <style>
    :root{color-scheme:dark light}
    body{margin:24px;background:#12161c;color:#e6e9f0;font:14px/1.55 ui-sans-serif,system-ui,Segoe UI,Roboto,Arial}
    a{color:#5ea0ff;text-decoration:none} a:hover{text-decoration:underline}
    .card{background:#151b23;border:1px solid #263041;border-radius:12px;margin:12px 0;overflow:hidden;box-shadow:0 1px 0 #11161c}
    .hdr{padding:12px 16px;border-bottom:1px solid #263041;display:flex;gap:12px;align-items:center;justify-content:space-between}
    .body{padding:12px 16px}
    .btn{padding:7px 12px;border:1px solid #2d5cff;border-radius:8px;background:#2051ff;color:#fff}
    .btn:hover{background:#1e4af0}
    input,textarea{width:100%;background:#0f141a;color:#e6e9f0;border:1px solid #2b3647;border-radius:8px;padding:9px}
    input::placeholder,textarea::placeholder{color:#9aa3b2}
    ul{margin:0;padding-left:18px}
    code,pre{background:#0f141a;border:1px solid #263041;padding:8px;border-radius:8px}
    .row{display:flex;gap:8px;flex-wrap:wrap}
    .pill{font-size:12px;padding:2px 8px;border:1px solid #2b3647;border-radius:999px;background:#101620}
    </style>
    """
    return "<!doctype html><meta charset=utf-8>" + css + "<body>" + body_html + "</body>"

def task_id_from_name(name: str):
    m = re.search(r"(\d{3})", name)  # <-- ????: ?????????? ??????
    return m.group(1) if m else None

def report_dirs_for(task_id: str):
    return sorted([p for p in REPORTS.glob("TASK_%s_*" % task_id) if p.is_dir()], reverse=True)

@app.get("/", response_class=HTMLResponse)
def index():
    rules_text = "" if not RULES.exists() else RULES.read_text(encoding="utf-8", errors="replace")

    def list_block(folder: Path, title: str, done: bool=False) -> str:
        items = []
        for p in sorted(folder.glob("*.md")):
            tid = task_id_from_name(p.name) or "-"
            report_links = ""
            if tid != "-" and report_dirs_for(tid):
                report_links = " <a class='pill' href='/report?task=%s'>Report</a>" % html.escape(tid)
            ops = []
            if not done:
                form = (
                    "<form method='post' action='/task/mark' style='display:inline'>"
                    "<input type='hidden' name='name' value='{name}'>"
                    "<input type='hidden' name='action' value='done'>"
                    "<button class='btn' type='submit'>Done</button></form>"
                ).format(name=html.escape(p.name))
                ops.append(form)
            else:
                form = (
                    "<form method='post' action='/task/mark' style='display:inline'>"
                    "<input type='hidden' name='name' value='{name}'>"
                    "<input type='hidden' name='action' value='verified'>"
                    "<button class='btn' type='submit'>Verified</button></form>"
                ).format(name=html.escape(p.name))
                ops.append(form)
            li = (
                "<li><a href='/task?name={q}'>{t}</a> [ID {tid}] {rep} {ops}</li>"
            ).format(q=html.escape(p.name), t=html.escape(p.name), tid=tid, rep=report_links, ops=" ".join(ops))
            items.append(li)
        content = "<ul>" + ("".join(items) if items else "<li>empty</li>") + "</ul>"
        return "<div class='card'><div class='hdr'><b>{}</b></div><div class='body'>{}</div></div>".format(title, content)

    page = []
    page.append("<h1>Warden-Lite</h1>")

    page.append("""
    <div class='card'><div class='hdr'><b>Global Rules</b></div>
    <div class='body'>
      <form method='post' action='/rules/save'>
        <textarea name='body' rows='12'>{rules}</textarea><p>
        <button class='btn' type='submit'>Save rules</button>
      </form>
    </div></div>
    """.format(rules=html.escape(rules_text)))

    page.append("""
    <div class='card'><div class='hdr'><b>Create task</b></div>
    <div class='body'>
      <form method='post' action='/task'>
        <input name='name' placeholder='008_product_card.md' required><p>
        <textarea name='body' rows='14' placeholder='Task markdown' required></textarea><p>
        <button class='btn' type='submit'>Create</button>
      </form>
    </div></div>
    """)

    page.append("""
    <div class='card'><div class='hdr'><b>Git</b></div>
    <div class='body row'>
      <form method='post' action='/git/pull'><button class='btn' type='submit'>Pull</button></form>
      <form id='gitPushForm' method='post' action='/git/push'>
        <input name='message' value='warden: update tasks' style='width:360px'>
        <button class='btn' type='submit'>Add+Commit+Push</button>
      </form>
    </div></div>
    """)

    page.append(list_block(INBOX,  "Inbox"))
    page.append(list_block(OUTBOX, "Done", done=True))
    return dark_wrap("".join(page))

@app.get("/task", response_class=PlainTextResponse)
def read_task(name: str):
    p = (INBOX / name) if (INBOX / name).exists() else (OUTBOX / name)
    if not p.exists():
        return PlainTextResponse("not found", status_code=404)
    return p.read_text(encoding="utf-8", errors="replace")

@app.post("/task")
def create_task(name: str = Form(...), body: str = Form(...)):
    (INBOX / name).write_text(body, encoding="utf-8")
    return RedirectResponse("/", status_code=303)

@app.post("/task/mark")
def task_mark(name: str = Form(...), action: str = Form(...)):
    src = (INBOX / name) if (INBOX / name).exists() else (OUTBOX / name)
    if not src.exists():
        return PlainTextResponse("not found", status_code=404)
    if action == "done":
        dst = OUTBOX / (src.stem + ".done.md")
        src.replace(dst)
    elif action == "verified":
        dst = OUTBOX / (src.stem + ".verified.md")
        src.replace(dst)
    return RedirectResponse("/", status_code=303)

@app.get("/report", response_class=HTMLResponse)
def report(task: str = Query(...)):
    dirs = report_dirs_for(task)
    if not dirs:
        return dark_wrap("<h2>No report folders for TASK {}</h2>".format(html.escape(task)))
    cards = []
    for d in dirs:
        files = sorted(d.glob("**/*"))
        lis = []
        for f in files:
            if f.is_file():
                rel = f.relative_to(REPORTS).as_posix()
                lis.append("<li><a href='/raw?path={}' target='_blank'>{}</a></li>".format(html.escape(rel), html.escape(rel)))
        card = "<div class='card'><div class='hdr'><b>{}</b></div><div class='body'><ul>{}</ul></div></div>".format(
            html.escape(d.name), "".join(lis) or "<li>empty</li>"
        )
        cards.append(card)
    return dark_wrap("<h1>Reports</h1>" + "".join(cards))

@app.get("/raw")
def raw(path: str = Query(...)):
    safe = (REPORTS / path).resolve()
    if not str(safe).startswith(str(REPORTS.resolve())) or not safe.exists() or not safe.is_file():
        return PlainTextResponse("not found", status_code=404)
    mt, _ = mimetypes.guess_type(safe.name)
    data = safe.read_bytes()
    return Response(content=data, media_type=mt or "application/octet-stream")

@app.get("/rules", response_class=PlainTextResponse)
def rules_get():
    return "" if not RULES.exists() else RULES.read_text(encoding="utf-8", errors="replace")

@app.post("/rules/save")
def rules_save(body: str = Form(...)):
    RULES.write_text(body, encoding="utf-8")
    return RedirectResponse("/", status_code=303)

@app.post("/git/push", response_class=PlainTextResponse)
def git_push(message: str = Form("warden: update tasks")):
    out = []
    a = run_git("add", "-A");  out += ["$ git add -A",      a.stderr or a.stdout or ""]
    c = run_git("commit", "-m", message); out += ["$ git commit",       c.stderr or c.stdout or ""]
    p = run_git("push");       out += ["$ git push",         p.stderr or p.stdout or ""]
    return PlainTextResponse("\n\n".join(out))

@app.post("/git/pull", response_class=PlainTextResponse)
def git_pull():
    r = run_git("pull", "--rebase")
    return PlainTextResponse(r.stderr or r.stdout or "")
