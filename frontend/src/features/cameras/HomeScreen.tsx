import { DollyLogo } from "../../components/DollyLogo";
import { DollyScreen } from "../../components/DollyScreen";
import { PrimaryButton, SecondaryButton } from "../../components/Buttons";
import { useDollyActor } from "../../app/DollyContext";

/** Screen 1 · Launch (Figma 121:1477): the dolly wordmark, one line, one primary action. */
export function HomeScreen() {
  const actor = useDollyActor();
  return (
    <DollyScreen label="Home">
      <div className="flex h-[453px] flex-col">
        <div className="flex grow flex-col items-center justify-center gap-[18px] pb-[40px]">
          <DollyLogo />
          <p className="text-[22px] leading-[33px] text-text-on-dark">Your crew is ready.</p>
        </div>
        <div className="flex flex-col gap-[20px]">
          <PrimaryButton onClick={() => actor.send({ type: "START_SESSION" })}>
            Start a session
          </PrimaryButton>
          <SecondaryButton onClick={() => actor.send({ type: "OPEN_PAST_PROJECTS" })}>
            Past projects
          </SecondaryButton>
        </div>
      </div>
    </DollyScreen>
  );
}
