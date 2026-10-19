"""Comprehensive integration tests for Cadastral Mapping API."""
import sys
import os
from io import BytesIO
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
try:
    from app.main import app  # type: ignore[import-not-found]
except ImportError:
    from backend.app.main import app  # type: ignore[import-not-found]

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_image_upload_and_validation():
    # Valid file upload
    file_content = b"SIMULATED_GEOTIFF_DATA_FOR_DRONE_SURVEY"
    response = client.post(
        "/api/imagery/upload",
        files={"file": ("test_drone.tif", BytesIO(file_content), "image/tiff")},
        data={"project_id": "1"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["filename"] == "test_drone.tif"
    assert data["type"] == "GeoTIFF"
    assert "bounds" in data

    # Invalid extension rejection
    bad_resp = client.post(
        "/api/imagery/upload",
        files={"file": ("malicious.exe", BytesIO(b"bad"), "application/octet-stream")}
    )
    assert bad_resp.status_code == 400


def test_elevation_upload():
    response = client.post(
        "/api/imagery/upload-elevation",
        files={"file": ("elevation_dsm.tif", BytesIO(b"DSM_DATA"), "image/tiff")},
        data={"elevation_type": "DSM", "project_id": "1"}
    )
    assert response.status_code == 200
    assert response.json()["type"] == "DSM"


def test_ai_segmentation_pipeline():
    response = client.post("/api/ai/segment")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["mode"] == "demo"
    assert data["parcels"] >= 100
    assert data["buildings"] >= 50
    assert data["roads"] >= 20
    assert "validation" in data
    assert data["validation"]["overlaps"] >= 1
    assert data["validation"]["invalid_geometries"] >= 1


def test_topology_validation_endpoint():
    response = client.post("/api/topology/validate")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    summary = data["summary"]
    assert summary["valid_parcels"] > 50
    assert summary["overlaps"] >= 1
    assert summary["invalid_geometries"] >= 1

    issues_resp = client.get("/api/validation/issues")
    assert issues_resp.status_code == 200
    issues = issues_resp.json()
    assert len(issues) > 0
    # Every issue has proper fields
    first = issues[0]
    assert "issue_id" in first
    assert "feature_id" in first
    assert "issue_type" in first
    assert "severity" in first
    assert "status" in first


def test_parcel_editing_geometry_and_topology_recheck():
    # Fetch parcel P-020 (which is an intentional bow-tie)
    p_resp = client.get("/api/parcels/P-020")
    assert p_resp.status_code == 200
    
    # Fix the geometry of P-020 with a clean rectangle
    fixed_geom = {
        "type": "Polygon",
        "coordinates": [
            [
                [77.8945, 11.3800],
                [77.8948, 11.3800],
                [77.8948, 11.3803],
                [77.8945, 11.3803],
                [77.8945, 11.3800]
            ]
        ]
    }
    edit_resp = client.put(
        "/api/parcels/P-020",
        json={"geometry": fixed_geom, "land_use": "Residential", "status": "verified"}
    )
    assert edit_resp.status_code == 200
    data = edit_resp.json()
    assert data["success"] is True
    assert data["parcel"]["properties"]["source"] == "Manual Map Edit"
    assert data["parcel"]["properties"]["status"] == "verified"
    # Verification that topology was re-checked
    assert "validation" in data


def test_ground_truth_workflow():
    gt_payload = {
        "parcel_id": "P-001",
        "gt_area": 255.0,
        "lat": 11.3801,
        "lon": 77.8946,
        "survey_accuracy": 0.015,
        "survey_id": "GNSS-CORS-01",
        "decision": "verified"
    }
    response = client.post("/api/ground-truth", json=gt_payload)
    assert response.status_code == 201
    rec = response.json()["record"]
    assert rec["parcel_id"] == "P-001"
    assert "difference" in rec
    assert rec["source"] == "Demo GNSS Data"

    # Verify parcel status updated
    p = client.get("/api/parcels/P-001").json()
    assert p["properties"]["status"] == "verified"


def test_existing_gis_comparison():
    response = client.get("/api/gis/comparison")
    assert response.status_code == 200
    data = response.json()
    assert "comparisons" in data
    assert len(data["comparisons"]) > 0
    first = data["comparisons"][0]
    assert "ai_parcel_id" in first
    assert "overlap_percentage" in first
    assert "difference_sqm" in first


def test_export_geojson():
    for layer in ["parcels", "buildings", "roads"]:
        response = client.get(f"/api/export/geojson?layer={layer}")
        assert response.status_code == 200
        geojson = response.json()
        assert geojson["type"] == "FeatureCollection"
        assert len(geojson["features"]) > 0


def test_system_status():
    response = client.get("/api/system/status")
    assert response.status_code == 200
    data = response.json()
    assert "backend" in data
    assert "ai_engine" in data
    assert "gis_engine" in data
    assert "database" in data
    assert data["backend"]["status"] == "connected"


def test_model_evaluation():
    response = client.get("/api/model/evaluation")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Not evaluated"
    assert "metrics" in data


def test_demo_load_and_survey_report():
    load_resp = client.post("/api/demo/load")
    assert load_resp.status_code == 200
    stats = load_resp.json()["statistics"]
    assert stats["total_parcels"] > 0

    rep_resp = client.get("/api/survey-report")
    assert rep_resp.status_code == 200
    rep = rep_resp.json()
    assert "AI URBAN CADASTRAL MAPPING REPORT" in rep["title"]
    assert "inventory" in rep
    assert "topology_summary" in rep
    assert "gnss_verification_summary" in rep


def test_sample_orthophoto():
    response = client.get("/api/imagery/sample-orthophoto")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"

