import type { Draft, ProjectRecord, Take } from "../../types";
import { getBackendConfig } from "../config";

export type IntegrationResult =
  | { ok: true; detail: string }
  | { ok: false; reason: string };

export interface ExportService {
  /** Downloads the real session data (takes, decisions, draft metadata) as a file. */
  download(project: ProjectRecord, draft: Draft, takes: Take[]): IntegrationResult;
  share(project: ProjectRecord, draft: Draft): Promise<IntegrationResult>;
  /** Typed OTIO handoff adapter — "Open timeline in Resolve" (Figma 10). */
  openTimelineInResolve(draft: Draft): Promise<IntegrationResult>;
  /** Typed future adapter — "Publish to socials" via Reap (Figma 10, phase 3). */
  publishToSocials(draft: Draft): Promise<IntegrationResult>;
}

export class DollyExportService implements ExportService {
  download(project: ProjectRecord, draft: Draft, takes: Take[]): IntegrationResult {
    const payload = {
      kind: "dolly-session-export",
      note: "Demo export: real session data. Rendered video requires the editing backend.",
      project,
      draft,
      takes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.title.replace(/[^a-z0-9]+/gi, "-")}-draft-${draft.version}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true, detail: "SESSION DATA DOWNLOADED (DEMO — NO RENDERED VIDEO YET)" };
  }

  async share(project: ProjectRecord, draft: Draft): Promise<IntegrationResult> {
    const text = `${project.title} — draft ${draft.version}, ${Math.round(draft.durationMs / 1000)}s, cut by Dolly.`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: project.title, text });
        return { ok: true, detail: "SHARED" };
      } catch {
        return { ok: false, reason: "SHARE CANCELLED" };
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, detail: "SUMMARY COPIED TO CLIPBOARD" };
    } catch {
      return { ok: false, reason: "CLIPBOARD UNAVAILABLE" };
    }
  }

  async openTimelineInResolve(draft: Draft): Promise<IntegrationResult> {
    const config = getBackendConfig();
    if (!config.connected) {
      return {
        ok: false,
        reason: "EDITING BACKEND NOT CONNECTED · OTIO HANDOFF NEEDS THE DOLLY SERVER",
      };
    }
    try {
      const response = await fetch(`${config.httpBase}/export/otio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id }),
      });
      if (!response.ok) {
        return { ok: false, reason: `BACKEND ERROR ${response.status}` };
      }
      return { ok: true, detail: "TIMELINE SENT TO RESOLVE" };
    } catch {
      return { ok: false, reason: "EDITING BACKEND UNREACHABLE" };
    }
  }

  async publishToSocials(draft: Draft): Promise<IntegrationResult> {
    const config = getBackendConfig();
    if (!config.connected) {
      return {
        ok: false,
        reason: "REAP NOT CONNECTED · PUBLISHING NEEDS THE DOLLY SERVER (PHASE 3)",
      };
    }
    try {
      const response = await fetch(`${config.httpBase}/export/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id }),
      });
      if (!response.ok) {
        return { ok: false, reason: `BACKEND ERROR ${response.status}` };
      }
      return { ok: true, detail: "SENT TO REAP" };
    } catch {
      return { ok: false, reason: "REAP BACKEND UNREACHABLE" };
    }
  }
}

export const exportService: ExportService = new DollyExportService();
