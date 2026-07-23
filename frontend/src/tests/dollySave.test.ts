import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import {
  db,
  getLastSetup,
  getProject,
  listTakes,
} from "../db/dollyDb";
import { dollyMachine, validRestoreState } from "../machines/dollyMachine";
import { clearAllData, sessionService } from "../services/session/SessionService";
import { startActor, voiceEvent, walkToRecording, walkToReady } from "./helpers";

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

describe("Dolly Save — persistence in IndexedDB", () => {
  beforeEach(async () => {
    await flush();
    await clearAllData();
  });
  afterEach(async () => {
    await flush();
    await clearAllData();
  });

  it("14. session data survives a complete reload (new db connection reads it back)", async () => {
    const actor = startActor();
    const detach = sessionService.attach(actor);
    walkToRecording(actor);
    actor.send({ type: "VOICE", event: voiceEvent("AGAIN") });
    await flush();
    detach();

    const projectId = actor.getSnapshot().context.projectId;

    // A page refresh = a fresh Dexie instance over the same IndexedDB.
    db.close();
    await db.open();

    const record = await getProject(projectId);
    expect(record).toBeDefined();
    expect(record?.workflowState).toBe("recording");
    const takes = await listTakes(projectId);
    expect(takes).toHaveLength(2);
    expect(takes[0].markedRetake).toBe(true);
    actor.stop();
  });

  it("15. Past Projects restores the correct project at its latest valid state", async () => {
    const actor = startActor();
    const detach = sessionService.attach(actor);
    walkToRecording(actor);
    actor.send({ type: "VOICE", event: voiceEvent("HOLD") });
    await flush();
    detach();
    const projectId = actor.getSnapshot().context.projectId;
    actor.stop();

    const bundle = await sessionService.loadProject(projectId);
    expect(bundle).toBeDefined();
    if (!bundle) return;
    expect(bundle.record.id).toBe(projectId);
    // holding is not a valid state to resurrect after a refresh → ready
    expect(validRestoreState(bundle.record.workflowState)).toBe("ready");

    const restored = createActor(dollyMachine, {
      input: { restore: { record: bundle.record, takes: bundle.takes, drafts: bundle.drafts } },
    });
    restored.start();
    expect(restored.getSnapshot().value).toBe("ready");
    expect(restored.getSnapshot().context.projectId).toBe(projectId);
    expect(restored.getSnapshot().context.takes).toHaveLength(1);
    restored.stop();
  });

  it("completed projects restore straight to Export", async () => {
    vi.useFakeTimers();
    const actor = startActor();
    const detach = sessionService.attach(actor);
    walkToRecording(actor);
    actor.send({ type: "VOICE", event: voiceEvent("CUT") });
    vi.advanceTimersByTime(15_000);
    expect(actor.getSnapshot().value).toBe("review");
    // Drain IndexedDB work that was scheduled while the clock was fake, so
    // switching back to real timers cannot strand an open transaction.
    await vi.advanceTimersByTimeAsync(500);
    vi.useRealTimers();
    actor.send({ type: "APPROVE" });
    expect(actor.getSnapshot().value).toBe("export");
    await flush();
    detach();
    const projectId = actor.getSnapshot().context.projectId;
    actor.stop();

    const bundle = await sessionService.loadProject(projectId);
    expect(bundle?.record.workflowState).toBe("export");
    const restored = createActor(dollyMachine, {
      input: {
        restore: {
          record: bundle!.record,
          takes: bundle!.takes,
          drafts: bundle!.drafts,
        },
      },
    });
    restored.start();
    expect(restored.getSnapshot().value).toBe("export");
    expect(restored.getSnapshot().context.drafts).toHaveLength(1);
    restored.stop();
  });

  it("ending a session from Ready saves the camera setup", async () => {
    const actor = startActor();
    const detach = sessionService.attach(actor);
    walkToReady(actor);
    actor.send({ type: "END_SESSION" });
    await flush();
    detach();
    actor.stop();

    const setup = await getLastSetup();
    expect(setup).toBeDefined();
    expect(setup?.cameraA.role).toBe("CLOSE");
    expect(setup?.cameraB.role).toBe("WIDE");
  });

  it("starting a new session remembers the most recent camera setup", async () => {
    const actor = startActor();
    const detach = sessionService.attach(actor);
    walkToReady(actor);
    actor.send({ type: "SWAP_ROLES" as never }); // illegal in ready — must be ignored
    actor.send({ type: "END_SESSION" });
    await flush();
    detach();
    actor.stop();

    const setup = await getLastSetup();
    const next = startActor({ savedSetup: setup });
    expect(next.getSnapshot().context.cameras.A.role).toBe(setup?.cameraA.role);
    next.stop();
  });
});
