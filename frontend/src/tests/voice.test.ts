import { describe, expect, it } from "vitest";
import { parseUtterance } from "../features/voice/parseCommand";

describe("wake-word parser — only the four Dolly commands act", () => {
  it("accepts the four canonical commands", () => {
    expect(parseUtterance("Dolly, action", 0.9)).toEqual({
      command: "ACTION",
      accepted: true,
      rejectionReason: null,
    });
    expect(parseUtterance("dolly again", 0.8).command).toBe("AGAIN");
    expect(parseUtterance("Dolly, hold.", 0.7).command).toBe("HOLD");
    expect(parseUtterance("DOLLY CUT", 0.95).command).toBe("CUT");
  });

  it("rejects speech without the wake word", () => {
    const result = parseUtterance("action please", 0.99);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe("NO WAKE WORD");
  });

  it("rejects unrelated speech after the wake word", () => {
    const result = parseUtterance("dolly what a lovely day", 0.99);
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe("NOT A DOLLY COMMAND");
  });

  it("rejects incomplete commands", () => {
    const result = parseUtterance("dolly", 0.99);
    expect(result.accepted).toBe(false);
  });

  it("rejects low-confidence recognition", () => {
    const result = parseUtterance("dolly cut", 0.3);
    expect(result.accepted).toBe(false);
    expect(result.command).toBe("CUT");
    expect(result.rejectionReason).toContain("LOW CONFIDENCE");
  });
});
