import type { VoiceEvent } from "../types";

/**
 * Always show what Dolly heard: on-screen confirmation for every utterance,
 * accepted or ignored, with recognition confidence (Figma 11).
 */
export function VoiceConfirmation({ event }: { event: VoiceEvent | undefined }) {
  if (!event) return null;
  return (
    <p
      role="status"
      className={`text-center font-mono text-[16px] font-medium leading-[24px] ${
        event.accepted ? "text-primary" : "text-text-muted-dark"
      }`}
    >
      HEARD “{event.transcript.trim().toUpperCase()}” ·{" "}
      {event.accepted
        ? `${event.command} · ${(event.confidence * 100).toFixed(0)}%`
        : `IGNORED · ${event.rejectionReason ?? ""}`}
    </p>
  );
}
