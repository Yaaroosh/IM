from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Dict
from database import get_db
from models import Message

router = APIRouter(tags=["WebSocket"])

class ConnectionManager:
    def __init__(self):
        # מילון לשמירת החיבורים הפעילים: מזהה משתמש -> אובייקט WebSocket
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
                # טיפול במקרה שבו החיבור נסגר פתאום
                self.disconnect(user_id)

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await manager.connect(websocket, user_id)
    try:
        while True:
            # 1. קבלת המידע (כולל ה-temp_id החדש!)
            data = await websocket.receive_json()
            
            # שימוש ב-.get כדי לא לקרוס אם המפתח חסר
            recipient_id = data.get("recipient_id")
            content = data.get("content")
            temp_id = data.get("temp_id") # <--- הנה המזהה הייחודי שהוספנו

            if recipient_id and content:
                # שמירה ב-DB (כרגיל, בלי ה-temp_id כי הוא לא נשמר בבסיס הנתונים)
                message = Message(sender_id=user_id, recipient_id=recipient_id, content=content)
                db.add(message)
                db.commit()
                db.refresh(message)

                # בניית התשובה שתשלח ללקוחות
                response = {
                    "id": message.id,
                    "sender_id": user_id,
                    "recipient_id": recipient_id,
                    "content": content,
                    "timestamp": str(message.timestamp),
                    "temp_id": temp_id # <--- מחזירים את המזהה חזרה ללקוחות
                }

                # 2. שליחה לנמען (Try)
                await manager.send_personal_json(response, recipient_id)
                
                # 3. שליחה חזרה גם לשולח (Ariel)
                # זה קריטי כדי שאריאל תקבל אישור מהשרת שההודעה נשמרה,
                # וה-Chat.jsx שלה יוכל לזהות לפי ה-temp_id שזו הודעה שהוא כבר מכיר
                await manager.send_personal_json(response, user_id)

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        # תמיד טוב להדפיס שגיאות כדי לדעת אם משהו קרס
        print(f"Error in WebSocket: {e}")
        manager.disconnect(user_id)