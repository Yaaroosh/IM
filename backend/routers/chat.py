from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from typing import List

router = APIRouter()

# Fetch users along with their unread message count
@router.get("/users", response_model=List[schemas.UserPublic])
def get_users(current_user_id: int, db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.id != current_user_id).all()
    
    results = []
    for user in users:
        count = db.query(models.Message).filter(
            models.Message.sender_id == user.id,
            models.Message.recipient_id == current_user_id,
            models.Message.is_read == False
        ).count()
        
        user_data = schemas.UserPublic(
            id=user.id, 
            username=user.username, 
            unread_count=count
        )
        results.append(user_data)
        
    return results

# Fetch full message history between the current user and another contact
@router.get("/messages/{other_user_id}", response_model=List[schemas.MessagePublic])
def get_messages(other_user_id: int, current_user_id: int, db: Session = Depends(get_db)):
    messages = db.query(models.Message).filter(
        ((models.Message.sender_id == current_user_id) & (models.Message.recipient_id == other_user_id)) |
        ((models.Message.sender_id == other_user_id) & (models.Message.recipient_id == current_user_id))
    ).order_by(models.Message.timestamp).all()

    return messages

# Mark all incoming messages from a specific user as read
@router.post("/messages/read/{other_user_id}")
def mark_messages_as_read(other_user_id: int, current_user_id: int, db: Session = Depends(get_db)):
    db.query(models.Message).filter(
        models.Message.sender_id == other_user_id,
        models.Message.recipient_id == current_user_id,
        models.Message.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    return {"status": "success"}