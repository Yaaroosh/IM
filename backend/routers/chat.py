from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from typing import List

router = APIRouter()

# Fetch users and count unread messages for each
@router.get("/users", response_model=List[schemas.UserPublic])
def get_users(current_user_id: int, db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.id != current_user_id).all()
    
    results = []
    for user in users:
        # Count messages sent by this specific user to me that are still marked as unread
        count = db.query(models.Message).filter(
            models.Message.sender_id == user.id,
            models.Message.recipient_id == current_user_id,
            models.Message.is_read == False
        ).count()
        
        # Construct a public user object including the unread message count
        user_data = schemas.UserPublic(
            id=user.id, 
            username=user.username, 
            unread_count=count
        )
        results.append(user_data)
        
    return results

# 2. Fetch conversation history and mark incoming messages as "read"
@router.get("/messages/{other_user_id}", response_model=List[schemas.MessagePublic])
def get_messages(other_user_id: int, current_user_id: int, db: Session = Depends(get_db)):
    # Retrieve all messages exchanged between the current user and the other contact
    messages = db.query(models.Message).filter(
        ((models.Message.sender_id == current_user_id) & (models.Message.recipient_id == other_user_id)) |
        ((models.Message.sender_id == other_user_id) & (models.Message.recipient_id == current_user_id))
    ).order_by(models.Message.timestamp).all()

    # Update: Mark all unread messages received from this contact as "read"
    db.query(models.Message).filter(
        models.Message.sender_id == other_user_id,
        models.Message.recipient_id == current_user_id,
        models.Message.is_read == False
    ).update({"is_read": True})
    
    db.commit() 

    return messages