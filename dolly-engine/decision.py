"""Decision emitter.

The engine PROPOSES only. Margin (0.12), hold (2500 ms) and cooldown
(1500 ms) are enforced by Nero's backend safety layer. Here we apply just
one engine-side gate (delta >= 0.05 vs the currently proposed camera) to
avoid spamming meaningless decisions, and we generate deterministic,
truthful reasons from a fixed enum.
"""
from __future__ import annotations

import time
from typing import Dict, Optional

import config

REASONS = (
    "subject_entered",
    "subject_lost",
    "better_framing",
    "feed_invalid",
    "fallback_heuristic",
    "low_confidence_default",
)


class DecisionEmitter:
    def __init__(self) -> None:
        self.proposed: str = config.DEFAULT_CAMERA
        self.prev_visibility: Dict[str, float] = {c: 0.0 for c in config.CAMERA_IDS}

    def _reason(self, selected: str, scores: Dict[str, float],
                subs: Dict[str, Dict[str, float]], mode: str,
                invalid: Dict[str, bool]) -> str:
        if mode == "heuristic":
            code = "fallback_heuristic"
        elif invalid.get(self.proposed, False) and selected != self.proposed:
            code = "feed_invalid"
        elif subs[selected]["visibility"] > 0.3 and self.prev_visibility[selected] <= 0.3:
            code = "subject_entered"
        elif selected == config.DEFAULT_CAMERA and subs[self.proposed]["visibility"] <= 0.1:
            code = "subject_lost"
        else:
            code = "better_framing"
        runner_up = sorted(
            (c for c in config.CAMERA_IDS if c != selected),
            key=lambda c: scores[c], reverse=True,
        )[0]
        bonus = config.ROLE_BONUS.get(selected, 0.0)
        bonus_txt = f" (incl. role bonus +{bonus:.2f})" if bonus else ""
        return (f"{code}: {selected} score {scores[selected]:.2f}{bonus_txt} "
                f"vs {runner_up} {scores[runner_up]:.2f}")

    def evaluate(self, scores: Dict[str, float],
                 subs: Dict[str, Dict[str, float]],
                 invalid: Dict[str, bool],
                 mode: str) -> Optional[dict]:
        """Return a director.decision message dict, or None if debounced."""
        best = max(config.CAMERA_IDS, key=lambda c: scores[c])
        confidence = scores[best]

        if confidence < config.MIN_CONFIDENCE_TO_PROPOSE:
            best = config.DEFAULT_CAMERA
            confidence = max(confidence, scores[config.DEFAULT_CAMERA])
            reason_override = "low_confidence_default: no reliable subject anywhere"
        else:
            reason_override = None

        # engine-side debounce: only speak when the proposal actually changes
        # meaningfully, or the currently proposed feed just went invalid
        if best == self.proposed and not invalid.get(self.proposed, False):
            self._remember(subs)
            return None
        if best != self.proposed and \
                scores[best] - scores[self.proposed] < config.ENGINE_DELTA_GATE and \
                not invalid.get(self.proposed, False):
            self._remember(subs)
            return None

        reason = reason_override or self._reason(best, scores, subs, mode, invalid)
        self.proposed = best
        self._remember(subs)

        return {
            "v": config.CONTRACT_VERSION,
            "type": "director.decision",
            "ts": int(time.time() * 1000),
            "selected": best,
            "confidence": round(confidence, 2),
            "scores": {c: round(scores[c], 2) for c in config.CAMERA_IDS},
            "reason": reason,
            "mode": mode,
        }

    def _remember(self, subs: Dict[str, Dict[str, float]]) -> None:
        for c in config.CAMERA_IDS:
            self.prev_visibility[c] = subs[c]["visibility"]
