import { WsVoiceMessageSchema } from "./types";
import type { VoiceListener, VoiceService } from "./types";

/** Backend voice events over a native WebSocket (FastAPI `/ws/voice`). */
export class WsVoiceService implements VoiceService {
  readonly kind = "websocket";
  private socket: WebSocket | null = null;

  constructor(private readonly wsBase: string) {}

  start(listener: VoiceListener): void {
    const socket = new WebSocket(`${this.wsBase}/ws/voice`);
    socket.onopen = () => listener({ type: "status", listening: true });
    socket.onmessage = (message) => {
      try {
        const parsed = WsVoiceMessageSchema.safeParse(JSON.parse(String(message.data)));
        if (parsed.success) {
          listener({
            type: "transcript",
            transcript: parsed.data.transcript,
            confidence: parsed.data.confidence,
            isFinal: parsed.data.isFinal,
          });
        }
      } catch {
        listener({ type: "error", message: "MALFORMED VOICE EVENT FROM BACKEND" });
      }
    };
    socket.onerror = () => {
      listener({ type: "error", message: "VOICE BACKEND UNREACHABLE" });
    };
    socket.onclose = () => listener({ type: "status", listening: false });
    this.socket = socket;
  }

  stop(): void {
    this.socket?.close();
    this.socket = null;
  }

  speak(text: string): void {
    if (typeof speechSynthesis === "undefined") return;
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
}
