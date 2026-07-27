import fitz
import os

pdf_path = "attached_assets/Iqra_logo_1785192418025.pdf"
out_dir = ".agents/outputs"
os.makedirs(out_dir, exist_ok=True)

doc = fitz.open(pdf_path)
print(f"Pages: {doc.page_count}, size: {doc[0].rect}")

# Render full page at high resolution
page = doc[0]
mat = fitz.Matrix(4, 4)  # 288 DPI for crisp logo
pix = page.get_pixmap(matrix=mat, alpha=True)
pix.save(f"{out_dir}/logo_full.png")
print(f"Saved logo_full.png — {pix.width}x{pix.height}")

# Also try extracting embedded images at native resolution
imgs = page.get_images(full=True)
print(f"Embedded images: {len(imgs)}")
for i, img in enumerate(imgs):
    xref = img[0]
    data = doc.extract_image(xref)
    ext = data["ext"]
    path = f"{out_dir}/logo_embedded_{i}.{ext}"
    with open(path, "wb") as f:
        f.write(data["image"])
    print(f"  [{i}] {data['width']}x{data['height']} {ext} → {path}")
