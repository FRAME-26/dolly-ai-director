/** The lowercase "dolly" wordmark — Archivo SemiBold, tight tracking (Figma 121:1479). */
export function DollyLogo({ size = "hero" }: { size?: "hero" | "small" }) {
  const classes =
    size === "hero"
      ? "text-[40px] tracking-[-2px]"
      : "text-[24px] tracking-[-1.2px]";
  return <span className={`font-semibold text-white ${classes}`}>dolly</span>;
}
