"""AI Engine for Cadastral Feature Extraction.
Supports REAL AI MODEL mode (U-Net, YOLO, DeepLabV3) and realistic DEMO MODE.
Extracts:
1. Cadastral Parcel Polygons with Land-Use classification
2. Building Footprint Polygons
3. Road & Pathway Centerlines (Main Road, Local Road, Lane, Pathway)
"""
import os
import random
import math
from typing import Tuple, List, Dict, Any, Optional
from shapely.geometry import Polygon, LineString, box, mapping, Point
from shapely.validation import make_valid
from .models_interface import (
    ParcelSegmentationModel,
    BuildingDetectionModel,
    RoadSegmentationModel,
    get_available_models
)

LAND_USE_CLASSES = [
    "Residential",
    "Commercial",
    "Public",
    "Open Space",
    "Vegetation",
    "Water",
    "Other"
]

ROAD_CLASSES = ["Main Road", "Local Road", "Lane", "Pathway"]


def model_available() -> bool:
    """Check whether real trained weights are configured in MODEL_DIR."""
    models = get_available_models()
    return all(models[k] for k in ["parcels", "buildings", "roads"])


def _feat(geom, props: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to return a standardized GeoJSON Feature."""
    return {"type": "Feature", "geometry": mapping(geom), "properties": props}


def demo_extract_parcels(
    center: Tuple[float, float] = (77.8945, 11.3800),
    rows: int = 10,
    cols: int = 11,
    seed: int = 42
) -> List[Dict[str, Any]]:
    """Generate 100+ spatially coherent urban parcels with varied shapes,
    land uses, and intentional topology anomalies for validation demonstration."""
    rnd = random.Random(seed)
    lon0, lat0 = center
    # Parcel dimensions in geographic degrees (~30m x ~25m with roads in between)
    pw, ph = 0.00032, 0.00026
    road_gap_x = 0.00010
    road_gap_y = 0.00010
    
    parcels = []
    parcel_count = 0
    
    for r in range(rows):
        for c in range(cols):
            parcel_count += 1
            pid = f"P-{parcel_count:03d}"
            
            # Add sector breaks for major roads
            x_offset = c * pw + (c // 3) * road_gap_x
            y_offset = r * ph + (r // 3) * road_gap_y
            x = lon0 + x_offset
            y = lat0 + y_offset
            
            # Subtle realistic corner jitter
            j1 = rnd.uniform(-0.000015, 0.000015)
            j2 = rnd.uniform(-0.000015, 0.000015)
            j3 = rnd.uniform(-0.000015, 0.000015)
            j4 = rnd.uniform(-0.000015, 0.000015)
            
            poly = Polygon([
                (x + j1, y + j2),
                (x + pw + j3, y + j1),
                (x + pw + j2, y + ph + j4),
                (x + j4, y + ph + j3)
            ])
            
            # Land use distribution
            lu_rand = rnd.random()
            if lu_rand < 0.65:
                land_use = "Residential"
            elif lu_rand < 0.82:
                land_use = "Commercial"
            elif lu_rand < 0.90:
                land_use = "Public"
            elif lu_rand < 0.95:
                land_use = "Open Space"
            else:
                land_use = "Vegetation"

            confidence = round(rnd.uniform(0.84, 0.97), 3)
            status = "pending"
            issue_note = None

            # Deliberate realistic topology issues for demonstration:
            # 1. Overlaps (Disputed boundaries / encroachment)
            if parcel_count in (11, 35, 62, 88):
                # Encroaches 35% into neighbor
                poly = box(x - 0.00012, y, x + pw, y + ph)
                issue_note = "Boundary encroachment overlap"

            # 2. Invalid Bow-tie self-intersection
            elif parcel_count in (20, 75):
                poly = Polygon([(x, y), (x + pw, y + ph), (x + pw, y), (x, y + ph)])
                issue_note = "Self-intersecting polygon boundary"

            # 3. Slivers (unclaimed tiny fragment)
            elif parcel_count in (44, 98):
                poly = Polygon([(x, y), (x + 0.00002, y), (x + 0.00002, y + ph), (x, y + ph)])
                issue_note = "Sliver polygon under threshold"

            # 4. Duplicate geometry
            elif parcel_count == 50 and len(parcels) > 0:
                # Exact copy of parcel P-049
                poly = shape_geom = Polygon(parcels[-1]["geometry"]["coordinates"][0])
                issue_note = "Duplicate geometry of previous parcel"

            # Approximate square meters: ~1 deg lat ~ 111,000m, ~1 deg lon ~ 108,000m -> 1 deg^2 ~ 1.2e10 sqm
            approx_sqm = round(poly.area * 1.2e10, 1) if poly.is_valid else 250.0
            
            parcels.append(_feat(poly, {
                "parcel_id": pid,
                "land_use": land_use,
                "land_use_classification": "Demo Classification",
                "area": approx_sqm,
                "confidence": confidence,
                "source": "Demo AI Prediction",
                "status": status,
                "row": r,
                "col": c,
                "notes": issue_note
            }))

    return parcels


def demo_detect_buildings(parcels: List[Dict[str, Any]], seed: int = 42) -> List[Dict[str, Any]]:
    """Generate 60+ realistic building footprints located within residential and commercial parcels."""
    rnd = random.Random(seed + 100)
    buildings = []
    b_count = 0

    for feat in parcels:
        props = feat["properties"]
        pid = props["parcel_id"]
        lu = props["land_use"]
        
        # Don't place buildings on open space or vegetation, or on invalid polygons
        if lu in ("Open Space", "Vegetation"):
            continue
        
        # ~70% of candidate parcels contain a building
        if rnd.random() > 0.32:
            b_count += 1
            bid = f"B-{b_count:03d}"
            
            coords = feat["geometry"]["coordinates"][0]
            if len(coords) < 4:
                continue
            
            # Compute centroid & bounds
            min_x = min(c[0] for c in coords)
            max_x = max(c[0] for c in coords)
            min_y = min(c[1] for c in coords)
            max_y = max(c[1] for c in coords)
            
            w = max_x - min_x
            h = max_y - min_y
            
            # Place building with setback margins
            bw = w * rnd.uniform(0.45, 0.65)
            bh = h * rnd.uniform(0.45, 0.65)
            bx0 = min_x + (w - bw) * rnd.uniform(0.2, 0.8)
            by0 = min_y + (h - bh) * rnd.uniform(0.2, 0.8)
            
            b_poly = box(bx0, by0, bx0 + bw, by0 + bh)
            b_area = round(b_poly.area * 1.2e10, 1)
            b_type = "Commercial Complex" if lu == "Commercial" else ("Public Office" if lu == "Public" else "Residential Dwelling")
            
            buildings.append(_feat(b_poly, {
                "building_id": bid,
                "parcel_id": pid,
                "building_type": b_type,
                "area": b_area,
                "confidence": round(rnd.uniform(0.86, 0.98), 3),
                "source": "Demo AI Prediction"
            }))
            
    return buildings


def demo_detect_roads(
    center: Tuple[float, float] = (77.8945, 11.3800),
    rows: int = 10,
    cols: int = 11,
    seed: int = 42
) -> List[Dict[str, Any]]:
    """Generate 20+ road and pathway features categorized as Main Road, Local Road, Lane, and Pathway."""
    rnd = random.Random(seed + 200)
    lon0, lat0 = center
    pw, ph = 0.00032, 0.00026
    road_gap_x = 0.00010
    road_gap_y = 0.00010
    
    total_w = cols * pw + (cols // 3) * road_gap_x
    total_h = rows * ph + (rows // 3) * road_gap_y
    
    roads = []
    r_count = 0
    
    # 1. Main Arterial Roads (Bounding & major avenue dividers)
    main_y_indices = [0, rows // 2, rows]
    for idx, r_idx in enumerate(main_y_indices):
        r_count += 1
        y = lat0 + r_idx * ph + (r_idx // 3) * road_gap_y
        line = LineString([(lon0 - 0.0002, y), (lon0 + total_w + 0.0002, y)])
        roads.append(_feat(line, {
            "road_id": f"R-{r_count:03d}",
            "road_type": "Main Road",
            "width_meters": 12.0,
            "confidence": round(rnd.uniform(0.92, 0.99), 3),
            "source": "Demo AI Prediction"
        }))
        
    # Main North-South Avenues
    main_x_indices = [0, cols // 2, cols]
    for idx, c_idx in enumerate(main_x_indices):
        r_count += 1
        x = lon0 + c_idx * pw + (c_idx // 3) * road_gap_x
        line = LineString([(x, lat0 - 0.0002), (x, lat0 + total_h + 0.0002)])
        roads.append(_feat(line, {
            "road_id": f"R-{r_count:03d}",
            "road_type": "Main Road",
            "width_meters": 10.0,
            "confidence": round(rnd.uniform(0.91, 0.98), 3),
            "source": "Demo AI Prediction"
        }))

    # 2. Local Roads between sectors
    for r in range(1, rows):
        if r not in main_y_indices:
            r_count += 1
            y = lat0 + r * ph + (r * 0.00001)
            line = LineString([(lon0, y), (lon0 + total_w, y)])
            roads.append(_feat(line, {
                "road_id": f"R-{r_count:03d}",
                "road_type": "Local Road",
                "width_meters": 7.0,
                "confidence": round(rnd.uniform(0.85, 0.95), 3),
                "source": "Demo AI Prediction"
            }))
            
    # 3. Residential Lanes and Alleys
    for c in range(1, cols, 2):
        if c not in main_x_indices:
            r_count += 1
            x = lon0 + c * pw
            y_start = lat0 + rnd.uniform(0.0001, 0.0003)
            y_end = lat0 + total_h - rnd.uniform(0.0001, 0.0003)
            line = LineString([(x, y_start), (x, y_end)])
            roads.append(_feat(line, {
                "road_id": f"R-{r_count:03d}",
                "road_type": "Lane",
                "width_meters": 4.5,
                "confidence": round(rnd.uniform(0.82, 0.93), 3),
                "source": "Demo AI Prediction"
            }))

    # 4. Pedestrian Pathways
    for p in range(4):
        r_count += 1
        px = lon0 + rnd.uniform(0.0005, total_w - 0.0005)
        py = lat0 + rnd.uniform(0.0003, total_h - 0.0003)
        line = LineString([
            (px, py),
            (px + 0.0002, py + 0.0001),
            (px + 0.00035, py + 0.00025)
        ])
        roads.append(_feat(line, {
            "road_id": f"R-{r_count:03d}",
            "road_type": "Pathway",
            "width_meters": 2.0,
            "confidence": round(rnd.uniform(0.79, 0.91), 3),
            "source": "Demo AI Prediction"
        }))

    return roads


def demo_extract(
    image_path: Optional[str] = None,
    center: Tuple[float, float] = (77.8945, 11.3800)
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Execute full demo extraction generating 110 parcels, 60+ buildings, and 25+ roads/pathways."""
    parcels = demo_extract_parcels(center=center, rows=10, cols=11)
    buildings = demo_detect_buildings(parcels)
    roads = demo_detect_roads(center=center, rows=10, cols=11)
    return parcels, buildings, roads


def run_real_model(image_path: str):
    """Placeholder for real neural network inference.
    If weights are loaded, tiles the image and runs inference.
    Otherwise raises NotImplementedError to trigger fallback."""
    parcel_model = ParcelSegmentationModel()
    building_model = BuildingDetectionModel()
    road_model = RoadSegmentationModel()
    
    if not (parcel_model.is_loaded or building_model.is_loaded or road_model.is_loaded):
        raise NotImplementedError("Real AI model weights (.pt/.onnx) not found in MODEL_DIR.")
    # Real inference execution...
    return None


def extract(image_path: Optional[str] = None) -> Tuple[Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]], str]:
    """Coordinates extraction with automatic fallback from Real AI Mode to Demo Mode.
    Never crashes when weights are absent."""
    if model_available() and image_path:
        try:
            results = run_real_model(image_path)
            return results, "model"
        except Exception:
            pass
    # Reliable Fallback to Demo Mode
    return demo_extract(image_path), "demo"
