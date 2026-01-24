from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, Message
import schemas

router = APIRouter(tags=["Chat"])

@router.get("/users", response_model=List[schemas.UserResponse])
def get_users(current_user_id: int, db: Session = Depends(get_db)):
    users = db.query(User).filter(User.id != current_user_id).all()
    return users

@router.get("/messages/{other_user_id}", response_model=List[schemas.MessageResponse])
def get_messages(other_user_id: int, current_user_id: int, db: Session = Depends(get_db)):
    messages = db.query(Message).filter(
        ((Message.sender_id == current_user_id) & (Message.recipient_id == other_user_id)) |
        ((Message.sender_id == other_user_id) & (Message.recipient_id == current_user_id))
    ).order_by(Message.timestamp).all()
    return messages