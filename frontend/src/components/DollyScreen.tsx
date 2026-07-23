import type { ReactNode } from "react";
import { motion } from "motion/react";

interface DollyScreenProps {
  label: string;
  children: ReactNode;
  /** Panel height variant: setup screens are 517-tall, session screens 416-tall (Figma ×2). */
  variant?: "setup" | "session" | "wide";
  /** Recording carries the Figma glow shadow. */
  glow?: boolean;
}

/**
 * One full application screen at a time: the centered dark product surface
 * (#080E46, 1px rgba(159,176,242,.3) border) on the #F2F2EF page background.
 */
export function DollyScreen({ label, children, variant = "setup", glow = false }: DollyScreenProps) {
  const width = variant === "wide" ? "w-[1216px]" : "w-[525px]";
  const minHeight =
    variant === "setup" ? "min-h-[517px]" : variant === "session" ? "min-h-[416px]" : "min-h-[416px]";
  return (
    <main className="grid min-h-screen place-items-center bg-background py-10">
      <motion.section
        aria-label={label}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className={`relative ${width} ${minHeight} rounded-[20px] border border-[rgba(159,176,242,0.3)] bg-surface-dark px-8 py-8 ${
          glow ? "shadow-[0px_0px_18px_0px_rgba(140,160,255,0.3)]" : ""
        }`}
      >
        {children}
      </motion.section>
    </main>
  );
}
