from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)

    messages_sent = relationship("Message", back_populates="sender", foreign_keys='Message.sender_id')
    messages_received = relationship("Message", back_populates="recipient", foreign_keys='Message.recipient_id')

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"))
    ciphertext = Column(Text, nullable=False)
    nonce = Column(String, nullable=False)
    ephemeral_public_key = Column(String, nullable=True)
    used_opk_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False) 

    sender = relationship("User", foreign_keys=[sender_id], back_populates="messages_sent")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="messages_received")

    # --- Signal Protocol Keys Tables ---

class IdentityKey(Base):
    __tablename__ = "identity_keys"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    public_key = Column(String)

class SignedPreKey(Base):
    __tablename__ = "signed_prekeys"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    key_id = Column(Integer)
    public_key = Column(String)
    signature = Column(String)

class OneTimePreKey(Base):
    __tablename__ = "onetime_prekeys"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    key_id = Column(Integer)
    public_key = Column(String)