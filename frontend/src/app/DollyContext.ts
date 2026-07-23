import { createContext, useContext } from "react";
import { useSelector } from "@xstate/react";
import type { DollyActor } from "../services/session/SessionService";
import type { MockCameraService } from "../services/cameras/CameraService";
import type { WorkflowState } from "../types";

export interface VoiceStatus {
  listening: boolean;
  error: string | null;
  interim: string;
  kind: "webspeech" | "websocket" | "mock" | "none";
}

export interface DollyAppContext {
  actor: DollyActor;
  cameraService: MockCameraService;
  voiceStatus: VoiceStatus;
  /** Dolly Save: reopen a saved project (completed → Export, unfinished → latest valid state). */
  openProject(id: string): Promise<void>;
}

export const DollyContext = createContext<DollyAppContext | null>(null);

export function useDolly(): DollyAppContext {
  const value = useContext(DollyContext);
  if (!value) throw new Error("useDolly must be used inside DollyContext");
  return value;
}

export function useDollyActor(): DollyActor {
  return useDolly().actor;
}

export function useWorkflowState(): WorkflowState | "boot" {
  const actor = useDollyActor();
  return useSelector(actor, (snapshot) => snapshot.value as WorkflowState | "boot");
}
