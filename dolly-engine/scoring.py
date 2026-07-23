"""Scoring layer: deterministic, interpretable sub-scores per camera.

score = 0.40*visibility + 0.25*framing + 0.20*stability + 0.15*sharpness
then EMA smoothing (alpha=0.4) and a role bonus for cam_track that is
always surfaced in the reason string. No LLM anywhere (Lock §6).
"""
from __future__ import annotations

from collections import deque
from typing import Dict, Optional

import cv2
import numpy as np

import config
from perception import PersonBox


def _visibility(box: Optional[PersonBox], shape) -> float:
    if box is None:
        return 0.0
    h, w = shape[:2]
    x1, y1, x2, y2, conf = box
    area_frac = ((x2 - x1) * (y2 - y1)) / float(w * h)
    # sweet spot: subject fills 8–60% of frame
    if area_frac < 0.02:
        size_score = area_frac / 0.02 * 0.4
    elif area_frac < 0.08:
        size_score = 0.4 + (area_frac - 0.02) / 0.06 * 0.6
    elif area_frac <= 0.60:
        size_score = 1.0
    else:
        size_score = max(0.5, 1.0 - (area_frac - 0.60))
    # cropped-at-edge penalty
    margin = 2.0
    cropped = x1 <= margin or y1 <= margin or x2 >= w - margin or y2 >= h - margin
    edge_penalty = 0.15 if cropped else 0.0
    return float(np.clip(size_score * conf - edge_penalty, 0.0, 1.0))


def _framing(box: Optional[PersonBox], shape) -> float:
    if box is None:
        return 0.0
    h, w = shape[:2]
    x1, y1, x2, y2, _ = box
    cx = (x1 + x2) / 2.0 / w
    cy = (y1 + y2) / 2.0 / h
    # distance to nearest vertical third (1/3 or 2/3) and to centre, take best
    dx = min(abs(cx - 1 / 3), abs(cx - 0.5), abs(cx - 2 / 3))
    horiz = 1.0 - np.clip(dx / 0.25, 0.0, 1.0)
    # headroom: subject's top should sit in the upper 5–35% band
    head = y1 / h
    if head < 0.02:
        vert = 0.5          # scalp cut off
    elif head <= 0.35:
        vert = 1.0
    else:
        vert = max(0.2, 1.0 - (head - 0.35) * 2.0)
    return float(np.clip(0.6 * horiz + 0.4 * vert, 0.0, 1.0))


def _sharpness(box: Optional[PersonBox], frame: np.ndarray) -> float:
    if box is None or frame is None:
        return 0.0
    x1, y1 = max(0, int(box[0])), max(0, int(box[1]))
    x2, y2 = int(box[2]), int(box[3])
    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return 0.0
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    var = cv2.Laplacian(gray, cv2.CV_64F).var()
    return float(np.clip(var / 200.0, 0.0, 1.0))


class CameraScorer:
    """Per-camera state: centre history for stability + EMA-smoothed score."""

    def __init__(self, camera_id: str) -> None:
        self.camera_id = camera_id
        self.centres: deque = deque(maxlen=config.STABILITY_WINDOW)
        self.ema: Optional[float] = None
        self.last_subscores: Dict[str, float] = {}

    def _stability(self) -> float:
        if len(self.centres) < 3:
            return 0.5
        arr = np.array(self.centres)
        jitter = float(arr.std(axis=0).mean())     # in normalised coords
        return float(np.clip(1.0 - jitter / 0.08, 0.0, 1.0))

    def compute_subscores(self, box: Optional[PersonBox],
                          frame: Optional[np.ndarray]) -> Dict[str, float]:
        if frame is None:
            subs = {"visibility": 0.0, "framing": 0.0, "stability": 0.0, "sharpness": 0.0}
        else:
            if box is not None:
                h, w = frame.shape[:2]
                self.centres.append((((box[0] + box[2]) / 2.0) / w,
                                     ((box[1] + box[3]) / 2.0) / h))
            subs = {
                "visibility": _visibility(box, frame.shape),
                "framing": _framing(box, frame.shape),
                "stability": self._stability(),
                "sharpness": _sharpness(box, frame),
            }
        self.last_subscores = subs
        return subs

    def update(self, subscores: Dict[str, float], freshness: float) -> float:
        raw = sum(config.WEIGHTS[k] * subscores[k] for k in config.WEIGHTS)
        raw += config.ROLE_BONUS.get(self.camera_id, 0.0)
        raw = min(1.0, raw)
        if self.ema is None:
            self.ema = raw
        else:
            a = config.EMA_ALPHA
            self.ema = a * raw + (1 - a) * self.ema
        # freshness affects the *reported* score so a stale feed can't win
        return round(self.ema * freshness, 3)
