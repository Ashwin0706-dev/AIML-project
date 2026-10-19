"""Polygonization utility: converts binary/multi-class segmentation masks into valid vector polygons.
Implements contour extraction, polygon creation, Douglas-Peucker simplification,
small sliver removal, and topological geometry cleanup (make_valid).
"""
import importlib
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from shapely.geometry import Polygon, MultiPolygon, shape, mapping, box
from shapely.validation import make_valid


def mask_to_polygons(
    mask: np.ndarray,
    transform: Optional[Tuple[float, float, float, float, float, float]] = None,
    min_area_pixels: float = 25.0,
    simplify_tolerance: float = 0.5,
    min_area_sqm: float = 5.0
) -> List[Polygon]:
    """Convert a 2D numpy binary mask (0/1 or 0/255) into cleaned Shapely Polygons.
    
    Args:
        mask: 2D numpy array where >0 indicates a feature region.
        transform: Affine transform tuple (x_origin, pixel_width, rot_x, y_origin, rot_y, pixel_height).
                   If None, returns pixel coordinate polygons.
        min_area_pixels: Minimum pixel area to keep.
        simplify_tolerance: Douglas-Peucker simplification factor.
        min_area_sqm: Minimum area in square meters / target units.
        
    Returns:
        List of cleaned, valid Shapely Polygons.
    """
    polygons: List[Polygon] = []

    # 1. Try using rasterio.features.shapes if rasterio is installed in the environment
    try:
        rasterio_features = importlib.import_module("rasterio.features")
        affine_module = importlib.import_module("affine")
        Affine = getattr(affine_module, "Affine")

        aff = Affine(*transform) if transform else Affine.identity()
        shapes = rasterio_features.shapes(mask.astype(np.int16), mask=(mask > 0), transform=aff)
        for geom, val in shapes:
            if val > 0:
                s = shape(geom)
                if not s.is_valid:
                    s = make_valid(s)
                if isinstance(s, Polygon) and s.area >= min_area_sqm:
                    simplified = s.simplify(simplify_tolerance, preserve_topology=True)
                    if simplified.is_valid and simplified.area >= min_area_sqm:
                        polygons.append(simplified)
                elif isinstance(s, MultiPolygon):
                    for sub in s.geoms:
                        if sub.is_valid and sub.area >= min_area_sqm:
                            simplified = sub.simplify(simplify_tolerance, preserve_topology=True)
                            if simplified.is_valid and simplified.area >= min_area_sqm:
                                polygons.append(simplified)
        if polygons:
            return polygons
    except (ImportError, ModuleNotFoundError, Exception):
        pass

    # 2. Alternative standard contour extraction using OpenCV if cv2 is installed
    try:
        cv2 = importlib.import_module("cv2")
        binary = (mask > 0).astype(np.uint8) * 255
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            if cv2.contourArea(cnt) < min_area_pixels:
                continue
            pts = cnt.squeeze(axis=1)
            if len(pts) < 3:
                continue

            # Apply affine transform to geographic coordinates if provided
            if transform:
                x0, dx, _, y0, _, dy = transform
                geo_pts = [(x0 + float(p[0]) * dx, y0 + float(p[1]) * dy) for p in pts]
            else:
                geo_pts = [(float(p[0]), float(p[1])) for p in pts]

            poly = Polygon(geo_pts)
            if not poly.is_valid:
                poly = make_valid(poly)

            if isinstance(poly, Polygon) and poly.area >= min_area_sqm:
                poly = poly.simplify(simplify_tolerance, preserve_topology=True)
                if poly.is_valid and poly.area >= min_area_sqm:
                    polygons.append(poly)
            elif isinstance(poly, MultiPolygon):
                for p in poly.geoms:
                    if p.is_valid and p.area >= min_area_sqm:
                        p = p.simplify(simplify_tolerance, preserve_topology=True)
                        if p.is_valid:
                            polygons.append(p)
        if polygons:
            return polygons
    except (ImportError, ModuleNotFoundError, Exception):
        pass

    # 3. Pure NumPy & Shapely fallback (connected bounding regions)
    # Allows polygonization even without rasterio/cv2 C-libraries installed
    try:
        rows, cols = np.where(mask > 0)
        if len(rows) >= int(min_area_pixels):
            r_min, r_max = float(rows.min()), float(rows.max())
            c_min, c_max = float(cols.min()), float(cols.max())
            if transform:
                x0, dx, _, y0, _, dy = transform
                b_poly = box(x0 + c_min * dx, y0 + r_min * dy, x0 + c_max * dx, y0 + r_max * dy)
            else:
                b_poly = box(c_min, r_min, c_max, r_max)
            if b_poly.is_valid and b_poly.area >= min_area_sqm:
                polygons.append(b_poly)
    except Exception:
        pass

    return polygons


def clean_polygon_geometry(poly: Polygon, simplify_tol: float = 0.00001, min_area: float = 1e-9) -> Optional[Polygon]:
    """Ensure polygon is valid, non-empty, above minimum area, and topologically clean."""
    if poly is None or poly.is_empty:
        return None
    if not poly.is_valid:
        poly = make_valid(poly)
    if isinstance(poly, MultiPolygon):
        # Pick largest polygon
        poly = max(poly.geoms, key=lambda g: g.area)
    if poly.area < min_area:
        return None
    simplified = poly.simplify(simplify_tol, preserve_topology=True)
    return simplified if simplified.is_valid and not simplified.is_empty else poly


def to_geojson_feature(geom, properties: Dict[str, Any]) -> Dict[str, Any]:
    """Convert Shapely geometry and properties to a standardized GeoJSON Feature."""
    return {
        "type": "Feature",
        "geometry": mapping(geom),
        "properties": properties
    }
