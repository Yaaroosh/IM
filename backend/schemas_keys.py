from pydantic import BaseModel
from typing import List, Optional

class OneTimeKeySchema(BaseModel):
    key_id: int
    public_key: str

class SignedPreKeySchema(BaseModel):
    key_id: int
    public_key: str
    signature: str

class BundleUploadRequest(BaseModel):
    identity_key: str
    signed_prekey: SignedPreKeySchema
    onetime_prekeys: List[OneTimeKeySchema]

class BundleResponse(BaseModel):
    identity_key: str
    signed_prekey: SignedPreKeySchema
    onetime_prekey: Optional[OneTimeKeySchema] = None