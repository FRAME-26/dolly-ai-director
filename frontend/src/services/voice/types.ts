import { z } from "zod";

export type VoiceServiceEvent =
  | { type: "transcript"; transcript: string; confidence: number; isFinal: boolean }
  | { type: "status"; listening: boolean }
  | { type: "error"; message: string };

export type VoiceListener = (event: VoiceServiceEvent) => void;

export interface VoiceService {
  readonly kind: "webspeech" | "websocket" | "mock";
  start(listener: VoiceListener): void;
  stop(): void;
  /** Spoken confirmation — every accepted command is confirmed out loud (Figma 11). */
  speak(text: string): void;
}

/** Wire format of backend voice events over WebSocket. */
export const WsVoiceMessageSchema = z.object({
  type: z.literal("transcript"),
  transcript: z.string(),
  confidence: z.number().min(0).max(1),
  isFinal: z.boolean(),
});
export type WsVoiceMessage = z.infer<typeof WsVoiceMessageSchema>;
