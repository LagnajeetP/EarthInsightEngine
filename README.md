# Earth Insight Engine

A **satellite change detection** platform for monitoring deforestation, urban expansion, water body changes, and fire events across user-defined geographic areas.

## What it does

| Feature | Details |
|---|---|
| **Areas of Interest (AOIs)** | Define bounding-box regions anywhere on Earth to monitor |
| **Scene Registry** | Register satellite acquisitions (Sentinel-2, Landsat-8/9, MODIS, etc.) with date, cloud cover, and optional image upload |
| **Change Detection Engine** | Compare any two scenes from the same AOI; produces change type breakdown, NDVI delta, and severity rating |
| **Interactive Map** | Leaflet map showing all AOI rectangles with hover tooltips |
| **Dashboard** | Live stats, job status breakdown, severity alerts, quick-action links |
| **Analysis Jobs** | Async processing pipeline with per-job result cards, bar charts, and NDVI gauge |

## Stack

```
EarthInsightEngine/
├── backend/          # FastAPI + SQLAlchemy (SQLite for MVP)
│   ├── app/
│   │   ├── models.py         # ORM: AOI, Scene, AnalysisJob, ChangeDetectionResult
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── aoi.py        # CRUD for Areas of Interest
│   │   │   ├── scenes.py     # Scene registration + file upload
│   │   │   ├── analysis.py   # Job creation, async simulation, results
│   │   │   └── stats.py      # Dashboard aggregate stats
│   │   ├── config.py
│   │   ├── db.py
│   │   └── main.py
│   └── seed.py               # Populate demo data
├── frontend/         # Next.js 14 (App Router) + TypeScript
│   └── src/
│       ├── app/
│       │   ├── page.tsx          # Dashboard
│       │   ├── aoi/page.tsx      # AOI management + map
│       │   ├── scenes/page.tsx   # Scene registry
│       │   └── analysis/page.tsx # Jobs + results viewer
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── AoiMap.tsx        # Leaflet map (SSR-safe dynamic import)
│       │   ├── SeverityBadge.tsx
│       │   └── StatusBadge.tsx
│       └── lib/api.ts            # Typed API client
├── docker-compose.yml
└── README.md
```

## Prerequisites

- **Local**: Python 3.11+, Node.js 20+, npm
- **Docker**: Docker Desktop (or Docker Engine + Compose)

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed.py          # optional: load demo AOIs, scenes, jobs
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- OpenAPI docs: http://localhost:8000/docs
- Health: `GET /health`, `GET /health/db`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: http://localhost:3000

## Docker Compose

```bash
docker compose up --build
```

`backend/data` is mounted into the API container so SQLite and uploads persist on the host.

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/aoi` | List all AOIs |
| POST | `/aoi` | Create AOI |
| GET | `/aoi/{id}` | Get AOI |
| DELETE | `/aoi/{id}` | Delete AOI (cascades) |
| GET | `/scenes` | List scenes (optional `?aoi_id=`) |
| POST | `/scenes` | Register scene (metadata only) |
| POST | `/scenes/upload` | Register scene + upload image file |
| DELETE | `/scenes/{id}` | Delete scene |
| GET | `/jobs` | List jobs (optional `?aoi_id=`) |
| POST | `/jobs` | Create and run analysis job |
| GET | `/jobs/{id}` | Get job + results |
| DELETE | `/jobs/{id}` | Delete job |
| GET | `/stats` | Dashboard aggregates |

## Environment variables

| Variable | Where | Default |
|---|---|---|
| `DATABASE_URL` | Backend | `sqlite:///./data/app.db` |
| `NEXT_PUBLIC_API_URL` | Frontend | `http://localhost:8000` |

## Change detection model

The MVP uses a **spectral simulation engine** that produces:
- **Change type breakdown**: vegetation loss/gain, water change, urban expansion, bare soil
- **NDVI before/after**: Normalised Difference Vegetation Index (proxy for vegetation health)
- **Severity rating**: low / medium / high / critical (thresholded on total change %)

The simulation produces deterministic, realistic-looking outputs seeded from the job ID. Replace `_simulate_change_detection` in `backend/app/routers/analysis.py` with a real EO pipeline (e.g. Google Earth Engine, GDAL, or a PyTorch segmentation model) to go production.
