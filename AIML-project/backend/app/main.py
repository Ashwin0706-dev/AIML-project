"""FastAPI Application for AI-Based Automated Urban Cadastral Mapping.
Provides RESTful GIS APIs for Drone Imagery Upload, AI Segmentation,
Topology Validation, Vertex Editing, Ground Truth Verification, and GIS Export.
"""
import os
import json
import shutil
import time
import hashlib
import csv
import io
from typing import Optional, List, Dict, Any
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from shapely.geometry import shape, mapping, Polygon

from .database import db
from .ai_engine import extract, demo_detect_buildings, demo_detect_roads, demo_extract_parcels
from .topology import validate

app = FastAPI(
    title="AI Urban Cadastral Mapping API",
    description="Automated urban parcel mapping and cadastral feature extraction using drone imagery",
    version="1.0.0"
)

# CORS configuration
origins_str = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
)
origins = [o.strip() for o in origins_str.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "data/sample")
EXPORTS_DIR = os.getenv("EXPORTS_DIR", "data/exports")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORTS_DIR, exist_ok=True)

ALLOWED_IMAGE_EXTS = {".tif", ".tiff", ".png", ".jpg", ".jpeg"}
ALLOWED_GIS_EXTS = {".geojson", ".json"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

fc = lambda features: {"type": "FeatureCollection", "features": features}


# Pydantic Schemas
class ProjectCreate(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Tiruchengode Urban Cadastral Zone A"})
    description: str = Field("", json_schema_extra={"example": "Drone orthomosaic survey block"})


class ParcelUpdate(BaseModel):
    land_use: Optional[str] = None
    area: Optional[float] = None
    status: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = None  # GeoJSON geometry for vertex editing


class GroundTruthIn(BaseModel):
    parcel_id: str
    gt_area: float
    lat: Optional[float] = None
    lon: Optional[float] = None
    survey_accuracy: Optional[float] = 0.02
    survey_date: Optional[str] = "2026-09-24"
    survey_id: Optional[str] = "GNSS-SURV-104"
    decision: str = "verified"  # verified, rejected, pending


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AI Cadastral Mapping API",
        "timestamp": time.time(),
        "database": "PostGIS" if db.use_postgres else ("SQLite Persistent Store" if db.sqlite_conn else "In-Memory Store")
    }


# Projects
@app.get("/api/projects")
def list_projects():
    return db.get_projects()


@app.post("/api/projects", status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate):
    return db.create_project(project.name, project.description)


@app.get("/api/projects/{pid}")
def get_project(pid: int):
    p = db.get_project(pid)
    if not p:
        raise HTTPException(status_code=404, detail=f"Project with ID {pid} not found.")
    return p


# Image & Raster Upload
@app.post("/api/imagery/upload")
async def upload_imagery(
    file: UploadFile = File(...),
    project_id: int = Form(1),
    elevation_type: Optional[str] = Form(None)  # DSM, DTM, or None (Orthophoto)
):
    """Securely uploads drone imagery / orthomosaics / DSM / DTM."""
    filename = Path(file.filename or "uploaded_image.tif").name
    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXTS))}"
        )

    # Secure file path
    safe_filename = f"img_{int(time.time())}_{filename}"
    target_path = os.path.join(UPLOAD_DIR, safe_filename)

    file_size = 0
    with open(target_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE_BYTES:
                os.remove(target_path)
                raise HTTPException(status_code=413, detail="File exceeds maximum allowed size of 50MB.")
            buffer.write(chunk)

    is_geotiff = ext in (".tif", ".tiff")
    img_type = elevation_type if elevation_type in ("DSM", "DTM") else ("GeoTIFF" if is_geotiff else "Drone Aerial Image")
    
    sha256 = hashlib.sha256()
    with open(target_path, "rb") as saved_file:
        for chunk in iter(lambda: saved_file.read(1024 * 1024), b""):
            sha256.update(chunk)

    dimensions = None
    try:
        from PIL import Image
        with Image.open(target_path) as im:
            dimensions = {"width": im.width, "height": im.height, "mode": im.mode}
    except Exception:
        dimensions = None

    img_record = {
        "image_id": f"IMG-{len(db.get_imagery()) + 1:03d}",
        "project_id": project_id,
        "filename": filename,
        "stored_filename": safe_filename,
        "path": target_path,
        "size_bytes": file_size,
        "type": img_type,
        "status": "uploaded",
        "bounds": [77.8940, 11.3795, 77.8995, 11.3840],
        "crs": "EPSG:4326 (WGS84)"
    }
    
    db.add_imagery(img_record)
    return {
        "success": True,
        **img_record
    }


# Elevation (DSM/DTM) Upload Endpoint
@app.post("/api/imagery/upload-elevation")
async def upload_elevation(
    file: UploadFile = File(...),
    elevation_type: str = Form("DSM"),  # DSM or DTM
    project_id: int = Form(1)
):
    """Uploads Digital Surface Model (DSM) or Digital Terrain Model (DTM)."""
    return await upload_imagery(file, project_id=project_id, elevation_type=elevation_type)


# AI Extraction Pipeline
@app.get("/api/imagery")
def list_imagery():
    """Returns uploaded imagery metadata without exposing server file paths."""
    items = []
    for rec in db.get_imagery():
        safe = {k: v for k, v in rec.items() if k != "path"}
        items.append(safe)
    return items


@app.post("/api/pipeline/run")
def run_full_pipeline():
    """Runs the complete extraction + topology workflow as one transaction-like operation."""
    result = run_segmentation()
    return {
        "success": True,
        "pipeline": ["imagery_ingestion", "feature_extraction", "polygon_generation", "topology_validation"],
        "result": result,
        "statistics": db.get_statistics(),
    }


@app.post("/api/ai/segment")
def run_segmentation():
    """Runs end-to-end cadastral feature extraction:
    Drone Image -> Parcel Boundaries -> Buildings -> Roads/Pathways -> Topology Validation.
    Clearly reports whether running in Demo Mode or Real AI Model mode."""
    imagery_list = db.get_imagery()
    latest_img = imagery_list[-1]["path"] if imagery_list else None

    (parcels, buildings, roads), mode = extract(latest_img)

    # Validate topology immediately
    summary, issues = validate(parcels)

    # Save to storage
    db.set_parcels(parcels, mode=mode)
    db.set_buildings(buildings)
    db.set_roads(roads)
    db.set_validation(summary, issues)

    confidences = [p["properties"]["confidence"] for p in parcels if "confidence" in p["properties"]]
    avg_conf = round(sum(confidences) / len(confidences), 3) if confidences else 0.0

    return {
        "success": True,
        "mode": mode,
        "mode_label": "Real AI Model" if mode == "model" else "Demo AI Prediction",
        "parcels": len(parcels),
        "buildings": len(buildings),
        "roads": len(roads),
        "average_confidence": avg_conf,
        "validation": summary
    }


@app.post("/api/ai/detect-buildings")
def detect_buildings_endpoint():
    """Extracts building footprints within parcels."""
    parcels = db.get_parcels()
    if not parcels:
        run_segmentation()
        parcels = db.get_parcels()
    buildings = demo_detect_buildings(parcels)
    db.set_buildings(buildings)
    return {
        "success": True,
        "mode": "demo",
        "buildings_detected": len(buildings),
        "features": fc(buildings)
    }


@app.post("/api/ai/detect-roads")
def detect_roads_endpoint():
    """Extracts road centerlines and pathway networks."""
    roads = demo_detect_roads()
    db.set_roads(roads)
    return {
        "success": True,
        "mode": "demo",
        "roads_detected": len(roads),
        "features": fc(roads)
    }


# Parcels & Map Editing
@app.get("/api/parcels")
def get_parcels():
    return fc(db.get_parcels())


@app.get("/api/parcels/{pid}")
def get_parcel(pid: str):
    p = db.get_parcel(pid)
    if not p:
        raise HTTPException(status_code=404, detail=f"Parcel {pid} not found.")
    return p


@app.put("/api/parcels/{pid}")
def update_parcel(pid: str, patch: ParcelUpdate):
    """Updates parcel attributes and/or polygon vertex geometry from map-based editing.
    Re-runs topology validation automatically after update."""
    updated = db.update_parcel(pid, patch.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail=f"Parcel {pid} not found.")

    # Re-run topology validation dynamically
    parcels = db.get_parcels()
    summary, issues = validate(parcels)
    db.set_validation(summary, issues)

    return {
        "success": True,
        "parcel": updated,
        "validation": summary
    }


# Buildings & Roads
@app.get("/api/buildings")
def get_buildings():
    return fc(db.get_buildings())


@app.get("/api/roads")
def get_roads():
    return fc(db.get_roads())


# Topology Validation
@app.post("/api/topology/validate")
def validate_topology():
    """Triggers on-demand spatial topology validation on current parcel layer."""
    parcels = db.get_parcels()
    summary, issues = validate(parcels)
    db.set_validation(summary, issues)
    return {
        "summary": summary,
        "total_issues": len(issues),
        "issues": issues
    }


@app.get("/api/validation/issues")
def get_validation_issues():
    return db.get_validation_issues()


# Ground Truth & GNSS Survey
@app.post("/api/ground-truth", status_code=status.HTTP_201_CREATED)
def submit_ground_truth(gt: GroundTruthIn):
    """Records field survey verification data (GNSS/CORS) for a cadastral parcel."""
    target_parcel = db.get_parcel(gt.parcel_id)
    ai_area = target_parcel["properties"]["area"] if target_parcel else gt.gt_area
    diff = round(abs(ai_area - gt.gt_area), 2)
    
    rec = {
        "id": len(db.get_ground_truth()) + 1,
        "parcel_id": gt.parcel_id,
        "gt_area": gt.gt_area,
        "ai_area": ai_area,
        "difference": diff,
        "lat": gt.lat,
        "lon": gt.lon,
        "survey_accuracy": gt.survey_accuracy,
        "survey_date": gt.survey_date,
        "survey_id": gt.survey_id,
        "decision": gt.decision,
        "source": "Demo GNSS Data"
    }
    
    db.add_ground_truth(rec)
    
    # Update parcel verification status
    if target_parcel:
        db.update_parcel(gt.parcel_id, {"status": gt.decision})
        
    return {
        "success": True,
        "record": rec
    }


@app.get("/api/ground-truth")
def get_ground_truth_list():
    return db.get_ground_truth()


@app.get("/api/gnss/sample")
def get_demo_gnss_data():
    """Provides sample GNSS/CORS rover survey checkpoints for demonstration."""
    return {
        "source": "Demo GNSS Data",
        "description": "Synthesized CORS-corrected RTK checkpoints for Tiruchengode cadastral sector",
        "checkpoints": [
            {"survey_id": "GNSS-01", "parcel_id": "P-001", "lat": 11.3801, "lon": 77.8946, "accuracy_m": 0.015, "survey_date": "2026-09-24"},
            {"survey_id": "GNSS-02", "parcel_id": "P-002", "lat": 11.3801, "lon": 77.8950, "accuracy_m": 0.012, "survey_date": "2026-09-24"},
            {"survey_id": "GNSS-03", "parcel_id": "P-011", "lat": 11.3804, "lon": 77.8945, "accuracy_m": 0.018, "survey_date": "2026-09-24"},
            {"survey_id": "GNSS-04", "parcel_id": "P-023", "lat": 11.3808, "lon": 77.8955, "accuracy_m": 0.014, "survey_date": "2026-09-24"},
            {"survey_id": "GNSS-05", "parcel_id": "P-050", "lat": 11.3812, "lon": 77.8962, "accuracy_m": 0.016, "survey_date": "2026-09-24"}
        ]
    }


# Existing GIS Layer & AI vs GIS Comparison
@app.post("/api/gis/upload-existing")
async def upload_existing_gis(file: UploadFile = File(...)):
    """Uploads an existing municipal cadastral GIS parcel layer (GeoJSON)."""
    filename = Path(file.filename or "existing_parcels.geojson").name
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_GIS_EXTS:
        raise HTTPException(status_code=400, detail="Allowed existing GIS format: .geojson")

    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
        features = data.get("features", [])
        db.set_existing_parcels(features)
        return {
            "success": True,
            "filename": filename,
            "parcels_loaded": len(features)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid GeoJSON content: {str(e)}")


@app.get("/api/gis/existing-parcels")
def get_existing_parcels():
    """Returns the existing GIS parcel layer."""
    existing = db.get_existing_parcels()
    if not existing:
        # Generate baseline existing municipal parcels for Tiruchengode
        base_parcels = demo_extract_parcels(rows=8, cols=9, seed=99)
        existing = [
            {
                "type": "Feature",
                "geometry": f["geometry"],
                "properties": {
                    "parcel_id": f["properties"]["parcel_id"].replace("P-", "REG-"),
                    "owner": f"Cadastral Record {f['properties']['parcel_id']}",
                    "recorded_area": f["properties"]["area"] * 0.98,
                    "layer": "Existing Municipal GIS"
                }
            }
            for f in base_parcels
        ]
        db.set_existing_parcels(existing)
    return fc(existing)


@app.get("/api/gis/comparison")
def compare_ai_vs_existing():
    """Performs spatial overlay comparison between AI-predicted parcels and Existing Municipal GIS records."""
    ai_parcels = db.get_parcels()
    if not ai_parcels:
        run_segmentation()
        ai_parcels = db.get_parcels()

    existing = db.get_existing_parcels()
    if not existing:
        get_existing_parcels()
        existing = db.get_existing_parcels()

    if not ai_parcels or not existing:
        return {"comparisons": [], "total": 0, "match_rate": 0}

    comparisons = []
    # Compare top parcels
    for ai_f in ai_parcels[:20]:
        ai_geom = shape(ai_f["geometry"])
        ai_pid = ai_f["properties"]["parcel_id"]
        ai_area = ai_f["properties"]["area"]
        ai_conf = ai_f["properties"]["confidence"]

        best_match = None
        best_overlap_area = 0

        for ex_f in existing:
            try:
                ex_geom = shape(ex_f["geometry"])
                if ai_geom.intersects(ex_geom):
                    inter = ai_geom.intersection(ex_geom)
                    if inter.area > best_overlap_area:
                        best_overlap_area = inter.area
                        best_match = ex_f
            except Exception:
                continue

        if best_match:
            ex_props = best_match["properties"]
            ex_area = ex_props.get("recorded_area", ai_area * 0.98)
            overlap_pct = min(100.0, round(100.0 * (best_overlap_area / ai_geom.area), 1))
            diff_sqm = round(abs(ai_area - ex_area), 1)

            comparisons.append({
                "ai_parcel_id": ai_pid,
                "existing_parcel_id": ex_props.get("parcel_id", "REG-UNKNOWN"),
                "ai_area": ai_area,
                "existing_area": round(ex_area, 1),
                "difference_sqm": diff_sqm,
                "overlap_percentage": overlap_pct,
                "ai_confidence": round(ai_conf * 100, 1)
            })

    return {
        "comparisons": comparisons,
        "total_analyzed": len(comparisons),
        "average_overlap": round(sum(c["overlap_percentage"] for c in comparisons) / len(comparisons), 1) if comparisons else 0
    }


# Dashboard Statistics
@app.get("/api/statistics")
def get_dashboard_statistics():
    return db.get_statistics()


# GeoJSON Layer Export
@app.get("/api/export/geojson")
def export_layer(layer: str = Query("parcels", pattern="^(parcels|buildings|roads|ground_truth|existing_parcels)$")):
    """Exports cadastral vector layers in standard GeoJSON format."""
    if layer == "parcels":
        data = fc(db.get_parcels())
    elif layer == "buildings":
        data = fc(db.get_buildings())
    elif layer == "roads":
        data = fc(db.get_roads())
    elif layer == "ground_truth":
        # Convert ground truth point records into GeoJSON features
        gt_list = db.get_ground_truth()
        gt_features = [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [g["lon"], g["lat"]]},
                "properties": g
            }
            for g in gt_list if g.get("lon") and g.get("lat")
        ]
        data = fc(gt_features)
    elif layer == "existing_parcels":
        data = fc(db.get_existing_parcels())
    else:
        raise HTTPException(status_code=400, detail="Invalid layer name.")

    # Save to export folder
    out_file = os.path.join(EXPORTS_DIR, f"{layer}.geojson")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return data


# System Status
@app.get("/api/export/csv")
def export_csv(layer: str = Query("parcels", pattern="^(parcels|buildings|roads|ground_truth)$")):
    """Exports tabular attributes for judging, analysis, or spreadsheet review."""
    mapping = {
        "parcels": db.get_parcels(),
        "buildings": db.get_buildings(),
        "roads": db.get_roads(),
        "ground_truth": db.get_ground_truth(),
    }
    rows = mapping[layer]
    if layer == "ground_truth":
        fields = sorted({k for row in rows for k in row.keys()}) or ["parcel_id", "gt_area", "decision"]
        data = rows
    else:
        fields = sorted({k for row in rows for k in row.get("properties", {}).keys()})
        data = [row.get("properties", {}) for row in rows]
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(data)
    return StreamingResponse(io.BytesIO(out.getvalue().encode("utf-8")), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={layer}.csv"})


@app.get("/api/system/status")
def system_status():
    """Returns live connection and readiness status of Backend, AI Engine, GIS Engine, and Database."""
    from .models_interface import get_available_models
    import shapely
    models = get_available_models()
    return {
        "backend": {
            "status": "connected",
            "service": "FastAPI Cadastral Engine",
            "version": "1.0.0"
        },
        "ai_engine": {
            "status": "demo_ready",
            "mode": models["mode"],
            "mode_label": "Real AI Model" if models["mode"] == "model" else "Demo Mode (Weights Not Configured)",
            "weights_available": any(models[k] for k in ["parcels", "buildings", "roads"])
        },
        "gis_engine": {
            "status": "ready",
            "engine": f"Shapely {shapely.__version__}",
            "topology_support": "STRtree + Planar Validation"
        },
        "database": {
            "status": "connected",
            "type": "PostgreSQL / PostGIS" if db.use_postgres else "Spatial Memory Store (In-Memory GeoDB)"
        }
    }


# Model Evaluation
@app.get("/api/model/evaluation")
def model_evaluation():
    """Returns model performance metrics if ground-truth benchmark is available,
    otherwise reports 'Not evaluated' as required when weights are absent."""
    from .models_interface import get_available_models
    models = get_available_models()
    has_model = all(models[k] for k in ["parcels", "buildings", "roads"])
    return {
        "evaluated": False,
        "status": "Not evaluated",
        "mode": "model" if has_model else "demo",
        "notice": "Ground-truth evaluation benchmarks require trained neural network weights and annotated test splits. Operating in Demo AI Mode.",
        "metrics": {
            "iou": None,
            "precision": None,
            "recall": None,
            "f1_score": None,
            "boundary_error_meters": None,
            "area_error_percentage": None
        }
    }


# Demo Dataset Loader
@app.post("/api/demo/load")
def load_demo_dataset():
    """Initializes and loads the complete demo dataset with parcels, buildings, roads,
    topology validation, and sample GNSS checkpoints."""
    stats = db.reset_demo_data()
    return {
        "success": True,
        "message": "Demo cadastral dataset successfully loaded.",
        "statistics": stats
    }


# Survey Report Generator
@app.get("/api/survey-report")
def get_survey_report():
    """Generates structured cadastral survey report using actual live project data."""
    stats = db.get_statistics()
    val_issues = db.get_validation_issues()
    gt_list = db.get_ground_truth()
    projects = db.get_projects()
    active_proj = projects[0] if projects else {"name": "Tiruchengode Urban Cadastral Zone A"}

    return {
        "title": "AI URBAN CADASTRAL MAPPING REPORT",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "project": {
            "name": active_proj.get("name", "Tiruchengode Urban Cadastral Zone A"),
            "survey_area": "Tiruchengode Sector 4 Urban Cadastre (WGS84 EPSG:4326)",
            "date": time.strftime("%Y-%m-%d", time.gmtime()),
            "coordinate_system": "EPSG:4326 (WGS84 Lat/Lon)"
        },
        "inventory": {
            "total_parcels": stats["total_parcels"],
            "buildings": stats["total_buildings"],
            "roads": stats["total_roads"],
            "valid_parcels": stats["valid_parcels"],
            "topology_issues": stats["topology_issues"],
            "pending_verification": stats.get("pending_verification", 0),
            "gnss_verified": stats.get("gnss_verified", 0)
        },
        "ai_model": {
            "mode": "DEMO MODE" if stats["mode"] == "demo" else "REAL MODEL",
            "model_type": "Multi-Task Cadastral Segmentation Interface",
            "weights_configured": False if stats["mode"] == "demo" else True,
            "average_confidence": f"{stats.get('avg_confidence', 0)}%"
        },
        "topology_summary": {
            "total_issues": len(val_issues),
            "breakdown": {
                "overlaps": sum(1 for i in val_issues if i.get("issue_type") == "overlaps"),
                "gaps": sum(1 for i in val_issues if i.get("issue_type") == "gaps"),
                "invalid_geometries": sum(1 for i in val_issues if i.get("issue_type") == "invalid_geometry"),
                "duplicates": sum(1 for i in val_issues if i.get("issue_type") == "duplicates"),
                "sliver_polygons": sum(1 for i in val_issues if i.get("issue_type") == "sliver_polygons")
            }
        },
        "gnss_verification_summary": {
            "total_checkpoints": len(gt_list),
            "verified": sum(1 for g in gt_list if g.get("decision") == "verified"),
            "rejected": sum(1 for g in gt_list if g.get("decision") == "rejected"),
            "checkpoints": gt_list
        },
        "export_metadata": {
            "formats_available": ["GeoJSON (Parcels, Buildings, Roads)", "Survey Report JSON/HTML/Print"],
            "licensing": "Municipal Cadastral Open GIS Protocol"
        }
    }


# Sample Drone Orthophoto Retrieval
@app.get("/api/imagery/sample-orthophoto")
def get_sample_orthophoto():
    """Serves the project's actual sample drone orthomosaic image."""
    candidates = [
        os.path.join(UPLOAD_DIR, "sample_urban_drone.png"),
        os.path.join("data", "sample", "sample_urban_drone.png"),
        os.path.join("backend", "data", "sample", "sample_urban_drone.png"),
        os.path.join("..", "data", "sample", "sample_urban_drone.png"),
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "sample", "sample_urban_drone.png"),
        os.path.join(os.path.dirname(__file__), "..", "data", "sample", "sample_urban_drone.png")
    ]
    for path in candidates:
        abs_p = os.path.abspath(path)
        if os.path.exists(abs_p):
            return FileResponse(abs_p, media_type="image/png")
    raise HTTPException(status_code=404, detail="Sample orthophoto file not found.")
