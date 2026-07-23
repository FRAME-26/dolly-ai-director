import type { ActorRefFrom, SnapshotFrom } from "xstate";
import {
  db,
  getLastSetup,
  getProject,
  listDrafts,
  listProjects,
  listTakes,
  listVoiceEvents,
  saveDraft,
  saveLastSetup,
  saveProject,
  saveTake,
  saveVoiceEvent,
} from "../../db/dollyDb";
import { snapshotToRecord, type dollyMachine } from "../../machines/dollyMachine";
import type { ProjectRecord, SavedSetup, WorkflowState } from "../../types";

export type DollyActor = ActorRefFrom<typeof dollyMachine>;
export type DollySnapshot = SnapshotFrom<typeof dollyMachine>;

export interface SessionService {
  /** Write-through persistence: every transition lands in IndexedDB. */
  attach(actor: DollyActor): () => void;
  listProjects(): Promise<ProjectRecord[]>;
  loadProject(id: string): ReturnType<typeof loadProjectBundle>;
  getLastSetup(): Promise<SavedSetup | undefined>;
}

async function loadProjectBundle(id: string) {
  const record = await getProject(id);
  if (!record) return undefined;
  const [takes, drafts, voiceEvents] = await Promise.all([
    listTakes(id),
    listDrafts(id),
    listVoiceEvents(id),
  ]);
  return { record, takes, drafts, voiceEvents };
}

function workflowStateOf(snapshot: DollySnapshot): WorkflowState | null {
  const value = snapshot.value;
  if (typeof value !== "string" || value === "boot") return null;
  return value as WorkflowState;
}

export class DexieSessionService implements SessionService {
  attach(actor: DollyActor): () => void {
    let lastPersisted = "";
    const persist = (snapshot: DollySnapshot) => {
      const state = workflowStateOf(snapshot);
      if (state === null) return;
      const context = snapshot.context;
      const fingerprint = JSON.stringify([state, context]);
      if (fingerprint === lastPersisted) return;
      lastPersisted = fingerprint;

      // A brand-new session that is only sitting on Home or browsing past
      // projects is not a project yet — nothing to save.
      const freshHome =
        (state === "home" || state === "pastProjects") &&
        context.takes.length === 0 &&
        context.draftVersion === 0;

      void (async () => {
        if (!freshHome) {
          await saveProject(snapshotToRecord(context, state));
          await Promise.all(context.takes.map((take) => saveTake(take)));
          await Promise.all(context.drafts.map((draft) => saveDraft(draft)));
          await Promise.all(context.voiceLog.map((event) => saveVoiceEvent(event)));
        }
        // Leaving via End session — or finishing a session — remembers the
        // completed camera setup, so coming back is one tap.
        if ((state === "home" || state === "export") && context.cameras.A.tracking) {
          await saveLastSetup({
            cameraA: context.cameras.A,
            cameraB: context.cameras.B,
            savedAt: Date.now(),
          });
        }
      })();
    };

    persist(actor.getSnapshot());
    const subscription = actor.subscribe(persist);
    return () => subscription.unsubscribe();
  }

  listProjects(): Promise<ProjectRecord[]> {
    return listProjects();
  }

  loadProject(id: string) {
    return loadProjectBundle(id);
  }

  getLastSetup(): Promise<SavedSetup | undefined> {
    return getLastSetup();
  }
}

export const sessionService: SessionService = new DexieSessionService();

/** Exposed for tests that need a clean database. */
export async function clearAllData(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}
