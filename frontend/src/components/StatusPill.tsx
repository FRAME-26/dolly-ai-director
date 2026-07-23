interface StatusPillProps {
  children: string;
  variant?: "filled" | "outline" | "error";
  /** Rolling pill carries the dark dot (Figma 121:1549). */
  dot?: boolean;
  className?: string;
}

/** Small mono status chip — filled (#9FB0F2) or outlined (Figma 121:1503/121:1506). */
export function StatusPill({ children, variant = "filled", dot = false, className = "" }: StatusPillProps) {
  const styles =
    variant === "filled"
      ? "bg-primary text-surface-dark"
      : variant === "outline"
        ? "border border-[rgba(159,176,242,0.5)] text-primary"
        : "border border-[rgba(192,57,43,0.7)] text-timeline-retake";
  return (
    <span
      className={`inline-flex h-[28px] items-center gap-[9px] rounded-[10px] px-[14px] font-mono text-[16px] font-medium ${styles} ${className}`}
    >
      {dot ? <span className="size-[10px] rounded-[5px] bg-surface-dark" aria-hidden /> : null}
      {children}
    </span>
  );
}
