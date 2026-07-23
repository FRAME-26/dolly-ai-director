import { useSelector } from "@xstate/react";
import { DollyScreen } from "../../components/DollyScreen";
import { ExitAction, PrimaryButton, SecondaryButton } from "../../components/Buttons";
import { CameraRoleCard } from "../../components/CameraRoleCard";
import { useDollyActor } from "../../app/DollyContext";

/** Screen 4 · Roles (Figma 121:1513): the creator's final normal setup action. */
export function RolesScreen() {
  const actor = useDollyActor();
  const cameras = useSelector(actor, (s) => s.context.cameras);

  return (
    <DollyScreen label="Roles & placement">
      <div className="flex min-h-[453px] flex-col">
        <div className="mt-[10px] flex flex-col gap-[12px]">
          <CameraRoleCard camera={cameras.A} />
          <CameraRoleCard camera={cameras.B} />
        </div>
        <p className="mt-[20px] text-[21px] leading-[29.4px] text-text-on-dark">
          Dolly gave each camera a job. Place them, close and wide.
        </p>
        <div className="mt-auto flex flex-col gap-[20px] pt-[24px]">
          <PrimaryButton onClick={() => actor.send({ type: "PLACED" })}>
            I&#39;ve placed them
          </PrimaryButton>
          <SecondaryButton onClick={() => actor.send({ type: "SWAP_ROLES" })}>
            Swap roles
          </SecondaryButton>
          <ExitAction onClick={() => actor.send({ type: "BACK" })}>Back</ExitAction>
        </div>
      </div>
    </DollyScreen>
  );
}
