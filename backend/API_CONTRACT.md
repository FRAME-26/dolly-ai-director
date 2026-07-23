# Backend API Contract (for `frontend/`)

The React frontend (`../frontend`) is pre-wired to talk to this FastAPI backend
via the `VITE_DOLLY_API` env var. It never talks to OBS/cameras directly — the
backend is the bridge. Below is the **exact** contract the frontend expects.
Implement these in `app/main.py` (Ceaser).

## Required: CORS

The browser calls the backend cross-origin (Vite dev on `:5173`, or the Vercel
frontend domain → backend). Enable CORS for the frontend origins:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://your-frontend.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Also keep `GET /health` returning `200 OK {"status":"ok"}` — `update_server.sh`
polls it after every deploy.

## 1. Voice — `WS /ws/voice`

- **Direction**: backend → frontend (the frontend only *receives*; it speaks
  confirmations via browser `speechSynthesis`).
- **Frontend validates each message** against this shape (Zod `WsVoiceMessage`):

```json
{ "type": "transcript", "transcript": "dolly action", "confidence": 0.92, "isFinal": true }
```

| field | type | notes |
|-------|------|-------|
| `type` | `"transcript"` (literal) | required, exact string |
| `transcript` | `string` | the recognized phrase / command text |
| `confidence` | `number` | **0.0 – 1.0** (validated) |
| `isFinal` | `boolean` | true = final result, false = interim |

The frontend's `WsVoiceService` only acts on `isFinal: true` and shows
interim `isFinal: false` transcripts live. It accepts the four wake commands
(`action` / `again` / `hold` / `cut`) — command parsing is frontend-side, so
the backend just needs to stream recognized speech here.

Suggested impl: accept the WebSocket, then push transcribed speech from the
client-side voice pipeline (or the `client/` Pocket-4 capture) as the JSON
above. The frontend ignores any malformed frame (`MALFORMED VOICE EVENT`).

## 2. Export → Resolve — `POST /export/otio`

- **Request body** (JSON): `{ "draftId": "<string>" }`
- **Response**: any `200 OK` (the frontend only checks `response.ok`; body is
  ignored). A `{ "detail": "..." }` is fine.
- Maps to the "Open timeline in Resolve" button. Backend should hand the draft
  off to the editing pipeline (OpenTimelineIO / `.otio`).

## 3. Publish — `POST /export/publish`

- **Request body** (JSON): `{ "draftId": "<string>" }`
- **Response**: any `200 OK`.
- Maps to "Publish to socials" (the doc calls this Reap / phase 3). Backend
  triggers the publish step (e.g. `client/obs_bridge` + platform API).

## Quick reference

| Method | Path | Request | Success |
|--------|------|---------|---------|
| WS | `/ws/voice` | — | stream `{type:"transcript",transcript,confidence:0–1,isFinal:bool}` |
| POST | `/export/otio` | `{draftId:string}` | `200` |
| POST | `/export/publish` | `{draftId:string}` | `200` |
| GET | `/health` | — | `200 {"status":"ok"}` |

> The frontend's `ExportService` is typed (`IntegrationResult`) and only checks
> `response.ok`; non-2xx yields `BACKEND ERROR <status>` in the UI. So returning
> `200` with an empty body is sufficient for a first integration.
