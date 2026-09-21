# TeamGrid local tools

Run the app and API from this folder:

```bash
python3 server.py
```

Then open [http://127.0.0.1:8787/](http://127.0.0.1:8787/). The server serves the UI and a SQLite database at `data/orgchart.db`. The first start imports `data/seed.json`. Later edits persist in the database, not in the hardcoded HTML/JS examples.

Override the port with `PORT=9000 python3 server.py` if 8787 is taken.

JSON request and response bodies use the same camelCase field names as the UI.

## Health

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Confirms the API and database path are up. |

## AI (local Ollama)

These routes call `ai.py`, which talks to a local Ollama server (`OLLAMA_HOST`, default `http://127.0.0.1:11434`) using `OLLAMA_MODEL` (default `qwen3:14b`). The model is instructed to load workspace data through the read APIs below as tool calls. It does not write tasks or conversations — the UI still confirms drafts.

Pull the model first: `ollama pull qwen3:14b`.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/ai/suggest-tasks` | Body: `{ "projectId" }`. Returns `{ "tasks": [{ "title", "assignee", "subtasks": [{ "title", "startDate", "endDate" }] }] }`. |
| `POST` | `/api/ai/draft-email` | Body: `{ "projectId", "preset", "instructions" }`. Returns `{ "subject", "body", "recipients": [{ "name", "email" }] }`. |
| `POST` | `/api/ai/chat` | Body: `{ "messages": [{ "role", "text" }] }`. Returns `{ "text" }`. |
| `POST` | `/api/ai/timeline-summary` | Body: `{ "projectId" }`. Returns `{ "text" }`. |
| `POST` | `/api/ai/daily-summary` | Body: `{}`. Returns `{ "text" }`. |

## Employees

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/employees` | List people in the directory. |
| `POST` | `/api/employees` | Create a person. Body: name, title, department, status, managerId, email, phone, startDate, photoUrl, customFields, selfAdded. |
| `GET` | `/api/employees/:id` | Fetch one person. |
| `PUT` | `/api/employees/:id` | Update a person. Partial fields are merged onto the stored record. |
| `DELETE` | `/api/employees/:id` | Remove a person and their notes/checklist. |

## Notes and onboarding checklist

Scoped to a person.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/employees/:id/notes` | List notes. |
| `POST` | `/api/employees/:id/notes` | Add a note. Body: `text`, optional `createdAt`. |
| `DELETE` | `/api/employees/:id/notes/:noteId` | Delete a note. |
| `GET` | `/api/employees/:id/checklist` | List checklist items. |
| `POST` | `/api/employees/:id/checklist` | Add an item. Body: `text`, optional `done`. |
| `PATCH` | `/api/employees/:id/checklist/:itemId` | Update `done` and/or `text`. |
| `DELETE` | `/api/employees/:id/checklist/:itemId` | Delete an item. |

## Custom field definitions

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/field-defs` | Return `{ "fields": [...] }`. |
| `PUT` | `/api/field-defs` | Replace the list. Body: `{ "fields": [{ id, label, type, options }] }`. |

## Projects

Projects include people, meeting notes, and tasks/subtasks.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/projects` | List projects. |
| `POST` | `/api/projects` | Create a project. Body: name, status, startDate, endDate, people. |
| `GET` | `/api/projects/:id` | Fetch one project, including meetings and tasks. |
| `PUT` | `/api/projects/:id` | Update a project. Partial fields are merged. |
| `DELETE` | `/api/projects/:id` | Delete a project. |
| `PUT` | `/api/projects/:id/tasks` | Replace the task list. Body: `{ "tasks": [...] }` or a raw array. Each task has `title`, `assignee`, and `subtasks` (`title`, `startDate`, `endDate`, `status`: `todo` \| `inprogress` \| `done`). |
| `POST` | `/api/projects/:id/meetings` | Append a meeting. Body: `date`, `memo`, `nextSteps`. |
| `DELETE` | `/api/projects/:id/meetings/:meetingId` | Remove a meeting. |

## Evaluations

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/evaluations` | List performance reviews. |
| `POST` | `/api/evaluations` | Create a review. Body: employeeId, period, reviewer, quality, productivity, communication, leadership, notes. |
| `DELETE` | `/api/evaluations/:id` | Delete a review. |

## Conversations

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/conversations` | List inbox threads, including messages. |
| `POST` | `/api/conversations` | Start a thread. Body: aboutType, aboutRefId, aboutLabel, participants, messages. |
| `PUT` | `/api/conversations/:id` | Update a thread (participants, label, or messages — used to mark messages read). |
| `POST` | `/api/conversations/:id/messages` | Append a message. Body: `from`, `text`, optional `read`. |
