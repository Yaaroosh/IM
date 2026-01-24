from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware # <--- הוספה קריטית 1
from sqlalchemy.orm import Session
from database import Base, engine, get_db
from models import User, Message
from pydantic import BaseModel
from typing import List, Dict
from datetime import datetime

# צור את הטבלאות אם אין
Base.metadata.create_all(bind=engine)

app = FastAPI()

# -------------------------
# CORS Configuration - חובה בשביל React
# -------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # הכתובת של ה-React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Pydantic Schemas
# -------------------------
class UserCreate(BaseModel):
    username: str
    password: str  # plain text for now

class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True # או orm_mode בגרסאות ישנות יותר

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True

# -------------------------
# REST API
# -------------------------
@app.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    new_user = User(username=user.username, password=user.password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=UserResponse)
def login(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or db_user.password != user.password:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    return db_user

@app.get("/users", response_model=List[UserResponse])
def get_users(current_user_id: int, db: Session = Depends(get_db)):
    users = db.query(User).filter(User.id != current_user_id).all()
    return users

@app.get("/messages/{other_user_id}", response_model=List[MessageResponse])
def get_messages(other_user_id: int, current_user_id: int, db: Session = Depends(get_db)):
    messages = db.query(Message).filter(
        ((Message.sender_id == current_user_id) & (Message.recipient_id == other_user_id)) |
        ((Message.sender_id == other_user_id) & (Message.recipient_id == current_user_id))
    ).order_by(Message.timestamp).all()
    return messages

# -------------------------
# WebSocket – Real-time chat
# -------------------------
active_connections: Dict[int, WebSocket] = {}

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await websocket.accept()
    user_id = int(user_id)
    active_connections[user_id] = websocket
    try:
        while True:
            data = await websocket.receive_json()
            recipient_id = data["recipient_id"]
            content = data["content"]

            # שמור הודעה ב-DB
            message = Message(sender_id=user_id, recipient_id=recipient_id, content=content)
            db.add(message)
            db.commit()
            db.refresh(message)

            # שלח הודעה בזמן אמת למקבל אם מחובר
            if recipient_id in active_connections:
                await active_connections[recipient_id].send_json({
                    "sender_id": user_id,
                    "recipient_id": recipient_id,
                    "content": content,
                    "timestamp": str(message.timestamp)
                })

    except WebSocketDisconnect:
        # print(f"User {user_id} disconnected") # אופציונלי
        if user_id in active_connections:
            del active_connections[user_id]