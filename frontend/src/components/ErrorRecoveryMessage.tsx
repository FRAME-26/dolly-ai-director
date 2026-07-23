/**
 * Errors say what Dolly is doing about it: name the problem, never blame the
 * creator, state the fix in progress (Figma 11 · UX principles).
 */
export function ErrorRecoveryMessage({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="rounded-[10px] border border-[rgba(192,57,43,0.7)] px-[14px] py-[10px] font-mono text-[16px] font-medium leading-[24px] text-timeline-retake"
    >
      {message}
    </p>
  );
}
