from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse
from pathlib import Path
import subprocess, html

ROOT = Path(__file__).resolve().parents[2]
TASKS = ROOT / "tasks"
INBOX = TASKS / "inbox"
OUTBOX = TASKS / "outbox"
RULES = TASKS / "RULES.md"
for d in (TASKS, INBOX, OUTBOX):
    d.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Warden-Lite")

def run_git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, shell=False)

@app.get("/", response_class=HTMLResponse)
def index():
    rules_text = "# GLOBAL RULES\n" if not RULES.exists() else RULES.read_text(encoding="utf-8", errors="replace")
    items = []
    for p in sorted(INBOX.glob("*.md")):
        items.append(f"<li><a href='/task?name={p.name}'>{html.escape(p.name)}</a></li>")
    if not items:
        items.append("<li>no tasks</li>")

    page = f"""
    <h1>Warden-Lite</h1>

    <h3>Global rules</h3>
    <form method='post' action='/rules/save' style='margin-bottom:16px'>
      <textarea name='body' rows='16' style='width:100%'>{html.escape(rules_text)}</textarea><br>
      <button type='submit'>Save rules</button>
    </form>

    <hr>
    <h3>Create task</h3>
    <form method='post' action='/task' style='margin-bottom:16px'>
      <input name='name' placeholder='001_audit_project.md' required style='width:400px'><br><br>
      <textarea name='body' rows='18' style='width:100%' placeholder='Task markdown (RU allowed)' required></textarea><br>
      <button type='submit'>Create</button>
    </form>

    <hr>
    <h3>Tasks</h3>
    <ul>{''.join(items)}</ul>

    <hr>
    <h3>Git push</h3>
    <form method='post' action='/git/push'>
      <input name='message' value='warden: update tasks' style='width:400px'/>
      <button type='submit'>git add/commit/push</button>
    </form>
    """
    return page

@app.get("/task", response_class=PlainTextResponse)
def read_task(name: str):
    p = INBOX / name
    if not p.exists():
        return PlainTextResponse("not found", status_code=404)
    return p.read_text(encoding="utf-8", errors="replace")

@app.post("/task")
def create_task(name: str = Form(...), body: str = Form(...)):
    p = INBOX / name
    p.write_text(body, encoding="utf-8")
    return RedirectResponse("/", status_code=303)

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
    a = run_git("add", "-A")
    out += ["$ git add -A", a.stderr or a.stdout or ""]
    c = run_git("commit", "-m", message)
    out += ["$ git commit", c.stderr or c.stdout or ""]
    p = run_git("push")
    out += ["$ git push", p.stderr or p.stdout or ""]
    return "\n".join(out)
