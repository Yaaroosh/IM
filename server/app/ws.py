from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Dict, Optional

from fastapi import WebSocket


@dataclass
class ClientConn:
    user_id: str
    ws: WebSocket


class WsHub:
    """
    Simple in-memory hub.
    - Tracks online connections: user_id -> websocket
    - Queues messages for offline users: user_id -> [event_json]
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._online: Dict[str, ClientConn] = {}
        self._queues: Dict[str, list[dict]] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._online[user_id] = ClientConn(user_id=user_id, ws=ws)

    async def disconnect(self, user_id: str) -> None:
        async with self._lock:
            self._online.pop(user_id, None)

    async def is_online(self, user_id: str) -> bool:
        async with self._lock:
            return user_id in self._online

    async def send_to(self, user_id: str, event: dict) -> None:
        """
        If user is online -> send immediately.
        Else -> enqueue.
        """
        async with self._lock:
            conn = self._online.get(user_id)
            if conn is None:
                self._queues.setdefault(user_id, []).append(event)
                return

        # send outside lock
        await conn.ws.send_json(event)

    async def flush_queue(self, user_id: str) -> int:
        """
        Deliver queued events to user if online.
        """
        async with self._lock:
            conn = self._online.get(user_id)
            queued = self._queues.get(user_id, [])
            if conn is None or not queued:
                return 0
            self._queues[user_id] = []

        for ev in queued:
            await conn.ws.send_json(ev)
        return len(queued)


hub = WsHub()
