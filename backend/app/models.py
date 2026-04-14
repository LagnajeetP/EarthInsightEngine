from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AreaOfInterest(Base):
    __tablename__ = "areas_of_interest"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    bbox_min_lat: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_max_lat: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_min_lon: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_max_lon: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    scenes: Mapped[list["Scene"]] = relationship("Scene", back_populates="aoi", cascade="all, delete-orphan")
    jobs: Mapped[list["AnalysisJob"]] = relationship("AnalysisJob", back_populates="aoi", cascade="all, delete-orphan")


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    aoi_id: Mapped[int] = mapped_column(Integer, ForeignKey("areas_of_interest.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    acquired_at: Mapped[str] = mapped_column(String(20), nullable=False)  # ISO date string
    satellite: Mapped[str] = mapped_column(String(100), nullable=False, default="Sentinel-2")
    cloud_cover_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    aoi: Mapped["AreaOfInterest"] = relationship("AreaOfInterest", back_populates="scenes")


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    aoi_id: Mapped[int] = mapped_column(Integer, ForeignKey("areas_of_interest.id"), nullable=False)
    scene_before_id: Mapped[int] = mapped_column(Integer, ForeignKey("scenes.id"), nullable=False)
    scene_after_id: Mapped[int] = mapped_column(Integer, ForeignKey("scenes.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    aoi: Mapped["AreaOfInterest"] = relationship("AreaOfInterest", back_populates="jobs")
    scene_before: Mapped["Scene"] = relationship("Scene", foreign_keys=[scene_before_id])
    scene_after: Mapped["Scene"] = relationship("Scene", foreign_keys=[scene_after_id])
    result: Mapped["ChangeDetectionResult | None"] = relationship(
        "ChangeDetectionResult", back_populates="job", uselist=False, cascade="all, delete-orphan"
    )


class ChangeDetectionResult(Base):
    __tablename__ = "change_detection_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("analysis_jobs.id"), nullable=False, unique=True)
    change_pct: Mapped[float] = mapped_column(Float, nullable=False)
    vegetation_loss_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    vegetation_gain_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    water_change_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    urban_expansion_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bare_soil_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ndvi_before: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ndvi_after: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ndvi_delta: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="low")  # low/medium/high/critical

    job: Mapped["AnalysisJob"] = relationship("AnalysisJob", back_populates="result")
