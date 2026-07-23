import { useState } from "react";
import { useSelector } from "@xstate/react";
import { DollyScreen } from "../../components/DollyScreen";
import { PrimaryButton, SecondaryButton } from "../../components/Buttons";
import { ErrorRecoveryMessage } from "../../components/ErrorRecoveryMessage";
import { MonoCaption } from "../../components/MonoCaption";
import { StatusPill } from "../../components/StatusPill";
import { formatDuration } from "../../components/RecordingTimer";
import { exportService } from "../../services/export/ExportService";
import type { IntegrationResult } from "../../services/export/ExportService";
import { snapshotToRecord } from "../../machines/dollyMachine";
import { useDollyActor } from "../../app/DollyContext";

/**
 * Screen 9 · Export (Figma 09 map, steps 121:1707–121:1724): Download, Share,
 * the OTIO handoff to Resolve, Reap publishing, and the loop back home.
 */
export function ExportScreen() {
  const actor = useDollyActor();
  const context = useSelector(actor, (s) => s.context);
  const [results, setResults] = useState<Record<string, IntegrationResult>>({});

  const draft = context.drafts[context.drafts.length - 1];

  const report = (key: string) => (result: IntegrationResult) => {
    setResults((prev) => ({ ...prev, [key]: result }));
  };

  return (
    <DollyScreen label="Export">
      <div className="flex flex-col">
        <div className="flex justify-center">
          <StatusPill>END · VIDEO DELIVERED</StatusPill>
        </div>
        {draft ? (
          <MonoCaption className="mt-[14px]">
            DRAFT {draft.version} · {formatDuration(draft.durationMs)}
          </MonoCaption>
        ) : null}

        <div className="mt-[24px] flex flex-col gap-[14px]">
          <PrimaryButton
            disabled={!draft}
            onClick={() => {
              if (!draft) return;
              const record = snapshotToRecord(context, "export");
              report("download")(exportService.download(record, draft, context.takes));
              actor.send({ type: "EXPORT_ACTION", action: "downloaded" });
            }}
          >
            Download
          </PrimaryButton>
          {results.download ? (
            <MonoCaption>{results.download.ok ? results.download.detail : ""}</MonoCaption>
          ) : (
            <MonoCaption>STAYS HERE</MonoCaption>
          )}

          <PrimaryButton
            disabled={!draft}
            onClick={() => {
              if (!draft) return;
              const record = snapshotToRecord(context, "export");
              void exportService.share(record, draft).then((result) => {
                report("share")(result);
                if (result.ok) actor.send({ type: "EXPORT_ACTION", action: "shared" });
              });
            }}
          >
            Share
          </PrimaryButton>
          {results.share ? (
            results.share.ok ? (
              <MonoCaption>{results.share.detail}</MonoCaption>
            ) : (
              <ErrorRecoveryMessage message={results.share.reason} />
            )
          ) : (
            <MonoCaption>STAYS HERE</MonoCaption>
          )}

          <SecondaryButton
            disabled={!draft}
            onClick={() => {
              if (!draft) return;
              void exportService.openTimelineInResolve(draft).then((result) => {
                report("resolve")(result);
                if (result.ok) actor.send({ type: "EXPORT_ACTION", action: "resolveOpened" });
              });
            }}
          >
            Open timeline in Resolve
          </SecondaryButton>
          {results.resolve ? (
            results.resolve.ok ? (
              <MonoCaption>{results.resolve.detail}</MonoCaption>
            ) : (
              <ErrorRecoveryMessage message={results.resolve.reason} />
            )
          ) : (
            <MonoCaption>OTIO HANDOFF · FOR PRO EDITORS</MonoCaption>
          )}

          <SecondaryButton
            disabled={!draft}
            onClick={() => {
              if (!draft) return;
              void exportService.publishToSocials(draft).then((result) => {
                report("publish")(result);
                if (result.ok) actor.send({ type: "EXPORT_ACTION", action: "published" });
              });
            }}
          >
            Publish to socials
          </SecondaryButton>
          {results.publish ? (
            results.publish.ok ? (
              <MonoCaption>{results.publish.detail}</MonoCaption>
            ) : (
              <ErrorRecoveryMessage message={results.publish.reason} />
            )
          ) : (
            <MonoCaption>VIA REAP · CAPTIONS + SCHEDULING</MonoCaption>
          )}

          <SecondaryButton onClick={() => actor.send({ type: "NEW_SESSION" })}>
            Start a new session
          </SecondaryButton>
          <MonoCaption>↺ BACK TO HOME · SETUP REMEMBERED</MonoCaption>
        </div>
      </div>
    </DollyScreen>
  );
}
