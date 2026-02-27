from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas_keys

router = APIRouter(prefix="/keys", tags=["Signal Keys"])

@router.post("/upload/{user_id}")
def upload_keys(user_id: int, bundle: schemas_keys.BundleUploadRequest, db: Session = Depends(get_db)):
    db.query(models.IdentityKey).filter(models.IdentityKey.user_id == user_id).delete()
    db.query(models.SignedPreKey).filter(models.SignedPreKey.user_id == user_id).delete()
    # 1. Save Identity Key
    new_ik = models.IdentityKey(
        user_id=user_id, 
        public_key=bundle.identity_key
    )
    db.add(new_ik)

    # 2. Save Signed PreKey
    new_spk = models.SignedPreKey(
        user_id=user_id,
        key_id=bundle.signed_prekey.key_id,
        public_key=bundle.signed_prekey.public_key,
        signature=bundle.signed_prekey.signature
    )
    db.add(new_spk)

    # 3. Save all One-Time PreKeys
    for opk in bundle.onetime_prekeys:
        new_opk = models.OneTimePreKey(
            user_id=user_id,
            key_id=opk.key_id,
            public_key=opk.public_key
        )
        db.add(new_opk)

    # 4. Commit all changes to the database
    db.commit()
    
    return {"message": "Keys uploaded successfully"}


@router.get("/{user_id}", response_model=schemas_keys.BundleResponse)
def get_user_bundle(user_id: int, db: Session = Depends(get_db)):
    # 1. Fetch Identity Key and Signed PreKey
    ik = db.query(models.IdentityKey).filter(models.IdentityKey.user_id == user_id).first()
    spk = db.query(models.SignedPreKey).filter(models.SignedPreKey.user_id == user_id).first()

    # Verify user exists and has base keys
    if not ik or not spk:
        raise HTTPException(status_code=404, detail="User keys not found")

    # 2. Fetch exactly ONE One-Time PreKey
    opk = db.query(models.OneTimePreKey).filter(models.OneTimePreKey.user_id == user_id).first()

    opk_response = None
    if opk:
        opk_response = {
            "key_id": opk.key_id, 
            "public_key": opk.public_key
        }
        # 3. Delete the used One-Time PreKey to ensure forward secrecy
        db.delete(opk)
        db.commit()

    # 4. Return the key bundle
    return {
        "identity_key": ik.public_key,
        "signed_prekey": {
            "key_id": spk.key_id,
            "public_key": spk.public_key,
            "signature": spk.signature
        },
        "onetime_prekey": opk_response
    }