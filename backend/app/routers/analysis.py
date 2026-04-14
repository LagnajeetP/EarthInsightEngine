import random
import time
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.models import AnalysisJob, AreaOfInterest, ChangeDetectionResult, Scene
from app.schemas import JobCreate, JobOut

router = APIRouter(prefix="/jobs", tags=["Analysis Jobs"])

# ── Change detection simulation ───────────────────────────────────────────────

_CHANGE_SUMMARIES = {
    "low": [
        "Minor seasonal variation detected. Vegetation indices show normal fluctuation consistent with the time of year.",
        "Slight reflectance differences observed. No significant land-cover transition detected in this period.",
        "Low-magnitude spectral change consistent with agricultural rotation or phenological cycle.",
    ],
    "medium": [
        "Moderate vegetation loss detected across {pct:.1f}% of the AOI. Likely logging or agricultural clearing activity.",
        "Significant water body extent change observed. Possible drought impact or reservoir drawdown.",
        "Urban footprint expansion detected at {pct:.1f}% of monitored area. Infrastructure development in progress.",
        "Mixed land-cover transition observed. Combination of vegetation clearing and bare soil exposure.",
    ],
    "high": [
        "Substantial deforestation event detected — {pct:.1f}% canopy loss. Immediate ground-truth verification recommended.",
        "Large-scale fire scar detected across {pct:.1f}% of AOI. Post-fire vegetation recovery monitoring advised.",
        "Major flood inundation event. Water extent expanded significantly beyond baseline.",
        "Rapid urban expansion event with {pct:.1f}% land conversion from vegetation/bare soil.",
    ],
    "critical": [
        "Critical deforestation alert: {pct:.1f}% primary forest loss detected. Consistent with industrial-scale clearing.",
        "Catastrophic wildfire event — {pct:.1f}% area affected. Immediate response and long-term monitoring required.",
        "Severe land degradation event. Multiple change type indicators at maximum levels.",
    ],
}


def _simulate_change_detection(job_id: int) -> None:
    """Runs in a background thread; uses its own DB session."""
    time.sleep(random.uniform(2.0, 5.0))  # simulate processing latency

    db: Session = SessionLocal()
    try:
        job = db.get(AnalysisJob, job_id)
        if job is None or job.status != "running":
            return

        # Generate realistic-looking random change metrics
        rng = random.Random(job_id * 31337)

        change_pct = rng.uniform(1.0, 45.0)
        veg_loss = rng.uniform(0, change_pct * 0.6)
        veg_gain = rng.uniform(0, change_pct * 0.2)
        water = rng.uniform(0, change_pct * 0.15)
        urban = rng.uniform(0, change_pct * 0.2)
        bare = max(0.0, change_pct - veg_loss - veg_gain - water - urban)

        ndvi_before = rng.uniform(0.3, 0.75)
        ndvi_after = ndvi_before + rng.uniform(-0.35, 0.1)
        ndvi_after = max(-1.0, min(1.0, ndvi_after))
        ndvi_delta = ndvi_after - ndvi_before

        if change_pct < 5:
            severity = "low"
        elif change_pct < 15:
            severity = "medium"
        elif change_pct < 30:
            severity = "high"
        else:
            severity = "critical"

        template = rng.choice(_CHANGE_SUMMARIES[severity])
        summary = template.format(pct=change_pct)

        result = ChangeDetectionResult(
            job_id=job_id,
            change_pct=round(change_pct, 2),
            vegetation_loss_pct=round(veg_loss, 2),
            vegetation_gain_pct=round(veg_gain, 2),
            water_change_pct=round(water, 2),
            urban_expansion_pct=round(urban, 2),
            bare_soil_pct=round(bare, 2),
            ndvi_before=round(ndvi_before, 4),
            ndvi_after=round(ndvi_after, 4),
            ndvi_delta=round(ndvi_delta, 4),
            summary=summary,
            severity=severity,
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
def create_job(payload: JobCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    aoi = db.get(AreaOfInterest, payload.aoi_id)
    if not aoi:
        raise HTTPException(status_code=404, detail="AOI not found")
    for scene_id, label in [(payload.scene_before_id, "before"), (payload.scene_after_id, "after")]:
        scene = db.get(Scene, scene_id)
        if not scene:
            raise HTTPException(status_code=404, detail=f"Scene ({label}) not found")
        if scene.aoi_id != payload.aoi_id:
            raise HTTPException(status_code=400, detail=f"Scene ({label}) does not belong to this AOI")
    if payload.scene_before_id == payload.scene_after_id:
        raise HTTPException(status_code=400, detail="Before and after scenes must be different")

    job = AnalysisJob(
        aoi_id=payload.aoi_id,
        scene_before_id=payload.scene_before_id,
        scene_after_id=payload.scene_after_id,
        status="running",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_simulate_change_detection, job.id)
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
