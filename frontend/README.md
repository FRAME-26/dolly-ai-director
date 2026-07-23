# dolly-frontend

React frontend for **Dolly V2**, implemented strictly from the approved Figma
design ("Dolly — Design System" → V2 NEW VERSION, file `1i1rFhuvgvWqFOr9TG4YXk`).

- Visuals: screen mockups in node `121:1473` (scaled ×2 to full screens) and the
  full-size assembly reveal `121:1226` (1:1).
- Routing/behavior: user-flow map `121:1577`.
- Behavior rules: UX principles `121:1813`.

## Stack

React · TypeScript · Vite · Tailwind CSS 4 (CSS design tokens) · React Router ·
XState 5 · Dexie/IndexedDB (Dolly Save) · Zod · native WebSocket · Motion · Vitest · Playwright.

## Run

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm test           # unit tests (Vitest)
pnpm test:e2e       # Playwright journey + screenshots (needs: pnpm exec playwright install chromium)
pnpm build
```

No backend needed for the demo: cameras are honestly-labeled mocks, voice uses
browser SpeechRecognition. Set `VITE_DOLLY_API=http://localhost:8000` to switch
the typed adapters to the FastAPI backend (`/ws/voice`, `/export/otio`,
`/export/publish`). The frontend never talks to OBS directly.

## Structure

```
src/
  app/        actor provider, app shell
  components/ DollyScreen, buttons, pills, ShotLog, AssemblyReveal, …
  features/   cameras / voice / recording / building / review / export / dolly-save
  machines/   dollyMachine (XState, strict transitions)
  services/   CameraService, VoiceService (webspeech/ws/mock), SessionService, ExportService
  db/         Dexie schema (projects, takes, voiceEvents, drafts, kv)
  routes/     router that follows the machine (URLs cannot skip the flow)
  tests/      Vitest suites
tests/e2e/    Playwright journey + 1440×900 screenshot capture
```

## Voice

Only the four wake-word commands act: "Dolly, action / again / hold / cut".
Every utterance is shown on screen with confidence; accepted commands are
confirmed out loud (speechSynthesis) and logged, timestamped, to the shot log.
Low-confidence or unrelated speech never changes state. In e2e runs (`/?e2e`)
a deterministic mock voice service is exposed as `window.__dollyVoice`.

## Dolly Save

Every transition is written through to IndexedDB: project, takes (never
deleted — "again" only marks retakes), voice events, drafts, feedback, export
state. Refresh-safe. Past projects reopens delivered sessions at Export and
unfinished ones at their latest valid state. Ending or finishing a session
remembers the camera setup.
