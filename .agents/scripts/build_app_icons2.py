"""
Build all Iqra app icon assets using fitz (render) + Pillow (composite/resize).
"""
import fitz
from PIL import Image, ImageOps
import io, os

PDF = "attached_assets/Iqra_logo_1785192418025.pdf"
OUT = "artifacts/mobile/assets/images"
os.makedirs(OUT, exist_ok=True)

doc  = fitz.open(PDF)
page = doc[0]

BRAND_TEAL = (27, 122, 107)   # #1B7A6B

def fitz_to_pil(pix: fitz.Pixmap) -> Image.Image:
    mode = "RGBA" if pix.alpha else "RGB"
    return Image.frombytes(mode, (pix.width, pix.height), pix.samples)

def crop_pil(rect, zoom=8, alpha=True) -> Image.Image:
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, clip=fitz.Rect(*rect), alpha=alpha)
    return fitz_to_pil(pix)

# ── 1. Icon mark (transparent bg) — large icon in APPICONSIZES
mark_img = crop_pil((262, 47, 313, 93), zoom=10, alpha=True)
mark_img.save(f"{OUT}/logo-mark.png")
print(f"logo-mark: {mark_img.size}")

# ── 2. App icon 1024×1024 — teal bg + icon mark centred
def make_square_icon(mark: Image.Image, size=1024, bg=BRAND_TEAL) -> Image.Image:
    icon = Image.new("RGBA", (size, size), (*bg, 255))
    # Scale mark to 72 % of canvas keeping aspect ratio
    target_w = int(size * 0.72)
    mark_rgb = mark.convert("RGBA")
    mark_rgb.thumbnail((target_w, target_w), Image.LANCZOS)
    mw, mh = mark_rgb.size
    ox = (size - mw) // 2
    oy = (size - mh) // 2
    icon.paste(mark_rgb, (ox, oy), mark_rgb)
    return icon

icon_img = make_square_icon(mark_img)
icon_img.save(f"{OUT}/icon.png")
print(f"icon: {icon_img.size}")

# ── 3. Android adaptive icon foreground (mark on transparent, 1024×1024)
adaptive = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
m = mark_img.copy().convert("RGBA")
m.thumbnail((720, 720), Image.LANCZOS)
mw, mh = m.size
adaptive.paste(m, ((1024-mw)//2, (1024-mh)//2), m)
adaptive.save(f"{OUT}/adaptive-icon.png")
print(f"adaptive-icon: {adaptive.size}")

# ── 4. Splash icon (same as app icon but bigger mark, for splash screen use)
splash = make_square_icon(mark_img, size=1024, bg=BRAND_TEAL)
splash.save(f"{OUT}/splash-icon.png")

# ── 5. Lockup (اقرأ / IQRA + icon) for the in-app header
lockup_img = crop_pil((450, 38, 648, 175), zoom=5, alpha=True)
# Trim whitespace
bbox = lockup_img.getbbox()
if bbox:
    lockup_img = lockup_img.crop(bbox)
lockup_img.save(f"{OUT}/logo-lockup.png")
print(f"logo-lockup: {lockup_img.size}")

print("\n✓ All assets written to", OUT)
