import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import AreaOfInterest, Scene
from app.schemas import SceneCreate, SceneOut

router = APIRouter(prefix="/scenes", tags=["Scenes"])
settings = get_settings()

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".geotiff"}


@router.get("", response_model=list[SceneOut])
def list_scenes(aoi_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Scene)
    if aoi_id is not None:
        q = q.filter(Scene.aoi_id == aoi_id)
    return q.order_by(Scene.acquired_at.desc()).all()


@router.post("", response_model=SceneOut, status_code=201)
def create_scene(payload: SceneCreate, db: Session = Depends(get_db)):
    aoi = db.get(AreaOfInterest, payload.aoi_id)
    if not aoi:
        raise HTTPException(status_code=404, detail="AOI not found")
    scene = Scene(**payload.model_dump())
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/upload", response_model=SceneOut, status_code=201)
async def upload_scene(
    aoi_id: int = Form(...),
    name: str = Form(...),
    acquired_at: str = Form(...),
    satellite: str = Form("Sentinel-2"),
    cloud_cover_pct: float = Form(0.0),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    aoi = db.get(AreaOfInterest, aoi_id)
    if not aoi:
        raise HTTPException(status_code=404, detail="AOI not found")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not allowed")

    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = settings.uploads_dir / unique_name
    contents = await file.read()
    dest.write_bytes(contents)

    scene = Scene(
        aoi_id=aoi_id,
        name=name,
        acquired_at=acquired_at,
        satellite=satellite,
        cloud_cover_pct=cloud_cover_pct,
        file_path=str(dest),
        file_size_bytes=len(contents),
    )
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return scene


@router.get("/{scene_id}", response_model=SceneOut)
def get_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.delete("/{scene_id}", status_code=204)
def delete_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if scene.file_path and os.path.exists(scene.file_path):
        os.remove(scene.file_path)
    db.delete(scene)
    db.commit()
