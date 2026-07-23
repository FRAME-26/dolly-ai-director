"""L1 fallback: heuristic sub-scores with no model and no GPU.

Frame-diff motion + brightness sanity + centre-area energy. Produces the
same sub-score dict shape as scoring.compute_subscores so the rest of the
pipeline (EMA, decision, reason) is unchanged. Reasons are tagged
'fallback_heuristic' and mode becomes 'heuristic' — honestly, per Lock §6.
"""
from __future__ import annotations

from typing import Dict, Optional

import cv2
import numpy as np


class HeuristicScorer:
    def __init__(self) -> None:
        self._prev: Dict[str, np.ndarray] = {}

    def subscores(self, camera_id: str, frame: Optional[np.ndarray]) -> Dict[str, float]:
        if frame is None:
            return {"visibility": 0.0, "framing": 0.0, "stability": 0.0, "sharpness": 0.0}

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray_small = cv2.resize(gray, (160, 90))

        prev = self._prev.get(camera_id)
        self._prev[camera_id] = gray_small

        # motion energy stands in for "a live subject is here"
        if prev is None:
            motion = 0.0
        else:
            diff = cv2.absdiff(gray_small, prev).astype(np.float32) / 255.0
            motion = float(np.clip(diff.mean() * 20.0, 0.0, 1.0))

        # centre-third energy stands in for framing
        h, w = gray_small.shape
        centre = gray_small[:, w // 3: 2 * w // 3].astype(np.float32)
        if prev is not None:
            centre_diff = cv2.absdiff(
                gray_small, prev)[:, w // 3: 2 * w // 3].astype(np.float32) / 255.0
            total = cv2.absdiff(gray_small, prev).astype(np.float32).sum() + 1e-6
            framing = float(np.clip(centre_diff.sum() * 255.0 / total, 0.0, 1.0))
        else:
            framing = 0.3

        # brightness sanity: heavily under/over-exposed frames score low
        mean_b = float(gray.mean()) / 255.0
        exposure = 1.0 - min(1.0, abs(mean_b - 0.45) * 2.5)

        sharpness = float(np.clip(cv2.Laplacian(gray_small, cv2.CV_64F).var() / 300.0, 0.0, 1.0))

        return {
            "visibility": motion,
            "framing": framing,
            "stability": exposure,   # reused slot: exposure sanity in L1 mode
            "sharpness": sharpness,
        }
