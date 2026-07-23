"""WS client to Nero's backend (/ws/v1/engine).

hello on connect, heartbeat every 1 s (strict — backend's 3 s/5 s failure
rules depend on it), decisions pushed as they occur. Reconnect with
exponential backoff; stale decisions are DROPPED during outages, never
replayed.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Callable, Dict

import websockets

import config


class EngineWSClient:
    def __init__(self, get_fps: Callable[[], Dict[str, float]],
                 get_mode: Callable[[], str],
                 get_gpu_ok: Callable[[], bool]) -> None:
        self._get_fps = get_fps
        self._get_mode = get_mode
        self._get_gpu_ok = get_gpu_ok
        self._latest_decision: dict | None = None
        self._decision_event = asyncio.Event()
        self.connected = asyncio.Event()

    # decision loop calls this; latest-wins, no queue buildup
    def push_decision(self, msg: dict) -> None:
        self._latest_decision = msg
        self._decision_event.set()

    def _hello(self) -> dict:
        return {
            "v": config.CONTRACT_VERSION,
            "type": "engine.hello",
            "engine": config.ENGINE_NAME,
            "build": config.ENGINE_BUILD,
            "mode": self._get_mode(),
        }

    def _heartbeat(self) -> dict:
        return {
            "v": config.CONTRACT_VERSION,
            "type": "engine.heartbeat",
            "ts": int(time.time() * 1000),
            "fps": self._get_fps(),
            "gpu_ok": self._get_gpu_ok(),
            "mode": self._get_mode(),
        }

    async def _heartbeat_loop(self, ws) -> None:
        while True:
            await ws.send(json.dumps(self._heartbeat()))
            await asyncio.sleep(config.HEARTBEAT_INTERVAL_S)

    async def _sender_loop(self, ws) -> None:
        while True:
            await self._decision_event.wait()
            self._decision_event.clear()
            msg, self._latest_decision = self._latest_decision, None
            if msg is not None:
                await ws.send(json.dumps(msg))

    async def _receiver_loop(self, ws) -> None:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            # decision.result / acks from backend: log only, backend is boss
            print(f"[ws] backend -> {msg.get('type', '?')}: "
                  f"{msg.get('result', msg)}")

    async def run(self, stop: asyncio.Event) -> None:
        backoff = config.RECONNECT_BACKOFF_START_S
        while not stop.is_set():
            try:
                async with websockets.connect(config.WS_ENGINE_URL,
                                              ping_interval=None) as ws:
                    print(f"[ws] connected to {config.WS_ENGINE_URL}")
                    self.connected.set()
                    backoff = config.RECONNECT_BACKOFF_START_S
                    # drop anything queued while offline
                    self._latest_decision = None
                    self._decision_event.clear()
                    await ws.send(json.dumps(self._hello()))
                    tasks = [
                        asyncio.create_task(self._heartbeat_loop(ws)),
                        asyncio.create_task(self._sender_loop(ws)),
                        asyncio.create_task(self._receiver_loop(ws)),
                    ]
                    done, pending = await asyncio.wait(
                        tasks, return_when=asyncio.FIRST_EXCEPTION)
                    for t in pending:
                        t.cancel()
                    for t in done:
                        if t.exception():
                            raise t.exception()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.connected.clear()
                print(f"[ws] disconnected ({exc!r}); retry in {backoff:.1f}s")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, config.RECONNECT_BACKOFF_MAX_S)
