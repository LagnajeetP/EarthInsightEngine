"""
Run once to generate tiny synthetic GeoTIFF fixtures used by test_change.py.

    cd backend
    python tests/make_fixtures.py

Produces:
  tests/fixtures/before_4band.tif   – 32×32, 4-band Sentinel-2 style (Blue/Green/Red/NIR)
  tests/fixtures/after_4band.tif    – same grid, NIR deliberately lower (simulates veg loss)
  tests/fixtures/before_ndvi.tif    – 32×32, 1-band pre-computed NDVI
  tests/fixtures/after_ndvi.tif     – same grid, values shifted down
"""
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_bounds

FIXTURES = Path(__file__).parent / "fixtures"
FIXTURES.mkdir(exist_ok=True)

RNG = np.random.default_rng(42)
H, W = 32, 32
CRS_WGS84 = CRS.from_epsg(4326)
TRANSFORM = from_bounds(-60.1, -3.1, -60.0, -3.0, W, H)


def _write(path: Path, arrays: list[np.ndarray], nodata: float | None = None) -> None:
    count = len(arrays)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        count=count,
        dtype=np.float32,
        crs=CRS_WGS84,
        transform=TRANSFORM,
        width=W,
        height=H,
        nodata=nodata,
    ) as dst:
        for i, arr in enumerate(arrays, start=1):
            dst.write(arr.astype(np.float32), i)
    print(f"  wrote {path.name}")


def make_4band() -> None:
    """Sentinel-2 10 m style: Blue, Green, Red, NIR reflectance (0–1)."""
    blue  = RNG.uniform(0.03, 0.08, (H, W)).astype(np.float32)
    green = RNG.uniform(0.04, 0.10, (H, W)).astype(np.float32)
    red   = RNG.uniform(0.04, 0.12, (H, W)).astype(np.float32)
    nir_b = RNG.uniform(0.30, 0.60, (H, W)).astype(np.float32)   # healthy veg
    nir_a = nir_b * RNG.uniform(0.55, 0.75, (H, W)).astype(np.float32)  # ~30% loss

    _write(FIXTURES / "before_4band.tif", [blue, green, red, nir_b])
    _write(FIXTURES / "after_4band.tif",  [blue, green, red, nir_a])


def make_1band_ndvi() -> None:
    """Pre-computed NDVI: values in [-1, 1]."""
    ndvi_b = RNG.uniform(0.3, 0.7, (H, W)).astype(np.float32)
    ndvi_a = (ndvi_b - RNG.uniform(0.1, 0.3, (H, W))).astype(np.float32)
    ndvi_a = np.clip(ndvi_a, -1.0, 1.0)

    _write(FIXTURES / "before_ndvi.tif", [ndvi_b])
    _write(FIXTURES / "after_ndvi.tif",  [ndvi_a])


if __name__ == "__main__":
    print("Generating fixtures…")
    make_4band()
    make_1band_ndvi()
    print("Done.")
