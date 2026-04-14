#!/usr/bin/env python3
"""
fetch_sentinel.py — Download free Sentinel-2 L2A GeoTIFFs via the Element84
Earth Search STAC catalog (no account required).

Usage
-----
    cd backend
    pip install pystac-client requests tqdm          # one-time
    python scripts/fetch_sentinel.py --help

Quick start (Amazon deforestation demo)
    python scripts/fetch_sentinel.py \\
        --bbox -60.1 -3.1 -60.0 -3.0 \\
        --before 2022-06-01 --after 2023-06-01 \\
        --max-cloud 15 \\
        --out-dir data/uploads

What it does
------------
1. Searches Element84's public STAC catalog for Sentinel-2 L2A scenes
   that intersect the bbox on the two target dates (±15 days).
2. Picks the least-cloudy scene for each date window.
3. Downloads only the four 10 m bands needed for NDVI:
     B02 (Blue)  B03 (Green)  B04 (Red)  B08 (NIR)
4. Clips each band to the requested bbox, stacks into a 4-band GeoTIFF
   (band order: B02/B03/B04/B08 = Blue, Green, Red, NIR).
5. Prints the upload commands to register scenes via the API.

The output files can be uploaded directly on the Scenes page
(or via  POST /scenes/upload) and used as before/after inputs in
the Analysis Jobs workflow.

Notes on free data
------------------
* Element84 Earth Search STAC: earth-search.aws.element84.com/v1
  No authentication required; COGs are hosted on AWS S3 (us-west-2).
  Reading them requires GDAL/rasterio with VSICURL support (default on
  most installs).  If you get SSL/network errors, set:
      GDAL_HTTP_UNSAFESSL=YES
* Copernicus Data Space (dataspace.copernicus.eu):
  Free account, OData/STAC API, direct GeoTIFF download.
* Google Earth Engine (earthengine.google.com):
  Free tier, Python API, good for server-side processing.

Dependencies (not in main requirements.txt — only needed for this script)
    pystac-client>=0.7
    requests
    tqdm
    rasterio  (already in requirements.txt)
    numpy     (already in requirements.txt)
"""

import argparse
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Lazy imports so the rest of the app isn't blocked if these aren't installed
# ---------------------------------------------------------------------------

def _require(package: str, install_as: str | None = None) -> None:
    import importlib
    try:
        importlib.import_module(package)
    except ImportError:
        pkg = install_as or package
        print(f"[error] Missing package '{pkg}'. Run:  pip install {pkg}", file=sys.stderr)
        sys.exit(1)


# ── STAC search helpers ───────────────────────────────────────────────────────

def _date_window(date_str: str, days: int = 15) -> tuple[str, str]:
    """Return (start, end) ISO strings for a window around date_str."""
    from datetime import datetime, timedelta
    d = datetime.fromisoformat(date_str)
    return (d - timedelta(days=days)).strftime("%Y-%m-%d"), (d + timedelta(days=days)).strftime("%Y-%m-%d")


def _search_least_cloudy(catalog, bbox: list[float], date_str: str, max_cloud: float) -> object | None:
    start, end = _date_window(date_str)
    results = catalog.search(
        collections=["sentinel-2-l2a"],
        bbox=bbox,
        datetime=f"{start}/{end}",
        query={"eo:cloud_cover": {"lte": max_cloud}},
        sortby=[{"field": "eo:cloud_cover", "direction": "asc"}],
        max_items=10,
    )
    items = list(results.items())
    if not items:
        return None
    return items[0]


# ── Raster download + clip + stack ───────────────────────────────────────────

BAND_ASSETS = ["blue", "green", "red", "nir"]          # Element84 asset keys
BAND_FALLBACKS = ["B02", "B03", "B04", "B08"]          # fallback asset keys


def _band_href(item, index: int) -> str:
    """Return the COG URL for the requested band (0-indexed)."""
    assets = item.assets
    key = BAND_ASSETS[index]
    if key in assets:
        return assets[key].href
    key2 = BAND_FALLBACKS[index]
    if key2 in assets:
        return assets[key2].href
    raise KeyError(f"Cannot find band asset for index {index}. Available: {list(assets.keys())}")


def _clip_and_stack(item, bbox: list[float], out_path: Path) -> None:
    """Download 4 bands, clip to bbox, write a 4-band GeoTIFF."""
    import numpy as np
    import rasterio
    from rasterio.windows import from_bounds
    from rasterio.enums import Resampling

    bands = []
    ref_profile = None

    for i, asset_key in enumerate(BAND_ASSETS):
        href = _band_href(item, i)
        vsi = f"/vsicurl/{href}" if not href.startswith("/vsicurl") else href

        print(f"  [{i+1}/4] Reading {asset_key} from {href[:60]}…")
        with rasterio.open(vsi) as src:
            win = from_bounds(*bbox, transform=src.transform)
            data = src.read(1, window=win, out_dtype="float32")
            if ref_profile is None:
                ref_profile = src.profile.copy()
                ref_profile.update(
                    count=4,
                    width=data.shape[1],
                    height=data.shape[0],
                    window_transform=src.window_transform(win),
                    dtype="float32",
                    driver="GTiff",
                    compress="lzw",
                    nodata=src.nodata,
                )
            # Normalise to [0, 1] reflectance if values look like DN (>2)
            if data.max() > 2.0:
                data = data / 10000.0
            bands.append(data)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(out_path, "w", **ref_profile) as dst:
        for i, band in enumerate(bands, start=1):
            dst.write(band, i)
    print(f"  Saved → {out_path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download free Sentinel-2 GeoTIFFs for the EarthInsightEngine demo."
    )
    parser.add_argument("--bbox", nargs=4, type=float, metavar=("MINLON", "MINLAT", "MAXLON", "MAXLAT"),
                        default=[-60.1, -3.1, -60.0, -3.0],
                        help="Bounding box (WGS-84). Default: Amazon deforestation hotspot.")
    parser.add_argument("--before", default="2022-07-01", help="Target date for 'before' scene (YYYY-MM-DD).")
    parser.add_argument("--after",  default="2023-07-01", help="Target date for 'after' scene (YYYY-MM-DD).")
    parser.add_argument("--max-cloud", type=float, default=15.0, help="Max cloud cover %% (default 15).")
    parser.add_argument("--out-dir", default="data/uploads", help="Output directory.")
    parser.add_argument("--window-days", type=int, default=15,
                        help="Search window ±N days around each target date.")
    args = parser.parse_args()

    _require("pystac_client", "pystac-client")
    _require("requests")

    from pystac_client import Client

    catalog = Client.open("https://earth-search.aws.element84.com/v1")
    out_dir = Path(args.out_dir)

    print(f"\nSearching STAC for Sentinel-2 scenes…")
    print(f"  BBox   : {args.bbox}")
    print(f"  Before : {args.before}  ±{args.window_days} days,  cloud ≤ {args.max_cloud}%")
    print(f"  After  : {args.after}   ±{args.window_days} days,  cloud ≤ {args.max_cloud}%")

    before_item = _search_least_cloudy(catalog, args.bbox, args.before, args.max_cloud)
    after_item  = _search_least_cloudy(catalog, args.bbox, args.after,  args.max_cloud)

    if before_item is None:
        print("[error] No 'before' scene found. Try widening --window-days or raising --max-cloud.")
        sys.exit(1)
    if after_item is None:
        print("[error] No 'after' scene found. Try widening --window-days or raising --max-cloud.")
        sys.exit(1)

    print(f"\nBefore scene : {before_item.id}  ({before_item.properties.get('eo:cloud_cover', '?')}% cloud)")
    print(f"After scene  : {after_item.id}  ({after_item.properties.get('eo:cloud_cover', '?')}% cloud)")

    before_path = out_dir / f"before_{before_item.id}.tif"
    after_path  = out_dir / f"after_{after_item.id}.tif"

    print(f"\nDownloading before scene…")
    _clip_and_stack(before_item, args.bbox, before_path)

    print(f"\nDownloading after scene…")
    _clip_and_stack(after_item, args.bbox, after_path)

    before_date = before_item.properties.get("datetime", args.before)[:10]
    after_date  = after_item.properties.get("datetime", args.after)[:10]

    print(f"""
Done!  Upload your scenes via the UI (Scenes page → Upload Scene) or with curl:

  curl -F "aoi_id=<AOI_ID>" \\
       -F "name=S2_{before_date}" \\
       -F "acquired_at={before_date}" \\
       -F "satellite=Sentinel-2" \\
       -F "cloud_cover_pct={before_item.properties.get('eo:cloud_cover', 0)}" \\
       -F "file=@{before_path}" \\
       http://localhost:8000/scenes/upload

  curl -F "aoi_id=<AOI_ID>" \\
       -F "name=S2_{after_date}" \\
       -F "acquired_at={after_date}" \\
       -F "satellite=Sentinel-2" \\
       -F "cloud_cover_pct={after_item.properties.get('eo:cloud_cover', 0)}" \\
       -F "file=@{after_path}" \\
       http://localhost:8000/scenes/upload

Then create an AOI with bbox {args.bbox} and run Analysis → New Job.
""")


if __name__ == "__main__":
    main()
