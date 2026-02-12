from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Dict
from database import get_db
from models import Message

router = APIRouter(tags=["WebSocket"])

class ConnectionManager:
    def __init__(self):
        # Maps user_id to their active WebSocket connection
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_json(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except RuntimeError:
                # Handle cases where the connection dropped unexpectedly
                self.disconnect(user_id)

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await manager.connect(websocket, user_id)
    try:
        while True:
            # 1. Receive incoming data
            data = await websocket.receive_json()
            
            # Use .get() to safely extract fields
            recipient_id = data.get("recipient_id")
            content = data.get("content")
            temp_id = data.get("temp_id") 

            if recipient_id and content:
                # 2. Save to Database (temp_id is not saved to DB)
                message = Message(sender_id=user_id, recipient_id=recipient_id, content=content)
                db.add(message)
                db.commit()
                db.refresh(message)

                # 3. Construct response payload (echoing temp_id back)
                response = {
                    "id": message.id,
                    "sender_id": user_id,
                    "recipient_id": recipient_id,
                    "content": content,
                    "timestamp": str(message.timestamp),
                    "temp_id": temp_id 
                }

                # 4. Send to recipient
                await manager.send_personal_json(response, recipient_id)
                
                # 5. Echo back to sender (critical for frontend deduplication)
                await manager.send_personal_json(response, user_id)

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        print(f"Error in WebSocket: {e}")
        manager.disconnect(user_id)