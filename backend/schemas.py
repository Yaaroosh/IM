from pydantic import BaseModel
from datetime import datetime

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserPublic(UserBase):
    id: int
    unread_count: int = 0 

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    recipient_id: int
    content: str

class MessagePublic(BaseModel):
    sender_id: int
    recipient_id: int
    content: str
    timestamp: datetime
    is_read: bool 

    class Config:
        from_attributes = True