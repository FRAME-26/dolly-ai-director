export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** ROLLING / HOLDING pill with live timer (Figma 121:1548 "ROLLING 12:04"). */
export function RecordingTimer({ label, ms, live }: { label: string; ms: number; live: boolean }) {
  return (
    <span
      className={`inline-flex h-[28px] items-center gap-[9px] rounded-[10px] px-[14px] font-mono text-[16px] font-medium ${
        live
          ? "bg-primary text-surface-dark"
          : "border border-[rgba(159,176,242,0.5)] text-primary"
      }`}
    >
      <span
        className={`size-[10px] rounded-[5px] ${live ? "bg-surface-dark" : "bg-primary"}`}
        aria-hidden
      />
      {label} {formatDuration(ms)}
    </span>
  );
}
