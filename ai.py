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


def run_agent(system: str, user: str, api_call: ApiCall, extra_messages: list[dict[str, Any]] | None = None) -> str:
    messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
    if extra_messages:
        messages.extend(extra_messages)
    messages.append({"role": "user", "content": user})

    for _ in range(MAX_ROUNDS):
        message = ollama_chat(messages, READ_TOOLS)
        messages.append(message)
        calls = _tool_calls(message)
        if not calls:
            return str(message.get("content") or "").strip()
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
        'Return {"tasks":[{"title":"","assignee":"","subtasks":[{"title":"","startDate":"","endDate":""}]}]}.'
    )
    user = f"Suggest tasks for project id {project_id}."
    data = parse_json_object(run_agent(system, user, api_call))
    tasks = data.get("tasks")
    if not isinstance(tasks, list):
        raise AiError(502, "The model did not return a tasks array.")
    return {"tasks": tasks}


def draft_email(body: dict[str, Any], api_call: ApiCall) -> dict[str, Any]:
    project_id = _require_project_id(body)
    preset = str((body or {}).get("preset") or "status update").strip()
    instructions = str((body or {}).get("instructions") or "").strip()
    system = (
        SHARED_RULES +
        " Call get_project and list_employees so recipient names and emails come from the directory. "
        "Write a short, professional email for the requested preset. "
        'Return {"subject":"","body":"","recipients":[{"name":"","email":""}]}.'
    )
    extra = f" Extra instructions: {instructions}" if instructions else ""
    user = f"Draft a {preset} email for project id {project_id}.{extra}"
    data = parse_json_object(run_agent(system, user, api_call))
    return {
        "subject": str(data.get("subject") or ""),
        "body": str(data.get("body") or ""),
        "recipients": data.get("recipients") if isinstance(data.get("recipients"), list) else [],
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
        'Return {"text":"..."}.'
    )
    data = parse_json_object(run_agent(system, last_user, api_call, extras))
    text = str(data.get("text") or "").strip()
    if not text:
        raise AiError(502, "The model returned an empty answer.")
    return {"text": text}


def timeline_summary(body: dict[str, Any], api_call: ApiCall) -> dict[str, Any]:
    project_id = _require_project_id(body)
    system = (
        SHARED_RULES +
        " Call get_project and summarize recent meetings: what happened, what was decided, what is still open. "
        "3-5 short sentences or bullets. "
        'Return {"text":"..."}.'
    )
    user = f"Summarize the timeline for project id {project_id}."
    data = parse_json_object(run_agent(system, user, api_call))
    text = str(data.get("text") or "").strip()
    if not text:
        raise AiError(502, "The model returned an empty summary.")
    return {"text": text}


def daily_summary(body: dict[str, Any], api_call: ApiCall) -> dict[str, Any]:
    system = (
        SHARED_RULES +
        " Call list_projects (and list_employees if needed) and write a short daily project-health summary "
        "for a team lead. Under 120 words. End with the single most urgent thing to address today. "
        'Return {"text":"..."}.'
    )
    data = parse_json_object(run_agent(system, "Write today's project-health summary.", api_call))
    text = str(data.get("text") or "").strip()
    if not text:
        raise AiError(502, "The model returned an empty summary.")
    return {"text": text}
