from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse
import subprocess, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # repo root
TASKS = ROOT / "tasks"
INBOX = TASKS / "inbox"
OUTBOX = TASKS / "outbox"
INBOX.mkdir(parents=True, exist_ok=True)
OUTBOX.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Warden-Lite")

def run_git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, shell=False)

@app.get("/", response_class=HTMLResponse)
def index():
    items = []
    for p in sorted(INBOX.glob("*.md")):
        items.append(f"<li><a href='/task?name={p.name}'>{p.name}</a></li>")
    if not items:
        items.append("<li>нет задач</li>")
    html = f"""
    <h1>Warden-Lite</h1>
    <form method='post' action='/task' style='margin-bottom:16px'>
      <input name='name' placeholder='id задачи, например 001_audit_project.md' required style='width:400px'><br><br>
      <textarea name='body' rows='18' style='width:100%' placeholder='Markdown задачи' required></textarea><br>
      <button type='submit'>Создать задачу</button>
    </form>
    <hr>
    <h3>Задачи</h3>
    <ul>{''.join(items)}</ul>
    <hr>
    <form method='post' action='/git/push'>
      <input name='message' value='warden: update tasks' style='width:400px'/>
      <button type='submit'>Сохранить (git add/commit/push)</button>
    </form>
    """
    return html

@app.get("/task", response_class=PlainTextResponse)
def read_task(name: str):
    p = INBOX / name
    return p.read_text(encoding="utf-8")

@app.post("/task")
def create_task(name: str = Form(...), body: str = Form(...)):
    p = INBOX / name
    p.write_text(body, encoding="utf-8")
    return RedirectResponse("/", status_code=303)

@app.post("/git/push", response_class=PlainTextResponse)
def git_push(message: str = Form("warden: update tasks")):
    a = run_git("add", "-A")
    c = run_git("commit", "-m", message)
    p = run_git("push")
    out = []
    out.append("$ git add -A")
    out.append(a.stderr or a.stdout or "")
    out.append("$ git commit")
    out.append(c.stderr or c.stdout or "")
    out.append("$ git push")
    out.append(p.stderr or p.stdout or "")
    return "\n".join(out)
