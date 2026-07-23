import { createActor } from "xstate";
import { dollyMachine, type DollyInput } from "../machines/dollyMachine";
import { newId } from "../db/dollyDb";
import type { VoiceCommand, VoiceEvent } from "../types";

export function startActor(input: DollyInput = {}) {
  const actor = createActor(dollyMachine, { input });
  actor.start();
  return actor;
}

export function voiceEvent(
  command: VoiceCommand | null,
  overrides: Partial<VoiceEvent> = {},
): VoiceEvent {
  return {
    id: newId(),
    projectId: "test-project",
    ts: Date.now(),
    transcript: command ? `dolly ${command.toLowerCase()}` : "unrelated speech",
    confidence: 0.9,
    command,
    accepted: command !== null,
    rejectionReason: command ? null : "NO WAKE WORD",
    ...overrides,
  };
}

type TestActor = ReturnType<typeof startActor>;

export function walkToConnect(actor: TestActor) {
  actor.send({ type: "START_SESSION" });
  actor.send({ type: "PERMISSIONS_RESULT", camera: "granted", voice: "granted" });
}

export function connectBothCameras(actor: TestActor) {
  const { A, B } = actor.getSnapshot().context.cameras;
  actor.send({ type: "CAMERA_STATUS", camera: { ...A, connection: "connected" } });
  actor.send({ type: "CAMERA_STATUS", camera: { ...B, connection: "connected" } });
}

export function walkToReady(actor: TestActor) {
  walkToConnect(actor);
  connectBothCameras(actor);
  actor.send({ type: "CONTINUE" });
  actor.send({ type: "PLACED" });
}

export function walkToRecording(actor: TestActor) {
  walkToReady(actor);
  actor.send({ type: "VOICE", event: voiceEvent("ACTION") });
}
