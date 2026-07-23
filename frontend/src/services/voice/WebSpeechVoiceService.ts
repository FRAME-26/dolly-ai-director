import type { VoiceListener, VoiceService } from "./types";

interface SpeechRecognitionResultLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<SpeechRecognitionResultLike> & { isFinal: boolean }
  >;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isWebSpeechAvailable(): boolean {
  return typeof window !== "undefined" && getRecognitionCtor() !== undefined;
}

/** Browser SpeechRecognition — the demo fallback when no backend is connected. */
export class WebSpeechVoiceService implements VoiceService {
  readonly kind = "webspeech";
  private recognition: SpeechRecognitionLike | null = null;
  private listener: VoiceListener | null = null;
  private shouldListen = false;

  start(listener: VoiceListener): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      listener({
        type: "error",
        message: "SPEECH RECOGNITION NOT AVAILABLE IN THIS BROWSER",
      });
      return;
    }
    this.listener = listener;
    this.shouldListen = true;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const alternative = result[0];
        if (!alternative) continue;
        this.listener?.({
          type: "transcript",
          transcript: alternative.transcript,
          confidence: alternative.confidence,
          isFinal: result.isFinal,
        });
      }
    };
    recognition.onerror = (event) => {
      this.listener?.({ type: "error", message: `MIC ERROR: ${event.error}` });
    };
    recognition.onend = () => {
      // Chrome stops recognition periodically; keep listening while armed.
      if (this.shouldListen) {
        try {
          recognition.start();
        } catch {
          this.listener?.({ type: "status", listening: false });
        }
      }
    };
    this.recognition = recognition;
    try {
      recognition.start();
      listener({ type: "status", listening: true });
    } catch (error) {
      listener({
        type: "error",
        message: `COULD NOT START MIC: ${error instanceof Error ? error.message : "unknown"}`,
      });
    }
  }

  stop(): void {
    this.shouldListen = false;
    this.recognition?.stop();
    this.recognition = null;
    this.listener?.({ type: "status", listening: false });
    this.listener = null;
  }

  speak(text: string): void {
    if (typeof speechSynthesis === "undefined") return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    speechSynthesis.speak(utterance);
  }
}
