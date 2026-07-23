import type { VoiceCommand } from "../../types";

/** Minimum recognition confidence Dolly will act on. */
export const MIN_CONFIDENCE = 0.55;

const WAKE_WORD = "dolly";

const COMMAND_WORDS: Record<string, VoiceCommand> = {
  action: "ACTION",
  again: "AGAIN",
  hold: "HOLD",
  cut: "CUT",
};

export interface ParsedUtterance {
  command: VoiceCommand | null;
  accepted: boolean;
  rejectionReason: string | null;
}

/**
 * Only "Dolly, action / again / hold / cut" may change state (Figma 03).
 * Low-confidence, incomplete, or unrelated speech never does.
 */
export function parseUtterance(
  transcript: string,
  confidence: number,
): ParsedUtterance {
  const text = transcript.toLowerCase().replace(/[.,!?]/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean);

  const wakeIndex = words.indexOf(WAKE_WORD);
  if (wakeIndex === -1) {
    return {
      command: null,
      accepted: false,
      rejectionReason: "NO WAKE WORD",
    };
  }

  const commandWord = words[wakeIndex + 1];
  const command = commandWord ? (COMMAND_WORDS[commandWord] ?? null) : null;
  if (!command) {
    return {
      command: null,
      accepted: false,
      rejectionReason: "NOT A DOLLY COMMAND",
    };
  }

  if (confidence < MIN_CONFIDENCE) {
    return {
      command,
      accepted: false,
      rejectionReason: `LOW CONFIDENCE ${(confidence * 100).toFixed(0)}%`,
    };
  }

  return { command, accepted: true, rejectionReason: null };
}

/** What Dolly says back out loud — spoken confirmation for every command (Figma 03/11). */
export const SPOKEN_CONFIRMATIONS: Record<VoiceCommand, string> = {
  ACTION: "Rolling.",
  AGAIN: "Again. Fresh take.",
  HOLD: "Holding.",
  CUT: "Cut. Building your cut.",
};
