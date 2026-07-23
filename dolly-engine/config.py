"""Dolly AI Engine configuration.

Frozen v1.0 contract constants live here. Camera IDs, endpoint paths and
message field names must match DOLLY_JULY23_FINAL_LOCK.md exactly.
DO NOT rename anything in the CONTRACT section without agreement from
Nero (integration owner) and Jeboy (presentation owner).
"""
import os

# ---------------------------------------------------------------- CONTRACT v1.0 (FROZEN)
CONTRACT_VERSION = "1.0"
CAMERA_IDS = ("cam_track", "cam_wide", "cam_side")
DEFAULT_CAMERA = "cam_wide"

BACKEND_HOST = os.getenv("DOLLY_BACKEND_HOST", "127.0.0.1")
BACKEND_PORT = int(os.getenv("DOLLY_BACKEND_PORT", "8000"))
BASE_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"
FRAME_URL_TEMPLATE = BASE_URL + "/api/v1/frames/{camera_id}.jpg"
WS_ENGINE_URL = f"ws://{BACKEND_HOST}:{BACKEND_PORT}/ws/v1/engine"

# ---------------------------------------------------------------- SAMPLING
FPS_PER_CAMERA = 2.0                 # Lock §4: start AI sampling at 2 FPS/camera
FETCH_TIMEOUT_S = 0.4                # single fetch slower than this -> drop the frame
FRAME_INVALID_AFTER_S = 2.0          # no valid frame for 2 s -> camera invalid
FRESHNESS_DECAY_AFTER_S = 1.5        # frame older than this -> confidence decays

# ---------------------------------------------------------------- SCORING
WEIGHTS = {
    "visibility": 0.40,
    "framing": 0.25,
    "stability": 0.20,
    "sharpness": 0.15,
}
EMA_ALPHA = 0.4                      # smoothing factor for per-camera score
STABILITY_WINDOW = 6                 # ~3 s of history at 2 FPS
ROLE_BONUS = {"cam_track": 0.03}     # surfaced in reason, never hidden

# ---------------------------------------------------------------- DECISION
DECISION_INTERVAL_S = 0.5            # aligned with 2 FPS
ENGINE_DELTA_GATE = 0.05             # engine-side debounce only; the real
                                     # margin/hold/cooldown live in Nero's backend
MIN_CONFIDENCE_TO_PROPOSE = 0.30     # below this, propose DEFAULT_CAMERA instead

# ---------------------------------------------------------------- TRANSPORT
HEARTBEAT_INTERVAL_S = 1.0           # backend rules: 3 s missing -> hold, 5 s -> wide
RECONNECT_BACKOFF_START_S = 0.5
RECONNECT_BACKOFF_MAX_S = 5.0

# ---------------------------------------------------------------- PERCEPTION
YOLO_MODEL = os.getenv("DOLLY_YOLO_MODEL", "yolov8n.pt")
YOLO_IMGSZ = 640
YOLO_CONF = 0.35
YOLO_PERSON_CLASS = 0

ENGINE_NAME = "dolly-engine"
ENGINE_BUILD = "2026-07-23"
