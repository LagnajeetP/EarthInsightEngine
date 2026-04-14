from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AreaOfInterest
from app.schemas import AoiCreate, AoiOut

router = APIRouter(prefix="/aoi", tags=["Areas of Interest"])


def _enrich(aoi: AreaOfInterest) -> AoiOut:
    out = AoiOut.model_validate(aoi)
    out.scene_count = len(aoi.scenes)
    out.job_count = len(aoi.jobs)
    return out


@router.get("", response_model=list[AoiOut])
def list_aois(db: Session = Depends(get_db)):
    aois = db.query(AreaOfInterest).order_by(AreaOfInterest.created_at.desc()).all()
    return [_enrich(a) for a in aois]


@router.post("", response_model=AoiOut, status_code=201)
def create_aoi(payload: AoiCreate, db: Session = Depends(get_db)):
    aoi = AreaOfInterest(**payload.model_dump())
    db.add(aoi)
    db.commit()
    db.refresh(aoi)
    return _enrich(aoi)


@router.get("/{aoi_id}", response_model=AoiOut)
def get_aoi(aoi_id: int, db: Session = Depends(get_db)):
    aoi = db.get(AreaOfInterest, aoi_id)
    if not aoi:
        raise HTTPException(status_code=404, detail="AOI not found")
    return _enrich(aoi)


@router.delete("/{aoi_id}", status_code=204)
def delete_aoi(aoi_id: int, db: Session = Depends(get_db)):
    aoi = db.get(AreaOfInterest, aoi_id)
    if not aoi:
        raise HTTPException(status_code=404, detail="AOI not found")
    db.delete(aoi)
    db.commit()
