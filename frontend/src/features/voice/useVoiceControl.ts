import { useEffect, useRef, useState } from "react";
import { useSelector } from "@xstate/react";
import { newId, saveVoiceEvent } from "../../db/dollyDb";
import { getBackendConfig, isTestMode } from "../../services/config";
import { MockVoiceService } from "../../services/voice/MockVoiceService";
import {
  WebSpeechVoiceService,
  isWebSpeechAvailable,
} from "../../services/voice/WebSpeechVoiceService";
import { WsVoiceService } from "../../services/voice/WsVoiceService";
import type { VoiceService } from "../../services/voice/types";
import type { DollyActor } from "../../services/session/SessionService";
import type { VoiceCommand, VoiceEvent } from "../../types";
import { SPOKEN_CONFIRMATIONS, parseUtterance } from "./parseCommand";
import type { VoiceStatus } from "../../app/DollyContext";

const LISTENING_STATES: ReadonlySet<string> = new Set(["ready", "recording", "holding"]);

const VALID_COMMANDS: Record<string, ReadonlySet<VoiceCommand>> = {
  ready: new Set<VoiceCommand>(["ACTION"]),
  recording: new Set<VoiceCommand>(["AGAIN", "HOLD", "CUT"]),
  holding: new Set<VoiceCommand>(["ACTION", "CUT"]),
};

declare global {
  interface Window {
    /** e2e instrumentation: deterministic voice input driven by Playwright. */
    __dollyVoice?: MockVoiceService;
  }
}

function createVoiceService(): VoiceService | null {
  if (isTestMode()) {
    const mock = new MockVoiceService();
    window.__dollyVoice = mock;
    return mock;
  }
  const backend = getBackendConfig();
  if (backend.connected) return new WsVoiceService(backend.wsBase);
  if (isWebSpeechAvailable()) return new WebSpeechVoiceService();
  return null;
}

/**
 * Arms the voice pipeline while the machine is in a listening state.
 * Every final utterance goes through the wake-word parser; only the four
 * accepted "Dolly, …" commands are sent to the machine, and each accepted
 * command is confirmed out loud and lands in the on-screen log.
 */
export function useVoiceControl(actor: DollyActor): VoiceStatus {
  const state = useSelector(actor, (snapshot) => String(snapshot.value));
  const projectId = useSelector(actor, (snapshot) => snapshot.context.projectId);
  const [status, setStatus] = useState<VoiceStatus>({
    listening: false,
    error: null,
    interim: "",
    kind: "none",
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const shouldListen = LISTENING_STATES.has(state);

  useEffect(() => {
    if (!shouldListen) return;

    const service = createVoiceService();
    if (!service) {
      setStatus({
        listening: false,
        error: "VOICE UNAVAILABLE IN THIS BROWSER · DOLLY IS STILL SAVING YOUR SESSION",
        interim: "",
        kind: "none",
      });
      return;
    }

    setStatus((prev) => ({ ...prev, kind: service.kind, error: null }));

    service.start((event) => {
      if (event.type === "status") {
        setStatus((prev) => ({ ...prev, listening: event.listening }));
        return;
      }
      if (event.type === "error") {
        setStatus((prev) => ({ ...prev, error: event.message }));
        return;
      }
      if (!event.isFinal) {
        setStatus((prev) => ({ ...prev, interim: event.transcript }));
        return;
      }
      setStatus((prev) => ({ ...prev, interim: "" }));

      const parsed = parseUtterance(event.transcript, event.confidence);
      const voiceEvent: VoiceEvent = {
        id: newId(),
        projectId,
        ts: Date.now(),
        transcript: event.transcript,
        confidence: event.confidence,
        command: parsed.command,
        accepted: parsed.accepted,
        rejectionReason: parsed.rejectionReason,
      };
      actor.send({ type: "VOICE", event: voiceEvent });
      void saveVoiceEvent(voiceEvent);

      const valid = VALID_COMMANDS[stateRef.current];
      if (parsed.accepted && parsed.command && valid?.has(parsed.command)) {
        service.speak(SPOKEN_CONFIRMATIONS[parsed.command]);
      }
    });

    return () => {
      service.stop();
      setStatus((prev) => ({ ...prev, listening: false, interim: "" }));
    };
  }, [shouldListen, actor, projectId]);

  return status;
}
