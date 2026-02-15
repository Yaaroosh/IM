from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter()

@router.post("/register", response_model=schemas.UserPublic)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    new_user = models.User(username=user.username, password=user.password)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

@router.post("/login", response_model=schemas.UserPublic)
def login(user_credentials: schemas.UserCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == user_credentials.username).first()
    
    if not user:
        raise HTTPException(status_code=403, detail="Invalid Credentials")
    
    if user.password != user_credentials.password:
        raise HTTPException(status_code=403, detail="Invalid Credentials")
    
    return user