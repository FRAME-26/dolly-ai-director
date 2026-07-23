import { assign, fromCallback, setup } from "xstate";
import type {
  BuildProgress,
  CameraState,
  DecisionSegment,
  Draft,
  Permissions,
  ProjectRecord,
  SavedSetup,
  Take,
  VoiceEvent,
  WorkflowState,
} from "../types";
import { newId } from "../db/dollyDb";

export interface DollyContext {
  projectId: string;
  title: string;
  createdAt: number;
  cameras: { A: CameraState; B: CameraState };
  permissions: Permissions;
  takes: Take[];
  recordedMs: number;
  lastTickAt: number | null;
  voiceLog: VoiceEvent[];
  buildProgress: BuildProgress;
  drafts: Draft[];
  draftVersion: number;
  feedbackNotes: string[];
  exportState: ProjectRecord["exportState"];
  /** Where a restored project should resume; used only by the boot state. */
  restoreTo: WorkflowState | null;
}

export type DollyEvent =
  | { type: "START_SESSION" }
  | { type: "OPEN_PAST_PROJECTS" }
  | { type: "BACK" }
  | { type: "NOT_NOW" }
  | { type: "PERMISSIONS_RESULT"; camera: Permissions["camera"]; voice: Permissions["voice"] }
  | { type: "CAMERA_STATUS"; camera: CameraState }
  | { type: "CONTINUE" }
  | { type: "TROUBLESHOOT" }
  | { type: "SWAP_ROLES" }
  | { type: "PLACED" }
  | { type: "END_SESSION" }
  | { type: "VOICE"; event: VoiceEvent }
  | { type: "TICK"; now: number }
  | { type: "BUILD_PROGRESS"; progress: BuildProgress }
  | { type: "DRAFT_READY"; draft: Draft }
  | { type: "REQUEST_CHANGES"; notes: string }
  | { type: "APPROVE" }
  | { type: "EXPORT_ACTION"; action: keyof ProjectRecord["exportState"] }
  | { type: "NEW_SESSION" };

export interface DollyInput {
  savedSetup?: SavedSetup;
  restore?: {
    record: ProjectRecord;
    takes: Take[];
    drafts: Draft[];
  };
}

const DEFAULT_CAMERAS: { A: CameraState; B: CameraState } = {
  A: {
    key: "A",
    name: "LUNA ULTRA A (DEMO)",
    connection: "waiting",
    role: "CLOSE",
    tracking: false,
    demo: true,
  },
  B: {
    key: "B",
    name: "LUNA ULTRA B (DEMO)",
    connection: "waiting",
    role: "WIDE",
    tracking: false,
    demo: true,
  },
};

const IDLE_BUILD: BuildProgress = { stage: "ingesting", overall: 0, stagePct: 0 };

/**
 * Restoring an unfinished project resumes its latest VALID state: a refresh
 * cannot resurrect a live recording, so recording/holding resume at ready
 * with every recorded take intact (nothing is ever lost).
 */
export function validRestoreState(state: WorkflowState): WorkflowState {
  switch (state) {
    case "recording":
    case "holding":
      return "ready";
    case "pastProjects":
      return "home";
    default:
      return state;
  }
}

function sessionTitle(now: Date): string {
  return `Session · ${now.toISOString().slice(0, 10)} ${now
    .toTimeString()
    .slice(0, 5)}`;
}

function initialContext(input: DollyInput): DollyContext {
  if (input.restore) {
    const { record, takes, drafts } = input.restore;
    return {
      projectId: record.id,
      title: record.title,
      createdAt: record.createdAt,
      cameras: record.cameras,
      permissions: record.permissions,
      takes,
      recordedMs: record.recordedMs,
      lastTickAt: null,
      voiceLog: [],
      buildProgress: IDLE_BUILD,
      drafts,
      draftVersion: record.draftVersion,
      feedbackNotes: drafts.flatMap((d) => (d.feedback ? [d.feedback] : [])),
      exportState: record.exportState,
      restoreTo: validRestoreState(record.workflowState),
    };
  }
  const now = new Date();
  const cameras = input.savedSetup
    ? {
        A: { ...input.savedSetup.cameraA, connection: "waiting" as const, tracking: false },
        B: { ...input.savedSetup.cameraB, connection: "waiting" as const, tracking: false },
      }
    : DEFAULT_CAMERAS;
  return {
    projectId: newId(),
    title: sessionTitle(now),
    createdAt: now.getTime(),
    cameras,
    permissions: { camera: "unknown", voice: "unknown" },
    takes: [],
    recordedMs: 0,
    lastTickAt: null,
    voiceLog: [],
    buildProgress: IDLE_BUILD,
    drafts: [],
    draftVersion: 0,
    feedbackNotes: [],
    exportState: {
      downloaded: false,
      shared: false,
      resolveOpened: false,
      published: false,
    },
    restoreTo: null,
  };
}

function currentTake(context: DollyContext): Take | undefined {
  return context.takes[context.takes.length - 1];
}

function startTake(context: DollyContext, now: number): Take {
  return {
    id: newId(),
    projectId: context.projectId,
    index: context.takes.length + 1,
    startedAt: now,
    endedAt: null,
    durationMs: 0,
    markedRetake: false,
    holdCount: 0,
    rawRef: `raw://${context.projectId}/take-${context.takes.length + 1}`,
  };
}

function finalizeTake(take: Take, now: number, markedRetake: boolean): Take {
  return {
    ...take,
    endedAt: now,
    markedRetake: take.markedRetake || markedRetake,
  };
}

/** Derives the honest decision timeline for a draft from the real session takes. */
export function deriveDecisionTimeline(takes: Take[]): DecisionSegment[] {
  const segments: DecisionSegment[] = [];
  takes.forEach((take, i) => {
    if (take.markedRetake) {
      segments.push({ kind: "retakeRemoved", label: "RETAKE REMOVED", weight: 0.6 });
      return;
    }
    segments.push(
      i % 2 === 0
        ? { kind: "camA", label: "CAM A · CLOSE", weight: 1 + (take.durationMs % 700) / 1000 }
        : { kind: "camB", label: "CAM B · WIDE", weight: 1 + (take.durationMs % 500) / 1000 },
    );
    if (i < takes.length - 1) {
      segments.push({ kind: "silenceTrimmed", label: "SILENCE TRIMMED", weight: 0.35 });
    }
  });
  if (segments.length === 0) {
    segments.push({ kind: "camA", label: "CAM A · CLOSE", weight: 1 });
  }
  return segments;
}

export const BUILD_STAGES = [
  { stage: "ingesting" as const, label: "Ingesting two cameras", ms: 2200 },
  { stage: "syncing" as const, label: "Syncing audio", ms: 2400 },
  { stage: "detecting" as const, label: "Detecting takes", ms: 2000 },
  { stage: "selecting" as const, label: "Selecting angles", ms: 2400 },
  { stage: "assembling" as const, label: "Assembling draft", ms: 2800 },
];

/** Staged demo build. Emits progress, then the finished draft derived from real takes. */
const buildDraftActor = fromCallback<
  { type: "noop" },
  { context: DollyContext }
>(({ input, sendBack }) => {
  const { context } = input;
  const totalMs = BUILD_STAGES.reduce((sum, s) => sum + s.ms, 0);
  let elapsed = 0;
  let stageIndex = 0;
  let stageElapsed = 0;
  const stepMs = 120;

  const timer = setInterval(() => {
    elapsed += stepMs;
    stageElapsed += stepMs;
    const stage = BUILD_STAGES[stageIndex];
    if (stageElapsed >= stage.ms && stageIndex < BUILD_STAGES.length - 1) {
      stageIndex += 1;
      stageElapsed = 0;
    }
    const progress: BuildProgress = {
      stage: BUILD_STAGES[stageIndex].stage,
      overall: Math.min(1, elapsed / totalMs),
      stagePct: Math.min(1, stageElapsed / BUILD_STAGES[stageIndex].ms),
    };
    sendBack({ type: "BUILD_PROGRESS", progress });

    if (elapsed >= totalMs) {
      clearInterval(timer);
      const keptTakes = context.takes.filter((t) => !t.markedRetake);
      const sourceTakes = keptTakes.length > 0 ? keptTakes : context.takes;
      const durationMs = Math.max(
        1000,
        sourceTakes.reduce((sum, t) => sum + t.durationMs, 0),
      );
      const draft: Draft = {
        id: newId(),
        projectId: context.projectId,
        version: context.draftVersion + 1,
        createdAt: Date.now(),
        durationMs,
        decisionTimeline: deriveDecisionTimeline(context.takes),
        feedback: null,
      };
      sendBack({ type: "DRAFT_READY", draft });
    }
  }, stepMs);

  return () => clearInterval(timer);
});

/** 1s ticker for the recording timer. */
const recordingTicker = fromCallback(({ sendBack }) => {
  const timer = setInterval(() => sendBack({ type: "TICK", now: Date.now() }), 250);
  return () => clearInterval(timer);
});

function acceptedCommand(event: DollyEvent, command: string): boolean {
  return (
    event.type === "VOICE" && event.event.accepted && event.event.command === command
  );
}

export const dollyMachine = setup({
  types: {
    context: {} as DollyContext,
    events: {} as DollyEvent,
    input: {} as DollyInput,
  },
  actors: {
    buildDraft: buildDraftActor,
    recordingTicker,
  },
  guards: {
    bothCamerasConnected: ({ context }) =>
      context.cameras.A.connection === "connected" &&
      context.cameras.B.connection === "connected",
    saysAction: ({ event }) => acceptedCommand(event, "ACTION"),
    saysAgain: ({ event }) => acceptedCommand(event, "AGAIN"),
    saysHold: ({ event }) => acceptedCommand(event, "HOLD"),
    saysCut: ({ event }) => acceptedCommand(event, "CUT"),
    restoresTo: ({ context }, params: { state: WorkflowState }) =>
      context.restoreTo === params.state,
  },
  actions: {
    logVoice: assign({
      voiceLog: ({ context, event }) => {
        if (event.type !== "VOICE") return context.voiceLog;
        return [...context.voiceLog, event.event].slice(-50);
      },
    }),
    updateCamera: assign({
      cameras: ({ context, event }) => {
        if (event.type !== "CAMERA_STATUS") return context.cameras;
        return { ...context.cameras, [event.camera.key]: event.camera };
      },
    }),
    setPermissions: assign({
      permissions: ({ context, event }) => {
        if (event.type !== "PERMISSIONS_RESULT") return context.permissions;
        return { camera: event.camera, voice: event.voice };
      },
    }),
    swapRoles: assign({
      cameras: ({ context }) => ({
        A: { ...context.cameras.A, role: context.cameras.B.role },
        B: { ...context.cameras.B, role: context.cameras.A.role },
      }),
    }),
    beginFirstTake: assign({
      takes: ({ context }) => [...context.takes, startTake(context, Date.now())],
      lastTickAt: () => Date.now(),
    }),
    resumeTicking: assign({ lastTickAt: () => Date.now() }),
    accumulateTime: assign({
      recordedMs: ({ context, event }) => {
        if (event.type !== "TICK" || context.lastTickAt === null) {
          return context.recordedMs;
        }
        return context.recordedMs + (event.now - context.lastTickAt);
      },
      lastTickAt: ({ event }) => (event.type === "TICK" ? event.now : null),
      takes: ({ context, event }) => {
        if (event.type !== "TICK" || context.lastTickAt === null) return context.takes;
        const take = currentTake(context);
        if (!take || take.endedAt !== null) return context.takes;
        const delta = event.now - context.lastTickAt;
        return context.takes.map((t) =>
          t.id === take.id ? { ...t, durationMs: t.durationMs + delta } : t,
        );
      },
    }),
    /** "Dolly, again": the last take is kept, marked as a retry; a fresh one starts. */
    markRetakeAndStartFresh: assign({
      takes: ({ context }) => {
        const now = Date.now();
        const take = currentTake(context);
        const closed = context.takes.map((t) =>
          take && t.id === take.id ? { ...finalizeTake(t, now, true) } : t,
        );
        return [...closed, startTake({ ...context, takes: closed }, now)];
      },
    }),
    markHold: assign({
      takes: ({ context }) => {
        const take = currentTake(context);
        if (!take) return context.takes;
        return context.takes.map((t) =>
          t.id === take.id ? { ...t, holdCount: t.holdCount + 1 } : t,
        );
      },
      lastTickAt: () => null,
    }),
    wrapShoot: assign({
      takes: ({ context }) => {
        const now = Date.now();
        const take = currentTake(context);
        return context.takes.map((t) =>
          take && t.id === take.id && t.endedAt === null
            ? finalizeTake(t, now, false)
            : t,
        );
      },
      lastTickAt: () => null,
    }),
    applyBuildProgress: assign({
      buildProgress: ({ context, event }) =>
        event.type === "BUILD_PROGRESS" ? event.progress : context.buildProgress,
    }),
    storeDraft: assign({
      drafts: ({ context, event }) =>
        event.type === "DRAFT_READY" ? [...context.drafts, event.draft] : context.drafts,
      draftVersion: ({ context, event }) =>
        event.type === "DRAFT_READY" ? event.draft.version : context.draftVersion,
      buildProgress: () => ({ stage: "done" as const, overall: 1, stagePct: 1 }),
    }),
    recordFeedback: assign({
      feedbackNotes: ({ context, event }) =>
        event.type === "REQUEST_CHANGES"
          ? [...context.feedbackNotes, event.notes]
          : context.feedbackNotes,
      drafts: ({ context, event }) => {
        if (event.type !== "REQUEST_CHANGES") return context.drafts;
        const latest = context.drafts[context.drafts.length - 1];
        return context.drafts.map((d) =>
          latest && d.id === latest.id ? { ...d, feedback: event.notes } : d,
        );
      },
      buildProgress: () => IDLE_BUILD,
    }),
    /** Deep Track locks on: both gimbals hold their framing preset (Figma 02 step 06). */
    lockTracking: assign({
      cameras: ({ context }) => ({
        A: { ...context.cameras.A, tracking: true },
        B: { ...context.cameras.B, tracking: true },
      }),
    }),
    markExportAction: assign({
      exportState: ({ context, event }) =>
        event.type === "EXPORT_ACTION"
          ? { ...context.exportState, [event.action]: true }
          : context.exportState,
    }),
    clearRestore: assign({ restoreTo: null }),
    /**
     * Leaving for Home starts a fresh project while remembering the camera
     * setup. The finished/parked project's record stays as last persisted
     * (export or ready) — it is never overwritten by the new session.
     */
    resetForNewSession: assign(({ context }) => {
      const now = new Date();
      return {
        projectId: newId(),
        title: sessionTitle(now),
        createdAt: now.getTime(),
        cameras: context.cameras,
        permissions: context.permissions,
        takes: [],
        recordedMs: 0,
        lastTickAt: null,
        voiceLog: [],
        buildProgress: IDLE_BUILD,
        drafts: [],
        draftVersion: 0,
        feedbackNotes: [],
        exportState: {
          downloaded: false,
          shared: false,
          resolveOpened: false,
          published: false,
        },
        restoreTo: null,
      };
    }),
  },
}).createMachine({
  id: "dolly",
  context: ({ input }) => initialContext(input ?? {}),
  initial: "boot",
  states: {
    /** Resolves a restored project to its latest valid page, then never returns. */
    boot: {
      always: [
        { guard: { type: "restoresTo", params: { state: "permissions" } }, target: "permissions", actions: "clearRestore" },
        { guard: { type: "restoresTo", params: { state: "connect" } }, target: "connect", actions: "clearRestore" },
        { guard: { type: "restoresTo", params: { state: "roles" } }, target: "roles", actions: "clearRestore" },
        { guard: { type: "restoresTo", params: { state: "ready" } }, target: "ready", actions: "clearRestore" },
        { guard: { type: "restoresTo", params: { state: "building" } }, target: "building", actions: "clearRestore" },
        { guard: { type: "restoresTo", params: { state: "review" } }, target: "review", actions: "clearRestore" },
        { guard: { type: "restoresTo", params: { state: "export" } }, target: "export", actions: "clearRestore" },
        { target: "home" },
      ],
    },
    home: {
      on: {
        START_SESSION: { target: "permissions" },
        OPEN_PAST_PROJECTS: { target: "pastProjects" },
      },
    },
    pastProjects: {
      on: {
        BACK: { target: "home" },
      },
    },
    permissions: {
      on: {
        PERMISSIONS_RESULT: [
          {
            guard: ({ event }) => event.camera === "granted" && event.voice === "granted",
            actions: "setPermissions",
            target: "connect",
          },
          { actions: "setPermissions" },
        ],
        NOT_NOW: { target: "home" },
      },
    },
    connect: {
      on: {
        CAMERA_STATUS: { actions: "updateCamera" },
        CONTINUE: { guard: "bothCamerasConnected", target: "roles" },
        BACK: { target: "permissions" },
      },
    },
    roles: {
      entry: "lockTracking",
      on: {
        CAMERA_STATUS: { actions: "updateCamera" },
        SWAP_ROLES: { actions: "swapRoles" },
        PLACED: { target: "ready" },
        BACK: { target: "connect" },
      },
    },
    ready: {
      on: {
        VOICE: [
          { guard: "saysAction", actions: ["logVoice", "beginFirstTake"], target: "recording" },
          { actions: "logVoice" },
        ],
        END_SESSION: { actions: "resetForNewSession", target: "home" },
      },
    },
    recording: {
      invoke: { src: "recordingTicker" },
      entry: "resumeTicking",
      on: {
        TICK: { actions: "accumulateTime" },
        VOICE: [
          { guard: "saysAgain", actions: ["logVoice", "markRetakeAndStartFresh"] },
          { guard: "saysHold", actions: ["logVoice", "markHold"], target: "holding" },
          { guard: "saysCut", actions: ["logVoice", "wrapShoot"], target: "building" },
          { actions: "logVoice" },
        ],
      },
    },
    holding: {
      on: {
        VOICE: [
          { guard: "saysAction", actions: "logVoice", target: "recording" },
          { guard: "saysCut", actions: ["logVoice", "wrapShoot"], target: "building" },
          { actions: "logVoice" },
        ],
      },
    },
    building: {
      invoke: {
        src: "buildDraft",
        input: ({ context }) => ({ context }),
      },
      on: {
        BUILD_PROGRESS: { actions: "applyBuildProgress" },
        DRAFT_READY: { actions: "storeDraft", target: "review" },
      },
    },
    review: {
      on: {
        REQUEST_CHANGES: { actions: "recordFeedback", target: "building" },
        APPROVE: { target: "export" },
      },
    },
    export: {
      on: {
        EXPORT_ACTION: { actions: "markExportAction" },
        NEW_SESSION: { actions: "resetForNewSession", target: "home" },
      },
    },
  },
});

/** Map of machine states to router paths — the router follows the machine, never the reverse. */
export const STATE_ROUTES: Record<WorkflowState, string> = {
  home: "/",
  pastProjects: "/projects",
  permissions: "/permissions",
  connect: "/connect",
  roles: "/roles",
  ready: "/ready",
  recording: "/recording",
  holding: "/recording",
  building: "/building",
  review: "/review",
  export: "/export",
};

export function snapshotToRecord(
  context: DollyContext,
  workflowState: WorkflowState,
): ProjectRecord {
  return {
    id: context.projectId,
    title: context.title,
    createdAt: context.createdAt,
    updatedAt: Date.now(),
    workflowState,
    cameras: context.cameras,
    permissions: context.permissions,
    recordedMs: context.recordedMs,
    draftVersion: context.draftVersion,
    exportState: context.exportState,
  };
}
