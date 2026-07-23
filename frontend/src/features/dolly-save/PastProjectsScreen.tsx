import { useEffect, useState } from "react";
import { DollyScreen } from "../../components/DollyScreen";
import { ExitAction } from "../../components/Buttons";
import { MonoCaption } from "../../components/MonoCaption";
import { StatusPill } from "../../components/StatusPill";
import { formatDuration } from "../../components/RecordingTimer";
import { sessionService } from "../../services/session/SessionService";
import { useDolly } from "../../app/DollyContext";
import type { ProjectRecord } from "../../types";

/**
 * Dolly Save · Past projects (Figma 09: "OPENS THE EXPORT PAGE OF ANY OLD
 * SESSION"). Completed projects reopen at Export; unfinished ones restore
 * their latest valid state.
 */
export function PastProjectsScreen() {
  const { actor, openProject } = useDolly();
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);

  useEffect(() => {
    void sessionService.listProjects().then(setProjects);
  }, []);

  return (
    <DollyScreen label="Past projects">
      <div className="flex min-h-[453px] flex-col">
        <p className="text-[22px] font-semibold text-white">Past projects</p>
        <MonoCaption className="mt-[8px] text-left">
          OPENS THE EXPORT PAGE OF ANY OLD SESSION
        </MonoCaption>
        <div className="mt-[14px] max-h-[280px] overflow-y-auto">
          {projects === null ? (
            <p className="py-4 font-mono text-[16px] text-text-muted-dark">LOADING…</p>
          ) : projects.length === 0 ? (
            <p className="py-4 font-mono text-[16px] text-text-muted-dark">
              NO SAVED SESSIONS YET
            </p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => void openProject(project.id)}
                className="flex h-[56px] w-full items-center justify-between border-b border-[rgba(159,176,242,0.15)] text-left"
              >
                <span className="flex flex-col">
                  <span className="font-mono text-[16px] font-medium text-text-on-dark">
                    {project.title}
                  </span>
                  <span className="font-mono text-[13px] text-text-muted-dark">
                    {new Date(project.updatedAt).toLocaleString()} ·{" "}
                    {formatDuration(project.recordedMs)} RECORDED
                  </span>
                </span>
                <StatusPill variant={project.workflowState === "export" ? "filled" : "outline"}>
                  {project.workflowState === "export" ? "DELIVERED" : project.workflowState.toUpperCase()}
                </StatusPill>
              </button>
            ))
          )}
        </div>
        <div className="mt-auto pt-[24px]">
          <ExitAction onClick={() => actor.send({ type: "BACK" })}>Back</ExitAction>
        </div>
      </div>
    </DollyScreen>
  );
}
