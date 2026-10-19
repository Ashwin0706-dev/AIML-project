import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

try:
    from app.ai_engine import demo_extract  # type: ignore[import-not-found]
    from app.topology import validate  # type: ignore[import-not-found]
except ImportError:
    from backend.app.ai_engine import demo_extract  # type: ignore[import-not-found]
    from backend.app.topology import validate  # type: ignore[import-not-found]


def test_demo_has_issues():
    parcels, _, _ = demo_extract()
    v, issues = validate(parcels)
    assert v["overlaps"] >= 1 and v["invalid_geometries"] >= 1
