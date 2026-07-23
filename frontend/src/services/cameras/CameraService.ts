import type { CameraKey, CameraState } from "../../types";

export type CameraListener = (camera: CameraState) => void;

export interface CameraService {
  /** Begin pairing both cameras; emits every connection state change. */
  startPairing(listener: CameraListener): void;
  /** "Check the cable" — re-detects one camera and reports states honestly. */
  troubleshoot(key: CameraKey): void;
  stop(): void;
}

/**
 * Demo cameras for local frontend development. Honestly labeled: the camera
 * names carry a DEMO suffix and `demo: true` — no fake hardware claims.
 */
export class MockCameraService implements CameraService {
  private listener: CameraListener | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private initial: { A: CameraState; B: CameraState },
    private timings: { aMs: number; bMs: number } = { aMs: 1200, bMs: 3200 },
  ) {}

  startPairing(listener: CameraListener): void {
    this.listener = listener;
    const { A, B } = this.initial;

    listener({ ...A, connection: "waiting", tracking: false });
    listener({ ...B, connection: "waiting", tracking: false });

    this.schedule(() => listener({ ...A, connection: "connecting", tracking: false }), this.timings.aMs / 2);
    this.schedule(() => listener({ ...A, connection: "connected", tracking: false }), this.timings.aMs);
    this.schedule(() => listener({ ...B, connection: "connecting", tracking: false }), this.timings.bMs / 2);
    this.schedule(() => listener({ ...B, connection: "connected", tracking: false }), this.timings.bMs);
  }

  troubleshoot(key: CameraKey): void {
    const camera = this.initial[key];
    if (!this.listener) return;
    this.listener({ ...camera, connection: "connecting", tracking: false });
    this.schedule(
      () => this.listener?.({ ...camera, connection: "connected", tracking: false }),
      900,
    );
  }

  /** Force an error state (used by tests to prove the error path is honest). */
  failCamera(key: CameraKey): void {
    this.listener?.({ ...this.initial[key], connection: "error", tracking: false });
  }

  stop(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.listener = null;
  }

  private schedule(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }
}
