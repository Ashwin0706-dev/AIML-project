"""Download a Kaggle aerial-imagery dataset for training. Run locally (needs Kaggle API token).
Setup: pip install kaggle; put kaggle.json in ~/.kaggle (or set KAGGLE_USERNAME / KAGGLE_KEY).
Usage: python ai/datasets/download_kaggle.py [owner/dataset-slug]
Verify the slug on kaggle.com before use; suitable datasets: aerial roads, building footprints, land-cover."""
import subprocess, sys, os
slug = sys.argv[1] if len(sys.argv) > 1 else os.getenv("KAGGLE_DATASET", "balraj98/massachusetts-roads-dataset")
out = os.path.join(os.path.dirname(__file__), "raw", "drone")
os.makedirs(out, exist_ok=True)
subprocess.run(["kaggle", "datasets", "download", "-d", slug, "-p", out, "--unzip"], check=True)
print("Downloaded", slug, "->", out)
