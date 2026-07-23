import Dexie, { type EntityTable } from "dexie";
import {
  DraftSchema,
  ProjectRecordSchema,
  SavedSetupSchema,
  TakeSchema,
  VoiceEventSchema,
  type Draft,
  type ProjectRecord,
  type SavedSetup,
  type Take,
  type VoiceEvent,
} from "../types";

/**
 * Dolly Save — the persistence layer behind "nothing is ever lost".
 * Everything survives a full browser refresh; takes are only ever added,
 * never deleted or overwritten.
 */
export class DollyDb extends Dexie {
  projects!: EntityTable<ProjectRecord, "id">;
  takes!: EntityTable<Take, "id">;
  voiceEvents!: EntityTable<VoiceEvent, "id">;
  drafts!: EntityTable<Draft, "id">;
  kv!: EntityTable<{ key: string; value: unknown }, "key">;

  constructor(name = "dolly-save") {
    super(name);
    this.version(1).stores({
      projects: "id, updatedAt, workflowState",
      takes: "id, projectId, index",
      voiceEvents: "id, projectId, ts",
      drafts: "id, projectId, version",
      kv: "key",
    });
  }
}

export const db = new DollyDb();

const LAST_SETUP_KEY = "lastCameraSetup";

export function newId(): string {
  return crypto.randomUUID();
}

export async function saveProject(record: ProjectRecord): Promise<void> {
  await db.projects.put(ProjectRecordSchema.parse(record));
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  const row = await db.projects.get(id);
  return row ? ProjectRecordSchema.parse(row) : undefined;
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const rows = await db.projects.orderBy("updatedAt").reverse().toArray();
  return rows.map((r) => ProjectRecordSchema.parse(r));
}

/** Takes are append/update only. "Again" adds a take; nothing is removed. */
export async function saveTake(take: Take): Promise<void> {
  await db.takes.put(TakeSchema.parse(take));
}

export async function listTakes(projectId: string): Promise<Take[]> {
  const rows = await db.takes.where("projectId").equals(projectId).sortBy("index");
  return rows.map((r) => TakeSchema.parse(r));
}

export async function saveVoiceEvent(event: VoiceEvent): Promise<void> {
  await db.voiceEvents.put(VoiceEventSchema.parse(event));
}

export async function listVoiceEvents(projectId: string): Promise<VoiceEvent[]> {
  const rows = await db.voiceEvents.where("projectId").equals(projectId).sortBy("ts");
  return rows.map((r) => VoiceEventSchema.parse(r));
}

export async function saveDraft(draft: Draft): Promise<void> {
  await db.drafts.put(DraftSchema.parse(draft));
}

export async function listDrafts(projectId: string): Promise<Draft[]> {
  const rows = await db.drafts.where("projectId").equals(projectId).sortBy("version");
  return rows.map((r) => DraftSchema.parse(r));
}

/** Ending a session (or finishing one) remembers the camera setup — one tap to come back. */
export async function saveLastSetup(setup: SavedSetup): Promise<void> {
  await db.kv.put({ key: LAST_SETUP_KEY, value: SavedSetupSchema.parse(setup) });
}

export async function getLastSetup(): Promise<SavedSetup | undefined> {
  const row = await db.kv.get(LAST_SETUP_KEY);
  if (!row) return undefined;
  const parsed = SavedSetupSchema.safeParse(row.value);
  return parsed.success ? parsed.data : undefined;
}
