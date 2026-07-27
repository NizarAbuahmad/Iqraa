import fitz, os

doc = fitz.open("attached_assets/Iqra_logo_1785192418025.pdf")
page = doc[0]
W, H = page.rect.width, page.rect.height   # 660 × 854.88 pts
out = ".agents/outputs"
os.makedirs(out, exist_ok=True)

def crop(name, x0, y0, x1, y1, zoom=4, alpha=True):
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, clip=fitz.Rect(x0, y0, x1, y1), alpha=alpha)
    pix.save(f"{out}/{name}.png")
    print(f"{name}: {pix.width}×{pix.height}")

# ── App-icon source (ONEMERALD pill, bottom-left quadrant)
# Content roughly occupies 20-290 x, 440-720 y in points
crop("onemerald",    20, 440, 295, 720, zoom=4)

# ── Lockup: icon + Arabic + IQRA text (top-right quadrant)
crop("lockup",      340, 20, 655, 200, zoom=4)

# ── Icon mark only — largest icon from APPICONSIZES (top-left, ~310-380 x)
crop("icon_mark",   270, 25, 380, 165, zoom=6)

# ── Variants strip (bottom-right)
crop("variants",    340, 450, 655, 570, zoom=4)

print("Done")
