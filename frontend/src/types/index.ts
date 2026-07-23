import { z } from "zod";

/** The four voice commands — the whole directing language (Figma 03). */
export const VoiceCommandSchema = z.enum(["ACTION", "AGAIN", "HOLD", "CUT"]);
export type VoiceCommand = z.infer<typeof VoiceCommandSchema>;

export const CameraKeySchema = z.enum(["A", "B"]);
export type CameraKey = z.infer<typeof CameraKeySchema>;

/** CAM A: close, telephoto, subject left third. CAM B: wide, subject right third. */
export const CameraRoleSchema = z.enum(["CLOSE", "WIDE"]);
export type CameraRole = z.infer<typeof CameraRoleSchema>;

export const CameraConnectionSchema = z.enum([
  "waiting",
  "connecting",
  "connected",
  "error",
]);
export type CameraConnection = z.infer<typeof CameraConnectionSchema>;

export const CameraStateSchema = z.object({
  key: CameraKeySchema,
  name: z.string(),
  connection: CameraConnectionSchema,
  role: CameraRoleSchema,
  tracking: z.boolean(),
  /** Honest labeling: mock cameras announce themselves as demo hardware. */
  demo: z.boolean(),
});
export type CameraState = z.infer<typeof CameraStateSchema>;

export const TakeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  index: z.number().int().min(1),
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  durationMs: z.number().min(0),
  /** "Dolly, again" marks the take as a retry — it is never deleted. */
  markedRetake: z.boolean(),
  holdCount: z.number().int().min(0),
  /** Reference to raw footage (backend URI once real hardware is attached). */
  rawRef: z.string(),
});
export type Take = z.infer<typeof TakeSchema>;

export const VoiceEventSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  ts: z.number(),
  transcript: z.string(),
  confidence: z.number().min(0).max(1),
  command: VoiceCommandSchema.nullable(),
  accepted: z.boolean(),
  /** Why a non-accepted utterance was rejected (low confidence, no wake word…). */
  rejectionReason: z.string().nullable(),
});
export type VoiceEvent = z.infer<typeof VoiceEventSchema>;

export const BuildStageSchema = z.enum([
  "ingesting",
  "syncing",
  "detecting",
  "selecting",
  "assembling",
  "done",
]);
export type BuildStage = z.infer<typeof BuildStageSchema>;

export const BuildProgressSchema = z.object({
  stage: BuildStageSchema,
  /** 0..1 within the whole build */
  overall: z.number().min(0).max(1),
  /** 0..1 within the current stage */
  stagePct: z.number().min(0).max(1),
});
export type BuildProgress = z.infer<typeof BuildProgressSchema>;

export const DecisionSegmentSchema = z.object({
  kind: z.enum(["camA", "camB", "retakeRemoved", "silenceTrimmed", "assembling"]),
  label: z.string(),
  /** Relative width of the segment in the decision timeline, 0..1 */
  weight: z.number().positive(),
});
export type DecisionSegment = z.infer<typeof DecisionSegmentSchema>;

export const DraftSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  version: z.number().int().min(1),
  createdAt: z.number(),
  durationMs: z.number().min(0),
  decisionTimeline: z.array(DecisionSegmentSchema),
  /** Creator notes that produced the NEXT draft (empty for the latest). */
  feedback: z.string().nullable(),
});
export type Draft = z.infer<typeof DraftSchema>;

/** Every page of the approved flow (Figma 09 · User flow map). */
export const WorkflowStateSchema = z.enum([
  "home",
  "pastProjects",
  "permissions",
  "connect",
  "roles",
  "ready",
  "recording",
  "holding",
  "building",
  "review",
  "export",
]);
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

export const SavedSetupSchema = z.object({
  cameraA: CameraStateSchema,
  cameraB: CameraStateSchema,
  savedAt: z.number(),
});
export type SavedSetup = z.infer<typeof SavedSetupSchema>;

export const PermissionsSchema = z.object({
  camera: z.enum(["unknown", "granted", "denied"]),
  voice: z.enum(["unknown", "granted", "denied"]),
});
export type Permissions = z.infer<typeof PermissionsSchema>;

export const ProjectRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  workflowState: WorkflowStateSchema,
  cameras: z.object({ A: CameraStateSchema, B: CameraStateSchema }),
  permissions: PermissionsSchema,
  recordedMs: z.number().min(0),
  draftVersion: z.number().int().min(0),
  exportState: z.object({
    downloaded: z.boolean(),
    shared: z.boolean(),
    resolveOpened: z.boolean(),
    published: z.boolean(),
  }),
});
export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;
