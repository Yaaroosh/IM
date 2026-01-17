from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Literal, Optional, Any, Dict


class RegisterKeysRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)


class RegisterKeysResponse(BaseModel):
    ok: bool = True


class KeyBundleResponse(BaseModel):
    user_id: str
    bundle: Optional[Dict[str, Any]] = None


WsEventType = Literal[
    "hello",
    "presence",
    "chat.send",
    "chat.deliver",
    "error",
]


class WsEvent(BaseModel):
    type: WsEventType
    request_id: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
