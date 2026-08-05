"""
B1.4 — Build investor-ready IQRA brand assets from the official lockup.

Outputs (under assets/images/):
  - logo-lockup.png / logo-mark.png           light glyphs (for dark backgrounds)
  - logo-lockup-dark.png / logo-mark-dark.png dark glyphs (for light backgrounds)
  - icon.png           square app icon (mark + IQRA, navy ground)
  - adaptive-icon.png  Android adaptive foreground (transparent + mark)
  - favicon.png        web favicon (compact mark)
  - splash-icon.png    splash logo (full lockup on transparent, for navy splash)
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images"
NAVY = (8, 27, 58, 255)  # #081B3A
NAVY_RGB = np.array(NAVY[:3], dtype=np.uint8)


def load_official() -> Image.Image:
    # scripts/ -> mobile/ -> artifacts/ -> repo root
    repo_root = ROOT.parents[1]
    candidates = [
        repo_root / "attached_assets" / "0_ikraa_logo_1785351722832.png",
        OUT / "logo-lockup.png",
        OUT / "icon.png",
    ]
    for p in candidates:
        if p.exists():
            print(f"source: {p}")
            return Image.open(p).convert("RGBA")
    raise FileNotFoundError("No official IQRA logo source found")


def content_bbox(arr: np.ndarray, dark_thresh: int = 28) -> tuple[int, int, int, int]:
    rgb = arr[:, :, :3].astype(np.int16)
    alpha = arr[:, :, 3]
    is_dark = (rgb[:, :, 0] < dark_thresh) & (rgb[:, :, 1] < dark_thresh) & (rgb[:, :, 2] < dark_thresh)
    content = (~is_dark) & (alpha > 8)
    ys, xs = np.where(content)
    if len(xs) == 0:
        raise ValueError("No logo content detected")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def cutout(im: Image.Image) -> Image.Image:
    """Crop tight and make near-black background transparent."""
    arr = np.array(im)
    x0, y0, x1, y1 = content_bbox(arr)
    crop = arr[y0:y1, x0:x1].copy()
    rgb = crop[:, :, :3].astype(np.int16)
    is_dark = (rgb[:, :, 0] < 28) & (rgb[:, :, 1] < 28) & (rgb[:, :, 2] < 28)
    crop[is_dark, 3] = 0
    return Image.fromarray(crop, "RGBA")


def fit_on_canvas(
    logo: Image.Image,
    size: int,
    *,
    background: tuple[int, int, int, int] | None,
    scale: float = 0.72,
) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), background if background else (0, 0, 0, 0))
    max_side = int(size * scale)
    ratio = min(max_side / logo.width, max_side / logo.height)
    w = max(1, int(logo.width * ratio))
    h = max(1, int(logo.height * ratio))
    resized = logo.resize((w, h), Image.Resampling.LANCZOS)
    x = (size - w) // 2
    y = (size - h) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def mark_only(full: Image.Image) -> Image.Image:
    """
    Keep Arabic calligraphy + IQRA wordmark; drop lower taglines for small icons.
    Empirically taglines begin near ~78% of the stacked lockup height.
    """
    w, h = full.size
    return full.crop((0, 0, w, int(h * 0.78)))


def to_dark_variant(im: Image.Image) -> Image.Image:
    """
    Recolor near-white glyphs to Midnight Navy while preserving teal accents.
    Used for light-background surfaces (chat header, avatars on pale grounds).
    """
    arr = np.array(im).copy()
    rgb = arr[:, :, :3].astype(np.float32)
    alpha = arr[:, :, 3]

    # Teal / aqua brand accents (keep): G&B dominate R
    is_teal = (
        (rgb[:, :, 1] > rgb[:, :, 0] + 35)
        & (rgb[:, :, 2] > rgb[:, :, 0] + 25)
        & (alpha > 8)
    )

    # Neutral light glyphs (recolor): high luminance, low channel spread
    luminance = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    channel_spread = np.maximum(
        np.abs(rgb[:, :, 0] - rgb[:, :, 1]),
        np.abs(rgb[:, :, 1] - rgb[:, :, 2]),
    )
    is_light_glyph = (luminance > 165) & (channel_spread < 45) & (alpha > 8)

    recolor = is_light_glyph & ~is_teal
    arr[recolor, 0] = NAVY_RGB[0]
    arr[recolor, 1] = NAVY_RGB[1]
    arr[recolor, 2] = NAVY_RGB[2]
    return Image.fromarray(arr, "RGBA")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    full = cutout(load_official())
    mark = mark_only(full)

    # Light glyphs (for dark backgrounds) — login, splash, teal icon chip
    full_padded = fit_on_canvas(full, 1024, background=None, scale=0.90)
    full_padded.save(OUT / "logo-lockup.png", optimize=True)
    print("wrote logo-lockup.png (light / transparent)")

    mark_pad = fit_on_canvas(mark, 1024, background=None, scale=0.86)
    mark_pad.save(OUT / "logo-mark.png", optimize=True)
    print("wrote logo-mark.png (light / transparent)")

    # Dark glyphs (for light backgrounds) — Midnight Navy + teal accents
    dark_lockup = to_dark_variant(full_padded)
    dark_lockup.save(OUT / "logo-lockup-dark.png", optimize=True)
    print("wrote logo-lockup-dark.png (dark / transparent)")

    dark_mark = to_dark_variant(mark_pad)
    dark_mark.save(OUT / "logo-mark-dark.png", optimize=True)
    print("wrote logo-mark-dark.png (dark / transparent)")

    icon = fit_on_canvas(mark, 1024, background=NAVY, scale=0.70)
    icon.save(OUT / "icon.png", optimize=True)
    print("wrote icon.png")

    adaptive = fit_on_canvas(mark, 1024, background=None, scale=0.62)
    adaptive.save(OUT / "adaptive-icon.png", optimize=True)
    print("wrote adaptive-icon.png")

    favicon = fit_on_canvas(mark, 192, background=NAVY, scale=0.78)
    favicon.save(OUT / "favicon.png", optimize=True)
    print("wrote favicon.png")

    # Splash image: full lockup, transparent ground — Expo paints navy behind it
    splash = fit_on_canvas(full, 1024, background=None, scale=0.82)
    splash.save(OUT / "splash-icon.png", optimize=True)
    print("wrote splash-icon.png")

    print("done")


if __name__ == "__main__":
    main()
