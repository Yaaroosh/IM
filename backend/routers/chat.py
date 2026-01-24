from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from typing import List

router = APIRouter()

# 1. שליפת משתמשים + ספירת הודעות שלא נקראו
@router.get("/users", response_model=List[schemas.UserPublic])
def get_users(current_user_id: int, db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.id != current_user_id).all()
    
    results = []
    for user in users:
        # ספירת הודעות שמשתמש זה שלח לי, ואני עדיין לא קראתי
        count = db.query(models.Message).filter(
            models.Message.sender_id == user.id,
            models.Message.recipient_id == current_user_id,
            models.Message.is_read == False
        ).count()
        
        # יצירת אובייקט עם המידע הנוסף
        user_data = schemas.UserPublic(
            id=user.id, 
            username=user.username, 
            unread_count=count
        )
        results.append(user_data)
        
    return results

# 2. שליפת הודעות + סימון כ"נקרא"
@router.get("/messages/{other_user_id}", response_model=List[schemas.MessagePublic])
def get_messages(other_user_id: int, current_user_id: int, db: Session = Depends(get_db)):
    # שליפת כל ההודעות ביני לבין המשתמש השני
    messages = db.query(models.Message).filter(
        ((models.Message.sender_id == current_user_id) & (models.Message.recipient_id == other_user_id)) |
        ((models.Message.sender_id == other_user_id) & (models.Message.recipient_id == current_user_id))
    ).order_by(models.Message.timestamp).all()

    # עדכון: כל ההודעות שקיבלתי מהמשתמש הזה עכשיו נחשבות "נקראו"
    db.query(models.Message).filter(
        models.Message.sender_id == other_user_id,
        models.Message.recipient_id == current_user_id,
        models.Message.is_read == False
    ).update({"is_read": True})
    
    db.commit() # שמירת השינוי במסד הנתונים

    return messages