import { useEffect } from "react";
import { useSelector } from "@xstate/react";
import { DollyScreen } from "../../components/DollyScreen";
import { ExitAction, PrimaryButton, SecondaryButton } from "../../components/Buttons";
import { CameraConnectionRow } from "../../components/CameraConnectionRow";
import { ErrorRecoveryMessage } from "../../components/ErrorRecoveryMessage";
import { MonoCaption } from "../../components/MonoCaption";
import { useDolly } from "../../app/DollyContext";

/** Screen 3 · Connect (Figma 121:1498): Continue stays dead until both cameras answer. */
export function ConnectScreen() {
  const { actor, cameraService } = useDolly();
  const cameras = useSelector(actor, (s) => s.context.cameras);
  const bothConnected =
    cameras.A.connection === "connected" && cameras.B.connection === "connected";
  const anyError = cameras.A.connection === "error" || cameras.B.connection === "error";
  const demo = cameras.A.demo || cameras.B.demo;

  useEffect(() => {
    const alreadyPaired =
      actor.getSnapshot().context.cameras.A.connection === "connected" &&
      actor.getSnapshot().context.cameras.B.connection === "connected";
    if (alreadyPaired) return;
    cameraService.startPairing((camera) => {
      actor.send({ type: "CAMERA_STATUS", camera });
    });
    return () => cameraService.stop();
  }, [actor, cameraService]);

  return (
    <DollyScreen label="Connect cameras">
      <div className="flex min-h-[453px] flex-col">
        <p className="mt-[16px] text-[21px] leading-[29.4px] text-text-on-dark">
          Pair both cameras.
        </p>
        <div className="mt-[10px]">
          <CameraConnectionRow camera={cameras.A} />
          <CameraConnectionRow camera={cameras.B} />
        </div>
        {demo ? (
          <MonoCaption className="mt-[14px] text-left">
            DEMO CAMERAS · NO REAL HARDWARE CONNECTED
          </MonoCaption>
        ) : null}
        {anyError ? (
          <div className="mt-[14px]">
            <ErrorRecoveryMessage
              message={`CAM ${cameras.A.connection === "error" ? "A" : "B"} ISN'T ANSWERING. CHECK THE CABLE. DOLLY RE-DETECTS WHEN YOU TROUBLESHOOT ↺`}
            />
          </div>
        ) : null}
        <div className="mt-auto flex flex-col gap-[16px] pt-[24px]">
          <PrimaryButton
            disabled={!bothConnected}
            onClick={() => actor.send({ type: "CONTINUE" })}
          >
            Continue
          </PrimaryButton>
          <MonoCaption>ENABLES WHEN BOTH CAMERAS ANSWER</MonoCaption>
          <SecondaryButton
            onClick={() => {
              if (cameras.A.connection !== "connected") cameraService.troubleshoot("A");
              if (cameras.B.connection !== "connected") cameraService.troubleshoot("B");
            }}
          >
            Troubleshoot a camera
          </SecondaryButton>
          <ExitAction onClick={() => actor.send({ type: "BACK" })}>Back</ExitAction>
        </div>
      </div>
    </DollyScreen>
  );
}
