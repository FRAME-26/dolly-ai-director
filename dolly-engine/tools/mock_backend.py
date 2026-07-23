"""Mock of Nero's backend for engine development WITHOUT the real environment.

Serves:
  GET /api/v1/frames/{camera_id}.jpg   -- synthetic 640x360 frames with a
                                          moving "person" blob that walks
                                          between cameras every ~8 s
  WS  /ws/v1/engine                    -- accepts hello/heartbeat/decision,
                                          applies mock hold/cooldown, replies
                                          with decision.result

This file is a TOOL, not the contract. Nero's real backend is authoritative.

Usage:  uvicorn tools.mock_backend:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import json
import time

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import Response

CAMERA_IDS = ("cam_track", "cam_wide", "cam_side")
MIN_HOLD_MS = 2500
COOLDOWN_MS = 1500
MIN_CONFIDENCE = 0.65

app = FastAPI()
_state = {"active": "cam_wide", "last_switch_ms": 0}


def _synthetic_frame(camera_id: str) -> bytes:
    """A subject blob that spends ~8 s favouring each camera in turn."""
    t = time.time()
    phase = int(t / 8) % 3
    favoured = CAMERA_IDS[phase]
    img = np.full((360, 640, 3), 105, dtype=np.uint8)
    # texture so sharpness/exposure behave like real footage
    xs = np.tile(np.arange(640, dtype=np.uint8) % 37, (360, 1))
    img[:, :, 0] = cv2.add(img[:, :, 0], xs)
    img[:, :, 1] = cv2.add(img[:, :, 1], xs // 2)
    cv2.putText(img, camera_id, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                (200, 200, 200), 2)
    if camera_id == favoured:
        # well-framed moving person-ish rectangle near a third line
        cx = int(640 / 3 + 80 * np.sin(t * 3.5))
        cy = 190 + int(30 * np.sin(t * 4.7))
        cv2.rectangle(img, (cx - 45, cy - 120), (cx + 45, cy + 120),
                      (60, 160, 230), -1)
        cv2.circle(img, (cx, cy - 150), 32, (80, 180, 240), -1)
        noise = np.random.randint(0, 60, img.shape, dtype=np.uint8)
        img = cv2.add(img, noise)
    elif camera_id == "cam_wide":
        # wide always has a small distant subject: the safe shot
        cv2.rectangle(img, (300, 160), (330, 240), (90, 120, 150), -1)
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


@app.get("/api/v1/frames/{camera_id}.jpg")
def frame(camera_id: str):
    if camera_id not in CAMERA_IDS:
        return Response(status_code=404)
    return Response(content=_synthetic_frame(camera_id), media_type="image/jpeg")


@app.get("/api/v1/health")
def health():
    return {"ok": True, "active": _state["active"], "mock": True}


@app.websocket("/ws/v1/engine")
async def ws_engine(ws: WebSocket):
    await ws.accept()
    print("[mock] engine connected")
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            mtype = msg.get("type")
            if mtype == "engine.hello":
                print(f"[mock] hello from {msg.get('engine')} mode={msg.get('mode')}")
            elif mtype == "engine.heartbeat":
                pass  # a real backend tracks the 3s/5s rules here
            elif mtype == "director.decision":
                now = int(time.time() * 1000)
                sel, conf = msg["selected"], msg["confidence"]
                since = now - _state["last_switch_ms"]
                if sel == _state["active"]:
                    result = "noop"
                elif conf < MIN_CONFIDENCE:
                    result = f"rejected:low_confidence({conf})"
                elif since < MIN_HOLD_MS:
                    result = f"rejected:hold({since}ms<{MIN_HOLD_MS})"
                elif since < MIN_HOLD_MS + COOLDOWN_MS:
                    result = "rejected:cooldown"
                else:
                    _state["active"] = sel
                    _state["last_switch_ms"] = now
                    result = f"switched:{sel}"
                    print(f"[mock] *** OBS SWITCH -> {sel} *** ({msg['reason']})")
                await ws.send_text(json.dumps({
                    "v": "1.0", "type": "decision.result",
                    "ts": now, "result": result, "active": _state["active"],
                }))
    except WebSocketDisconnect:
        print("[mock] engine disconnected")
