CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imagery (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    filename TEXT,
    elevation_type TEXT,
    footprint GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parcels (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    parcel_id TEXT UNIQUE,
    land_use TEXT,
    area DOUBLE PRECISION,
    confidence REAL,
    source TEXT,
    status TEXT DEFAULT 'pending',
    geom GEOMETRY(Polygon, 4326)
);

CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    building_id TEXT UNIQUE,
    building_type TEXT,
    confidence REAL,
    geom GEOMETRY(Polygon, 4326)
);

CREATE TABLE IF NOT EXISTS roads (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    road_id TEXT UNIQUE,
    road_type TEXT,
    confidence REAL,
    geom GEOMETRY(LineString, 4326)
);

CREATE TABLE IF NOT EXISTS ground_truth (
    id SERIAL PRIMARY KEY,
    parcel_id TEXT,
    gt_area DOUBLE PRECISION,
    decision TEXT,
    survey_accuracy REAL DEFAULT 0.02,
    survey_date TEXT,
    survey_id TEXT,
    geom GEOMETRY(Point, 4326)
);

CREATE TABLE IF NOT EXISTS validation_errors (
    id SERIAL PRIMARY KEY,
    feature_id TEXT,
    issue_type TEXT,
    severity TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    geom GEOMETRY(Geometry, 4326)
);

CREATE TABLE IF NOT EXISTS existing_parcels (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    parcel_id TEXT,
    owner_name TEXT,
    recorded_area DOUBLE PRECISION,
    geom GEOMETRY(Polygon, 4326)
);

CREATE INDEX IF NOT EXISTS idx_parcels_geom ON parcels USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_buildings_geom ON buildings USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_ground_truth_geom ON ground_truth USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_validation_errors_geom ON validation_errors USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_existing_parcels_geom ON existing_parcels USING GIST(geom);
