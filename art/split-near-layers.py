"""Extract soft-masked performance layers from the existing near-ghost artwork.

Does not repaint the subject: all output pixels are from ghost-near.png.
The three layers composite back to the source when perfectly aligned.
Run: python3 art/split-near-layers.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "public/assets/ghost-near.png"
image = Image.open(source).convert("RGBA")
width, height = image.size


def soft_ellipse(bounds, blur):
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).ellipse(bounds, fill=255)
    return np.asarray(mask.filter(ImageFilter.GaussianBlur(blur)), dtype=np.float32) / 255


# Deliberately small soft masks; moving the whole silhouette looks like a flat poster.
head = soft_ellipse((300, 20, 706, 490), 24)
hand = soft_ellipse((234, 306, 491, 580), 18) * (1.0 - head)
body = (1.0 - head) * (1.0 - hand)

rgba = np.array(image, dtype=np.uint8)
for name, mask in [("body", body), ("head", head), ("hand", hand)]:
    frame = rgba.copy()
    frame[:, :, 3] = np.round(rgba[:, :, 3].astype(np.float32) * mask).astype(np.uint8)
    frame[frame[:, :, 3] == 0, :3] = 0
    dest = source.with_name(f"ghost-near-{name}.png")
    Image.fromarray(frame, "RGBA").save(dest, optimize=True)
    print(dest.relative_to(ROOT), dest.stat().st_size)
