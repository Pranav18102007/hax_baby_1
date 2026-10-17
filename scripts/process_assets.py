"""Turn assets-raw/ (ChatGPT + official PNGs) into web-ready WebP files in public/assets/img.

Run:  python3 -I scripts/process_assets.py
Re-run whenever a raw file changes; never hand-edit the outputs.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets-raw"
OUT = ROOT / "public" / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)
manifest: dict[str, dict] = {}


def raw(prefix: str) -> Image.Image:
    hits = sorted(RAW.glob(prefix + "*.png"))
    if not hits:
        sys.exit(f"missing raw file: {prefix}")
    return Image.open(hits[0])


def save(img: Image.Image, name: str, sizes: tuple[int, ...], quality: int = 80) -> None:
    """Save `name-<size>.webp` for each size (size = longest side), never upscaling."""
    longest = max(img.size)
    entry = {"w": img.width, "h": img.height, "sizes": []}
    for s in sizes:
        s = min(s, longest)
        scale = s / longest
        im = img if scale == 1 else img.resize(
            (max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
        path = OUT / f"{name}-{s}.webp"
        im.save(path, "WEBP", quality=quality, method=4)
        entry["sizes"].append(s)
    manifest[name] = entry


def pad(img: Image.Image, frac: float = 0.05) -> Image.Image:
    p = round(max(img.size) * frac)
    out = Image.new("RGBA", (img.width + 2 * p, img.height + 2 * p), (0, 0, 0, 0))
    out.paste(img, (p, p))
    return out


def trim(img: Image.Image, margin: int = 8) -> Image.Image:
    bbox = img.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    return img.crop((max(0, l - margin), max(0, t - margin), min(img.width, r + margin), min(img.height, b + margin)))


def slice_sheet(img: Image.Image, expected: int, merge: int = 2) -> list[Image.Image]:
    """Split a sheet into its separate objects using the alpha channel.
    Works on a 1/4-scale copy for speed; nearby bits (sparkles, hearts) are merged
    into their object by `merge` dilation steps at that scale."""
    k = 4
    small = img.getchannel("A").resize((img.width // k, img.height // k), Image.BOX)
    a = np.array(small) > 40
    grown = ndimage.binary_dilation(a, iterations=merge) if merge else a
    labels, n = ndimage.label(grown)
    boxes = ndimage.find_objects(labels)
    sizes = ndimage.sum(a, labels, range(1, n + 1))
    keep = [((slice(b[0].start * k, b[0].stop * k), slice(b[1].start * k, b[1].stop * k)), sizes[i])
            for i, b in enumerate(boxes) if sizes[i] > 0.08 * max(sizes)]
    if len(keep) != expected:
        print(f"  ! expected {expected} objects, found {len(keep)}")
    # sort into reading order: rows by centre-y (tolerance = 1/3 of median height), then by x
    keep.sort(key=lambda k: (k[0][0].start + k[0][0].stop) / 2)
    hmed = float(np.median([k[0][0].stop - k[0][0].start for k in keep]))
    rows: list[list] = []
    for k in keep:
        cy = (k[0][0].start + k[0][0].stop) / 2
        if rows and abs(cy - rows[-1][0]) < hmed / 3:
            rows[-1][1].append(k)
        else:
            rows.append([cy, [k]])
    ordered = [k for _, r in rows for k in sorted(r, key=lambda k: k[0][1].start)]
    out = []
    for (ys, xs), _ in ordered:
        crop = img.crop((max(0, xs.start - 4), max(0, ys.start - 4), min(img.width, xs.stop + 4), min(img.height, ys.stop + 4)))
        # wipe pixels belonging to neighbours that leaked into the box
        out.append(trim(crop))
    return out


def remove_flat_bg(img: Image.Image, tol: int = 28) -> Image.Image:
    """Make a flat light background transparent (flood from the border), with a soft edge."""
    rgb = np.array(img.convert("RGB")).astype(np.int32)
    corners = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    near = dist < tol
    labels, _ = ndimage.label(near)
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    mask = np.isin(labels, list(border))
    # soft alpha: fully clear inside bg, ramp over the next ~12 colour units
    alpha = np.clip((dist - tol * 0.6) / (tol * 0.6), 0, 1) * 255
    alpha = np.where(mask, np.minimum(alpha, 40), 255)
    alpha = ndimage.gaussian_filter(alpha, 1.2)
    rgba = np.dstack([rgb, alpha]).astype(np.uint8)
    return trim(Image.fromarray(rgba, "RGBA"))


def crop_ledge(img: Image.Image) -> Image.Image:
    """P08: cut the painted ledge off below Pip's hands."""
    a = np.array(img.getchannel("A")) > 20
    widths = a.sum(axis=1)
    full = np.where(widths > 0.75 * img.width)[0]
    if len(full) == 0:
        return img
    # the ledge is the LOWEST band of near-full-width rows; walk up from the bottom of it
    top = int(full[-1])
    while top - 1 in set(full.tolist()):
        top -= 1
    return trim(img.crop((0, 0, img.width, top + round(img.height * 0.02))))


PAINT = (1600, 900)
CHAR = (1024, 512)

print("paintings")
paintings = {
    "B01": "hero-night", "B02": "hero-day", "B04": "story-town", "B05": "story-clouds",
    "B06": "story-star", "B08": "dome", "B09": "room-lab", "B10": "room-gallery",
    "B11": "room-toys", "B13": "dawn", "B14": "secret-crib", "B15": "growth-wall",
}
for pre, name in paintings.items():
    save(raw(pre).convert("RGB"), name, PAINT, 78)
save(raw("B07_the nursery night").convert("RGB"), "nursery-night", PAINT, 78)
save(raw("B07_the nursery day").convert("RGB"), "nursery-day", PAINT, 78)
save(raw("B12_rooftop town map horizontal").convert("RGB"), "route-wide", PAINT, 78)
save(raw("B12_rooftop town map vertical").convert("RGB"), "route-tall", (1536, 1100), 78)
save(raw("B03").convert("RGBA"), "hero-clouds", PAINT, 80)

print("pip")
for pre, name in {"P01": "pip-default", "P02": "pip-happy", "P03": "pip-surprised",
                  "P04": "pip-sleepy", "P05": "pip-cheeky"}.items():
    save(raw(pre).convert("RGBA"), name, CHAR)  # same canvas for all five: no trim
save(trim(raw("P06").convert("RGBA")), "pip-worried", CHAR)
save(pad(trim(raw("P07").convert("RGBA"))), "pip-asleep", CHAR)
save(crop_ledge(raw("P08").convert("RGBA")), "pip-peek", (768, 384))
save(pad(trim(raw("P09").convert("RGBA"))), "pip-flying", CHAR)
save(trim(raw("P10").convert("RGBA")), "pip-hand", CHAR)
save(trim(raw("P11").convert("RGBA")), "pip-pixel", (256, 64))

print("props")
# Official lantern + music box ship on a cream background. Cut them out once with
#   rembg (isnet-general-use) -> assets-raw/O01x_<name>_cut.png ; fall back to a flat-colour key.
for nm, src in (("lantern", "O01_pip dream lantern"), ("musicbox", "O01_pip lullaby box")):
    cut = RAW / f"O01x_{nm}_cut.png"
    img = trim(Image.open(cut).convert("RGBA")) if cut.exists() else remove_flat_bg(raw(src))
    save(img, nm, CHAR)
save(trim(raw("O02").convert("RGBA")), "block", CHAR)
save(trim(raw("O05").convert("RGBA")), "moon-hand", CHAR)
save(trim(raw("O07").convert("RGBA")), "ghost-peek", (768, 384))
save(trim(raw("O09").convert("RGBA")), "unicorn", CHAR)
save(trim(raw("O12").convert("RGBA")), "sock-ghost", (512, 256))
save(trim(raw("O14").convert("RGBA")), "cassette", (1024, 512))

sheets = [
    ("O03", 8, ["toy-star", "toy-moon", "toy-heart", "toy-cloud", "toy-bone", "toy-note", "rattle-round", "rattle-star"], (384,)),
    ("O04", 6, ["lamp-mushroom", "lamp-starjar", "lamp-jellyfish", "lamp-cloud", "lamp-candle", "lamp-moonbottle"], (512, 256)),
    ("O06", 4, ["ghost-plain", "ghost-nightcap", "ghost-teddy", "ghost-yawn"], (512, 256)),
    ("O08", 3, ["blob-tongue", "blob-storm", "blob-grump"], (384,)),
    ("O11", 3, ["duck-nightcap", "duck-upside", "duck-ring"], (384,)),
    ("O13", 12, ["icon-musicbox", "icon-lantern", "icon-block", "icon-guestbook", "icon-cassette", "icon-bin",
                 "icon-nightmare", "icon-settings", "icon-daynight", "icon-monitor", "icon-unicorn", "icon-portal"], (128,)),
    ("O15", 2, ["bin-closed", "bin-open"], (384,)),
    ("O16", 6, ["sticker-wave", "sticker-asleep", "sticker-lantern", "sticker-kitten", "sticker-duck", "sticker-unicorn"], (512,)),
]
for pre, n, names, sizes in sheets:
    print(" sheet", pre)
    parts = slice_sheet(raw(pre).convert("RGBA"), n)
    for img, name in zip(parts, names):
        save(img, name, sizes)

print(" kitten sprite")
frames = slice_sheet(raw("O10").convert("RGBA"), 10)
# keep every frame on one shared canvas so the animation doesn't jitter
fw = max(f.width for f in frames); fh = max(f.height for f in frames)
strip = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
for i, f in enumerate(frames):
    strip.paste(f, (i * fw + (fw - f.width) // 2, fh - f.height))
scale = 96 / fh
strip = strip.resize((round(strip.width * scale), 96), Image.LANCZOS)
strip.save(OUT / "kitten-strip.webp", "WEBP", quality=85, method=4)
manifest["kitten-strip"] = {"w": strip.width, "h": strip.height, "frames": len(frames), "sizes": []}

(ROOT / "src" / "content").mkdir(parents=True, exist_ok=True)
(ROOT / "src" / "content" / "assets.json").write_text(json.dumps(manifest, indent=1))
print("done:", len(manifest), "assets")
