import { useState } from "react";
import { useSelector } from "@xstate/react";
import { DollyScreen } from "../../components/DollyScreen";
import { ExitAction, PrimaryButton, TertiaryAction } from "../../components/Buttons";
import { ErrorRecoveryMessage } from "../../components/ErrorRecoveryMessage";
import { useDollyActor } from "../../app/DollyContext";
import { isTestMode } from "../../services/config";

function PermissionCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-[84px] flex-col justify-center gap-[8px] rounded-[12px] border border-[rgba(159,176,242,0.3)] bg-[rgba(255,255,255,0.05)] px-[20px]">
      <p className="text-[22px] font-semibold text-white">{title}</p>
      <p className="font-mono text-[16px] font-medium text-primary">{detail}</p>
    </div>
  );
}

async function requestPermissions(): Promise<boolean> {
  if (isTestMode()) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

/** Screen 2 · Permissions (Figma 121:1485): camera + voice, one primary, an explanation, a way out. */
export function PermissionsScreen() {
  const actor = useDollyActor();
  const permissions = useSelector(actor, (s) => s.context.permissions);
  const [showWhy, setShowWhy] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const denied = permissions.camera === "denied" || permissions.voice === "denied";

  return (
    <DollyScreen label="Permissions">
      <div className="flex min-h-[453px] flex-col">
        <div className="mt-[24px] flex flex-col gap-[16px]">
          <PermissionCard title="Camera" detail="TO SEE THE ROOM" />
          <PermissionCard title="Voice" detail="TO HEAR COMMANDS" />
        </div>
        {denied ? (
          <div className="mt-[20px]">
            <ErrorRecoveryMessage message="CAMERA OR VOICE ACCESS IS OFF. DOLLY NEEDS BOTH ONCE THE SHOOT STARTS. ALLOW ACCESS IN THE BROWSER BAR, THEN TAP ALLOW AGAIN." />
          </div>
        ) : null}
        <div className="mt-auto flex flex-col gap-[20px] pt-[24px]">
          <PrimaryButton
            disabled={requesting}
            onClick={() => {
              setRequesting(true);
              void requestPermissions().then((granted) => {
                setRequesting(false);
                actor.send({
                  type: "PERMISSIONS_RESULT",
                  camera: granted ? "granted" : "denied",
                  voice: granted ? "granted" : "denied",
                });
              });
            }}
          >
            Allow camera &amp; voice
          </PrimaryButton>
          <TertiaryAction onClick={() => setShowWhy(true)}>
            Why does Dolly need this?
          </TertiaryAction>
          <ExitAction onClick={() => actor.send({ type: "NOT_NOW" })}>Not now</ExitAction>
        </div>
      </div>

      {showWhy ? (
        <div
          role="dialog"
          aria-label="Why does Dolly need this?"
          className="absolute inset-0 flex flex-col justify-center gap-[20px] rounded-[20px] bg-surface-dark-2/95 px-8"
          onClick={() => setShowWhy(false)}
        >
          <p className="text-[22px] font-semibold text-white">Why does Dolly need this?</p>
          <p className="text-[21px] leading-[29.4px] text-text-on-dark">
            Dolly asks for microphone permission up front, explaining why: voice is
            the only control surface once the shoot starts.
          </p>
          <p className="text-[21px] leading-[29.4px] text-text-on-dark">
            The camera is how Dolly sees the room, keeps both Luna Ultras tracking
            you, and confirms each one as it answers.
          </p>
          <p className="font-mono text-[16px] font-medium text-text-muted-dark">
            EXPLAINS · STAYS HERE — TAP ANYWHERE TO GO BACK
          </p>
        </div>
      ) : null}
    </DollyScreen>
  );
}
