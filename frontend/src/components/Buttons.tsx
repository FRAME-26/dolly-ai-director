import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Filled #9FB0F2 pill, #080E46 label — exactly one per setup screen (Figma 121:1481). */
export function PrimaryButton({ className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`h-[60px] w-full rounded-full bg-primary text-[22px] font-semibold text-surface-dark transition-opacity disabled:opacity-45 ${className}`}
    />
  );
}

/** Bordered pill, #9FB0F2 label (Figma 121:1528 "Swap roles"). */
export function SecondaryButton({ className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`h-[60px] w-full rounded-full border border-[rgba(159,176,242,0.6)] bg-transparent text-[22px] font-semibold text-primary ${className}`}
    />
  );
}

/** Back / exit action — the red path out (Figma 09 legend, #C0392B). */
export function ExitAction({ className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`h-[50px] w-full rounded-full bg-danger text-[20px] font-semibold text-white ${className}`}
    />
  );
}

/** Quiet tertiary text action (Figma 121:1495 "Why does Dolly need this?"). */
export function TertiaryAction({ className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`w-full text-center text-[20px] font-semibold text-text-muted-dark ${className}`}
    />
  );
}
