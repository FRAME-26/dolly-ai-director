import { useState } from "react";
import { useSelector } from "@xstate/react";
import { DollyScreen } from "../../components/DollyScreen";
import { SecondaryButton } from "../../components/Buttons";
import { AssemblyReveal } from "../../components/AssemblyReveal";
import { BuildProgressBar } from "../../components/BuildProgressBar";
import { MonoCaption } from "../../components/MonoCaption";
import { deriveDecisionTimeline } from "../../machines/dollyMachine";
import { useDollyActor } from "../../app/DollyContext";

/**
 * Screen 7 · Building (Figma 121:1557) with the optional assembly reveal
 * (Figma 121:1226, "View progress" per the 09 flow map). Advances to Review
 * on its own; the creator can walk away.
 */
export function BuildingScreen() {
  const actor = useDollyActor();
  const context = useSelector(actor, (s) => s.context);
  const [expanded, setExpanded] = useState(false);

  const footageMs = context.takes.reduce((sum, take) => sum + take.durationMs, 0);

  if (expanded) {
    return (
      <DollyScreen label="Building" variant="wide">
        <AssemblyReveal
          progress={context.buildProgress}
          segments={deriveDecisionTimeline(context.takes)}
          takeCount={context.takes.length}
          footageMs={footageMs}
        />
        <div className="mx-auto mt-[24px] w-[460px]">
          <SecondaryButton onClick={() => setExpanded(false)}>Hide progress</SecondaryButton>
        </div>
        <MonoCaption className="mt-[18px]">CREATOR CAN WALK AWAY</MonoCaption>
      </DollyScreen>
    );
  }

  return (
    <DollyScreen label="Building" variant="session">
      <div className="flex min-h-[352px] flex-col">
        <p className="mt-[48px] text-center text-[28px] font-semibold leading-[38px] text-white">
          That&#39;s a wrap.
          <br />
          Dolly is building your cut.
        </p>
        <div className="mt-[22px]">
          <BuildProgressBar progress={context.buildProgress} draftVersion={context.draftVersion} />
        </div>
        <div className="mt-[26px]">
          <SecondaryButton onClick={() => setExpanded(true)}>View progress</SecondaryButton>
        </div>
        <MonoCaption className="mt-auto pt-[20px]">CREATOR CAN WALK AWAY</MonoCaption>
      </div>
    </DollyScreen>
  );
}
