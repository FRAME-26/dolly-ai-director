import { useSelector } from "@xstate/react";
import { DollyScreen } from "../../components/DollyScreen";
import { ErrorRecoveryMessage } from "../../components/ErrorRecoveryMessage";
import { MonoCaption } from "../../components/MonoCaption";
import { RecordingTimer } from "../../components/RecordingTimer";
import { ShotLog } from "../../components/ShotLog";
import { VoiceConfirmation } from "../../components/VoiceConfirmation";
import { VoiceTranscript } from "../../components/VoiceTranscript";
import { useDolly } from "../../app/DollyContext";

/**
 * Screen 6 · Recording and 6B · Holding (Figma 121:1546, 09 map step 6/6B).
 * Voice-only: no manual action buttons, no back button. "Dolly, cut" is the
 * only way out, and it moves forward to editing.
 */
export function RecordingScreen({ holding }: { holding: boolean }) {
  const { actor, voiceStatus } = useDolly();
  const context = useSelector(actor, (s) => s.context);
  const cameraSummary = `CAM A ${context.cameras.A.role} · CAM B ${context.cameras.B.role} · TRACKING`;
  const lastEvent = context.voiceLog[context.voiceLog.length - 1];

  return (
    <DollyScreen label={holding ? "Holding" : "Recording"} variant="session" glow={!holding}>
      <div className="flex min-h-[352px] flex-col">
        <div className="flex justify-end">
          <RecordingTimer
            label={holding ? "HOLDING" : "ROLLING"}
            ms={context.recordedMs}
            live={!holding}
          />
        </div>
        <div className="mt-[16px]">
          <ShotLog
            takes={context.takes}
            voiceLog={context.voiceLog}
            cameraSummary={cameraSummary}
          />
        </div>
        <p className="mt-[18px] text-[21px] leading-[29.4px] text-text-on-dark">
          The cameras record on their own. This screen is a shot log: every take
          and every command confirmation, timestamped.
        </p>
        <div className="mt-[12px] flex flex-col gap-[8px]">
          <VoiceConfirmation event={lastEvent} />
          <VoiceTranscript interim={voiceStatus.interim} />
          {voiceStatus.error ? <ErrorRecoveryMessage message={voiceStatus.error} /> : null}
        </div>
        <MonoCaption className="mt-auto pt-[18px]">
          {holding
            ? "“ACTION” RESUMES RECORDING · “CUT” ALSO WRAPS FROM HERE"
            : "“AGAIN” ↺ RETAKE · “HOLD” ⇄ PAUSE · “CUT” ENDS"}
        </MonoCaption>
      </div>
    </DollyScreen>
  );
}
