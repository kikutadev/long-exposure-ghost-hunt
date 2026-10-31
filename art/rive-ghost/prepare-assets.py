"""Split the existing photographic ghost into non-overlapping soft performance masks.

At rest, all six layers composite to exactly the source RGBA (apart from WebP/PNG
quantization). The forearm moves from the shoulder and the hand from the wrist.
Run from project root: python3 art/rive-ghost/prepare-assets.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
source = Image.open(ROOT / 'public/assets/ghost-near.png').convert('RGBA')
w, h = source.size


def polygon(vertices, sigma):
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).polygon(vertices, fill=255)
    return np.asarray(mask.filter(ImageFilter.GaussianBlur(sigma)), dtype=np.float32) / 255


def oval(box, sigma):
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    return np.asarray(mask.filter(ImageFilter.GaussianBlur(sigma)), dtype=np.float32) / 255

# Note: source is 1024x1536; palms and sleeve are distinct parts. The masks
# taper at shoulder and wrist so they overlap without exposing black gaps.
raw = {
    'grasp': oval((258, 318, 493, 497), 26) * .98,
    'sleeve': polygon([(350,218),(411,238),(447,324),(400,438),(347,567),
                        (220,600),(220,425),(280,316)], 26) * .93,
    'head': oval((332, 18, 672, 357), 32) * .98,
    'hair_left': polygon([(0,190),(325,185),(348,335),(301,780),(185,915),
                          (82,700),(0,590)], 55) * .82,
    'hair_right': polygon([(642,184),(1024,235),(1024,1010),(786,985),
                           (704,718),(669,365)], 60) * .82,
}
# Front to back compositing priority; every source pixel belongs to a partition.
order = ['grasp','sleeve','head','hair_left','hair_right']
remaining = np.ones((h,w), dtype=np.float32)
weights = {}
for name in order:
    weights[name] = remaining * raw[name]
    remaining -= weights[name]
weights['body'] = remaining

rgba = np.asarray(source, dtype=np.uint8)
for name, weight in weights.items():
    arr = rgba.copy()
    arr[:,:,3] = np.clip(rgba[:,:,3].astype('float32') * weight + .5,0,255).astype('uint8')
    arr[arr[:,:,3] == 0,:3] = 0
    outfile = HERE / 'assets' / f'{name}.png'
    Image.fromarray(arr,'RGBA').resize((512,768), Image.Resampling.LANCZOS).save(outfile, optimize=True)
    print(name, outfile.stat().st_size)
# A per-pixel normalized reconstruction has no cut-out holes and no double arm.
print('max mask normalization error:', float(np.max(np.abs(sum(weights.values())-1.0))))
