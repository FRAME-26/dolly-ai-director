"""Offline replay: run the full scoring -> decision chain over saved frames.

Directory layout expected:
    frames/
      cam_track/0001.jpg 0002.jpg ...
      cam_wide/0001.jpg ...
      cam_side/0001.jpg ...

Usage:
    python replay.py frames/ [--heuristic]

Lets Ceaser validate the whole pipeline before Nero's environment exists,
and turns any recorded rehearsal into a regression test.
"""
from __future__ import annotations

import argparse
import pathlib
import sys

import cv2

import config
from decision import DecisionEmitter
from heuristic import HeuristicScorer
from perception import DegradeToHeuristic, Perception
from scoring import CameraScorer


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("frames_dir", type=pathlib.Path)
    ap.add_argument("--heuristic", action="store_true")
    args = ap.parse_args()

    perception = None
    mode = "heuristic"
    if not args.heuristic:
        try:
            perception = Perception()
            mode = "model"
        except DegradeToHeuristic as exc:
            print(f"[replay] degrading to heuristic: {exc}")

    seqs = {}
    for cid in config.CAMERA_IDS:
        d = args.frames_dir / cid
        seqs[cid] = sorted(d.glob("*.jpg")) if d.is_dir() else []
        print(f"[replay] {cid}: {len(seqs[cid])} frames")
    n = max((len(s) for s in seqs.values()), default=0)
    if n == 0:
        print("no frames found"); return 1

    scorers = {c: CameraScorer(c) for c in config.CAMERA_IDS}
    heur = HeuristicScorer()
    emitter = DecisionEmitter()
    decisions = 0

    for i in range(n):
        scores, subs, invalid = {}, {}, {}
        for cid in config.CAMERA_IDS:
            frame = cv2.imread(str(seqs[cid][i])) if i < len(seqs[cid]) else None
            invalid[cid] = frame is None
            if mode == "model" and perception is not None:
                box = None if frame is None else perception.detect_person(frame)
                s = scorers[cid].compute_subscores(box, frame)
            else:
                s = heur.subscores(cid, frame)
            subs[cid] = s
            scores[cid] = scorers[cid].update(s, 1.0)
        msg = emitter.evaluate(scores, subs, invalid, mode)
        if msg:
            decisions += 1
            print(f"t={i/config.FPS_PER_CAMERA:5.1f}s  -> {msg['selected']:9s} "
                  f"conf={msg['confidence']:.2f}  {msg['reason']}")

    print(f"\n[replay] {n} ticks, {decisions} decisions emitted, mode={mode}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
