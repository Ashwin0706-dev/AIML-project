from pathlib import Path
from PIL import Image
import csv

ROOT = Path(__file__).resolve().parents[2] / "data" / "synthetic_datasets"
manifest = ROOT / "manifest.csv"
with manifest.open(newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
print(f"Manifest: {manifest}")
print(f"Total pairs: {len(rows)}")
for dataset in sorted({r["dataset"] for r in rows}):
    group = [r for r in rows if r["dataset"] == dataset]
    print(f"\n{dataset}: {len(group)} pairs")
    for split in ("train", "val", "test"):
        print(f"  {split}: {sum(r["split"] == split for r in group)}")
    bad = []
    for r in group:
        ip, mp = ROOT / dataset / r["image"], ROOT / dataset / r["mask"]
        if not ip.exists() or not mp.exists(): bad.append((str(ip), str(mp))); continue
        with Image.open(ip) as im, Image.open(mp) as ma:
            if im.size != ma.size: bad.append((str(ip), "size mismatch"))
    print("  Pair check:", "OK" if not bad else f"FAILED ({len(bad)} issues)")
