"""
Run once to populate the database with demo data.

Usage:
    cd backend
    source .venv/bin/activate
    python seed.py
"""
import sys
import os

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.config import get_settings
from app.db import SessionLocal, engine
from app.models import AnalysisJob, AreaOfInterest, Base, ChangeDetectionResult, Scene

settings = get_settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
settings.uploads_dir.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Clear existing data
for model in [ChangeDetectionResult, AnalysisJob, Scene, AreaOfInterest]:
    db.query(model).delete()
db.commit()

# ── AOIs ──────────────────────────────────────────────────────────────────────
aois_data = [
    {
        "name": "Amazon Basin — Block 4",
        "description": "Primary deforestation hotspot in Para state, Brazil",
        "bbox_min_lat": -8.0, "bbox_max_lat": -4.0,
        "bbox_min_lon": -55.0, "bbox_max_lon": -50.0,
    },
    {
        "name": "Siberian Taiga — West",
        "description": "Boreal forest fire tracking, Krasnoyarsk Krai",
        "bbox_min_lat": 57.0, "bbox_max_lat": 64.0,
        "bbox_min_lon": 90.0, "bbox_max_lon": 102.0,
    },
    {
        "name": "Aral Sea Region",
        "description": "Water body shrinkage monitoring",
        "bbox_min_lat": 43.0, "bbox_max_lat": 47.0,
        "bbox_min_lon": 58.0, "bbox_max_lon": 62.0,
    },
]

aoi_objs = []
for d in aois_data:
    a = AreaOfInterest(**d)
    db.add(a)
    aoi_objs.append(a)
db.commit()
for a in aoi_objs:
    db.refresh(a)

# ── Scenes ────────────────────────────────────────────────────────────────────
scenes_data = [
    # Amazon Block 4
    {"aoi_id": aoi_objs[0].id, "name": "S2_20230601_T23KPQ", "acquired_at": "2023-06-01", "satellite": "Sentinel-2", "cloud_cover_pct": 4.2},
    {"aoi_id": aoi_objs[0].id, "name": "S2_20230901_T23KPQ", "acquired_at": "2023-09-01", "satellite": "Sentinel-2", "cloud_cover_pct": 8.7},
    {"aoi_id": aoi_objs[0].id, "name": "S2_20240101_T23KPQ", "acquired_at": "2024-01-01", "satellite": "Sentinel-2", "cloud_cover_pct": 11.3},
    {"aoi_id": aoi_objs[0].id, "name": "L8_20240401_T23KPQ", "acquired_at": "2024-04-01", "satellite": "Landsat-8", "cloud_cover_pct": 3.0},
    # Siberia
    {"aoi_id": aoi_objs[1].id, "name": "S2_20230501_T47VNH", "acquired_at": "2023-05-01", "satellite": "Sentinel-2", "cloud_cover_pct": 6.0},
    {"aoi_id": aoi_objs[1].id, "name": "S2_20230801_T47VNH", "acquired_at": "2023-08-01", "satellite": "Sentinel-2", "cloud_cover_pct": 15.2},
    {"aoi_id": aoi_objs[1].id, "name": "S2_20231001_T47VNH", "acquired_at": "2023-10-01", "satellite": "Sentinel-2", "cloud_cover_pct": 22.0},
    # Aral Sea
    {"aoi_id": aoi_objs[2].id, "name": "L9_20230301_T41SKC", "acquired_at": "2023-03-01", "satellite": "Landsat-9", "cloud_cover_pct": 1.5},
    {"aoi_id": aoi_objs[2].id, "name": "L9_20240301_T41SKC", "acquired_at": "2024-03-01", "satellite": "Landsat-9", "cloud_cover_pct": 0.8},
]

scene_objs = []
for d in scenes_data:
    s = Scene(**d)
    db.add(s)
    scene_objs.append(s)
db.commit()
for s in scene_objs:
    db.refresh(s)

# ── Jobs + Results ────────────────────────────────────────────────────────────
import random
from datetime import datetime, timezone, timedelta

jobs_config = [
    # Amazon: 3 period comparisons
    (aoi_objs[0].id, scene_objs[0].id, scene_objs[1].id, "completed"),
    (aoi_objs[0].id, scene_objs[1].id, scene_objs[2].id, "completed"),
    (aoi_objs[0].id, scene_objs[2].id, scene_objs[3].id, "completed"),
    # Siberia
    (aoi_objs[1].id, scene_objs[4].id, scene_objs[5].id, "completed"),
    (aoi_objs[1].id, scene_objs[5].id, scene_objs[6].id, "completed"),
    # Aral Sea
    (aoi_objs[2].id, scene_objs[7].id, scene_objs[8].id, "completed"),
]

SUMMARIES = {
    "low": "Minor seasonal variation detected. No significant land-cover transition.",
    "medium": "Moderate vegetation change detected. Likely agricultural or managed clearing.",
    "high": "Substantial deforestation event detected. Ground-truth verification recommended.",
    "critical": "Critical deforestation alert: large-scale primary forest loss detected.",
}

for i, (aoi_id, before_id, after_id, status) in enumerate(jobs_config):
    rng = random.Random(i * 9999 + 42)
    created = datetime.now(timezone.utc) - timedelta(days=30 - i * 4)
    completed = created + timedelta(seconds=rng.randint(3, 8))

    job = AnalysisJob(
        aoi_id=aoi_id,
        scene_before_id=before_id,
        scene_after_id=after_id,
        status=status,
        created_at=created,
        completed_at=completed if status == "completed" else None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    if status == "completed":
        change_pct = rng.uniform(3.0, 42.0)
        veg_loss = rng.uniform(0, change_pct * 0.55)
        veg_gain = rng.uniform(0, change_pct * 0.15)
        water = rng.uniform(0, change_pct * 0.12)
        urban = rng.uniform(0, change_pct * 0.18)
        bare = max(0.0, change_pct - veg_loss - veg_gain - water - urban)

        ndvi_before = rng.uniform(0.35, 0.70)
        ndvi_after = max(-0.5, min(0.9, ndvi_before + rng.uniform(-0.30, 0.05)))
        ndvi_delta = ndvi_after - ndvi_before

        if change_pct < 5:
            severity = "low"
        elif change_pct < 15:
            severity = "medium"
        elif change_pct < 30:
            severity = "high"
        else:
            severity = "critical"

        result = ChangeDetectionResult(
            job_id=job.id,
            change_pct=round(change_pct, 2),
            vegetation_loss_pct=round(veg_loss, 2),
            vegetation_gain_pct=round(veg_gain, 2),
            water_change_pct=round(water, 2),
            urban_expansion_pct=round(urban, 2),
            bare_soil_pct=round(bare, 2),
            ndvi_before=round(ndvi_before, 4),
            ndvi_after=round(ndvi_after, 4),
            ndvi_delta=round(ndvi_delta, 4),
            summary=SUMMARIES[severity],
            severity=severity,
        )
        db.add(result)
        db.commit()

print(f"Seeded: {len(aoi_objs)} AOIs, {len(scene_objs)} scenes, {len(jobs_config)} jobs")
db.close()
