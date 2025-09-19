from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path
import subprocess, os, json, time

ROOT = Path(__file__).resolve().parents[2]   # repo root
TASKS = ROOT / "tasks"
INBOX = TASKS / "inbox"
LOGS = TASKS / "logs"
INBOX.mkdir(parents=True, exist_ok=True)
LOGS.mkdir(parents=True, exist_ok=True)

app = FastAPI()
app.mount("/ui", StaticFiles(directory=str(Path(__file__).parent / "ui"), html=True), name="ui")

class Task(BaseModel):
    title: str
    goal: str
    allow_ops: bool = False
    notes: str = ""

@app.get("/", response_class=HTMLResponse)
async def home():
    idx = Path(__file__).parent / "ui" / "index.html"
    return HTMLResponse(idx.read_text(encoding="utf-8"))

@app.get("/tasks")
async def list_tasks():
    items = []
    for p in sorted(INBOX.glob("*.json")):
        j = json.loads(p.read_text(encoding="utf-8"))
        items.append({"id": p.stem, **j})
    return {"items": items}

@app.post("/tasks")
async def create_task(t: Task):
    ts = time.strftime("%Y%m%d-%H%M%S")
    tid = f"{ts}-{t.title.replace(' ','_')[:40]}"
    path = INBOX / f"{tid}.json"
    path.write_text(json.dumps(t.dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "id": tid}

@app.post("/ops/approve")
async def approve_ops(req: Request):
    data = await req.json()
    areas = data.get("areas", "nginx, proxy, strapi")
    msg = data.get("message", "ops: approve from Warden")
    env = os.environ.copy()
    env["OPS_ALLOW"] = areas
    subprocess.run(["bash", "scripts/commit-push.sh", msg], cwd=str(ROOT), env=env, check=False)
    return {"ok": True, "areas": areas}

@app.post("/git/save")
async def git_save(req: Request):
    data = await req.json()
    msg = data.get("message", "auto: warden save")
    subprocess.run(["bash", "scripts/commit-push.sh", msg], cwd=str(ROOT), check=False)
    return {"ok": True}
