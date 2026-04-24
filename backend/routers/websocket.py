from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Dict
from database import get_db
from models import Message

router = APIRouter(tags=["WebSocket"])

# Manages active WebSocket connections for real-time messaging
class ConnectionManager:
    # Initializes an empty dictionary to store active user connections
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    # Accepts a new WebSocket connection and maps it to the user's ID
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    # Removes a user's WebSocket connection from the active pool
    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_json(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except RuntimeError:
                self.disconnect(user_id)

manager = ConnectionManager()

# Handles real-time message routing, database storage, and delivery of encrypted payloads
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Receive incoming data
            data = await websocket.receive_json()
            
            recipient_id = data.get("recipient_id")
            ciphertext = data.get("ciphertext")
            nonce = data.get("nonce")
            ratchet_key = data.get("ratchet_key")
            temp_id = data.get("temp_id")
            ephemeral_public_key = data.get("ephemeral_public_key")
            used_opk_id = data.get("used_opk_id")
            sender_identity_key = data.get("sender_identity_key")

            if recipient_id and ciphertext and nonce:
                # Save to Database 
                message = Message(
                    sender_id=user_id, 
                    recipient_id=recipient_id, 
                    ciphertext=ciphertext,
                    nonce=nonce,
                    ratchet_key=ratchet_key,
                    ephemeral_public_key=ephemeral_public_key,
                    used_opk_id=used_opk_id,
                    sender_identity_key=sender_identity_key
                )
                db.add(message)
                db.commit()
                db.refresh(message)

                # Construct response payload
                response = {
                    "id": message.id,
                    "sender_id": user_id,
                    "recipient_id": recipient_id,
                    "ciphertext": ciphertext,
                    "nonce": nonce,
                    "ratchet_key": ratchet_key,
                    "ephemeral_public_key": ephemeral_public_key,
                    "used_opk_id": used_opk_id,
                    "sender_identity_key": sender_identity_key,
                    "timestamp": str(message.timestamp),
                    "temp_id": temp_id 
                }

                # Send to recipient
                await manager.send_personal_json(response, recipient_id)
                

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        print(f"Error in WebSocket: {e}")
        manager.disconnect(user_id)