from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AnalysisJob, AreaOfInterest, ChangeDetectionResult, Scene
from app.schemas import JobOut, StatsOut

router = APIRouter(prefix="/stats", tags=["Stats"])


@router.get("", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    total_aois = db.query(func.count(AreaOfInterest.id)).scalar() or 0
    total_scenes = db.query(func.count(Scene.id)).scalar() or 0
    total_jobs = db.query(func.count(AnalysisJob.id)).scalar() or 0
    completed_jobs = db.query(func.count(AnalysisJob.id)).filter(AnalysisJob.status == "completed").scalar() or 0
    pending_jobs = db.query(func.count(AnalysisJob.id)).filter(AnalysisJob.status.in_(["pending", "running"])).scalar() or 0
    failed_jobs = db.query(func.count(AnalysisJob.id)).filter(AnalysisJob.status == "failed").scalar() or 0

    avg_change = db.query(func.avg(ChangeDetectionResult.change_pct)).scalar()
    high_severity = (
        db.query(func.count(ChangeDetectionResult.id))
        .filter(ChangeDetectionResult.severity.in_(["high", "critical"]))
        .scalar()
        or 0
    )

    recent_jobs = (
        db.query(AnalysisJob)
        .order_by(AnalysisJob.created_at.desc())
        .limit(5)
        .all()
    )

    return StatsOut(
        total_aois=total_aois,
        total_scenes=total_scenes,
        total_jobs=total_jobs,
        completed_jobs=completed_jobs,
        pending_jobs=pending_jobs,
        failed_jobs=failed_jobs,
        avg_change_pct=round(float(avg_change), 2) if avg_change is not None else None,
        high_severity_count=high_severity,
        recent_jobs=[JobOut.model_validate(j) for j in recent_jobs],
    )
