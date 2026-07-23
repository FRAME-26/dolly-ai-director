import type { ReactNode } from "react";

/** Centered muted mono caption (Figma 121:1510 / 121:1543 / 121:1563). */
export function MonoCaption({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-center font-mono text-[16px] font-medium text-text-muted-dark ${className}`}>
      {children}
    </p>
  );
}
