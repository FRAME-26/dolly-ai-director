import { motion } from "motion/react";
import type { Take } from "../types";
import { formatDuration } from "./RecordingTimer";
import { StatusPill } from "./StatusPill";
import { SecondaryButton } from "./Buttons";

interface RawTakesDrawerProps {
  takes: Take[];
  onClose: () => void;
}

/**
 * "See raw takes" — every take survives and can be inspected, never deleted
 * (Figma 09: "EVERY TAKE SURVIVES · STAYS HERE"). Opens over Review.
 */
export function RawTakesDrawer({ takes, onClose }: RawTakesDrawerProps) {
  return (
    <motion.div
      role="dialog"
      aria-label="Raw takes"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-x-0 bottom-0 rounded-[20px] border border-[rgba(159,176,242,0.3)] bg-surface-dark-2 px-8 pb-8 pt-6"
    >
      <p className="font-mono text-[18px] font-semibold tracking-[0.72px] text-text-muted-dark">
        RAW TAKES · NOTHING IS EVER DELETED
      </p>
      <div className="mt-[10px] max-h-[240px] overflow-y-auto">
        {takes.map((take) => (
          <div
            key={take.id}
            className="flex h-[50px] items-center justify-between border-b border-[rgba(159,176,242,0.15)]"
          >
            <span className="font-mono text-[16px] font-medium text-text-on-dark">
              TAKE {String(take.index).padStart(2, "0")} · {formatDuration(take.durationMs)}
              {take.holdCount > 0 ? ` · ${take.holdCount} HOLD${take.holdCount > 1 ? "S" : ""}` : ""}
            </span>
            <StatusPill variant={take.markedRetake ? "outline" : "filled"}>
              {take.markedRetake ? "MARKED RETAKE" : "KEPT"}
            </StatusPill>
          </div>
        ))}
        {takes.length === 0 ? (
          <p className="py-4 font-mono text-[16px] text-text-muted-dark">NO TAKES RECORDED</p>
        ) : null}
      </div>
      <SecondaryButton className="mt-6" onClick={onClose}>
        Close
      </SecondaryButton>
    </motion.div>
  );
}
