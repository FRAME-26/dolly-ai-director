import type { VoiceListener, VoiceService } from "./types";

/**
 * Deterministic voice source for tests and e2e runs. Transcripts are pushed
 * through the exact same wake-word parser as real speech — no shortcuts.
 */
export class MockVoiceService implements VoiceService {
  readonly kind = "mock";
  private listener: VoiceListener | null = null;
  readonly spoken: string[] = [];

  start(listener: VoiceListener): void {
    this.listener = listener;
    listener({ type: "status", listening: true });
  }

  stop(): void {
    this.listener?.({ type: "status", listening: false });
    this.listener = null;
  }

  speak(text: string): void {
    this.spoken.push(text);
  }

  /** Push a fake utterance, as if the recognizer had heard it. */
  pushTranscript(transcript: string, confidence = 0.92): void {
    this.listener?.({ type: "transcript", transcript, confidence, isFinal: true });
  }

  pushError(message: string): void {
    this.listener?.({ type: "error", message });
  }
}
