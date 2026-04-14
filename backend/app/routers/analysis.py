import time
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.eo.change import run_change_detection
from app.models import AnalysisJob, AreaOfInterest, ChangeDetectionResult, Scene
from app.schemas import JobCreate, JobOut

router = APIRouter(prefix="/jobs", tags=["Analysis Jobs"])


# ── Background change-detection task ─────────────────────────────────────────

def _run_change_detection(job_id: int) -> None:
    """
    Background thread: loads both scene GeoTIFFs, computes real NDVI change
    metrics, writes a ChangeDetectionResult, and marks the job completed/failed.

    Requires both scenes to have a non-null file_path pointing to a valid
    GeoTIFF.  If either is missing the job is failed immediately with a clear
    error_message that the UI can display.
    """
    db: Session = SessionLocal()
    try:
        job = db.get(AnalysisJob, job_id)
        if job is None or job.status != "running":
            return

        scene_before: Scene | None = db.get(Scene, job.scene_before_id)
        scene_after: Scene | None = db.get(Scene, job.scene_after_id)

        # Validate files are present
        missing = []
        if not scene_before or not scene_before.file_path:
            missing.append("before")
        if not scene_after or not scene_after.file_path:
            missing.append("after")
        if missing:
            job.status = "failed"
            job.error_message = (
                f"Scene(s) missing GeoTIFF file: {', '.join(missing)}. "
                "Upload a GeoTIFF via the Scenes page before running analysis."
            )
            db.commit()
            return

        # Run real NDVI change detection (may take a few seconds on large files)
        metrics = run_change_detection(scene_before.file_path, scene_after.file_path)

        result = ChangeDetectionResult(
            job_id=job_id,
            change_pct=metrics["change_pct"],
            vegetation_loss_pct=metrics["vegetation_loss_pct"],
            vegetation_gain_pct=metrics["vegetation_gain_pct"],
            water_change_pct=metrics["water_change_pct"],
            urban_expansion_pct=metrics["urban_expansion_pct"],
            bare_soil_pct=metrics["bare_soil_pct"],
            ndvi_before=metrics["ndvi_before"],
            ndvi_after=metrics["ndvi_after"],
            ndvi_delta=metrics["ndvi_delta"],
            summary=metrics["summary"],
            severity=metrics["severity"],
        )
        db.add(result)
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        job = db.get(AnalysisJob, job_id)
        if job:
            job.status = "failed"
            job.error_message = str(exc)
            db.commit()
    finally:
        db.close()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[JobOut])
def list_jobs(aoi_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(AnalysisJob)
    if aoi_id is not None:
        q = q.filter(AnalysisJob.aoi_id == aoi_id)
    return q.order_by(AnalysisJob.created_at.desc()).all()


@router.post("", response_model=JobOut, status_code=201)
def create_job(
    payload: JobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    aoi = db.get(AreaOfInterest, payload.aoi_id)
    if not aoi:
        raise HTTPException(status_code=404, detail="AOI not found")

    for scene_id, label in [
        (payload.scene_before_id, "before"),
        (payload.scene_after_id, "after"),
    ]:
        scene = db.get(Scene, scene_id)
        if not scene:
            raise HTTPException(status_code=404, detail=f"Scene ({label}) not found")
        if scene.aoi_id != payload.aoi_id:
            raise HTTPException(
                status_code=400,
                detail=f"Scene ({label}) does not belong to this AOI",
            )
        if not scene.file_path:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Scene ({label}) has no uploaded GeoTIFF. "
                    "Upload a file via the Scenes page before running analysis."
                ),
            )

    if payload.scene_before_id == payload.scene_after_id:
        raise HTTPException(
            status_code=400, detail="Before and after scenes must be different"
        )

    job = AnalysisJob(
        aoi_id=payload.aoi_id,
        scene_before_id=payload.scene_before_id,
        scene_after_id=payload.scene_after_id,
        status="running",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_change_detection, job.id)
    return job


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
