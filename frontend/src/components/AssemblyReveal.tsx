import type { BuildProgress, DecisionSegment } from "../types";
import { formatDuration } from "./RecordingTimer";

interface AssemblyRevealProps {
  progress: BuildProgress;
  segments: DecisionSegment[];
  takeCount: number;
  footageMs: number;
}

const SEGMENT_STYLES: Record<DecisionSegment["kind"], { block: string; label: string }> = {
  camA: { block: "bg-primary rounded-[4px]", label: "text-text-muted-dark" },
  camB: {
    block: "border border-[rgba(159,176,242,0.7)] rounded-[4px]",
    label: "text-text-muted-dark",
  },
  retakeRemoved: { block: "bg-[rgba(192,57,43,0.55)] rounded-[4px]", label: "text-timeline-retake" },
  silenceTrimmed: { block: "bg-[rgba(159,176,242,0.2)] rounded-[4px]", label: "text-timeline-silence" },
  assembling: {
    block:
      "bg-[rgba(159,176,242,0.12)] border border-dashed border-[rgba(159,176,242,0.35)] rounded-[4px]",
    label: "text-timeline-silence",
  },
};

interface StepSpec {
  index: 1 | 2 | 3;
  title: string;
  body: string;
  stages: BuildProgress["stage"][];
}

/** The three narrative steps of the reveal (Figma 121:1231–121:1242). */
const STEPS: StepSpec[] = [
  {
    index: 1,
    title: "Ingested both cameras",
    body: "All footage transferred over USB.",
    stages: ["ingesting"],
  },
  {
    index: 2,
    title: "Synced by audio waveform",
    body: "Both angles locked to one clock.",
    stages: ["syncing"],
  },
  {
    index: 3,
    title: "Assembling the cut",
    body: "Choosing angles, trimming, removing retakes.",
    stages: ["detecting", "selecting", "assembling"],
  },
];

function stepStatus(step: StepSpec, progress: BuildProgress): "todo" | "active" | "done" {
  const order: BuildProgress["stage"][] = [
    "ingesting",
    "syncing",
    "detecting",
    "selecting",
    "assembling",
    "done",
  ];
  const current = order.indexOf(progress.stage);
  const first = order.indexOf(step.stages[0]);
  const last = order.indexOf(step.stages[step.stages.length - 1]);
  if (current > last) return "done";
  if (current >= first) return "active";
  return "todo";
}

/**
 * "Dolly is building your cut" — the assembly reveal, the emotional peak.
 * Implements the full-size Figma component 121:1226 at native scale on the
 * #0B1670 surface: never a generic spinner, every decision legible.
 */
export function AssemblyReveal({ progress, segments, takeCount, footageMs }: AssemblyRevealProps) {
  const building = progress.stage !== "done";
  const shown = building
    ? [...segments, { kind: "assembling" as const, label: "ASSEMBLING…", weight: 0.9 }]
    : segments;
  const totalWeight = shown.reduce((sum, s) => sum + s.weight, 0);

  return (
    <div className="rounded-[10px] border border-[rgba(159,176,242,0.3)] bg-surface-dark-2 px-8 pb-8 pt-7">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-[23px] items-center gap-[8px] rounded-[6px] bg-primary px-[12px]">
          <span className="size-[6px] rounded-[3px] bg-surface-dark" aria-hidden />
          <span className="font-mono text-[10px] font-medium tracking-[0.5px] text-surface-dark">
            {building ? "BUILDING" : "DONE"}
          </span>
        </span>
        <span className="font-mono text-[10px] font-medium tracking-[0.4px] text-text-muted-dark">
          2 CAMERAS · {takeCount} TAKE{takeCount === 1 ? "" : "S"} · {formatDuration(footageMs)} OF FOOTAGE
        </span>
      </div>

      <div className="mt-[20px] grid grid-cols-3 gap-[10px]">
        {STEPS.map((step) => {
          const status = stepStatus(step, progress);
          const active = status === "active";
          const label =
            status === "done"
              ? `STEP ${step.index} · DONE`
              : active
                ? `STEP ${step.index} · ${Math.round(progress.stagePct * 100)}%`
                : `STEP ${step.index}`;
          return (
            <div
              key={step.index}
              className={`h-[80px] rounded-[8px] px-4 pt-[13px] ${
                active
                  ? "border border-[rgba(159,176,242,0.6)] bg-[rgba(159,176,242,0.14)]"
                  : "border border-[rgba(159,176,242,0.25)] bg-[rgba(255,255,255,0.05)]"
              }`}
            >
              <p
                className={`font-mono text-[9px] font-medium tracking-[0.45px] ${
                  active ? "text-primary" : "text-text-muted-dark"
                }`}
              >
                {label}
              </p>
              <p className="mt-[8px] text-[13px] font-semibold text-white">{step.title}</p>
              <p className="mt-[5px] text-[11.5px] leading-[16.68px] text-text-on-dark">
                {step.body}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-[24px] font-mono text-[9px] font-medium tracking-[0.45px] text-text-muted-dark">
        DECISION TIMELINE · {building ? "POPULATING LIVE" : "FINAL"}
      </p>
      <div className="mt-[13px] flex gap-[3px]">
        {shown.map((segment, i) => (
          <div
            key={`${segment.kind}-${i}`}
            className={`h-[34px] ${SEGMENT_STYLES[segment.kind].block}`}
            style={{ flexGrow: segment.weight / totalWeight, flexBasis: 0 }}
          />
        ))}
      </div>
      <div className="mt-[10px] flex gap-[3px]">
        {shown.map((segment, i) => (
          <p
            key={`${segment.kind}-label-${i}`}
            className={`overflow-hidden whitespace-nowrap font-mono text-[8px] font-medium tracking-[0.24px] ${SEGMENT_STYLES[segment.kind].label}`}
            style={{ flexGrow: segment.weight / totalWeight, flexBasis: 0 }}
          >
            {segment.label}
          </p>
        ))}
      </div>

      <div className="mt-[22px] flex items-center gap-[29px]">
        <span className="flex items-center gap-[10px]">
          <span className="h-[11px] w-[29px] rounded-[3px] bg-primary" aria-hidden />
          <span className="font-mono text-[9px] font-medium tracking-[0.36px] text-text-muted-dark">
            CAM A · CLOSE
          </span>
        </span>
        <span className="flex items-center gap-[10px]">
          <span
            className="h-[11px] w-[29px] rounded-[3px] border border-[rgba(159,176,242,0.7)]"
            aria-hidden
          />
          <span className="font-mono text-[9px] font-medium tracking-[0.36px] text-text-muted-dark">
            CAM B · WIDE
          </span>
        </span>
        <span className="flex items-center gap-[10px]">
          <span className="h-[11px] w-[29px] rounded-[3px] bg-[rgba(192,57,43,0.55)]" aria-hidden />
          <span className="font-mono text-[9px] font-medium tracking-[0.36px] text-text-muted-dark">
            RETAKE REMOVED
          </span>
        </span>
        <span className="flex items-center gap-[10px]">
          <span className="h-[11px] w-[29px] rounded-[3px] bg-[rgba(159,176,242,0.2)]" aria-hidden />
          <span className="font-mono text-[9px] font-medium tracking-[0.36px] text-text-muted-dark">
            SILENCE TRIMMED
          </span>
        </span>
      </div>
    </div>
  );
}
