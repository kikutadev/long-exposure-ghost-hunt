"""Pack Blender's 12 photographed-ghost poses into one mobile-friendly atlas."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / ".qa/near-performance"
frames = [Image.open(SRC / f"pose-{i:02d}.png").convert("RGBA") for i in range(12)]
assert all(img.size == (512, 768) for img in frames)
atlas = Image.new("RGBA", (2048, 2304))
for i, image in enumerate(frames):
    atlas.alpha_composite(image, ((i % 4) * 512, (i // 4) * 768))
destination = ROOT / "public/assets/ghost-near-performance.webp"
atlas.save(destination, "WEBP", quality=90, method=6)
print(destination, destination.stat().st_size)
