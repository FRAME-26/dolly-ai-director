import type { CameraState } from "../types";
import { StatusPill } from "./StatusPill";

const CONNECTION_LABEL: Record<CameraState["connection"], string> = {
  waiting: "WAITING…",
  connecting: "CONNECTING…",
  connected: "CONNECTED",
  error: "NOT ANSWERING",
};

/** CAM A / CAM B pairing row with live connection pill (Figma 121:1501–121:1507). */
export function CameraConnectionRow({ camera }: { camera: CameraState }) {
  const variant =
    camera.connection === "connected"
      ? "filled"
      : camera.connection === "error"
        ? "error"
        : "outline";
  return (
    <div className="flex h-[50px] items-center justify-between border-b border-[rgba(159,176,242,0.15)]">
      <span className="font-mono text-[18px] font-medium text-text-on-dark">
        CAM {camera.key}
      </span>
      <StatusPill variant={variant}>{CONNECTION_LABEL[camera.connection]}</StatusPill>
    </div>
  );
}
