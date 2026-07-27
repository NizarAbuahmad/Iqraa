"""
Build all Iqra app icon assets from the brand PDF.
Outputs:
  artifacts/mobile/assets/images/icon.png           (1024×1024 — iOS / general)
  artifacts/mobile/assets/images/adaptive-icon.png  (1024×1024 — Android foreground)
  artifacts/mobile/assets/images/logo-lockup.png    (lockup for in-app header)
  artifacts/mobile/assets/images/logo-mark.png      (icon mark, transparent bg)
"""
import fitz, os, struct, zlib

PDF = "attached_assets/Iqra_logo_1785192418025.pdf"
OUT = "artifacts/mobile/assets/images"
os.makedirs(OUT, exist_ok=True)

doc = fitz.open(PDF)
page = doc[0]

TEAL   = (0x1B, 0x7A, 0x6B)   # #1B7A6B — brand primary

# ── 1. Tightly crop the large icon mark (APPICONSIZES right icon, white bg)
#    Verified visually: the larger icon sits at ~Rect(262,47,313,93) pts
mat = fitz.Matrix(10, 10)
pix_mark = page.get_pixmap(matrix=mat, clip=fitz.Rect(262, 47, 313, 93), alpha=True)
pix_mark.save(f"{OUT}/logo-mark.png")
print(f"logo-mark: {pix_mark.width}x{pix_mark.height}")

# ── 2. App icon: 1024×1024 — teal background + icon mark centred (no alpha)
# Render the mark at size we need. Icon mark box is 51×46 pts → at zoom 20 ≈ 1020×920
pix_mark_hd = page.get_pixmap(matrix=fitz.Matrix(20, 20),
                               clip=fitz.Rect(262, 47, 313, 93), alpha=True)
mark_w, mark_h = pix_mark_hd.width, pix_mark_hd.height
print(f"mark HD: {mark_w}x{mark_h}")

# Create 1024×1024 teal canvas (RGBA) using raw bytes
SIZE = 1024
canvas_bytes = bytearray(SIZE * SIZE * 4)
# Fill with teal
r, g, b = TEAL
for i in range(SIZE * SIZE):
    canvas_bytes[i*4]   = r
    canvas_bytes[i*4+1] = g
    canvas_bytes[i*4+2] = b
    canvas_bytes[i*4+3] = 255

# Composite the mark centred — padding ~14% on each side
target_w = int(SIZE * 0.72)
target_h = int(target_w * mark_h / mark_w)
# Resize mark to target using fitz sampling
resized = pix_mark_hd
# Use a fixed zoom to fit target_w
zoom_needed = target_w / mark_w
pix_mark_fit = page.get_pixmap(
    matrix=fitz.Matrix(20 * zoom_needed, 20 * zoom_needed),
    clip=fitz.Rect(262, 47, 313, 93), alpha=True)
mw, mh = pix_mark_fit.width, pix_mark_fit.height
ox = (SIZE - mw) // 2
oy = (SIZE - mh) // 2

mark_samples = pix_mark_fit.samples  # bytes: RGBA

for row in range(mh):
    for col in range(mw):
        src_idx = (row * mw + col) * 4
        mr = mark_samples[src_idx]
        mg = mark_samples[src_idx+1]
        mb = mark_samples[src_idx+2]
        ma = mark_samples[src_idx+3]
        dst_row = oy + row
        dst_col = ox + col
        if 0 <= dst_row < SIZE and 0 <= dst_col < SIZE:
            dst_idx = (dst_row * SIZE + dst_col) * 4
            # Alpha composite over teal background
            alpha = ma / 255.0
            canvas_bytes[dst_idx]   = int(mr * alpha + r * (1 - alpha))
            canvas_bytes[dst_idx+1] = int(mg * alpha + g * (1 - alpha))
            canvas_bytes[dst_idx+2] = int(mb * alpha + b * (1 - alpha))
            canvas_bytes[dst_idx+3] = 255

# Save as PNG (using fitz Pixmap from raw bytes)
icon_pix = fitz.Pixmap(fitz.csRGB, SIZE, SIZE, bytes(canvas_bytes[:SIZE*SIZE*3]), False)
# Build RGBA pixmap properly
icon_pix_rgba = fitz.Pixmap(fitz.csRGBA, SIZE, SIZE, bytes(canvas_bytes), False)
icon_pix_rgba.save(f"{OUT}/icon.png")
print(f"icon: {SIZE}x{SIZE}")

# ── 3. Adaptive icon foreground (same as icon but transparent bg)
pix_mark_fit.save(f"{OUT}/adaptive-icon.png")
print(f"adaptive-icon: {mw}x{mh}")

# ── 4. Lockup for in-app header use (icon + اقرأ + IQRA text)
# Crop tightly around the lockup content (top-right quadrant)
pix_lockup = page.get_pixmap(matrix=fitz.Matrix(6,6),
                              clip=fitz.Rect(450, 40, 650, 180), alpha=True)
pix_lockup.save(f"{OUT}/logo-lockup.png")
print(f"logo-lockup: {pix_lockup.width}x{pix_lockup.height}")

print("\nAll assets saved to", OUT)
