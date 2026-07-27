"""
Final icon build: white → transparent for the mark, then composite on teal.
"""
import fitz
from PIL import Image
import os

PDF = "attached_assets/Iqra_logo_1785192418025.pdf"
OUT = "artifacts/mobile/assets/images"
os.makedirs(OUT, exist_ok=True)

doc  = fitz.open(PDF)
page = doc[0]
TEAL = (27, 122, 107)

def fitz_to_pil(pix):
    mode = "RGBA" if pix.alpha else "RGB"
    return Image.frombytes(mode, (pix.width, pix.height), pix.samples)

# ── Render the icon mark at high resolution (white bg)
mat = fitz.Matrix(10, 10)
pix = page.get_pixmap(matrix=mat, clip=fitz.Rect(262, 47, 313, 93), alpha=False)
raw = fitz_to_pil(pix).convert("RGBA")

# ── Remove white background: pixels with R,G,B all > 240 → fully transparent
pixels = raw.load()
for y in range(raw.height):
    for x in range(raw.width):
        r, g, b, a = pixels[x, y]
        if r > 238 and g > 238 and b > 238:
            pixels[x, y] = (r, g, b, 0)

mark = raw   # now has transparent background
mark.save(f"{OUT}/logo-mark.png")
print(f"logo-mark: {mark.size}")

# ── 1024×1024 app icon: teal bg + mark centred
def make_icon(mark_img, size=1024):
    icon = Image.new("RGBA", (size, size), (*TEAL, 255))
    m = mark_img.copy()
    target = int(size * 0.62)
    m.thumbnail((target, target), Image.LANCZOS)
    ox = (size - m.width)  // 2
    oy = (size - m.height) // 2
    icon.paste(m, (ox, oy), m)
    return icon.convert("RGB")   # PNG for icon (no alpha needed)

icon = make_icon(mark)
icon.save(f"{OUT}/icon.png")
print(f"icon.png: {icon.size}")

# ── Android adaptive-icon foreground: mark on transparent
adaptive = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
m = mark.copy()
m.thumbnail((720, 720), Image.LANCZOS)
adaptive.paste(m, ((1024-m.width)//2, (1024-m.height)//2), m)
adaptive.save(f"{OUT}/adaptive-icon.png")
print(f"adaptive-icon: {adaptive.size}")

# ── Splash image (same as app icon)
icon_rgba = make_icon(mark).convert("RGBA")
icon_rgba.save(f"{OUT}/splash-icon.png")

# ── Lockup for in-app use (tight crop, white→transparent)
mat2 = fitz.Matrix(5, 5)
pix2 = page.get_pixmap(matrix=mat2, clip=fitz.Rect(450, 38, 648, 175), alpha=False)
lockup = fitz_to_pil(pix2).convert("RGBA")
px = lockup.load()
for y in range(lockup.height):
    for x in range(lockup.width):
        r, g, b, a = px[x, y]
        if r > 238 and g > 238 and b > 238:
            px[x, y] = (r, g, b, 0)
bbox = lockup.getbbox()
if bbox:
    lockup = lockup.crop(bbox)
lockup.save(f"{OUT}/logo-lockup.png")
print(f"logo-lockup: {lockup.size}")

print("\n✓ All assets written.")
