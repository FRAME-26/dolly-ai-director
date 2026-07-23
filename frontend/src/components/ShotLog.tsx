import { useEffect, useRef } from "react";
import type { Take, VoiceEvent } from "../types";

function clockTime(ts: number): string {
  return new Date(ts).toTimeString().slice(0, 8);
}

interface ShotLogProps {
  takes: Take[];
  voiceLog: VoiceEvent[];
  cameraSummary: string;
}

interface LogLine {
  ts: number;
  text: string;
  accepted: boolean;
}

/**
 * "This screen is a shot log: every take and every command confirmation,
 * timestamped." (Figma 121:1553) — and it shows exactly what Dolly heard.
 */
export function ShotLog({ takes, voiceLog, cameraSummary }: ShotLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const lines: LogLine[] = [
    ...takes.map((take) => ({
      ts: take.startedAt,
      text: `TAKE ${String(take.index).padStart(2, "0")} · ${cameraSummary}${
        take.markedRetake ? " · MARKED RETAKE" : ""
      }${take.holdCount > 0 ? ` · ${take.holdCount} HOLD${take.holdCount > 1 ? "S" : ""}` : ""}`,
      accepted: true,
    })),
    ...voiceLog.map((event) => ({
      ts: event.ts,
      text: event.accepted
        ? `HEARD "${event.transcript.trim().toUpperCase()}" · ${(event.confidence * 100).toFixed(0)}% · ${event.command}`
        : `HEARD "${event.transcript.trim().toUpperCase()}" · IGNORED · ${event.rejectionReason ?? ""}`,
      accepted: event.accepted,
    })),
  ].sort((a, b) => a.ts - b.ts);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div
      ref={scrollRef}
      className="h-[132px] overflow-y-auto rounded-[12px] border border-[rgba(159,176,242,0.3)] px-[12px] py-[10px]"
    >
      {lines.map((line) => (
        <p
          key={`${line.ts}-${line.text}`}
          className={`font-mono text-[16px] font-medium leading-[24px] ${
            line.accepted ? "text-primary" : "text-text-muted-dark"
          }`}
        >
          {clockTime(line.ts)} · {line.text}
        </p>
      ))}
    </div>
  );
}
