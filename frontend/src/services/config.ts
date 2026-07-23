/**
 * Backend boundary: React frontend → FastAPI REST/WebSocket → OBS/cameras/voice/editing.
 * The frontend never talks to OBS directly and holds no camera credentials.
 */
export interface BackendConfig {
  /** e.g. "http://localhost:8000" — empty string means: no backend, run demo mocks. */
  httpBase: string;
  /** e.g. "ws://localhost:8000" */
  wsBase: string;
  connected: boolean;
}

export function getBackendConfig(): BackendConfig {
  const httpBase = (import.meta.env.VITE_DOLLY_API as string | undefined) ?? "";
  const wsBase = httpBase.replace(/^http/, "ws");
  return { httpBase, wsBase, connected: httpBase.length > 0 };
}

/** Test instrumentation flag (used by Playwright to inject deterministic services). */
export function isTestMode(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("e2e")) {
    sessionStorage.setItem("dolly-e2e", "1");
    return true;
  }
  return sessionStorage.getItem("dolly-e2e") === "1";
}
