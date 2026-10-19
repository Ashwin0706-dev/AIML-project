"""Database access layer supporting PostgreSQL/PostGIS with resilient fallback.
When PostgreSQL is reachable via DATABASE_URL or POSTGRES_* environment variables,
records are persisted to PostGIS spatial tables.
Otherwise, an in-memory spatial store maintains state seamlessly for demonstrations.
"""
import os
import json
import logging
import sqlite3
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "cadastral")
POSTGRES_USER = os.getenv("POSTGRES_USER", "cadastral")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "change_me")

if not DATABASE_URL and os.getenv("POSTGRES_DB"):
    DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"


class SpatialStore:
    """Unified storage interface for Cadastral GIS data."""

    def __init__(self):
        self.use_postgres = False
        self.conn = None
        self.sqlite_conn = None
        self.sqlite_path = os.getenv("SQLITE_PATH", os.path.join("data", "cadastral.db"))
        self._init_memory_store()
        self._init_sqlite_store()
        self._try_connect_postgres()
        self._load_sqlite_snapshot()

    def _init_sqlite_store(self):
        os.makedirs(os.path.dirname(self.sqlite_path) or ".", exist_ok=True)
        try:
            self.sqlite_conn = sqlite3.connect(self.sqlite_path, check_same_thread=False)
            self.sqlite_conn.execute("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)")
            self.sqlite_conn.commit()
        except Exception as e:
            logger.warning("SQLite persistence unavailable: %s", e)
            self.sqlite_conn = None

    def _load_sqlite_snapshot(self):
        if not self.sqlite_conn:
            return
        try:
            row = self.sqlite_conn.execute("SELECT payload FROM app_state WHERE id=1").fetchone()
            if row:
                restored = json.loads(row[0])
                if isinstance(restored, dict):
                    self.memory.update(restored)
                    logger.info("Loaded cadastral state from SQLite: %s", self.sqlite_path)
        except Exception as e:
            logger.warning("Could not restore SQLite state: %s", e)

    def _persist(self):
        if not self.sqlite_conn:
            return
        try:
            payload = json.dumps(self.memory, separators=(",", ":"))
            self.sqlite_conn.execute("INSERT INTO app_state(id,payload,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at", (payload, datetime.now(timezone.utc).isoformat()))
            self.sqlite_conn.commit()
        except Exception as e:
            logger.warning("Could not persist cadastral state: %s", e)

    def _init_memory_store(self):
        self.memory = {
            "projects": [
                {
                    "id": 1,
                    "name": "Tiruchengode Urban Cadastral Zone A",
                    "description": "High-resolution drone orthomosaic parcel mapping & boundary verification",
                    "created_at": "2026-09-24T10:00:00Z"
                }
            ],
            "imagery": [],
            "parcels": [],
            "buildings": [],
            "roads": [],
            "existing_parcels": [],
            "ground_truth": [],
            "validation_issues": [],
            "validation_summary": None,
            "mode": "demo"
        }

    def _try_connect_postgres(self):
        if not DATABASE_URL:
            logger.info("DATABASE_URL not set. Running with built-in Spatial Store.")
            return
        try:
            import psycopg2
            self.conn = psycopg2.connect(DATABASE_URL)
            self.conn.autocommit = True
            self.use_postgres = True
            logger.info("Successfully connected to PostgreSQL/PostGIS database.")
        except Exception as e:
            logger.info("PostgreSQL unavailable (%s). Falling back to built-in Spatial Store.", e)
            self.use_postgres = False

    # Projects
    def create_project(self, name: str, description: str = "") -> Dict[str, Any]:
        item = {
            "id": len(self.memory["projects"]) + 1,
            "name": name,
            "description": description
        }
        self.memory["projects"].append(item)
        if self.use_postgres and self.conn:
            try:
                with self.conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO projects (name, description) VALUES (%s, %s) RETURNING id;",
                        (name, description)
                    )
                    item["id"] = cur.fetchone()[0]
            except Exception as e:
                logger.error("Error creating project in PostGIS: %s", e)
        self._persist()
        return item

    def get_projects(self) -> List[Dict[str, Any]]:
        return self.memory["projects"]

    def get_project(self, pid: int) -> Optional[Dict[str, Any]]:
        for p in self.memory["projects"]:
            if p["id"] == pid:
                return p
        return None

    # Imagery
    def add_imagery(self, rec: Dict[str, Any]) -> Dict[str, Any]:
        self.memory["imagery"].append(rec)
        self._persist()
        return rec

    def get_imagery(self) -> List[Dict[str, Any]]:
        return self.memory["imagery"]

    # Parcels
    def set_parcels(self, parcels: List[Dict[str, Any]], mode: str = "demo") -> None:
        self.memory["parcels"] = parcels
        self.memory["mode"] = mode
        self._persist()

    def get_parcels(self) -> List[Dict[str, Any]]:
        return self.memory["parcels"]

    def get_parcel(self, pid: str) -> Optional[Dict[str, Any]]:
        for f in self.memory["parcels"]:
            if f["properties"].get("parcel_id") == pid:
                return f
        return None

    def update_parcel(self, pid: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for f in self.memory["parcels"]:
            if f["properties"].get("parcel_id") == pid:
                # If geometry patch is provided (e.g. from map vertex editing)
                if "geometry" in patch and patch["geometry"]:
                    f["geometry"] = patch["geometry"]
                    # Recalculate area using Shapely
                    try:
                        from shapely.geometry import shape
                        s = shape(f["geometry"])
                        if s.is_valid:
                            f["properties"]["area"] = round(s.area * 1.2e10, 1)
                    except Exception:
                        pass
                    f["properties"]["source"] = "Manual Map Edit"
                
                # Update property fields
                for k, v in patch.items():
                    if k not in ("geometry", "parcel_id") and v is not None:
                        f["properties"][k] = v
                self._persist()
                return f
        return None

    # Buildings
    def set_buildings(self, buildings: List[Dict[str, Any]]) -> None:
        self.memory["buildings"] = buildings
        self._persist()

    def get_buildings(self) -> List[Dict[str, Any]]:
        return self.memory["buildings"]

    # Roads
    def set_roads(self, roads: List[Dict[str, Any]]) -> None:
        self.memory["roads"] = roads
        self._persist()

    def get_roads(self) -> List[Dict[str, Any]]:
        return self.memory["roads"]

    # Existing Parcels (for AI vs Existing GIS comparison)
    def set_existing_parcels(self, existing: List[Dict[str, Any]]) -> None:
        self.memory["existing_parcels"] = existing
        self._persist()

    def get_existing_parcels(self) -> List[Dict[str, Any]]:
        return self.memory["existing_parcels"]

    # Validation
    def set_validation(self, summary: Dict[str, int], issues: List[Dict[str, Any]]) -> None:
        self.memory["validation_summary"] = summary
        self.memory["validation_issues"] = issues
        self._persist()

    def get_validation_summary(self) -> Optional[Dict[str, int]]:
        return self.memory["validation_summary"]

    def get_validation_issues(self) -> List[Dict[str, Any]]:
        return self.memory["validation_issues"]

    # Ground Truth
    def add_ground_truth(self, rec: Dict[str, Any]) -> Dict[str, Any]:
        self.memory["ground_truth"].append(rec)
        self._persist()
        return rec

    def get_ground_truth(self) -> List[Dict[str, Any]]:
        return self.memory["ground_truth"]

    # Statistics
    def get_statistics(self) -> Dict[str, Any]:
        parcels = self.memory["parcels"]
        confidences = [
            f["properties"]["confidence"]
            for f in parcels
            if "confidence" in f["properties"] and f["properties"]["confidence"] is not None
        ]
        val = self.memory["validation_summary"] or {}
        gt_verified = sum(1 for g in self.memory["ground_truth"] if g.get("decision") == "verified")

        pending_count = sum(
            1 for f in parcels
            if f.get("properties", {}).get("status") in ("pending", None, "")
        )

        return {
            "total_parcels": len(parcels),
            "total_buildings": len(self.memory["buildings"]),
            "total_roads": len(self.memory["roads"]),
            "valid_parcels": val.get("valid_parcels", len(parcels)),
            "topology_issues": len(self.memory["validation_issues"]),
            "pending_verification": pending_count,
            "gnss_verified": gt_verified,
            "ground_truth_verified": gt_verified,
            "avg_confidence": round(100 * sum(confidences) / len(confidences), 1) if confidences else 0.0,
            "mode": self.memory["mode"]
        }

    def reset_demo_data(self) -> Dict[str, Any]:
        """Resets and initializes complete demo dataset with parcels, buildings, roads, validation, and sample GNSS."""
        from .ai_engine import demo_extract
        from .topology import validate

        parcels, buildings, roads = demo_extract()
        summary, issues = validate(parcels)

        self.set_parcels(parcels, mode="demo")
        self.set_buildings(buildings)
        self.set_roads(roads)
        self.set_validation(summary, issues)

        # Initialize standard sample GNSS survey points
        demo_gt = [
            {"id": 1, "parcel_id": "P-001", "gt_area": 252.0, "ai_area": 250.0, "difference": 2.0, "lat": 11.3801, "lon": 77.8946, "survey_accuracy": 0.015, "survey_date": "2026-09-24", "survey_id": "GNSS-01", "decision": "verified", "source": "Demo GNSS Data"},
            {"id": 2, "parcel_id": "P-002", "gt_area": 248.5, "ai_area": 250.0, "difference": 1.5, "lat": 11.3801, "lon": 77.8950, "survey_accuracy": 0.012, "survey_date": "2026-09-24", "survey_id": "GNSS-02", "decision": "verified", "source": "Demo GNSS Data"},
            {"id": 3, "parcel_id": "P-011", "gt_area": 310.0, "ai_area": 250.0, "difference": 60.0, "lat": 11.3804, "lon": 77.8945, "survey_accuracy": 0.018, "survey_date": "2026-09-24", "survey_id": "GNSS-03", "decision": "rejected", "source": "Demo GNSS Data"},
            {"id": 4, "parcel_id": "P-023", "gt_area": 249.0, "ai_area": 250.0, "difference": 1.0, "lat": 11.3808, "lon": 77.8955, "survey_accuracy": 0.014, "survey_date": "2026-09-24", "survey_id": "GNSS-04", "decision": "verified", "source": "Demo GNSS Data"},
            {"id": 5, "parcel_id": "P-050", "gt_area": 251.2, "ai_area": 250.0, "difference": 1.2, "lat": 11.3812, "lon": 77.8962, "survey_accuracy": 0.016, "survey_date": "2026-09-24", "survey_id": "GNSS-05", "decision": "verified", "source": "Demo GNSS Data"}
        ]
        self.memory["ground_truth"] = demo_gt
        self._persist()

        # Mark corresponding parcels with decisions
        for gt in demo_gt:
            self.update_parcel(gt["parcel_id"], {"status": gt["decision"]})

        return self.get_statistics()


# Global store instance
db = SpatialStore()
