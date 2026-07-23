import { useState } from "react";
import { useSelector } from "@xstate/react";
import { DollyScreen } from "../../components/DollyScreen";
import { PrimaryButton, SecondaryButton } from "../../components/Buttons";
import { DraftPlayer } from "../../components/DraftPlayer";
import { RawTakesDrawer } from "../../components/RawTakesDrawer";
import { useDollyActor } from "../../app/DollyContext";

/**
 * Screen 8 · Review (Figma 121:1566): buttons return here. "Request changes ↺"
 * loops back to Building; a new draft comes back to this page.
 */
export function ReviewScreen() {
  const actor = useDollyActor();
  const context = useSelector(actor, (s) => s.context);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const draft = context.drafts[context.drafts.length - 1];
  if (!draft) return null;

  return (
    <DollyScreen label="Draft review">
      <div className="flex min-h-[453px] flex-col">
        <div className="mt-[10px]">
          <DraftPlayer draft={draft} />
        </div>
        <div className="mt-[18px]">
          <SecondaryButton onClick={() => setDrawerOpen(true)}>See raw takes</SecondaryButton>
        </div>
        <div className="mt-auto flex flex-col gap-[20px] pt-[24px]">
          <PrimaryButton onClick={() => actor.send({ type: "APPROVE" })}>
            It&#39;s good, export it
          </PrimaryButton>
          <SecondaryButton onClick={() => setFeedbackOpen(true)}>
            Request changes ↺
          </SecondaryButton>
        </div>
      </div>

      {drawerOpen ? (
        <RawTakesDrawer takes={context.takes} onClose={() => setDrawerOpen(false)} />
      ) : null}

      {feedbackOpen ? (
        <div
          role="dialog"
          aria-label="Notes to Dolly"
          className="absolute inset-0 flex flex-col justify-center gap-[16px] rounded-[20px] bg-surface-dark-2/95 px-8"
        >
          <p className="font-mono text-[18px] font-semibold tracking-[0.72px] text-text-muted-dark">
            NOTES TO DOLLY · A NEW DRAFT RETURNS HERE
          </p>
          <textarea
            aria-label="Feedback for the next draft"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-[12px] border border-[rgba(159,176,242,0.3)] bg-[rgba(255,255,255,0.05)] p-4 text-[21px] leading-[29.4px] text-text-on-dark"
          />
          <PrimaryButton
            disabled={notes.trim().length === 0}
            onClick={() => {
              actor.send({ type: "REQUEST_CHANGES", notes: notes.trim() });
              setFeedbackOpen(false);
              setNotes("");
            }}
          >
            Send notes, rebuild
          </PrimaryButton>
          <SecondaryButton onClick={() => setFeedbackOpen(false)}>Cancel</SecondaryButton>
        </div>
      ) : null}
    </DollyScreen>
  );
}
