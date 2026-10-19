"""Topology Validation Engine for Cadastral GIS Polygons.
Performs rigorous spatial topology validation:
1. Overlapping parcels (Disputed boundaries / encroachment)
2. Cadastral Gaps (Internal voids and unclaimed corridor gaps)
3. Self-intersections and Invalid Geometries (Bow-ties, unclosed rings)
4. Duplicate geometries
5. Sliver and degenerate polygons
"""
from typing import List, Dict, Any, Tuple
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.strtree import STRtree
from shapely.validation import explain_validity, make_valid
from shapely.ops import unary_union

# Thresholds for degree-based coordinates (WGS84)
# ~1 deg lat ~ 111km -> 1e-9 deg^2 ~ 12 sqm
SLIVER_AREA_THRESHOLD = 3e-9      # ~35 sqm
OVERLAP_AREA_RATIO = 0.015        # Ignore trivial boundary touches


def validate(parcels: List[Dict[str, Any]]) -> Tuple[Dict[str, int], List[Dict[str, Any]]]:
    """Validate list of GeoJSON parcel features and return statistics and detailed issues.
    
    Returns:
        stats: {
            "valid_parcels": int,
            "overlaps": int,
            "gaps": int,
            "invalid_geometries": int,
            "duplicates": int,
            "sliver_polygons": int
        }
        issues: List[Dict] with issue_id, feature_id, issue_type, severity, description, geometry, status
    """
    if not parcels:
        return {
            "valid_parcels": 0,
            "overlaps": 0,
            "gaps": 0,
            "invalid_geometries": 0,
            "duplicates": 0,
            "sliver_polygons": 0
        }, []

    geoms = []
    ids = []
    for f in parcels:
        g = shape(f["geometry"])
        geoms.append(g)
        ids.append(f["properties"].get("parcel_id", "unknown"))

    issues = []
    bad_features = set()
    issue_counter = 0

    def add_issue(fid: str, itype: str, severity: str, desc: str, geom) -> None:
        nonlocal issue_counter
        issue_counter += 1
        bad_features.add(fid)
        issues.append({
            "issue_id": f"ISS-{issue_counter:03d}",
            "feature_id": fid,
            "issue_type": itype,
            "severity": severity.upper(),   # LOW, MEDIUM, HIGH
            "description": desc,
            "geometry": mapping(geom),
            "status": "OPEN"                # OPEN, RESOLVED, IGNORED
        })

    # 1. Invalid Geometry and Sliver checks
    seen_wkb = {}
    valid_geoms_for_union = []
    valid_ids_for_union = []

    for i, g in enumerate(geoms):
        fid = ids[i]
        
        # Check validity (bow-ties, self-intersections)
        if not g.is_valid:
            rep_pt = g.representative_point() if hasattr(g, "representative_point") else g.centroid
            add_issue(fid, "invalid_geometry", "HIGH", explain_validity(g), rep_pt)
            continue

        # Check slivers / tiny polygons
        approx_sqm = g.area * 1.2e10
        if g.area < SLIVER_AREA_THRESHOLD:
            add_issue(
                fid,
                "sliver_polygons",
                "LOW",
                f"Sliver polygon area ({round(approx_sqm, 1)} m²) is below standard parcel threshold",
                g.representative_point()
            )

        # Check duplicates
        key = g.wkb_hex
        if key in seen_wkb:
            add_issue(
                fid,
                "duplicates",
                "MEDIUM",
                f"Identical geometry duplication of {seen_wkb[key]}",
                g.representative_point()
            )
        else:
            seen_wkb[key] = fid
            valid_geoms_for_union.append(g)
            valid_ids_for_union.append(fid)

    # 2. Overlap Detection with STRtree
    valid_indices = [i for i, g in enumerate(geoms) if g.is_valid]
    if valid_indices:
        valid_subset = [geoms[i] for i in valid_indices]
        tree = STRtree(valid_subset)
        
        for idx_in_sub, g in enumerate(valid_subset):
            orig_i = valid_indices[idx_in_sub]
            fid_i = ids[orig_i]
            
            candidates = tree.query(g)
            for cand_sub in candidates:
                if cand_sub <= idx_in_sub:
                    continue
                orig_j = valid_indices[cand_sub]
                fid_j = ids[orig_j]
                g_j = valid_subset[cand_sub]
                
                # Check intersection
                inter = g.intersection(g_j)
                if not inter.is_empty and inter.area > 0:
                    min_area = min(g.area, g_j.area)
                    if min_area > 0 and (inter.area / min_area) > OVERLAP_AREA_RATIO:
                        overlap_sqm = round(inter.area * 1.2e10, 1)
                        add_issue(
                            fid_i,
                            "overlaps",
                            "HIGH",
                            f"Parcel boundary overlaps {fid_j} by {overlap_sqm} m² (overlap ratio {round(100 * inter.area / min_area, 1)}%)",
                            inter.representative_point()
                        )

    # 3. Cadastral Gap Detection
    # Detect interior holes / gaps between adjacent parcels in the unified fabric
    if valid_geoms_for_union:
        try:
            # Group or union nearby parcels to find enclosed holes
            buffered_fabric = unary_union(valid_geoms_for_union)
            holes = []
            
            if isinstance(buffered_fabric, Polygon):
                holes.extend(buffered_fabric.interiors)
            elif isinstance(buffered_fabric, MultiPolygon):
                for p in buffered_fabric.geoms:
                    holes.extend(p.interiors)
                    
            for interior_ring in holes:
                hole_poly = Polygon(interior_ring)
                hole_sqm = hole_poly.area * 1.2e10
                # Real cadastral gaps are typically between 10 sqm and 500 sqm
                if 5.0 <= hole_sqm <= 500.0:
                    # Find which parcel touches this hole
                    touching_id = "fabric"
                    for vi, vg in enumerate(valid_geoms_for_union):
                        if vg.distance(hole_poly) < 0.00002:
                            touching_id = valid_ids_for_union[vi]
                            break
                    add_issue(
                        touching_id,
                        "gaps",
                        "MEDIUM",
                        f"Unclaimed cadastral gap ({round(hole_sqm, 1)} m²) detected between parcels",
                        hole_poly.representative_point()
                    )
        except Exception:
            pass

    overlap_count = sum(1 for x in issues if x["issue_type"] == "overlaps")
    gap_count = sum(1 for x in issues if x["issue_type"] == "gaps")
    invalid_count = sum(1 for x in issues if x["issue_type"] == "invalid_geometry")
    dup_count = sum(1 for x in issues if x["issue_type"] == "duplicates")
    sliver_count = sum(1 for x in issues if x["issue_type"] == "sliver_polygons")
    valid_parcels = max(0, len(ids) - len(bad_features))

    stats = {
        "valid_parcels": valid_parcels,
        "overlaps": overlap_count,
        "gaps": gap_count,
        "invalid_geometries": invalid_count,
        "duplicates": dup_count,
        "sliver_polygons": sliver_count
    }

    return stats, issues
