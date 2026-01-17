from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from .models import RegisterKeysRequest, RegisterKeysResponse, KeyBundleResponse, WsEvent
from .ws import hub

app = FastAPI(title="Secure Messaging Skeleton")

# Dev-only CORS (tighten later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Placeholder storage for A2 (A3 will replace this with real key bundle storage)
_registered_users: set[str] = set()


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/registerKeys", response_model=RegisterKeysResponse)
def register_keys(req: RegisterKeysRequest) -> RegisterKeysResponse:
    # A2: only registers the user_id. A3 will store a full key bundle.
    _registered_users.add(req.user_id)
    return RegisterKeysResponse(ok=True)


@app.get("/getKeyBundle/{user_id}", response_model=KeyBundleResponse)
def get_key_bundle(user_id: str) -> KeyBundleResponse:
    # A2: returns empty bundle placeholder. A3 will return IK/SPK/OPK etc.
    if user_id not in _registered_users:
        return KeyBundleResponse(user_id=user_id, bundle=None)
    return KeyBundleResponse(user_id=user_id, bundle={"placeholder": True})


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket, user_id: str = Query(..., min_length=1, max_length=64)) -> None:
    await ws.accept()
    await hub.connect(user_id, ws)

    # Notify client + flush queued messages
    await ws.send_json(WsEvent(type="hello", payload={"user_id": user_id}).model_dump())
    flushed = await hub.flush_queue(user_id)
    await ws.send_json(WsEvent(type="presence", payload={"online": True, "flushed": flushed}).model_dump())

    try:
        while True:
            raw = await ws.receive_json()
            event = WsEvent.model_validate(raw)

            # A2: only chat.send -> server routes it (no crypto yet)
            if event.type == "chat.send":
                to_user = str(event.payload.get("to", "")).strip()
                text = str(event.payload.get("text", "")).strip()
                if not to_user or not text:
                    await ws.send_json(WsEvent(type="error", payload={"message": "Missing to/text"}).model_dump())
                    continue

                deliver = WsEvent(
                    type="chat.deliver",
                    payload={
                        "from": user_id,
                        "to": to_user,
                        "text": text,
                    },
                ).model_dump()

                await hub.send_to(to_user, deliver)

            else:
                await ws.send_json(WsEvent(type="error", payload={"message": f"Unsupported event: {event.type}"}).model_dump())

    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(user_id)
