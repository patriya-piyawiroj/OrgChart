#!/usr/bin/env python3
"""TeamGrid local SQLite database + REST API + static file server."""

from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import ai

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "orgchart.db"
SEED_PATH = DATA_DIR / "seed.json"
PORT = int(os.environ.get("PORT", "8787"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Not Started',
  manager_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  custom_fields TEXT NOT NULL DEFAULT '{}',
  self_added INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS checklist (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS field_defs (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text',
  options TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'upcoming',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  people TEXT NOT NULL DEFAULT '[]',
  meetings TEXT NOT NULL DEFAULT '[]',
  tasks TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  reviewer TEXT NOT NULL DEFAULT '',
  quality INTEGER NOT NULL DEFAULT 0,
  productivity INTEGER NOT NULL DEFAULT 0,
  communication INTEGER NOT NULL DEFAULT 0,
  leadership INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  about_type TEXT NOT NULL DEFAULT 'general',
  about_ref_id TEXT,
  about_label TEXT NOT NULL DEFAULT '',
  participants TEXT NOT NULL DEFAULT '[]',
  messages TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
"""


def new_id(prefix: str) -> str:
    return f"{prefix}_{int(time.time() * 1000):x}{secrets.token_hex(3)}"


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


def loads(value: Any, default: Any) -> Any:
    if value is None or value == "":
        return default
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def seed_if_empty(conn: sqlite3.Connection) -> None:
    count = conn.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
    seeded = conn.execute("SELECT value FROM meta WHERE key = 'seeded'").fetchone()
    if count or seeded:
        return
    if not SEED_PATH.exists():
        conn.execute("INSERT INTO meta (key, value) VALUES ('seeded', '1')")
        conn.commit()
        return
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    for emp in seed.get("employees", []):
        insert_employee(conn, emp, emp.get("id") or new_id("emp"))
    for project in seed.get("projects", []):
        insert_project(conn, project, project.get("id") or new_id("proj"))
    for evaluation in seed.get("evaluations", []):
        insert_evaluation(conn, evaluation, evaluation.get("id") or new_id("eva"))
    for conversation in seed.get("conversations", []):
        insert_conversation(conn, conversation, conversation.get("id") or new_id("conv"))
    replace_field_defs(conn, seed.get("fieldDefs", []))
    for note in seed.get("notes", []):
        conn.execute(
            "INSERT INTO notes (id, employee_id, text, created_at) VALUES (?, ?, ?, ?)",
            (
                note.get("id") or new_id("n"),
                note.get("employeeId", ""),
                note.get("text", ""),
                note.get("createdAt") or time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            ),
        )
    for item in seed.get("checklist", []):
        conn.execute(
            "INSERT INTO checklist (id, employee_id, text, done, created_at) VALUES (?, ?, ?, ?, ?)",
            (
                item.get("id") or new_id("chk"),
                item.get("employeeId", ""),
                item.get("text", ""),
                1 if item.get("done") else 0,
                item.get("createdAt") or time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            ),
        )
    conn.execute("INSERT INTO meta (key, value) VALUES ('seeded', '1')")
    conn.commit()


def employee_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"] or "",
        "title": row["title"] or "",
        "department": row["department"] or "",
        "status": row["status"] or "Not Started",
        "managerId": row["manager_id"] or "",
        "email": row["email"] or "",
        "phone": row["phone"] or "",
        "startDate": row["start_date"] or "",
        "photoUrl": row["photo_url"] or "",
        "customFields": loads(row["custom_fields"], {}),
        "selfAdded": bool(row["self_added"]),
    }


def insert_employee(conn: sqlite3.Connection, data: dict[str, Any], emp_id: str) -> dict[str, Any]:
    conn.execute(
        """
        INSERT INTO employees (
          id, name, title, department, status, manager_id, email, phone,
          start_date, photo_url, custom_fields, self_added
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            emp_id,
            data.get("name") or "",
            data.get("title") or "",
            data.get("department") or "",
            data.get("status") or "Not Started",
            data.get("managerId") or "",
            data.get("email") or "",
            data.get("phone") or "",
            data.get("startDate") or "",
            data.get("photoUrl") or "",
            dumps(data.get("customFields") or {}),
            1 if data.get("selfAdded") else 0,
        ),
    )
    row = conn.execute("SELECT * FROM employees WHERE id = ?", (emp_id,)).fetchone()
    return employee_from_row(row)


def update_employee(conn: sqlite3.Connection, emp_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM employees WHERE id = ?", (emp_id,)).fetchone()
    if not row:
        return None
    current = employee_from_row(row)
    current.update({k: v for k, v in data.items() if k != "id"})
    conn.execute(
        """
        UPDATE employees SET
          name = ?, title = ?, department = ?, status = ?, manager_id = ?,
          email = ?, phone = ?, start_date = ?, photo_url = ?, custom_fields = ?, self_added = ?
        WHERE id = ?
        """,
        (
            current["name"],
            current["title"],
            current["department"],
            current["status"],
            current["managerId"],
            current["email"],
            current["phone"],
            current["startDate"],
            current["photoUrl"],
            dumps(current.get("customFields") or {}),
            1 if current.get("selfAdded") else 0,
            emp_id,
        ),
    )
    return employee_from_row(conn.execute("SELECT * FROM employees WHERE id = ?", (emp_id,)).fetchone())


def project_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"] or "",
        "status": row["status"] or "upcoming",
        "startDate": row["start_date"] or "",
        "endDate": row["end_date"] or "",
        "people": loads(row["people"], []),
        "meetings": loads(row["meetings"], []),
        "tasks": loads(row["tasks"], []),
    }


def insert_project(conn: sqlite3.Connection, data: dict[str, Any], project_id: str) -> dict[str, Any]:
    conn.execute(
        """
        INSERT INTO projects (id, name, status, start_date, end_date, people, meetings, tasks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            data.get("name") or "",
            data.get("status") or "upcoming",
            data.get("startDate") or "",
            data.get("endDate") or "",
            dumps(data.get("people") or []),
            dumps(data.get("meetings") or []),
            dumps(data.get("tasks") or []),
        ),
    )
    return project_from_row(conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone())


def update_project(conn: sqlite3.Connection, project_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        return None
    current = project_from_row(row)
    current.update({k: v for k, v in data.items() if k != "id"})
    conn.execute(
        """
        UPDATE projects SET name = ?, status = ?, start_date = ?, end_date = ?,
          people = ?, meetings = ?, tasks = ?
        WHERE id = ?
        """,
        (
            current["name"],
            current["status"],
            current["startDate"],
            current["endDate"],
            dumps(current.get("people") or []),
            dumps(current.get("meetings") or []),
            dumps(current.get("tasks") or []),
            project_id,
        ),
    )
    return project_from_row(conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone())


def evaluation_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "employeeId": row["employee_id"] or "",
        "period": row["period"] or "",
        "reviewer": row["reviewer"] or "",
        "quality": int(row["quality"] or 0),
        "productivity": int(row["productivity"] or 0),
        "communication": int(row["communication"] or 0),
        "leadership": int(row["leadership"] or 0),
        "notes": row["notes"] or "",
        "createdAt": row["created_at"] or "",
    }


def insert_evaluation(conn: sqlite3.Connection, data: dict[str, Any], eval_id: str) -> dict[str, Any]:
    conn.execute(
        """
        INSERT INTO evaluations (
          id, employee_id, period, reviewer, quality, productivity,
          communication, leadership, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            eval_id,
            data.get("employeeId") or "",
            data.get("period") or "",
            data.get("reviewer") or "",
            int(data.get("quality") or 0),
            int(data.get("productivity") or 0),
            int(data.get("communication") or 0),
            int(data.get("leadership") or 0),
            data.get("notes") or "",
            data.get("createdAt") or time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        ),
    )
    return evaluation_from_row(conn.execute("SELECT * FROM evaluations WHERE id = ?", (eval_id,)).fetchone())


def conversation_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "aboutType": row["about_type"] or "general",
        "aboutRefId": row["about_ref_id"] or "",
        "aboutLabel": row["about_label"] or "",
        "participants": loads(row["participants"], []),
        "messages": loads(row["messages"], []),
        "createdAt": row["created_at"] or "",
    }


def insert_conversation(conn: sqlite3.Connection, data: dict[str, Any], conv_id: str) -> dict[str, Any]:
    conn.execute(
        """
        INSERT INTO conversations (
          id, about_type, about_ref_id, about_label, participants, messages, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            conv_id,
            data.get("aboutType") or "general",
            data.get("aboutRefId") or None,
            data.get("aboutLabel") or "",
            dumps(data.get("participants") or []),
            dumps(data.get("messages") or []),
            data.get("createdAt") or time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        ),
    )
    return conversation_from_row(conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone())


def field_def_from_row(row: sqlite3.Row) -> dict[str, Any]:
    item = {"id": row["id"], "label": row["label"] or "", "type": row["type"] or "text"}
    options = loads(row["options"], None)
    if options:
        item["options"] = options
    return item


def replace_field_defs(conn: sqlite3.Connection, fields: list[dict[str, Any]]) -> list[dict[str, Any]]:
    conn.execute("DELETE FROM field_defs")
    for field in fields:
        conn.execute(
            "INSERT INTO field_defs (id, label, type, options) VALUES (?, ?, ?, ?)",
            (
                field.get("id") or new_id("fld"),
                field.get("label") or "",
                field.get("type") or "text",
                dumps(field.get("options")) if field.get("options") is not None else None,
            ),
        )
    return [field_def_from_row(r) for r in conn.execute("SELECT * FROM field_defs")]


def note_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "text": row["text"] or "", "createdAt": row["created_at"] or ""}


def checklist_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "text": row["text"] or "",
        "done": bool(row["done"]),
        "createdAt": row["created_at"] or "",
    }


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def require_employee(conn: sqlite3.Connection, emp_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM employees WHERE id = ?", (emp_id,)).fetchone()
    if not row:
        raise ApiError(404, "Employee not found")
    return row


def require_project(conn: sqlite3.Connection, project_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise ApiError(404, "Project not found")
    return row


def require_conversation(conn: sqlite3.Connection, conv_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
    if not row:
        raise ApiError(404, "Conversation not found")
    return row


def handle_api(method: str, path: str, body: Any) -> tuple[int, Any]:
    if method == "POST" and path.startswith("/api/ai/"):
        return dispatch_ai(path, body if isinstance(body, dict) else {})
    conn = connect()
    try:
        seed_if_empty(conn)
        return dispatch(conn, method, path, body if isinstance(body, dict) or isinstance(body, list) else {})
    finally:
        conn.close()


def call_tool_api(method: str, path: str, body: Any = None) -> Any:
    status, data = handle_api(method, path, body if body is not None else {})
    if status >= 400:
        err = data.get("error") if isinstance(data, dict) else data
        raise ApiError(status, str(err))
    return data


def dispatch_ai(path: str, body: dict[str, Any]) -> tuple[int, Any]:
    try:
        if path == "/api/ai/suggest-tasks":
            return 200, ai.suggest_tasks(body, call_tool_api)
        if path == "/api/ai/draft-email":
            return 200, ai.draft_email(body, call_tool_api)
        if path == "/api/ai/chat":
            return 200, ai.chat(body, call_tool_api)
        if path == "/api/ai/timeline-summary":
            return 200, ai.timeline_summary(body, call_tool_api)
        if path == "/api/ai/daily-summary":
            return 200, ai.daily_summary(body, call_tool_api)
    except ai.AiError as exc:
        raise ApiError(exc.status, exc.message) from exc
    raise ApiError(404, "Unknown API route")


def dispatch(conn: sqlite3.Connection, method: str, path: str, body: Any) -> tuple[int, Any]:
    if method == "GET" and path == "/api/health":
        return 200, {"ok": True, "db": str(DB_PATH)}

    if path == "/api/employees":
        if method == "GET":
            rows = conn.execute("SELECT * FROM employees ORDER BY name COLLATE NOCASE").fetchall()
            return 200, [employee_from_row(r) for r in rows]
        if method == "POST":
            created = insert_employee(conn, body or {}, (body or {}).get("id") or new_id("emp"))
            conn.commit()
            return 201, created

    m = re.fullmatch(r"/api/employees/([^/]+)", path)
    if m:
        emp_id = unquote(m.group(1))
        if method == "GET":
            return 200, employee_from_row(require_employee(conn, emp_id))
        if method == "PUT":
            updated = update_employee(conn, emp_id, body or {})
            if not updated:
                raise ApiError(404, "Employee not found")
            conn.commit()
            return 200, updated
        if method == "DELETE":
            require_employee(conn, emp_id)
            conn.execute("DELETE FROM notes WHERE employee_id = ?", (emp_id,))
            conn.execute("DELETE FROM checklist WHERE employee_id = ?", (emp_id,))
            conn.execute("DELETE FROM employees WHERE id = ?", (emp_id,))
            conn.commit()
            return 200, {"ok": True}

    m = re.fullmatch(r"/api/employees/([^/]+)/notes", path)
    if m:
        emp_id = unquote(m.group(1))
        require_employee(conn, emp_id)
        if method == "GET":
            rows = conn.execute(
                "SELECT * FROM notes WHERE employee_id = ? ORDER BY created_at ASC", (emp_id,)
            ).fetchall()
            return 200, [note_from_row(r) for r in rows]
        if method == "POST":
            note_id = (body or {}).get("id") or new_id("n")
            created_at = (body or {}).get("createdAt") or time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            conn.execute(
                "INSERT INTO notes (id, employee_id, text, created_at) VALUES (?, ?, ?, ?)",
                (note_id, emp_id, (body or {}).get("text") or "", created_at),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
            return 201, note_from_row(row)

    m = re.fullmatch(r"/api/employees/([^/]+)/notes/([^/]+)", path)
    if m and method == "DELETE":
        emp_id, note_id = unquote(m.group(1)), unquote(m.group(2))
        require_employee(conn, emp_id)
        cur = conn.execute("DELETE FROM notes WHERE id = ? AND employee_id = ?", (note_id, emp_id))
        if cur.rowcount == 0:
            raise ApiError(404, "Note not found")
        conn.commit()
        return 200, {"ok": True}

    m = re.fullmatch(r"/api/employees/([^/]+)/checklist", path)
    if m:
        emp_id = unquote(m.group(1))
        require_employee(conn, emp_id)
        if method == "GET":
            rows = conn.execute(
                "SELECT * FROM checklist WHERE employee_id = ? ORDER BY created_at ASC", (emp_id,)
            ).fetchall()
            return 200, [checklist_from_row(r) for r in rows]
        if method == "POST":
            item_id = (body or {}).get("id") or new_id("chk")
            created_at = (body or {}).get("createdAt") or time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            conn.execute(
                "INSERT INTO checklist (id, employee_id, text, done, created_at) VALUES (?, ?, ?, ?, ?)",
                (item_id, emp_id, (body or {}).get("text") or "", 1 if (body or {}).get("done") else 0, created_at),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM checklist WHERE id = ?", (item_id,)).fetchone()
            return 201, checklist_from_row(row)

    m = re.fullmatch(r"/api/employees/([^/]+)/checklist/([^/]+)", path)
    if m:
        emp_id, item_id = unquote(m.group(1)), unquote(m.group(2))
        require_employee(conn, emp_id)
        row = conn.execute(
            "SELECT * FROM checklist WHERE id = ? AND employee_id = ?", (item_id, emp_id)
        ).fetchone()
        if not row:
            raise ApiError(404, "Checklist item not found")
        if method == "PATCH":
            done = (body or {}).get("done", bool(row["done"]))
            text = (body or {}).get("text", row["text"])
            conn.execute(
                "UPDATE checklist SET done = ?, text = ? WHERE id = ?",
                (1 if done else 0, text or "", item_id),
            )
            conn.commit()
            return 200, checklist_from_row(
                conn.execute("SELECT * FROM checklist WHERE id = ?", (item_id,)).fetchone()
            )
        if method == "DELETE":
            conn.execute("DELETE FROM checklist WHERE id = ?", (item_id,))
            conn.commit()
            return 200, {"ok": True}

    if path == "/api/field-defs":
        if method == "GET":
            return 200, {"fields": [field_def_from_row(r) for r in conn.execute("SELECT * FROM field_defs")]}
        if method == "PUT":
            fields = (body or {}).get("fields") if isinstance(body, dict) else body
            saved = replace_field_defs(conn, fields or [])
            conn.commit()
            return 200, {"fields": saved}

    if path == "/api/projects":
        if method == "GET":
            rows = conn.execute("SELECT * FROM projects ORDER BY name COLLATE NOCASE").fetchall()
            return 200, [project_from_row(r) for r in rows]
        if method == "POST":
            created = insert_project(conn, body or {}, (body or {}).get("id") or new_id("proj"))
            conn.commit()
            return 201, created

    m = re.fullmatch(r"/api/projects/([^/]+)", path)
    if m:
        project_id = unquote(m.group(1))
        if method == "GET":
            return 200, project_from_row(require_project(conn, project_id))
        if method == "PUT":
            updated = update_project(conn, project_id, body or {})
            if not updated:
                raise ApiError(404, "Project not found")
            conn.commit()
            return 200, updated
        if method == "DELETE":
            require_project(conn, project_id)
            conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.commit()
            return 200, {"ok": True}

    m = re.fullmatch(r"/api/projects/([^/]+)/tasks", path)
    if m and method == "PUT":
        project_id = unquote(m.group(1))
        require_project(conn, project_id)
        tasks = body if isinstance(body, list) else (body or {}).get("tasks") or []
        updated = update_project(conn, project_id, {"tasks": tasks})
        conn.commit()
        return 200, updated

    m = re.fullmatch(r"/api/projects/([^/]+)/meetings", path)
    if m and method == "POST":
        project_id = unquote(m.group(1))
        project = project_from_row(require_project(conn, project_id))
        meeting = dict(body or {})
        meeting["id"] = meeting.get("id") or new_id("m")
        meetings = list(project.get("meetings") or []) + [meeting]
        updated = update_project(conn, project_id, {"meetings": meetings})
        conn.commit()
        return 201, meeting if updated else meeting

    m = re.fullmatch(r"/api/projects/([^/]+)/meetings/([^/]+)", path)
    if m and method == "DELETE":
        project_id, meeting_id = unquote(m.group(1)), unquote(m.group(2))
        project = project_from_row(require_project(conn, project_id))
        meetings = [item for item in (project.get("meetings") or []) if item.get("id") != meeting_id]
        if len(meetings) == len(project.get("meetings") or []):
            raise ApiError(404, "Meeting not found")
        update_project(conn, project_id, {"meetings": meetings})
        conn.commit()
        return 200, {"ok": True}

    if path == "/api/evaluations":
        if method == "GET":
            rows = conn.execute("SELECT * FROM evaluations ORDER BY created_at DESC").fetchall()
            return 200, [evaluation_from_row(r) for r in rows]
        if method == "POST":
            created = insert_evaluation(conn, body or {}, (body or {}).get("id") or new_id("eva"))
            conn.commit()
            return 201, created

    m = re.fullmatch(r"/api/evaluations/([^/]+)", path)
    if m and method == "DELETE":
        eval_id = unquote(m.group(1))
        cur = conn.execute("DELETE FROM evaluations WHERE id = ?", (eval_id,))
        if cur.rowcount == 0:
            raise ApiError(404, "Evaluation not found")
        conn.commit()
        return 200, {"ok": True}

    if path == "/api/conversations":
        if method == "GET":
            rows = conn.execute("SELECT * FROM conversations ORDER BY created_at DESC").fetchall()
            return 200, [conversation_from_row(r) for r in rows]
        if method == "POST":
            created = insert_conversation(conn, body or {}, (body or {}).get("id") or new_id("conv"))
            conn.commit()
            return 201, created

    m = re.fullmatch(r"/api/conversations/([^/]+)", path)
    if m and method == "PUT":
        conv_id = unquote(m.group(1))
        conversation = conversation_from_row(require_conversation(conn, conv_id))
        if isinstance(body, dict):
            if "aboutType" in body:
                conversation["aboutType"] = body.get("aboutType") or "general"
            if "aboutRefId" in body:
                conversation["aboutRefId"] = body.get("aboutRefId") or ""
            if "aboutLabel" in body:
                conversation["aboutLabel"] = body.get("aboutLabel") or ""
            if "participants" in body:
                conversation["participants"] = body.get("participants") or []
            if "messages" in body:
                conversation["messages"] = body.get("messages") or []
        conn.execute(
            """
            UPDATE conversations SET about_type = ?, about_ref_id = ?, about_label = ?,
              participants = ?, messages = ?
            WHERE id = ?
            """,
            (
                conversation["aboutType"],
                conversation["aboutRefId"] or None,
                conversation["aboutLabel"],
                dumps(conversation["participants"]),
                dumps(conversation["messages"]),
                conv_id,
            ),
        )
        conn.commit()
        return 200, conversation_from_row(
            conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
        )

    m = re.fullmatch(r"/api/conversations/([^/]+)/messages", path)
    if m and method == "POST":
        conv_id = unquote(m.group(1))
        conversation = conversation_from_row(require_conversation(conn, conv_id))
        message = dict(body or {})
        message.setdefault("id", new_id("cm"))
        message.setdefault("createdAt", time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()))
        message.setdefault("read", False)
        messages = list(conversation.get("messages") or []) + [message]
        conn.execute("UPDATE conversations SET messages = ? WHERE id = ?", (dumps(messages), conv_id))
        conn.commit()
        return 201, message

    raise ApiError(404, "Unknown API route")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _read_json(self) -> Any:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ApiError(400, f"Invalid JSON: {exc}") from exc

    def _send_json(self, status: int, payload: Any):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _handle_api(self, method: str):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            body = self._read_json() if method in {"POST", "PUT", "PATCH"} else {}
            status, payload = handle_api(method, path, body)
            self._send_json(status, payload)
        except ApiError as exc:
            self._send_json(exc.status, {"error": exc.message})
        except Exception as exc:  # noqa: BLE001 — return a JSON error instead of a raw traceback
            self._send_json(500, {"error": str(exc)})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path.startswith("/api/"):
            self._handle_api("GET")
            return
        if path.endswith(".db"):
            self.send_error(404, "Not found")
            return
        if path in {"/", "/index.html"}:
            self.path = "/orgchartdirectory.html"
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        self._handle_api("POST")

    def do_PUT(self):
        self._handle_api("PUT")

    def do_PATCH(self):
        self._handle_api("PATCH")

    def do_DELETE(self):
        self._handle_api("DELETE")

    def log_message(self, fmt: str, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = connect()
    seed_if_empty(conn)
    conn.close()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"TeamGrid local server: http://127.0.0.1:{PORT}/")
    print(f"SQLite database: {DB_PATH}")
    print("API docs: TOOLS.md")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


if __name__ == "__main__":
    main()
