import type { BuildProgress } from "../types";
import { MonoCaption } from "./MonoCaption";

const STAGE_LINES: Record<BuildProgress["stage"], string> = {
  ingesting: "INGESTING 2 CAMERAS",
  syncing: "SYNCING AUDIO",
  detecting: "DETECTING TAKES",
  selecting: "SELECTING ANGLES",
  assembling: "ASSEMBLING DRAFT",
  done: "DRAFT READY",
};

/** Slim progress bar + staged status lines (Figma 121:1560–121:1562). */
export function BuildProgressBar({
  progress,
  draftVersion,
}: {
  progress: BuildProgress;
  draftVersion: number;
}) {
  return (
    <div className="flex flex-col gap-[24px]">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.overall * 100)}
        className="h-[10px] overflow-clip rounded-full bg-[rgba(255,255,255,0.12)]"
      >
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: `${Math.round(progress.overall * 100)}%` }}
        />
      </div>
      <MonoCaption className="leading-[25.6px]">
        {STAGE_LINES[progress.stage]}
        <br />
        ASSEMBLING DRAFT {draftVersion + 1}
      </MonoCaption>
    </div>
  );
}
