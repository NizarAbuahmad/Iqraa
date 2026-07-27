"""
Extract brand assets from the Iqra logo PDF and generate app icon files.
"""
import fitz, os, sys

doc = fitz.open("attached_assets/Iqra_logo_1785192418025.pdf")
page = doc[0]
W, H = page.rect.width, page.rect.height
out = ".agents/outputs"
print(f"Page: {W:.1f}x{H:.1f} pts")

# Render the full page at 3x to locate sections precisely
mat3 = fitz.Matrix(3, 3)
full = page.get_pixmap(matrix=mat3, alpha=True)
full.save(f"{out}/full_3x.png")
print(f"Full 3x: {full.width}x{full.height}")

# ── Crop the icon mark (large size in top-left APPICONSIZES quadrant)
# In the full render at 4x (2640x3420) the big icon was around x=240-370px, y=50-290px
# → in PDF points: x=60-93, y=12-72 (roughly)
# Try a generous crop of the top-left icon area
def crop(name, x0, y0, x1, y1, zoom=5, alpha=True):
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, clip=fitz.Rect(x0, y0, x1, y1), alpha=alpha)
    path = f"{out}/{name}.png"
    pix.save(path)
    print(f"  {name}: {pix.width}x{pix.height} @ Rect({x0},{y0},{x1},{y1})")
    return pix

# icon mark — top-left quadrant, scanning for the largest icon
crop("icon_tight", 200, 30, 330, 160, zoom=6)

# onemerald — bottom-left, try inner content of the teal pill
# Page height is ~854. Bottom-left quadrant: x=0-330, y=427-854
# The teal pill seems to be at approx y=460-700
crop("onemerald_v2", 30, 465, 310, 705, zoom=4)

# lockup clean — top-right, crop tightly around the logo+text
crop("lockup_clean", 360, 35, 650, 195, zoom=5)

print("Done")
