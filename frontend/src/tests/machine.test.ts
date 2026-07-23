import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  connectBothCameras,
  startActor,
  voiceEvent,
  walkToConnect,
  walkToReady,
  walkToRecording,
} from "./helpers";

describe("dolly workflow machine — strict transitions", () => {
  it("1. Start a session opens Permissions", () => {
    const actor = startActor();
    expect(actor.getSnapshot().value).toBe("home");
    actor.send({ type: "START_SESSION" });
    expect(actor.getSnapshot().value).toBe("permissions");
  });

  it("2. Camera permission denial remains recoverable", () => {
    const actor = startActor();
    actor.send({ type: "START_SESSION" });
    actor.send({ type: "PERMISSIONS_RESULT", camera: "denied", voice: "denied" });
    expect(actor.getSnapshot().value).toBe("permissions");
    expect(actor.getSnapshot().context.permissions.camera).toBe("denied");
    // Recover: allow again
    actor.send({ type: "PERMISSIONS_RESULT", camera: "granted", voice: "granted" });
    expect(actor.getSnapshot().value).toBe("connect");
  });

  it("3. Connect CONTINUE is rejected until both cameras connect", () => {
    const actor = startActor();
    walkToConnect(actor);
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().value).toBe("connect");
    const { A } = actor.getSnapshot().context.cameras;
    actor.send({ type: "CAMERA_STATUS", camera: { ...A, connection: "connected" } });
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().value).toBe("connect");
    connectBothCameras(actor);
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().value).toBe("roles");
  });

  it("4. Swap roles exchanges CAM A and CAM B", () => {
    const actor = startActor();
    walkToConnect(actor);
    connectBothCameras(actor);
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.cameras.A.role).toBe("CLOSE");
    expect(actor.getSnapshot().context.cameras.B.role).toBe("WIDE");
    actor.send({ type: "SWAP_ROLES" });
    expect(actor.getSnapshot().context.cameras.A.role).toBe("WIDE");
    expect(actor.getSnapshot().context.cameras.B.role).toBe("CLOSE");
    expect(actor.getSnapshot().value).toBe("roles");
  });

  it("5. \"I've placed them\" opens Ready", () => {
    const actor = startActor();
    walkToReady(actor);
    expect(actor.getSnapshot().value).toBe("ready");
  });

  it("6. ACTION changes Ready to Recording", () => {
    const actor = startActor();
    walkToRecording(actor);
    expect(actor.getSnapshot().value).toBe("recording");
    expect(actor.getSnapshot().context.takes).toHaveLength(1);
  });

  it("7. AGAIN creates a new take without deleting the old one", () => {
    const actor = startActor();
    walkToRecording(actor);
    actor.send({ type: "VOICE", event: voiceEvent("AGAIN") });
    const takes = actor.getSnapshot().context.takes;
    expect(takes).toHaveLength(2);
    expect(takes[0].markedRetake).toBe(true);
    expect(takes[0].endedAt).not.toBeNull();
    expect(takes[1].markedRetake).toBe(false);
    expect(actor.getSnapshot().value).toBe("recording");
  });

  it("8. HOLD changes Recording to Holding", () => {
    const actor = startActor();
    walkToRecording(actor);
    actor.send({ type: "VOICE", event: voiceEvent("HOLD") });
    expect(actor.getSnapshot().value).toBe("holding");
    expect(actor.getSnapshot().context.takes[0].holdCount).toBe(1);
  });

  it("9. ACTION resumes from Holding", () => {
    const actor = startActor();
    walkToRecording(actor);
    actor.send({ type: "VOICE", event: voiceEvent("HOLD") });
    actor.send({ type: "VOICE", event: voiceEvent("ACTION") });
    expect(actor.getSnapshot().value).toBe("recording");
    // Resuming must not create a duplicate take.
    expect(actor.getSnapshot().context.takes).toHaveLength(1);
  });

  it("10. CUT starts Building (from Recording and from Holding)", () => {
    const a = startActor();
    walkToRecording(a);
    a.send({ type: "VOICE", event: voiceEvent("CUT") });
    expect(a.getSnapshot().value).toBe("building");
    expect(a.getSnapshot().context.takes[0].endedAt).not.toBeNull();

    const b = startActor();
    walkToRecording(b);
    b.send({ type: "VOICE", event: voiceEvent("HOLD") });
    b.send({ type: "VOICE", event: voiceEvent("CUT") });
    expect(b.getSnapshot().value).toBe("building");
  });

  it("17. Invalid voice commands cannot change state", () => {
    const actor = startActor();
    walkToReady(actor);

    // Unaccepted utterance (no wake word)
    actor.send({ type: "VOICE", event: voiceEvent(null) });
    expect(actor.getSnapshot().value).toBe("ready");

    // Low-confidence command parsed but not accepted
    actor.send({
      type: "VOICE",
      event: voiceEvent("ACTION", { accepted: false, rejectionReason: "LOW CONFIDENCE 30%" }),
    });
    expect(actor.getSnapshot().value).toBe("ready");

    // Command that is not valid in this state
    actor.send({ type: "VOICE", event: voiceEvent("CUT") });
    expect(actor.getSnapshot().value).toBe("ready");

    // But every utterance is logged — Dolly always shows what it heard.
    expect(actor.getSnapshot().context.voiceLog).toHaveLength(3);
  });

  it("END_SESSION returns Ready to Home; illegal navigation events are rejected", () => {
    const actor = startActor();
    walkToReady(actor);
    // Illegal: APPROVE only exists in review
    actor.send({ type: "APPROVE" });
    expect(actor.getSnapshot().value).toBe("ready");
    actor.send({ type: "END_SESSION" });
    expect(actor.getSnapshot().value).toBe("home");
  });
});

describe("building → review → export", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("11. Building completes and opens Review with a draft", () => {
    const actor = startActor();
    walkToRecording(actor);
    actor.send({ type: "VOICE", event: voiceEvent("CUT") });
    expect(actor.getSnapshot().value).toBe("building");
    vi.advanceTimersByTime(15_000);
    expect(actor.getSnapshot().value).toBe("review");
    expect(actor.getSnapshot().context.drafts).toHaveLength(1);
    expect(actor.getSnapshot().context.drafts[0].version).toBe(1);
  });

  it("12. Request changes creates a new draft version and returns to Review", () => {
    const actor = startActor();
    walkToRecording(actor);
    actor.send({ type: "VOICE", event: voiceEvent("CUT") });
    vi.advanceTimersByTime(15_000);
    actor.send({ type: "REQUEST_CHANGES", notes: "Tighter cuts on the wide angle." });
    expect(actor.getSnapshot().value).toBe("building");
    expect(actor.getSnapshot().context.drafts[0].feedback).toBe(
      "Tighter cuts on the wide angle.",
    );
    vi.advanceTimersByTime(15_000);
    expect(actor.getSnapshot().value).toBe("review");
    expect(actor.getSnapshot().context.drafts).toHaveLength(2);
    expect(actor.getSnapshot().context.drafts[1].version).toBe(2);
  });

  it("13. Approval opens Export; new session returns Home", () => {
    const actor = startActor();
    walkToRecording(actor);
    actor.send({ type: "VOICE", event: voiceEvent("CUT") });
    vi.advanceTimersByTime(15_000);
    actor.send({ type: "APPROVE" });
    expect(actor.getSnapshot().value).toBe("export");
    actor.send({ type: "NEW_SESSION" });
    expect(actor.getSnapshot().value).toBe("home");
  });
});
