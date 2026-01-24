from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Dict
from database import get_db
from models import Message

router = APIRouter(tags=["WebSocket"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_json(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            recipient_id = data["recipient_id"]
            content = data["content"]

            # שמירה ב-DB
            message = Message(sender_id=user_id, recipient_id=recipient_id, content=content)
            db.add(message)
            db.commit()
            db.refresh(message)

            # שליחה לנמען
            response = {
                "sender_id": user_id,
                "recipient_id": recipient_id,
                "content": content,
                "timestamp": str(message.timestamp)
            }
            await manager.send_personal_json(response, recipient_id)

    except WebSocketDisconnect:
        manager.disconnect(user_id)