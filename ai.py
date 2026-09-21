#!/usr/bin/env python3
"""Ollama agent that uses TeamGrid REST APIs as tools."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Callable

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:14b")
MAX_ROUNDS = 8
TIMEOUT_SEC = 180

ApiCall = Callable[[str, str, Any], Any]


class AiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


READ_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "list_employees",
            "description": "List people in the directory (name, title, department, email, status).",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_employee",
            "description": "Fetch one person by id.",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "string", "description": "Employee id, e.g. emp_1"}},
                "required": ["id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_employee_notes",
            "description": "List notes for a person.",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "string", "description": "Employee id"}},
                "required": ["id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_employee_checklist",
            "description": "List onboarding checklist items for a person.",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "string", "description": "Employee id"}},
                "required": ["id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_projects",
            "description": "List all projects with people, meetings, and tasks.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_project",
            "description": "Fetch one project by id, including meetings and tasks.",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "string", "description": "Project id, e.g. pr1"}},
                "required": ["id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_evaluations",
            "description": "List performance reviews.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_conversations",
            "description": "List inbox conversation threads and their messages.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
]

TOOL_ROUTES: dict[str, tuple[str, str]] = {
    "list_employees": ("GET", "/api/employees"),
    "get_employee": ("GET", "/api/employees/{id}"),
    "list_employee_notes": ("GET", "/api/employees/{id}/notes"),
    "list_employee_checklist": ("GET", "/api/employees/{id}/checklist"),
    "list_projects": ("GET", "/api/projects"),
    "get_project": ("GET", "/api/projects/{id}"),
    "list_evaluations": ("GET", "/api/evaluations"),
    "list_conversations": ("GET", "/api/conversations"),
}

SHARED_RULES = (
    "You are an assistant inside TeamGrid, a local org-chart and project tool. "
    "Use the provided tools to load live workspace data before you answer. "
    "Do not invent people, emails, project names, or dates that are not in tool results. "
    "Do not write, update, or delete records — only read via tools, then return JSON. "
    "Return ONLY a JSON object, no markdown preamble."
)


def _tool_args(raw: Any) -> dict[str, Any]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def execute_tool(name: str, args: dict[str, Any], api_call: ApiCall) -> Any:
    spec = TOOL_ROUTES.get(name)
    if not spec:
        return {"error": f"Unknown tool: {name}"}
    method, template = spec
    try:
        path = template.format(**args)
    except KeyError as exc:
        return {"error": f"Missing argument {exc} for {name}"}
    try:
        return api_call(method, path, None)
    except Exception as exc:  # noqa: BLE001 — send the failure back to the model
        return {"error": str(exc)}


def ollama_chat(messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "think": False,
    }
    if tools:
        payload["tools"] = tools
    req = urllib.request.Request(
        OLLAMA_HOST + "/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
        raise AiError(
            503,
            f"Couldn't reach the local Ollama model ({exc.code}). Is Ollama running with {OLLAMA_MODEL}? {detail[:240]}",
        ) from exc
    except urllib.error.URLError as exc:
        raise AiError(
            503,
            f"Couldn't reach the local Ollama model. Is Ollama running with {OLLAMA_MODEL}? {exc.reason}",
        ) from exc
    except TimeoutError as exc:
        raise AiError(503, f"Ollama timed out after {TIMEOUT_SEC}s.") from exc
    if not isinstance(data, dict) or "message" not in data:
        raise AiError(502, "Ollama returned an unexpected response.")
    return data["message"]


def _tool_calls(message: dict[str, Any]) -> list[dict[str, Any]]:
    calls = message.get("tool_calls") or []
    return calls if isinstance(calls, list) else []


def run_agent(
    system: str,
    user: str,
    api_call: ApiCall,
    extra_messages: list[dict[str, Any]] | None = None,
    require_tools: bool = True,
    tools: list[dict[str, Any]] | None = None,
) -> str:
    """Run the Ollama tool loop. By default at least one tool call is required
    before a final answer is accepted (grounding in TeamGrid records)."""
    tool_defs = tools if tools is not None else READ_TOOLS
    messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
    if extra_messages:
        messages.extend(extra_messages)
    messages.append({"role": "user", "content": user})
    used_tools = False

    for _ in range(MAX_ROUNDS):
        message = ollama_chat(messages, tool_defs)
        messages.append(message)
        calls = _tool_calls(message)
        if not calls:
            if require_tools and tool_defs and not used_tools:
                messages.append({
                    "role": "user",
                    "content": (
                        "You must call at least one retrieval tool to load TeamGrid records "
                        "before answering. Call a tool now, then return the JSON result."
                    ),
                })
                continue
            return str(message.get("content") or "").strip()
        used_tools = True
        for call in calls:
            fn = call.get("function") or {}
            name = str(fn.get("name") or call.get("name") or "")
            args = _tool_args(fn.get("arguments"))
            result = execute_tool(name, args, api_call)
            messages.append({
                "role": "tool",
                "tool_name": name,
                "name": name,
                "content": json.dumps(result, ensure_ascii=False),
            })
    raise AiError(502, "The model kept calling tools without finishing. Try again.")


def _employee_names(api_call: ApiCall) -> set[str]:
    rows = api_call("GET", "/api/employees", None)
    if not isinstance(rows, list):
        return set()
    return {str(r.get("name") or "").strip() for r in rows if isinstance(r, dict) and r.get("name")}


def _employee_emails_by_name(api_call: ApiCall) -> dict[str, str]:
    rows = api_call("GET", "/api/employees", None)
    out: dict[str, str] = {}
    if not isinstance(rows, list):
        return out
    for r in rows:
        if not isinstance(r, dict):
            continue
        name = str(r.get("name") or "").strip()
        if name:
            out[name] = str(r.get("email") or "").strip()
    return out


def parse_json_object(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, flags=re.S)
    blob = fenced.group(1) if fenced else cleaned
    if not fenced:
        start = blob.find("{")
        end = blob.rfind("}")
        if start != -1 and end > start:
            blob = blob[start : end + 1]
    try:
        data = json.loads(blob)
    except json.JSONDecodeError as exc:
        raise AiError(502, f"The model did not return valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise AiError(502, "The model returned JSON that was not an object.")
    return data


def _require_project_id(body: dict[str, Any]) -> str:
    project_id = str((body or {}).get("projectId") or "").strip()
    if not project_id:
        raise AiError(400, "projectId is required.")
    return project_id


def suggest_tasks(body: dict[str, Any], api_call: ApiCall) -> dict[str, Any]:
    project_id = _require_project_id(body)
    system = (
        SHARED_RULES +
        " Call get_project for the given id and list_employees so assignees match real people. "
        "Propose exactly two parent tasks, each with exactly two subtasks. "
        "Use ISO dates (YYYY-MM-DD) inside the project's startDate/endDate window when those exist. "
        "Assignee must be a name returned by list_employees (or empty). "
        'Return {"tasks":[{"title":"","assignee":"","subtasks":[{"title":"","startDate":"","endDate":""}]}]}.'
    )
    user = f"Suggest tasks for project id {project_id}."
    data = parse_json_object(run_agent(system, user, api_call, require_tools=True))
    tasks = data.get("tasks")
    if not isinstance(tasks, list):
        raise AiError(502, "The model did not return a tasks array.")
    known = _employee_names(api_call)
    cleaned = []
    for t in tasks:
        if not isinstance(t, dict):
            continue
        assignee = str(t.get("assignee") or "").strip()
        if assignee and known and assignee not in known:
            assignee = ""
        subs = t.get("subtasks") if isinstance(t.get("subtasks"), list) else []
        cleaned.append({
            "title": str(t.get("title") or "").strip(),
            "assignee": assignee,
            "subtasks": [
                {
                    "title": str(s.get("title") or "").strip(),
                    "startDate": str(s.get("startDate") or "").strip(),
                    "endDate": str(s.get("endDate") or "").strip(),
                }
                for s in subs if isinstance(s, dict)
            ],
        })
    return {"tasks": cleaned}


def draft_email(body: dict[str, Any], api_call: ApiCall) -> dict[str, Any]:
    project_id = _require_project_id(body)
    preset = str((body or {}).get("preset") or "status update").strip()
    instructions = str((body or {}).get("instructions") or "").strip()
    system = (
        SHARED_RULES +
        " Call get_project and list_employees so recipient names and emails come from the directory. "
        "Write a short, professional email for the requested preset. "
        "Only include recipients who appear on the project and in list_employees; use their directory email. "
        'Return {"subject":"","body":"","recipients":[{"name":"","email":""}]}.'
    )
    extra = f" Extra instructions: {instructions}" if instructions else ""
    user = f"Draft a {preset} email for project id {project_id}.{extra}"
    data = parse_json_object(run_agent(system, user, api_call, require_tools=True))
    emails_by_name = _employee_emails_by_name(api_call)
    project = api_call("GET", f"/api/projects/{project_id}", None)
    project_people = set()
    if isinstance(project, dict):
        project_people = {str(n).strip() for n in (project.get("people") or []) if n}
    recipients_out = []
    raw_recipients = data.get("recipients") if isinstance(data.get("recipients"), list) else []
    for r in raw_recipients:
        if not isinstance(r, dict):
            continue
        name = str(r.get("name") or "").strip()
        if not name:
            continue
        if project_people and name not in project_people:
            continue
        if name not in emails_by_name:
            continue
        recipients_out.append({"name": name, "email": emails_by_name[name]})
    if not recipients_out and project_people:
        for name in sorted(project_people):
            if name in emails_by_name:
                recipients_out.append({"name": name, "email": emails_by_name[name]})
    return {
        "subject": str(data.get("subject") or ""),
        "body": str(data.get("body") or ""),
        "recipients": recipients_out,
    }


def chat(body: dict[str, Any], api_call: ApiCall) -> dict[str, Any]:
    turns = (body or {}).get("messages") or []
    if not isinstance(turns, list) or not turns:
        raise AiError(400, "messages is required.")
    extras: list[dict[str, Any]] = []
    for turn in turns:
        if not isinstance(turn, dict):
            continue
        role = "assistant" if turn.get("role") == "assistant" else "user"
        text = str(turn.get("text") or turn.get("content") or "").strip()
        if text:
            extras.append({"role": role, "content": text})
    if extras and extras[-1]["role"] == "user":
        last_user = extras[-1]["content"]
        extras = extras[:-1]
    else:
        last_user = ""
    if not last_user:
        raise AiError(400, "A user question is required.")
    system = (
        SHARED_RULES +
        " Answer the question using only tool results. If the data is not there, say so plainly. "
        "Be concise: short paragraphs or bullets, no markdown headers. "
        "You must call retrieval tools before answering. "
        'Return {"text":"..."}.'
    )
    data = parse_json_object(run_agent(system, last_user, api_call, extras, require_tools=True))
    text = str(data.get("text") or "").strip()
    if not text:
        raise AiError(502, "The model returned an empty answer.")
    return {"text": text}


def timeline_summary(body: dict[str, Any], api_call: ApiCall) -> dict[str, Any]:
    project_id = _require_project_id(body)
    events = (body or {}).get("events")
    if not isinstance(events, list) or not events:
        raise AiError(400, "events is required (recent meeting list, not full history).")
    # Cap and sanitize — only summarize what the client selected
    limited = []
    for m in events[:10]:
        if not isinstance(m, dict):
            continue
        limited.append({
            "date": str(m.get("date") or ""),
            "memo": str(m.get("memo") or ""),
            "nextSteps": str(m.get("nextSteps") or ""),
        })
    if not limited:
        raise AiError(400, "No usable events to summarize.")
    events_text = "\n".join(
        f"{i + 1}. {e['date']} — memo: {e['memo'] or '—'} | next steps: {e['nextSteps'] or '—'}"
        for i, e in enumerate(limited)
    )
    system = (
        SHARED_RULES +
        " Call get_project once to confirm the project exists and match names/status. "
        "Summarize ONLY the meeting events supplied in the user message — do not invent older meetings. "
        "Cover what happened, what was decided, and what is still open. 3-5 short sentences or bullets. "
        'Return {"text":"..."}.'
    )
    user = (
        f"Summarize the timeline for project id {project_id} using ONLY these recent events "
        f"(most recent first):\n{events_text}"
    )
    data = parse_json_object(run_agent(system, user, api_call, require_tools=True))
    text = str(data.get("text") or "").strip()
    if not text:
        raise AiError(502, "The model returned an empty summary.")
    return {"text": text}


def daily_summary(body: dict[str, Any], api_call: ApiCall) -> dict[str, Any]:
    facts = (body or {}).get("facts")
    if not isinstance(facts, dict) or not facts:
        raise AiError(400, "facts is required (dashboard-calculated findings).")
    # Keep a compact, deterministic facts block from the UI
    lines = []
    status = facts.get("statusCounts") if isinstance(facts.get("statusCounts"), dict) else {}
    if status:
        lines.append(
            "Status counts: "
            + ", ".join(f"{k}: {status.get(k, 0)}" for k in ("active", "upcoming", "stuck", "completed"))
        )
    lines.append(
        "Timeline health: "
        f"{facts.get('onTrack', 0)} on track, "
        f"{facts.get('dueSoon', 0)} due within 7 days, "
        f"{facts.get('overdue', 0)} overdue."
    )
    for key, label in (
        ("overdueList", "Overdue"),
        ("dueSoonList", "Due soon"),
        ("unassignedList", "No one assigned"),
        ("stuckList", "Stuck"),
    ):
        items = facts.get(key)
        if isinstance(items, list) and items:
            names = []
            for item in items:
                if isinstance(item, dict):
                    names.append(str(item.get("name") or item.get("id") or ""))
                else:
                    names.append(str(item))
            names = [n for n in names if n]
            if names:
                lines.append(f"{label}: " + ", ".join(names))
    facts_block = "\n".join(lines)
    system = (
        SHARED_RULES +
        " Call list_projects once to verify the supplied dashboard facts against live records. "
        "Write the summary using ONLY those supplied facts (and tool checks). Do not invent projects. "
        "Under 120 words. End with the single most urgent thing to address today. "
        'Return {"text":"..."}.'
    )
    user = (
        "Write today's project-health summary from these dashboard-calculated facts:\n\n"
        + facts_block
    )
    data = parse_json_object(run_agent(system, user, api_call, require_tools=True))
    text = str(data.get("text") or "").strip()
    if not text:
        raise AiError(502, "The model returned an empty summary.")
    return {"text": text}


def improve_note(body: dict[str, Any], api_call: ApiCall) -> dict[str, Any]:
    text = str((body or {}).get("text") or "").strip()
    if not text:
        raise AiError(400, "text is required.")
    employee_id = str((body or {}).get("employeeId") or "").strip()
    system = (
        SHARED_RULES +
        " Improve clarity and phrasing of the note without changing its meaning or adding facts. "
        "Keep about the same length. "
        + (
            "Call get_employee for the given employeeId so you know who the note is about; do not invent details about them. "
            if employee_id else
            "Call list_employees if you need directory context; do not invent people. "
        )
        + 'Return {"text":"..."} with ONLY the revised note.'
    )
    user = (
        f"Improve this note for employee id {employee_id}:\n\n---\n{text}"
        if employee_id else
        f"Improve this note:\n\n---\n{text}"
    )
    data = parse_json_object(run_agent(system, user, api_call, require_tools=True))
    revised = str(data.get("text") or "").strip()
    if not revised:
        raise AiError(502, "The model returned an empty note.")
    return {"text": revised}


def suggest_next_steps(body: dict[str, Any], api_call: ApiCall) -> dict[str, Any]:
    memo = str((body or {}).get("memo") or "").strip()
    if not memo:
        raise AiError(400, "memo is required.")
    project_id = str((body or {}).get("projectId") or "").strip()
    system = (
        SHARED_RULES +
        " Read the meeting memo and extract concrete action items — things a person needs to do next. "
        + (
            "Call get_project for the given projectId so names and context stay grounded. "
            if project_id else
            "Call list_projects or list_employees if you need grounding; do not invent people. "
        )
        + "Return JSON: {\"items\":[\"...\"]} as short strings, one action each. "
        "If nothing is actionable, return {\"items\":[]}."
    )
    user = (
        f"Extract next steps from this memo for project id {project_id}:\n\n---\n{memo}"
        if project_id else
        f"Extract next steps from this memo:\n\n---\n{memo}"
    )
    data = parse_json_object(run_agent(system, user, api_call, require_tools=True))
    items = data.get("items")
    if not isinstance(items, list):
        # tolerate {"text": "- a\\n- b"} style
        text = str(data.get("text") or "").strip()
        items = [ln.lstrip("-• ").strip() for ln in text.splitlines() if ln.strip()] if text else []
    cleaned = [str(i).strip() for i in items if str(i).strip()]
    text = "\n".join("- " + i for i in cleaned) if cleaned else ""
    return {"items": cleaned, "text": text}
