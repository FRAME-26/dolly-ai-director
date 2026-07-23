"""Perception layer: YOLO person detection with warm-up and graceful degradation.

If the model cannot load or inference fails repeatedly, raise
DegradeToHeuristic so the engine drops to L1 (heuristic.py) instead of dying.
"""
from __future__ import annotations

from typing import Optional, Tuple

import numpy as np

import config


class DegradeToHeuristic(Exception):
    """Signal: switch the engine to heuristic (L1) mode."""


PersonBox = Tuple[float, float, float, float, float]  # x1, y1, x2, y2, conf


class Perception:
    def __init__(self) -> None:
        try:
            from ultralytics import YOLO  # heavy import kept local
            self.model = YOLO(config.YOLO_MODEL)
            self._warmup()
        except Exception as exc:  # ImportError, CUDA errors, missing weights, ...
            raise DegradeToHeuristic(f"model init failed: {exc}") from exc
        self._consecutive_errors = 0

    def _warmup(self) -> None:
        dummy = np.zeros((360, 640, 3), dtype=np.uint8)
        for _ in range(3):
            self.model.predict(dummy, imgsz=config.YOLO_IMGSZ,
                               conf=config.YOLO_CONF, verbose=False)

    def detect_person(self, frame: np.ndarray) -> Optional[PersonBox]:
        """Return the largest person box in the frame, or None."""
        try:
            results = self.model.predict(
                frame, imgsz=config.YOLO_IMGSZ, conf=config.YOLO_CONF,
                classes=[config.YOLO_PERSON_CLASS], verbose=False,
            )
            self._consecutive_errors = 0
        except Exception as exc:
            self._consecutive_errors += 1
            if self._consecutive_errors >= 3:
                raise DegradeToHeuristic(f"inference failing: {exc}") from exc
            return None

        best: Optional[PersonBox] = None
        best_area = 0.0
        for r in results:
            if r.boxes is None:
                continue
            for b in r.boxes:
                x1, y1, x2, y2 = map(float, b.xyxy[0].tolist())
                conf = float(b.conf[0])
                area = (x2 - x1) * (y2 - y1)
                if area > best_area:
                    best_area = area
                    best = (x1, y1, x2, y2, conf)
        return best
