"""Dolly AI Engine — entry point.

Runs on the 4060 laptop. Connects to Nero's backend on the OBS laptop over
LAN. Proposes camera decisions; never touches OBS directly.

Usage:
    DOLLY_BACKEND_HOST=192.168.x.x python main.py
    python main.py --heuristic        # force L1 mode (no GPU/model)
"""
from __future__ import annotations

import argparse
import asyncio
from typing import Dict

import httpx

import config
from decision import DecisionEmitter
from fetcher import FrameStore, start_fetchers
from heuristic import HeuristicScorer
from perception import DegradeToHeuristic, Perception
from scoring import CameraScorer
from ws_client import EngineWSClient


class Engine:
    def __init__(self, force_heuristic: bool = False) -> None:
        self.store = FrameStore()
        self.scorers = {c: CameraScorer(c) for c in config.CAMERA_IDS}
        self.heuristic = HeuristicScorer()
        self.emitter = DecisionEmitter()
        self.mode = "heuristic"
        self.perception: Perception | None = None
        if not force_heuristic:
            try:
                self.perception = Perception()
                self.mode = "model"
                print("[engine] perception ready (mode=model)")
            except DegradeToHeuristic as exc:
                print(f"[engine] L1 DEGRADE at startup: {exc} (mode=heuristic)")

    # ---- callbacks for heartbeat ------------------------------------
    def fps(self) -> Dict[str, float]:
        return {c: self.store.get(c).measured_fps for c in config.CAMERA_IDS}

    def gpu_ok(self) -> bool:
        return self.mode == "model"

    def get_mode(self) -> str:
        return self.mode

    # ---- one scoring pass over all cameras --------------------------
    def step(self) -> dict | None:
        scores: Dict[str, float] = {}
        subs: Dict[str, Dict[str, float]] = {}
        invalid: Dict[str, bool] = {}

        for cid in config.CAMERA_IDS:
            slot = self.store.get(cid)
            invalid[cid] = slot.invalid
            frame = None if slot.invalid else slot.frame

            if self.mode == "model" and self.perception is not None:
                try:
                    box = None if frame is None else self.perception.detect_person(frame)
                except DegradeToHeuristic as exc:
                    print(f"[engine] L1 DEGRADE mid-run: {exc}")
                    self.mode = "heuristic"
                    box = None
                s = self.scorers[cid].compute_subscores(box, frame)
            if self.mode == "heuristic":
                s = self.heuristic.subscores(cid, frame)
                self.scorers[cid].last_subscores = s

            subs[cid] = s
            scores[cid] = self.scorers[cid].update(s, slot.freshness)

        return self.emitter.evaluate(scores, subs, invalid, self.mode)


async def run(force_heuristic: bool) -> None:
    engine = Engine(force_heuristic=force_heuristic)
    stop = asyncio.Event()
    ws = EngineWSClient(engine.fps, engine.get_mode, engine.gpu_ok)

    async with httpx.AsyncClient() as client:
        fetchers = start_fetchers(engine.store, client, stop)
        ws_task = asyncio.create_task(ws.run(stop))

        try:
            while True:
                t0 = asyncio.get_event_loop().time()
                msg = engine.step()
                if msg is not None:
                    print(f"[decision] {msg['selected']} conf={msg['confidence']} "
                          f"reason=\"{msg['reason']}\"")
                    ws.push_decision(msg)
                dt = asyncio.get_event_loop().time() - t0
                await asyncio.sleep(max(0.0, config.DECISION_INTERVAL_S - dt))
        finally:
            stop.set()
            ws_task.cancel()
            for t in fetchers:
                t.cancel()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--heuristic", action="store_true",
                    help="force L1 heuristic mode (skip YOLO)")
    args = ap.parse_args()
    try:
        asyncio.run(run(force_heuristic=args.heuristic))
    except KeyboardInterrupt:
        print("\n[engine] stopped")
