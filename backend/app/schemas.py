from datetime import datetime

from pydantic import BaseModel, Field


# ── Area of Interest ──────────────────────────────────────────────────────────

class AoiCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    bbox_min_lat: float = Field(..., ge=-90, le=90)
    bbox_max_lat: float = Field(..., ge=-90, le=90)
    bbox_min_lon: float = Field(..., ge=-180, le=180)
    bbox_max_lon: float = Field(..., ge=-180, le=180)


class AoiOut(BaseModel):
    id: int
    name: str
    description: str | None
    bbox_min_lat: float
    bbox_max_lat: float
    bbox_min_lon: float
    bbox_max_lon: float
    created_at: datetime
    scene_count: int = 0
    job_count: int = 0

    model_config = {"from_attributes": True}


# ── Scene ─────────────────────────────────────────────────────────────────────

class SceneCreate(BaseModel):
    aoi_id: int
    name: str = Field(..., min_length=1, max_length=200)
    acquired_at: str = Field(..., description="ISO date string, e.g. 2024-03-15")
    satellite: str = Field("Sentinel-2", max_length=100)
    cloud_cover_pct: float = Field(0.0, ge=0.0, le=100.0)


class SceneOut(BaseModel):
    id: int
    aoi_id: int
    name: str
    acquired_at: str
    satellite: str
    cloud_cover_pct: float
    file_path: str | None
    file_size_bytes: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Analysis Job ──────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    aoi_id: int
    scene_before_id: int
    scene_after_id: int


class ChangeDetectionResultOut(BaseModel):
    id: int
    job_id: int
    change_pct: float
    vegetation_loss_pct: float
    vegetation_gain_pct: float
    water_change_pct: float
    urban_expansion_pct: float
    bare_soil_pct: float
    ndvi_before: float
    ndvi_after: float
    ndvi_delta: float
    summary: str
    severity: str

    model_config = {"from_attributes": True}


class JobOut(BaseModel):
    id: int
    aoi_id: int
    scene_before_id: int
    scene_after_id: int
    status: str
    created_at: datetime
    completed_at: datetime | None
    error_message: str | None
    result: ChangeDetectionResultOut | None = None

    model_config = {"from_attributes": True}


# ── Stats ─────────────────────────────────────────────────────────────────────

class StatsOut(BaseModel):
    total_aois: int
    total_scenes: int
    total_jobs: int
    completed_jobs: int
    pending_jobs: int
    failed_jobs: int
    avg_change_pct: float | None
    high_severity_count: int
    recent_jobs: list[JobOut]
