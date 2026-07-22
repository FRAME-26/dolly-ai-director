# dolly-ai-director

> AI director project — team: Ceaser, Nero, Jeboy

## Structure

```
dolly-ai-director/
├── backend/            # ⭐ Server runs only this folder
│   ├── app/
│   │   ├── main.py          # FastAPI entrypoint
│   │   ├── decision_engine.py  # MCDA scoring + state machine
│   │   ├── watchdog.py      # Watchdog
│   │   └── models.py        # Pydantic data models (interface contract)
│   ├── requirements.txt     # Server deps (fastapi/uvicorn/websockets...)
│   ├── .env.example         # Env var template
│   └── Dockerfile           # (optional) containerized deploy
├── client/             # Local laptop (Nero + Jeboy)
│   ├── perception/
│   │   ├── camera_capture.py   # cv2 read Pocket 4
│   │   └── yolo_inference.py   # YOLOv8n + feature extraction
│   ├── obs_bridge/
│   │   └── obs_controller.py   # obs-websocket-py control OBS
│   └── requirements.txt    # Local deps (ultralytics, opencv, gradio...)
├── ui/                 # Jeboy's Gradio dashboard
│   └── dashboard.py
├── docs/               # All PDFs / docs
├── .gitignore
└── README.md
```

## Quick start

### Backend (server)
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # then fill in values
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Client (local laptop)
```bash
cd client
pip install -r requirements.txt
python perception/camera_capture.py
```

### UI dashboard
```bash
cd ui
python dashboard.py
```
