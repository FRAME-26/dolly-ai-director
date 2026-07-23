import type { CameraState } from "../types";
import { StatusPill } from "./StatusPill";

const ROLE_DETAIL: Record<CameraState["role"], string> = {
  CLOSE: "TELEPHOTO · SUBJECT LEFT THIRD",
  WIDE: "WIDE ANGLE · SUBJECT RIGHT THIRD",
};

/** Camera role assignment card (Figma 121:1515–121:1524). */
export function CameraRoleCard({ camera }: { camera: CameraState }) {
  return (
    <div className="relative flex h-[82px] items-center rounded-[12px] border border-[rgba(159,176,242,0.3)] pl-[18px] pr-[14px]">
      <div className="flex flex-col gap-[7px]">
        <span className="font-mono text-[20px] font-semibold text-white">
          CAM {camera.key} · {camera.role}
        </span>
        <span className="font-mono text-[16px] font-medium text-text-muted-dark">
          {ROLE_DETAIL[camera.role]}
        </span>
      </div>
      <StatusPill className="ml-auto" variant={camera.tracking ? "filled" : "outline"}>
        {camera.tracking ? "TRACKING" : "ASSIGNED"}
      </StatusPill>
    </div>
  );
}
