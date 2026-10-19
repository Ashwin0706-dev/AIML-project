# Three Synthetic Datasets

This folder contains three separate paired image/label datasets generated procedurally for development and baseline experiments.

## Datasets
1. `parcel_boundaries/` — aerial-style RGB tiles and parcel-boundary masks.
2. `building_footprints/` — aerial-style RGB tiles and building-footprint masks.
3. `road_extraction/` — aerial-style RGB tiles and road masks.

Each dataset contains 60 paired 256×256 samples: 42 train, 9 validation, 9 test. `manifest.csv` lists all pairs and splits. Masks use grayscale values 0 (background) and 255 (target class).

## Important limitation
These are **synthetic demo/training-pipeline datasets**, not authentic drone survey imagery. They are useful for testing data loaders and segmentation training code, but models trained only on these samples should not be presented as validated for real-world cadastral extraction. For real performance, add verified orthophotos and matching surveyed labels.
