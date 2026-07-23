import { useEffect, useState } from "react";
import type { Draft } from "../types";
import { formatDuration } from "./RecordingTimer";

/**
 * The Figma video-preview area (121:1568): bordered box with the #9FB0F2 play
 * triangle. Demo playback runs a real progress clock over the draft's true
 * duration — honestly labeled, since no video is rendered without the backend.
 */
export function DraftPlayer({ draft }: { draft: Draft }) {
  const [playingSince, setPlayingSince] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (playingSince === null) return;
    const timer = setInterval(() => {
      const value = Date.now() - playingSince;
      if (value >= draft.durationMs) {
        setElapsed(draft.durationMs);
        setPlayingSince(null);
      } else {
        setElapsed(value);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [playingSince, draft.durationMs]);

  const playing = playingSince !== null;

  return (
    <div className="flex flex-col gap-[14px]">
      <button
        type="button"
        aria-label={playing ? "Pause draft" : "Play draft"}
        onClick={() => {
          setPlayingSince(playing ? null : Date.now() - elapsed);
        }}
        className="relative grid h-[108px] w-full place-items-center rounded-[12px] border border-[rgba(159,176,242,0.3)]"
      >
        {playing ? (
          <span className="flex gap-[8px]" aria-hidden>
            <span className="h-[28px] w-[8px] bg-primary" />
            <span className="h-[28px] w-[8px] bg-primary" />
          </span>
        ) : (
          <span
            aria-hidden
            className="block size-0 border-y-[14px] border-l-[24px] border-y-transparent border-l-primary"
          />
        )}
        {playing || elapsed > 0 ? (
          <span
            className="absolute inset-x-[12px] bottom-[10px] h-[4px] overflow-clip rounded-full bg-[rgba(255,255,255,0.12)]"
            aria-hidden
          >
            <span
              className="block h-full bg-primary"
              style={{ width: `${(elapsed / draft.durationMs) * 100}%` }}
            />
          </span>
        ) : null}
      </button>
      <p className="text-center font-mono text-[16px] font-medium text-text-muted-dark">
        DRAFT {draft.version} · {formatDuration(draft.durationMs)}
        {playing ? " · PLAYING (DEMO — VIDEO RENDERS ON THE BACKEND)" : ""}
      </p>
    </div>
  );
}
