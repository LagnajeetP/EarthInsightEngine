"""
Real NDVI-based change detection using rasterio + numpy.

Band layout auto-detection (applied to each uploaded GeoTIFF):
  - 1 band  → pre-computed NDVI  (values already in −1..1)
  - 2 bands → NIR = band 1, Red = band 2
  - 3 bands → RGB only; raises ValueError (no NIR channel)
  - 4 bands → Blue=1, Green=2, Red=3, NIR=4  (Sentinel-2 10 m: B2/B3/B4/B8)
  - 8+ bands → Sentinel-2 L2A stack; NIR=band 8, Red=band 4

Recommended export for demos:
  Download a Sentinel-2 Level-2A tile, stack bands B02/B03/B04/B08 (10 m),
  clip to your AOI, and export as a 4-band GeoTIFF.
  Free sources: Copernicus Data Space (dataspace.copernicus.eu),
                Element84 STAC (earth-search.aws.element84.com/v1).
"""
from __future__ import annotations

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject


# ── Band detection ────────────────────────────────────────────────────────────

def _detect_bands(band_count: int) -> tuple[int, int] | None:
    """
    Return (NIR_band, Red_band) 1-indexed, or None if already pre-computed NDVI.
    Raises ValueError for unsupported layouts.
    """
    if band_count == 1:
        return None  # pre-computed NDVI
    if band_count == 2:
        return (1, 2)  # NIR, Red
    if band_count == 3:
        raise ValueError(
            "3-band (RGB) GeoTIFF has no NIR channel — "
            "upload a 4-band (B, G, R, NIR) clip or a 1-band pre-computed NDVI."
        )
    if band_count == 4:
        return (4, 3)  # Sentinel-2 10 m: Blue=1 Green=2 Red=3 NIR=4
    if band_count >= 8:
        return (8, 4)  # Sentinel-2 L2A extended stack
    return (1, 2)  # fallback for 5-7 bands


# ── NDVI computation ──────────────────────────────────────────────────────────

def _compute_ndvi_from_file(path: str) -> tuple[np.ndarray, object, object, int, int]:
    """
    Read a GeoTIFF, auto-detect bands, return:
      (ndvi_float32, crs, transform, width, height)
    NDVI values outside −1..1 and nodata pixels become NaN.
    """
    with rasterio.open(path) as src:
        band_count = src.count
        src_nodata = src.nodata
        crs = src.crs
        transform = src.transform
        width = src.width
        height = src.height

        nir_red = _detect_bands(band_count)

        if nir_red is None:
            # Already NDVI
            arr = src.read(1).astype(np.float32)
            if src_nodata is not None:
                arr = np.where(arr == src_nodata, np.nan, arr)
            ndvi = np.clip(arr, -1.0, 1.0)
        else:
            nir_idx, red_idx = nir_red
            nir = src.read(nir_idx).astype(np.float32)
            red = src.read(red_idx).astype(np.float32)
            if src_nodata is not None:
                mask = (nir == src_nodata) | (red == src_nodata)
                nir[mask] = np.nan
                red[mask] = np.nan
            denom = nir + red
            ndvi = np.where(denom == 0, np.nan, (nir - red) / denom).astype(np.float32)
            ndvi = np.clip(ndvi, -1.0, 1.0)

    return ndvi, crs, transform, width, height


def _warp_ndvi_to_reference(
    src_ndvi: np.ndarray,
    src_crs,
    src_transform,
    ref_crs,
    ref_transform,
    ref_width: int,
    ref_height: int,
) -> np.ndarray:
    """
    Reproject a 2-D NDVI array to match a reference grid.
    If CRS and transform already match, returns src_ndvi unchanged (no copy).
    """
    if (
        src_crs == ref_crs
        and src_transform == ref_transform
        and src_ndvi.shape == (ref_height, ref_width)
    ):
        return src_ndvi

    dst = np.full((ref_height, ref_width), np.nan, dtype=np.float32)
    reproject(
        source=src_ndvi,
        destination=dst,
        src_transform=src_transform,
        src_crs=src_crs,
        dst_transform=ref_transform,
        dst_crs=ref_crs,
        resampling=Resampling.bilinear,
        src_nodata=np.nan,
        dst_nodata=np.nan,
    )
    return dst


# ── Severity & summary ────────────────────────────────────────────────────────

def _severity(change_pct: float) -> str:
    if change_pct < 5:
        return "low"
    if change_pct < 15:
        return "medium"
    if change_pct < 30:
        return "high"
    return "critical"


def _make_summary(m: dict) -> str:
    sev = m["severity"]
    cpct = m["change_pct"]
    delta = m["ndvi_delta"]
    vl = m["vegetation_loss_pct"]
    vg = m["vegetation_gain_pct"]

    if sev == "low":
        return (
            f"Minor spectral change detected ({cpct:.1f}% of valid pixels). "
            f"NDVI delta of {delta:+.3f} is within typical seasonal variation. "
            "No significant land-cover transition detected."
        )
    if sev == "medium":
        if vl >= vg:
            return (
                f"Moderate vegetation stress detected. {vl:.1f}% of AOI shows NDVI "
                f"decline (delta {delta:+.3f}). Possible drought, fire, or light clearing."
            )
        return (
            f"Moderate vegetation recovery detected. {vg:.1f}% of AOI shows NDVI "
            f"increase (delta {delta:+.3f}). Possible regrowth or seasonal green-up."
        )
    if sev == "high":
        return (
            f"Substantial land-cover change — {cpct:.1f}% of AOI affected "
            f"(NDVI delta {delta:+.3f}). Vegetation loss: {vl:.1f}%, "
            f"gain: {vg:.1f}%. Ground-truth verification recommended."
        )
    return (
        f"Critical change alert: {cpct:.1f}% of AOI shows major NDVI shift "
        f"({delta:+.3f}). Vegetation loss: {vl:.1f}%. Consistent with large-scale "
        "disturbance (fire, flood, or deforestation). Immediate action advised."
    )


# ── Public API ────────────────────────────────────────────────────────────────

def run_change_detection(before_path: str, after_path: str) -> dict:
    """
    Compute NDVI change metrics between two GeoTIFF scenes.

    Parameters
    ----------
    before_path : str
        Absolute path to the "before" GeoTIFF.
    after_path : str
        Absolute path to the "after" GeoTIFF.

    Returns
    -------
    dict
        Keys match ``ChangeDetectionResult`` model fields:
        change_pct, vegetation_loss_pct, vegetation_gain_pct,
        water_change_pct, urban_expansion_pct, bare_soil_pct,
        ndvi_before, ndvi_after, ndvi_delta, severity, summary.

    Raises
    ------
    ValueError
        Human-readable message on bad inputs (3-band RGB, no overlap, etc.).
    """
    # ── 1. Read & compute NDVI for each scene ─────────────────────────────────
    ndvi_b, crs_b, tf_b, w_b, h_b = _compute_ndvi_from_file(before_path)
    ndvi_a, crs_a, tf_a, w_a, h_a = _compute_ndvi_from_file(after_path)

    # ── 2. Align "after" to "before" grid ────────────────────────────────────
    ndvi_a_aligned = _warp_ndvi_to_reference(
        ndvi_a, crs_a, tf_a, crs_b, tf_b, w_b, h_b
    )

    # ── 3. Valid-pixel mask ───────────────────────────────────────────────────
    valid = np.isfinite(ndvi_b) & np.isfinite(ndvi_a_aligned)
    total_valid = int(valid.sum())
    if total_valid == 0:
        raise ValueError(
            "No overlapping valid pixels found. "
            "Ensure both scenes cover the same geographic area and use a supported band layout."
        )

    nb = ndvi_b[valid]
    na = ndvi_a_aligned[valid]
    diff = na - nb

    # ── 4. Change threshold (adaptive) ───────────────────────────────────────
    # Use 0.05 NDVI units as the minimum meaningful change
    THRESH = 0.05
    changed_mask = np.abs(diff) > THRESH

    # If fewer than 1% of pixels pass, relax to 0.01 to avoid empty results
    if changed_mask.mean() < 0.01:
        THRESH = 0.01
        changed_mask = np.abs(diff) > THRESH

    change_pct = 100.0 * float(changed_mask.mean())

    # ── 5. Category breakdown ─────────────────────────────────────────────────
    veg_loss_mask = diff < -THRESH
    veg_gain_mask = diff > THRESH

    # Water proxy: pixel transitions across the NDVI=0 boundary
    water_change_mask = (nb < 0) != (na < 0)

    # Urban proxy: vegetated (>0.1) → low-NDVI (<0.1) transition
    urban_mask = (nb > 0.1) & (na < 0.1) & (diff < -THRESH)

    veg_loss_pct = 100.0 * float(veg_loss_mask.mean())
    veg_gain_pct = 100.0 * float(veg_gain_mask.mean())
    water_pct = 100.0 * float(water_change_mask.mean())
    urban_pct = 100.0 * float(urban_mask.mean())
    bare_pct = max(0.0, change_pct - veg_loss_pct - veg_gain_pct - water_pct - urban_pct)

    # ── 6. Mean NDVI summary stats ────────────────────────────────────────────
    mean_before = float(np.nanmean(nb))
    mean_after = float(np.nanmean(na))
    ndvi_delta = mean_after - mean_before

    # ── 7. Severity & summary ─────────────────────────────────────────────────
    sev = _severity(change_pct)
    metrics: dict = {
        "change_pct": round(change_pct, 2),
        "vegetation_loss_pct": round(veg_loss_pct, 2),
        "vegetation_gain_pct": round(veg_gain_pct, 2),
        "water_change_pct": round(water_pct, 2),
        "urban_expansion_pct": round(urban_pct, 2),
        "bare_soil_pct": round(bare_pct, 2),
        "ndvi_before": round(mean_before, 4),
        "ndvi_after": round(mean_after, 4),
        "ndvi_delta": round(ndvi_delta, 4),
        "severity": sev,
    }
    metrics["summary"] = _make_summary(metrics)
    return metrics
