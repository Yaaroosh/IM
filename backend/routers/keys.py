from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas_keys

router = APIRouter(prefix="/keys", tags=["Signal Keys"])

@router.post("/upload/{user_id}")
def upload_keys(user_id: int, bundle: schemas_keys.BundleUploadRequest, db: Session = Depends(get_db)):
    # הלוגיקה של העלאת המפתחות תיכתב כאן
    pass


@router.get("/{user_id}", response_model=schemas_keys.BundleResponse)
def get_user_bundle(user_id: int, db: Session = Depends(get_db)):
    # הלוגיקה של משיכת המפתחות תיכתב כאן
    pass