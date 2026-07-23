import { useSelector } from "@xstate/react";
import { DollyScreen } from "../../components/DollyScreen";
import { ExitAction } from "../../components/Buttons";
import { ErrorRecoveryMessage } from "../../components/ErrorRecoveryMessage";
import { MonoCaption } from "../../components/MonoCaption";
import { VoiceConfirmation } from "../../components/VoiceConfirmation";
import { VoiceTranscript } from "../../components/VoiceTranscript";
import { useDolly } from "../../app/DollyContext";

/** Screen 5 · Ready (Figma 121:1533): no advance buttons — Dolly is listening. */
export function ReadyScreen() {
  const { actor, voiceStatus } = useDolly();
  const voiceLog = useSelector(actor, (s) => s.context.voiceLog);
  const lastEvent = voiceLog[voiceLog.length - 1];

  return (
    <DollyScreen label="Ready" variant="session">
      <div className="flex min-h-[352px] flex-col items-center">
        <span className="mt-[26px] inline-flex h-[36px] items-center rounded-[10px] border border-[rgba(159,176,242,0.5)] px-[16px] font-mono text-[16px] font-medium text-primary">
          READY · 2 CAMERAS TRACKING
        </span>
        <p className="mt-[28px] text-center text-[28px] font-semibold leading-[38px] text-white">
          Say &quot;Dolly, action&quot;
          <br />
          when you&#39;re ready.
        </p>
        <span
          className="mt-[18px] grid h-[72px] w-[76px] place-items-center rounded-full border border-[rgba(255,255,255,0.95)] shadow-[0px_0px_28px_0px_rgba(140,160,255,0.5)]"
          aria-hidden
        >
          <span
            className="block h-[20px] w-[18px] bg-white"
            style={{
              maskImage: "url(/assets/mic.svg)",
              maskRepeat: "no-repeat",
              maskSize: "18px 20px",
              WebkitMaskImage: "url(/assets/mic.svg)",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskSize: "18px 20px",
            }}
          />
        </span>
        <div className="mt-[20px] flex w-full flex-col gap-[8px]">
          <VoiceConfirmation event={lastEvent} />
          <VoiceTranscript interim={voiceStatus.interim} />
          {voiceStatus.error ? <ErrorRecoveryMessage message={voiceStatus.error} /> : null}
        </div>
        <MonoCaption className="mt-auto pt-[20px]">
          NO BUTTONS · DOLLY IS LISTENING
        </MonoCaption>
        <div className="mt-[20px] w-full">
          <ExitAction onClick={() => actor.send({ type: "END_SESSION" })}>
            End session
          </ExitAction>
        </div>
      </div>
    </DollyScreen>
  );
}
