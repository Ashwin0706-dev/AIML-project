# AI Urban Cadastral Mapping

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?logo=leaflet&logoColor=white)](https://leafletjs.com)
[![Shapely](https://img.shields.io/badge/Shapely-2.0+-blue)](https://shapely.readthedocs.io)
[![PostGIS](https://img.shields.io/badge/PostGIS-16--3.4-336791?logo=postgresql&logoColor=white)](https://postgis.net)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **AI-Assisted Urban Parcel Extraction, Validation & GNSS Verification**  
> *A human-in-the-loop AI + GIS cadastral mapping platform designed to accelerate municipal surveying while preserving statutory accuracy.*

---

## Problem Statement

Rapidly urbanizing municipalities face significant backlogs in updating cadastral land records. Conventional terrestrial surveying using total stations and GNSS rovers is labor-intensive, costly, and takes months per sector. While high-resolution drone orthomosaics provide visual detail, converting raw imagery into legally compliant cadastre poses severe challenges:
1. **Topological Violations:** Raw computer vision boundary predictions frequently produce self-intersections (bow-ties), gaps between adjacent parcels, and overlaps (encroachment).
2. **Statutory Standards:** Cadastral registries mandate closed 2D planar topology with zero disputed voids and centimeter-accurate area calculations.
3. **Black-box AI Distrust:** Survey authorities cannot accept unchecked AI boundaries without human review and field verification.

---

## Proposed Solution

**AI Urban Cadastral Mapping** introduces an AI-assisted, human-in-the-loop cadastral workflow:
```
DRONE / ORTHOPHOTO
       ↓
AI EXTRACTION
       ↓
PARCEL / BUILDING / ROAD DETECTION
       ↓
GIS POLYGON GENERATION
       ↓
TOPOLOGY VALIDATION
       ↓
HUMAN REVIEW
       ↓
GNSS VERIFICATION
       ↓
FINAL CADASTRAL GIS
       ↓
GEOJSON / SURVEY REPORT
```
The platform **does not replace certified surveyors**. Instead, it automates 85% of preliminary drafting—extracting parcel boundaries, building footprints, and road corridors—and provides surveyors with specialized tools to validate topology, review anomalies, incorporate RTK/CORS rover checkpoints, and generate formal survey reports.

---

## Key Features

- **Interactive GIS Dashboard:** Live Leaflet map canvas rendering AI parcels, building rooftops, road networks, municipal reference layers, and topology anomalies.
- **Automated Spatial Topology Validation:** Uses Shapely 2.0+ `STRtree` algorithms to detect boundary overlaps, cadastral gaps, self-intersecting bow-ties, slivers (<35 m²), and duplicate geometries.
- **In-Browser Boundary Editing:** Reshape polygon vertices directly on the map with draggable handles and midpoint `(+)` insertion markers, with immediate automatic topology re-validation.
- **GNSS Rover Field Verification:** Calculates area differences and percentage deltas between AI estimated areas and ground-truth GNSS measurements (`VERIFIED` vs `REVIEW REQUIRED`).
- **Before / After Comparison Slider:** Interactive slider comparing raw drone orthomosaics against extracted vector boundaries.
- **AI Review Queue:** Dedicated human-in-the-loop triage table listing flagged anomalies with one-click Approve, Reject, Edit, and Re-validate actions.
- **Municipal GIS Comparison:** Spatial intersection analysis comparing AI drone predictions against legacy municipal records (`REFERENCE DATA` vs `AI-GENERATED DATA`).
- **Cadastral Survey Report Generator:** Generates comprehensive municipal survey reports with inventory breakdowns, topology compliance logs, and print/PDF export.
- **Judge Presentation Mode:** Streamlined, high-contrast presenter mode optimized for hackathon judging and projector demonstrations.
- **Instant Parcel Search:** Quick-find search bar (e.g. `P-020`) that zooms, highlights, and inspects parcel attributes in real time.

---

## AI Pipeline

The feature extraction architecture (`backend/app/ai_engine.py` & `backend/app/models_interface.py`) is structured for end-to-end aerial segmentation:
1. **Preprocessing:** Ingests orthorectified GeoTIFF/PNG rasters, applies radiometric normalization, and tiles imagery to standard receptive field windows.
2. **Segmentation Interfaces:**
   - **Parcel Boundary Model:** U-Net / DeepLabV3+ semantic segmentation interface for cadastral parcel boundaries and multi-class land use.
   - **Building Detection Model:** YOLO / Mask R-CNN detector interface for rooftop footprints and setback margins.
   - **Road Extraction Model:** D-LinkNet / DeepLabV3 interface for road centerlines and pedestrian pathways.
3. **Polygonization:** Converts raster masks into cleaned Shapely vector polygons with Douglas-Peucker simplification and `make_valid` topology enforcement (`backend/app/mask_to_polygon.py`).
4. **Resilient Dual Mode:** The pipeline automatically checks for model weights (`.pt`, `.pth`, `.onnx`) in `MODEL_DIR`. When weights are absent, it cleanly runs in **Demo AI Prediction Mode** with honest UI labeling.

---

## GIS Pipeline

The spatial vector engine handles coordinate systems, polygon geometries, and cadastral spatial algebra:
- **Coordinate Reference System:** EPSG:4326 (WGS84 Lat/Lon) with meter-equivalent spatial area conversions.
- **Feature Classes:** Parcels (`Polygon`), Buildings (`Polygon`), Roads (`LineString`), GNSS Checkpoints (`Point`).
- **Map Vector Editing:** Bi-directional translation between GeoJSON `[lon, lat]` and Leaflet `[lat, lon]`, recalculating geometric surface area dynamically upon save.

---

## Topology Validation

The topology validation engine (`backend/app/topology.py`) applies planar topological rules:
- **Overlaps (Encroachment):** Uses `STRtree` spatial indexing to detect pairwise polygon intersections exceeding 1.5% area ratio.
- **Cadastral Gaps:** Computes `unary_union` across valid parcel fabric and inspects interior linear rings to locate unclaimed internal voids (5 m² to 500 m²).
- **Invalid Geometries:** Evaluates `geom.is_valid` and retrieves descriptive explanations via `explain_validity` for bow-ties and self-intersections.
- **Duplicates:** Identifies redundant spatial features via WKB (Well-Known Binary) hex hash comparison.
- **Slivers:** Flags degenerate polygons below statutory thresholds (<35 m²).

---

## GNSS Verification

Field verification connects drone-derived cadastre to centimeter-accurate ground coordinates:
- **Rover Data:** Captures GNSS RTK survey checkpoints (WGS84 lat/lon, surveyed area, accuracy ±0.015m, surveyor ID).
- **Differential Calculation:** Dynamically calculates:
  $$\Delta \text{Area} = |\text{Area}_{\text{AI}} - \text{Area}_{\text{GNSS}}|$$
  $$\%\text{ Difference} = \frac{\Delta \text{Area}}{\text{Area}_{\text{AI}}} \times 100$$
- **Threshold Decision:** Flagged as `✓ VERIFIED` if $\le 5\%$ variance, or `⚠ REVIEW REQUIRED` if exceeding tolerance.

---

## System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React 18 + Vite UI                   │
│  Leaflet Web-GIS • Presentation Mode • Survey Reports  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / REST API (Port 8001)
┌───────────────────────────▼────────────────────────────┐
│                    FastAPI Backend                     │
│  ├── AI Pipeline Interface (U-Net / YOLO / DeepLab)    │
│  ├── Spatial Topology Engine (Shapely 2.0+ STRtree)   │
│  ├── GeoJSON Export & Survey Report Generator          │
│  └── Dual Storage: PostGIS 16 ⇄ In-Memory GeoStore     │
└────────────────────────────────────────────────────────┘
```

---

## Technology Stack

- **Frontend:** React 18.3, Vite 5.4, Leaflet 1.9.4, React-Leaflet 4.2, Vanilla CSS.
- **Backend:** Python 3.11 / 3.13, FastAPI, Uvicorn, Pydantic v2, Shapely 2.0+, NumPy, Pillow, HTTPX.
- **GIS Algorithms:** Shapely `STRtree`, `unary_union`, `make_valid`, Douglas-Peucker simplification.
- **Database:** PostgreSQL 16 + PostGIS 3.4 (with automatic in-memory spatial store fallback).
- **Testing:** Pytest 8.0+ (14 integration and unit tests passing).

---

## Project Structure

```
AI-Urban-Cadastral-Mapping/
├── .env.example              # Environment variable template
├── .gitignore                # Git exclusions (caches, venvs, weights)
├── README.md                 # Project documentation
├── docker-compose.yml        # Multi-container orchestration
├── backend/
│   ├── requirements.txt      # Python dependencies
│   ├── data/sample/          # Sample orthophotos and GeoJSON data
│   └── app/
│       ├── main.py           # FastAPI REST API routes & endpoints
│       ├── ai_engine.py      # Cadastral feature extraction & demo generation
│       ├── models_interface.py # Base neural network interfaces
│       ├── topology.py       # Shapely 2.0 STRtree planar validation
│       ├── mask_to_polygon.py# Raster mask to vector polygonization
│       └── database.py       # Spatial storage layer (PostGIS + Memory store)
├── frontend/
│   ├── package.json          # Node dependencies
│   ├── vite.config.js        # Vite build config
│   ├── public/               # Static assets & sample drone orthophoto
│   └── src/
│       ├── App.jsx           # Main GIS application workspace
│       ├── index.css         # Professional GIS design system styles
│       ├── services/api.js   # Frontend API client
│       └── components/       # Modular UI components
│           ├── Header.jsx
│           ├── StatsDock.jsx
│           ├── ExtractionModal.jsx
│           ├── BeforeAfterSlider.jsx
│           ├── ParcelSearch.jsx
│           ├── ReviewQueue.jsx
│           ├── TopologyPanel.jsx
│           ├── GnssPanel.jsx
│           ├── ComparisonPanel.jsx
│           ├── ModelEvaluation.jsx
│           ├── WorkflowGuide.jsx
│           ├── SurveyReportModal.jsx
│           ├── SystemStatusModal.jsx
│           └── MapLegend.jsx
└── tests/
    ├── test_api.py           # API integration tests
    └── test_topology.py      # Topology validation unit tests
```

---

## Installation

### Prerequisites
- Python 3.11+ (or 3.12/3.13)
- Node.js 18+ and npm
- (Optional) Docker and Docker Compose

---

## Backend Setup

1. Navigate to the project directory:
   ```bash
   cd AI-Urban-Cadastral-Mapping
   ```
2. Activate your Python virtual environment or create one:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```
3. Install backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Start the FastAPI backend server:
   ```bash
   uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 --reload
   ```
   API interactive docs available at: `http://127.0.0.1:8001/docs`

---

## Frontend Setup

1. In a new terminal, navigate to the frontend directory:
   ```bash
   cd AI-Urban-Cadastral-Mapping/frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open your browser at: `http://localhost:5173`

---

## Environment Variables

Copy `.env.example` to `.env` in the project root:
```ini
# Backend Port and CORS
PORT=8001
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Database (Optional: falls back automatically to In-Memory GeoStore)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=cadastral
POSTGRES_USER=cadastral
POSTGRES_PASSWORD=your_password
DATABASE_URL=postgresql://cadastral:your_password@localhost:5432/cadastral

# Directories
MODEL_DIR=models
UPLOAD_DIR=data/sample
EXPORTS_DIR=data/exports

# Frontend
VITE_API_URL=http://127.0.0.1:8001/api
```

---

## Running the Project

### Development Mode (Concurrent)
- **Backend:** `uvicorn backend.app.main:app --port 8001 --reload`
- **Frontend:** `npm --prefix frontend run dev`

### Production Build Test
```bash
cd frontend
npm run build
```

### Running Automated Test Suite
```bash
pytest tests/
```
All 14 integration and unit tests will run and pass.

---

## Demo Mode

When trained neural network weights (`.pt`, `.pth`, `.onnx`) are not placed in `MODEL_DIR`, the application operates in **Demo Mode**.
- **Transparency:** The dashboard clearly displays `AI MODE: DEMO MODE` across the topbar, modals, and survey reports.
- **Simulated Cadastre:** Generates 110 coherent urban parcels, 60+ buildings, and 25+ road centerlines calibrated for the Tiruchengode cadastral sector.
- **Deliberate Anomalies:** Includes intentional real-world boundary encroachments, self-intersecting bow-ties, and slivers so that topology validation and surveyor editing workflows can be fully demonstrated during hackathon judging.

---

## AI Model Information

- **Interfaces Defined:** `ParcelSegmentationModel`, `BuildingDetectionModel`, `RoadSegmentationModel` in `backend/app/models_interface.py`.
- **Intended Model Architectures:**
  - Parcel Boundary Segmentation: DeepLabV3+ with ResNet-50 / HRNet backbone.
  - Building Rooftop Detection: YOLOv8-seg / Mask R-CNN.
  - Road Network Extraction: D-LinkNet with directional convolutions.
- **Weight Loading:** Place `.pt` or `.onnx` files into the `models/` directory; the backend detects them automatically upon restart.

---

## Evaluation

Quantitative evaluation metrics require a ground-truth test partition and trained model weights:
- **Status:** Displayed as `MODEL EVALUATION: Not evaluated (Demo Mode Active)`.
- **Benchmark Schema:** Ready to ingest and report:
  - **IoU (Intersection over Union)**
  - **Boundary Precision & Recall**
  - **F1 Score**
  - **Boundary Error RMSE (meters)**
  - **Area Variance Percentage**

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health and active database type |
| `GET` | `/api/system/status` | Live status of backend, AI engine, GIS engine, and database |
| `POST` | `/api/demo/load` | Initializes complete demo cadastral dataset |
| `POST` | `/api/ai/segment` | Runs end-to-end extraction pipeline |
| `POST` | `/api/ai/detect-buildings` | Extracts building footprints within parcels |
| `POST` | `/api/ai/detect-roads` | Extracts road centerlines and pathways |
| `GET` | `/api/parcels` | Returns FeatureCollection of cadastral parcels |
| `PUT` | `/api/parcels/{id}` | Updates parcel attributes and vertex geometry |
| `POST` | `/api/topology/validate` | Triggers on-demand spatial topology validation |
| `GET` | `/api/validation/issues` | Returns list of detected topology anomalies |
| `POST` | `/api/ground-truth` | Records field surveyor GNSS RTK checkpoint |
| `GET` | `/api/gnss/sample` | Returns sample GNSS RTK survey checkpoints |
| `GET` | `/api/gis/comparison` | Spatial overlay comparison of AI vs existing cadastre |
| `GET` | `/api/model/evaluation` | Model performance benchmarking status |
| `GET` | `/api/survey-report` | Generates official Cadastral Survey Report data |
| `GET` | `/api/export/geojson?layer={l}` | Exports standard GeoJSON layer for GIS tools |

---

## Screenshots

*(Interactive demonstration views available in the running application:)*
1. **Interactive Cadastral Map:** High-contrast multi-layer vector display on satellite orthophotos.
2. **Before / After Comparison Slider:** Real-time sliding split view between raw orthophoto and AI cadastre.
3. **AI Review Queue:** Surveyor triage table with zoom, approve, reject, and vertex editing.
4. **Topology Quality Panel:** Real-time metrics on overlaps, voids, bow-ties, and slivers.
5. **Cadastral Survey Report:** Formal printable municipal report with signatures and audit logs.

---

## Future Enhancements

- **Direct GPU TensorRT Engine:** Sub-second inference for 200+ Megapixel ultra-high resolution drone orthomosaics.
- **3D Cadastral LOD2 Integration:** Fusing LiDAR/DSM elevation data to calculate volumetric building parcel rights.
- **Real-Time NMEA GNSS Rover Streaming:** WebSockets interface for live field surveyor RTK rovers.
- **National Land Registry Interoperability:** Export to LADM (ISO 19152 Land Administration Domain Model).

---

## Team

- **AI Urban Cadastral Mapping Project Team**
- Built for AI + GIS Hackathon 2026.

## Hackathon-Ready Upgrade

The current version is structured as a real end-to-end application rather than a UI-only mock. It supports: 

- **Persistent project state:** SQLite snapshot persistence keeps uploaded imagery metadata, extracted layers, topology results, edits, and GNSS verification after a backend restart.
- **Real upload handling:** image uploads are size/type validated and recorded with SHA-256 integrity hashes, dimensions when readable, timestamps, CRS metadata, and storage metadata.
- **One-click complete pipeline:** `POST /api/pipeline/run` executes extraction, parcel/building/road generation, and topology validation in one workflow.
- **Human-in-the-loop editing:** parcel vertices and land-use/status attributes can be edited from the map, followed by automatic topology re-validation.
- **Quality assurance:** overlaps, gaps, invalid geometries, duplicate geometries, and sliver polygons are surfaced as actionable review issues.
- **GNSS verification:** field measurements can be attached to a parcel and compared with AI-estimated area.
- **GIS interoperability:** GeoJSON and CSV exports are available for parcels, buildings, roads, ground-truth records, and municipal reference data.
- **Optional PostGIS:** PostgreSQL/PostGIS remains available for deployment; SQLite is the default zero-setup persistent store.
- **AI model integration boundary:** trained parcel/building/road weights can be plugged into `models_interface.py`. The application does not falsely treat an arbitrary single weight file as three trained models.

### Recommended hackathon demo flow

1. Start the FastAPI backend on port `8001`.
2. Start the Vite frontend on port `5173`.
3. Upload the provided sample orthophoto or a judge-supplied aerial image.
4. Click **RUN COMPLETE ANALYSIS**.
5. Show the generated parcel/building/road layers on the map.
6. Open **Topology Validation** and click an anomaly to zoom to it.
7. Edit a parcel boundary and validate again.
8. Open **GNSS Verification** and demonstrate a verified/review-required field measurement.
9. Compare against municipal GIS.
10. Export GeoJSON/CSV and open the survey report.

> **Important:** Without trained neural-network weights, extraction runs through the project's deterministic fallback pipeline. For a production deployment, provide separately trained and evaluated model weights and benchmark them against an annotated test set.

### Local setup

```bash
# backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# frontend (new terminal)
cd frontend
npm install
npm run dev
```

The default persistent database is `data/cadastral.db`; remove that file only when you intentionally want to reset local state.


## Included synthetic datasets

The `data/synthetic_datasets/` directory now includes three generated paired image/mask datasets: parcel boundaries, building footprints, and road extraction (60 pairs each). See `data/synthetic_datasets/README.md` for details and limitations. Run `python ai/datasets/inspect_synthetic_datasets.py` to verify the image/mask pairs. These datasets are synthetic and are for pipeline experimentation, not real-world validation.
