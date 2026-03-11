from pydantic import BaseModel
from datetime import datetime
from typing import Optional

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
    """Schema for sending a new encrypted message via WebSocket or API."""
    recipient_id: int
    ciphertext: str
    nonce: str
    # Optional fields for the X3DH Handshake (Included only in the first message of a session)
    ephemeral_public_key: Optional[str] = None
    used_opk_id: Optional[int] = None

class MessagePublic(BaseModel):
    """Schema for retrieving messages - matches the Signal E2EE database structure."""
    id: int
    sender_id: int
    recipient_id: int
    ciphertext: str
    nonce: str
    timestamp: datetime
    is_read: bool
    ephemeral_public_key: Optional[str] = None
    used_opk_id: Optional[int] = None

    class Config:
        from_attributes = True