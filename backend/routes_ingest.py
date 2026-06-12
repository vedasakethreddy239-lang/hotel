"""Data ingestion routes for LoyaltyShield AI."""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

import models
from database import get_db
from ingest import TEMPLATES, active_source, clear_uploaded, ingest

logger = logging.getLogger("loyaltyshield.ingest")

router = APIRouter(prefix="/api", tags=["ingestion"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


@router.post("/ingest/upload", status_code=201)
async def upload_dataset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 20 MB upload limit")
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")
    try:
        ds = ingest(db, file.filename or "upload", content)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # malformed binary / encoding issues at the boundary
        db.rollback()
        logger.exception("Ingestion failed")
        raise HTTPException(status_code=422, detail=f"Could not parse file: {e}")
    return ds.to_dict()


@router.get("/datasets")
def list_datasets(db: Session = Depends(get_db)):
    items = db.query(models.Dataset).order_by(models.Dataset.created_at.desc()).all()
    return [d.to_dict() for d in items]


@router.delete("/ingest/clear")
def clear_uploaded_data(db: Session = Depends(get_db)):
    counts = clear_uploaded(db)
    return {"status": "ok", "removed": counts, "mode": "demo"}


@router.get("/system/mode")
def system_mode(db: Session = Depends(get_db)):
    mode = active_source(db)
    datasets = db.query(models.Dataset).count()
    uploaded_accounts = db.query(models.Account).filter(models.Account.source == "uploaded").count()
    return {"mode": mode, "datasets": datasets, "uploaded_accounts": uploaded_accounts}


@router.get("/ingest/template/{kind}", response_class=PlainTextResponse)
def download_template(kind: str):
    if kind not in TEMPLATES:
        raise HTTPException(status_code=404, detail=f"No template for '{kind}'. Available: {', '.join(TEMPLATES)}")
    return PlainTextResponse(
        TEMPLATES[kind],
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="loyaltyshield_{kind}_template.csv"'},
    )
