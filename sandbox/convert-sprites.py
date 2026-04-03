"""
Batch Sprite Dye — Channel Mix 64px 12색
originals/ → src/asset/sprites/
"""
import json, csv, os, sys
import numpy as np
from PIL import Image

PIXEL_RES = 64
OUTPUT_SIZE = 256
QUANTIZE_K = 12
STRENGTH = 0.85

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINALS = os.path.join(ROOT, "sandbox", "originals")
OUT_DIR = os.path.join(ROOT, "src", "asset", "sprites")
CSV_PATH = os.path.join(ROOT, "src", "data", "gen1-evo-lines.csv")
PAL_PATH = os.path.join(ROOT, "src", "data", "brand-palettes.json")

# ── Load data ──
def load_dex_map():
    m = {}
    with open(CSV_PATH, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            for dex in row["members"].split("/"):
                m[dex] = row["assigned_brand"]
    return m

def load_palettes():
    with open(PAL_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    pals = {}
    for k, v in raw.items():
        if k.startswith("_"):
            continue
        colors = [(c["rgb"], c["w"]) for c in v["colors"]]
        pals[k] = colors
    return pals

# ── Channel Mix Engine ──
def lum(r, g, b):
    return (r * 0.299 + g * 0.587 + b * 0.114) / 255.0

def kmeans_quantize(pixels, k, max_iter=12):
    if len(pixels) == 0:
        return np.empty((0, 3))
    # Sort by luminance, pick evenly spaced initial centers
    lums = np.array([lum(*p) for p in pixels])
    idx = np.argsort(lums)
    sorted_px = pixels[idx]
    step = max(1, len(sorted_px) // k)
    centers = np.array([sorted_px[min(i * step, len(sorted_px) - 1)] for i in range(k)], dtype=np.float64)

    for _ in range(max_iter):
        # Assign
        dists = np.sum((pixels[:, None, :] - centers[None, :, :]) ** 2, axis=2)
        labels = np.argmin(dists, axis=1)
        # Update
        new_centers = np.empty_like(centers)
        moved = False
        for j in range(k):
            mask = labels == j
            if mask.sum() == 0:
                new_centers[j] = centers[j]
                continue
            nc = pixels[mask].mean(axis=0)
            if np.sum((nc - centers[j]) ** 2) > 4:
                moved = True
            new_centers[j] = nc
        centers = new_centers
        if not moved:
            break

    # Sort by luminance
    c_lums = np.array([lum(*c) for c in centers])
    return centers[np.argsort(c_lums)]

def build_target_palette(pal_colors, k):
    entries = sorted(pal_colors, key=lambda c: lum(*c[0]))
    cum = []
    acc = 0.0
    for rgb, w in entries:
        cum.append((acc, acc + w, rgb))
        acc += w
    result = []
    for i in range(k):
        t = (i + 0.5) / k
        seg = cum[-1]
        for s in cum:
            if t <= s[1]:
                seg = s
                break
        result.append(list(seg[2]))
    return np.array(result, dtype=np.float64)

def solve_least_squares(pairs, ch):
    n = len(pairs)
    A = np.zeros((n, 4))
    b = np.zeros(n)
    for i, (src, dst) in enumerate(pairs):
        A[i] = [src[0] / 255, src[1] / 255, src[2] / 255, 1.0]
        b[i] = dst[ch] / 255
    ATA = A.T @ A + 0.01 * np.eye(4)
    ATb = A.T @ b
    return np.linalg.solve(ATA, ATb)

def channel_mix(data, pal_colors):
    """data: (H,W,4) uint8 RGBA. Modifies in place."""
    # Collect opaque pixels
    alpha = data[:, :, 3]
    mask = alpha > 10
    if mask.sum() == 0:
        return
    pixels = data[mask][:, :3].astype(np.float64)

    # K-means
    centers = kmeans_quantize(pixels, QUANTIZE_K)
    if len(centers) == 0:
        return
    targets = build_target_palette(pal_colors, len(centers))

    # Build pairs + anchors
    pairs = list(zip(centers, targets))
    pairs.append((np.array([0, 0, 0]), np.array([0, 0, 0])))
    pairs.append((np.array([255, 255, 255]), np.array([255, 255, 255])))
    pairs.append((np.array([128, 128, 128]), np.array([128, 128, 128])))

    # Solve 3 channels
    cR = solve_least_squares(pairs, 0)
    cG = solve_least_squares(pairs, 1)
    cB = solve_least_squares(pairs, 2)
    M = np.array([cR[:3], cG[:3], cB[:3]])
    C = np.array([cR[3], cG[3], cB[3]])

    # Apply to all opaque pixels
    rgb = data[:, :, :3].astype(np.float64)
    norm = rgb / 255.0
    h, w = data.shape[:2]
    flat = norm.reshape(-1, 3)
    new_flat = (flat @ M.T + C) * 255.0
    old_flat = rgb.reshape(-1, 3)
    blended = old_flat * (1 - STRENGTH) + new_flat * STRENGTH
    blended = np.clip(blended, 0, 255).astype(np.uint8).reshape(h, w, 3)

    # Only apply to opaque
    data[:, :, :3] = np.where(mask[:, :, None], blended, data[:, :, :3])

def pixelate(img):
    """Downscale to PIXEL_RES x PIXEL_RES, centered, RGBA."""
    w, h = img.size
    scale = min(PIXEL_RES / w, PIXEL_RES / h)
    nw, nh = int(w * scale), int(h * scale)
    resized = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (PIXEL_RES, PIXEL_RES), (0, 0, 0, 0))
    canvas.paste(resized, ((PIXEL_RES - nw) // 2, (PIXEL_RES - nh) // 2))
    return canvas

def upscale_nearest(small_img):
    """Nearest-neighbor upscale to OUTPUT_SIZE."""
    return small_img.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.NEAREST)

# ── Main ──
def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    dex_map = load_dex_map()
    palettes = load_palettes()

    files = sorted([f for f in os.listdir(ORIGINALS) if f.endswith(".png") and f[:3].isdigit()])
    total = len(files)
    print(f"Found {total} images in {ORIGINALS}")
    print(f"Output: {OUT_DIR}")
    print()

    done = 0
    skipped = 0
    for fname in files:
        dex = fname.replace(".png", "")
        brand = dex_map.get(dex)
        pal = palettes.get(brand) if brand else None

        img = Image.open(os.path.join(ORIGINALS, fname)).convert("RGBA")
        small = pixelate(img)
        arr = np.array(small)

        if pal:
            channel_mix(arr, pal)
        else:
            skipped += 1

        result = Image.fromarray(arr, "RGBA")
        out = upscale_nearest(result)
        out.save(os.path.join(OUT_DIR, fname))

        done += 1
        brand_str = brand or "NO BRAND"
        filled = done * 30 // total
        bar = "#" * filled + "." * (30 - filled)
        print(f"\r  [{bar}] {done}/{total}  #{dex} -> {brand_str:<30s}", end="", flush=True)

    print(f"\n\nDone! {done} sprites saved, {skipped} without palette.")

if __name__ == "__main__":
    main()
