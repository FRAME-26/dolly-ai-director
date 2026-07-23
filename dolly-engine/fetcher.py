"""Frame fetcher: one asyncio task per camera, pulling JPEGs from the
backend frame relay. NEVER opens cameras directly (OBS owns UVC, Lock §4).
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Dict, Optional

import cv2
import httpx
import numpy as np

import config


@dataclass
class FrameSlot:
    camera_id: str
    frame: Optional[np.ndarray] = None
    ts: float = 0.0                       # monotonic time of last good frame
    consecutive_failures: int = 0
    fetch_count: int = 0
    _fps_window: list = field(default_factory=list)

    @property
    def age_s(self) -> float:
        return time.monotonic() - self.ts if self.ts else float("inf")

    @property
    def invalid(self) -> bool:
        return self.frame is None or self.age_s > config.FRAME_INVALID_AFTER_S

    @property
    def freshness(self) -> float:
        """1.0 while fresh, linear decay to 0 between decay-threshold and invalid."""
        a = self.age_s
        if a <= config.FRESHNESS_DECAY_AFTER_S:
            return 1.0
        if a >= config.FRAME_INVALID_AFTER_S:
            return 0.0
        span = config.FRAME_INVALID_AFTER_S - config.FRESHNESS_DECAY_AFTER_S
        return max(0.0, 1.0 - (a - config.FRESHNESS_DECAY_AFTER_S) / span)

    @property
    def measured_fps(self) -> float:
        now = time.monotonic()
        self._fps_window = [t for t in self._fps_window if now - t < 5.0]
        return round(len(self._fps_window) / 5.0, 1)


class FrameStore:
    """Latest-frame-wins store shared between fetcher tasks and the decision loop."""

    def __init__(self) -> None:
        self.slots: Dict[str, FrameSlot] = {
            cid: FrameSlot(camera_id=cid) for cid in config.CAMERA_IDS
        }

    def get(self, camera_id: str) -> FrameSlot:
        return self.slots[camera_id]


async def fetch_loop(store: FrameStore, camera_id: str, client: httpx.AsyncClient,
                     stop: asyncio.Event) -> None:
    url = config.FRAME_URL_TEMPLATE.format(camera_id=camera_id)
    interval = 1.0 / config.FPS_PER_CAMERA
    slot = store.get(camera_id)

    while not stop.is_set():
        t0 = time.monotonic()
        try:
            resp = await client.get(url, timeout=config.FETCH_TIMEOUT_S)
            resp.raise_for_status()
            buf = np.frombuffer(resp.content, dtype=np.uint8)
            frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError("jpeg decode failed")
            slot.frame = frame
            slot.ts = time.monotonic()
            slot.consecutive_failures = 0
            slot.fetch_count += 1
            slot._fps_window.append(slot.ts)
        except Exception:
            slot.consecutive_failures += 1
            # frame/ts left as-is; staleness handles invalidation

        # keep cadence regardless of fetch duration
        elapsed = time.monotonic() - t0
        await asyncio.sleep(max(0.0, interval - elapsed))


def start_fetchers(store: FrameStore, client: httpx.AsyncClient,
                   stop: asyncio.Event) -> list[asyncio.Task]:
    return [
        asyncio.create_task(fetch_loop(store, cid, client, stop), name=f"fetch:{cid}")
        for cid in config.CAMERA_IDS
    ]
