# Parcel boundary segmentation — Synthetic Dataset

White pixels (255) mark synthetic cadastral boundary lines; black pixels (0) are background.

- Images: 60 RGB PNG tiles, each 256×256.
- Masks: 60 single-channel PNG labels, pixel-aligned with the corresponding image.
- Split: 42 train, 9 validation, 9 test.
- Generated procedurally for this project; **not real drone imagery and not a substitute for surveyed ground truth**.
- Image/mask pairs share the same filename stem.
