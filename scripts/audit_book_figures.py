#!/usr/bin/env python3
"""Audit the committed book-figure crops against the page they came from.

Why this exists
───────────────
The extractors (`extract_book_figures.py`, `extract_book_photos.py`) seed on
one kind of thing each — an axis pair, a curve cluster, one embedded raster —
and keep the bounding box of what they seeded on. A printed figure is usually
several of those at once: a photo plus a drawn inset, an illustration plus its
leader lines and labels, a drawing plus «الشكلُ (3): …» under it. Eyeballing
two random 16-figure samples on 2026-10-19 found 35–45% of deck figures cut
badly in exactly those ways: a label or caption sliced at the edge, half a
diagram, a body-text column pulled in, a lone sub-image of a composite picture.

What this does
──────────────
For every figure a lesson can reach (`figure-lesson-map.json` → `index.json`),
it rebuilds the figure from the page's own structure, seeded on the committed
rect:

1. Graphics = embedded images + vector paths, minus page furniture (full-page
   washes, header/footer bands, page-number badges) and invisible white fills.
2. Seed = the graphics the committed rect mostly holds. Grow by proximity
   through graphics only (`GAP`), so a figure's parts and leader lines join.
3. Admit text that sits on the grown figure — labels — but never body text
   (the page's own running size and a full line's length). Text is admitted,
   never chased, as in the extractor.
4. Add the caption: a «الشكل/Figure…» line, or a small-font block, touching
   the figure from above or below.

and classifies the result:

    ok      the committed rect already is that figure (IoU ≥ OK_IOU)
    recrop  the rebuilt rect differs; `rect` holds the proposal
    drop    nothing a teacher could project: a lone simple shape, page
            chrome, an empty panel, or a duplicate of another figure's rebuild
    manual  the rebuild could not be trusted (it swallowed most of the page,
            found no graphics, or the PDF is not on this machine)

It writes `<out>/audit.json` and contact sheets (`<out>/sheets/*.png`): each
row is the page with the old rect in red and the proposal in green, then the
old crop, then the new one. The sheets are the review; `audit.json` is only a
proposal until a person has looked. `--apply` writes the reviewed proposals
back: new rects into `index.json` with the PNG re-rendered at the book's DPI,
and drops removed from both the PNG and the index (see the extractor's header
for why both).

Usage
─────
    IQRAA_PDF_ROOT=<main checkout> python scripts/audit_book_figures.py <out>
    IQRAA_PDF_ROOT=<main checkout> python scripts/audit_book_figures.py <out> --apply <decisions.json>
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_book_figures as ebf  # noqa: E402
import extract_book_photos as ebp  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / "knowledge-base" / "figure-lesson-map.json"
FIGURES_TS = ROOT / "artifacts" / "mobile" / "services" / "bookFigures.ts"

# Graphics closer than this (points) are one figure. Leader lines touch their
# labels and insets overlap their photo; Grade 4 vocational stacks separate
# photos 9pt apart.
GAP = 6.0
# A text line this close to the figure is a candidate label.
LABEL_PAD = 6.0
# How far from the figure a caption may sit.
CAPTION_REACH = 30.0
MARGIN = 6.0
OK_IOU = 0.85
CAPTION_RE = re.compile(r"^\(?\s*(ال)?(شكل|صوره|صورة|خريطه|خريطة|figure|fig\b|picture|map\b)", re.I)


def pdf_for(source_id: str) -> Path | None:
    if source_id in ebf.BOOKS:
        return ebf.resolve_pdf(ebf.BOOKS[source_id][1])
    if source_id in ebp.BOOKS:
        return ebp.PDF_ROOT / ebp.BOOKS[source_id][1]
    return None


def dpi_for(source_id: str) -> int:
    return ebf.DPI_OVERRIDES.get(source_id, ebf.DPI)


def bare(text: str) -> str:
    """Strip harakat and tatweel so «الشَّكلُ» matches «الشكل»."""
    return "".join(c for c in unicodedata.normalize("NFKD", text)
                   if not unicodedata.combining(c) and c != "ـ").strip()


def is_caption(text: str) -> bool:
    """«الشكلُ (3): …», «صورة 2», «Figure 4». Some books store the line in
    visual order, so «الشكل» arrives at the end: «) : مكوّناتُ … (1 الشكل»."""
    t = bare(text)
    if CAPTION_RE.match(re.sub(r"^[\W\d_]+", "", t)):
        return True
    # Reversed, the number sits just before it; a sentence ending «…كما في
    # الشكل» has none and stays prose.
    return len(t) <= 80 and bool(re.search(r"\d+\W*\s*(ال)?شكل\W*$", t))


def deck_figures() -> list[dict]:
    """Every figure some lesson can reach, in `figuresForLesson` order."""
    ts = FIGURES_TS.read_text(encoding="utf-8")
    paths = re.findall(r"^import \w+ from '\.\./\.\./\.\./(knowledge-base/[^']+/index\.json)'", ts, re.M)
    entries = json.loads(MAP.read_text(encoding="utf-8"))["entries"]
    at = {(e["sourceId"], e["unit"], e["lesson"]): e["kbLessonId"] for e in entries if e.get("kbLessonId")}
    out, rank = [], {}
    for p in paths:
        for f in json.loads((ROOT / p).read_text(encoding="utf-8"))["figures"]:
            k = at.get((f["sourceId"], f.get("unit"), f.get("lesson")))
            if not k:
                continue
            rank[k] = rank.get(k, 0) + 1
            out.append({**f, "index": p, "kbLessonId": k, "rankInLesson": rank[k]})
    return out


# ── page structure ──────────────────────────────────────────────────────────

def area(r) -> float:
    return max(0.0, r[2] - r[0]) * max(0.0, r[3] - r[1])


def inter(a, b):
    return (max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3]))


def union(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def near(a, b, gap: float) -> bool:
    return a[0] - gap <= b[2] and b[0] - gap <= a[2] and a[1] - gap <= b[3] and b[1] - gap <= a[3]


def iou(a, b) -> float:
    i = area(inter(a, b))
    u = area(a) + area(b) - i
    return i / u if u else 0.0


def _whiteish(color) -> bool:
    return color is not None and all(c > 0.94 for c in color)


class Page:
    """The page reduced to graphics boxes and classified text lines."""

    def __init__(self, page: pymupdf.Page):
        self.rect = tuple(page.rect)
        W, H = page.rect.width, page.rect.height
        self.W, self.H = W, H
        g = []
        for info in page.get_image_info():
            b = tuple(info["bbox"])
            g.append((b, None))
        for d in page.get_drawings():
            b = tuple(d["rect"])
            if d.get("fill") is not None and _whiteish(d.get("fill")) and d.get("color") is None:
                continue
            g.append((b, d))
        self.graphics = []
        self._paths = {}
        for b, d in g:
            b = inter(b, self.rect)
            w, h = b[2] - b[0], b[3] - b[1]
            if w < 0 or h < 0 or (w <= 0.5 and h <= 0.5):
                continue
            # Column rules and section dividers: one long thin stroke that would
            # otherwise join everything along it into one "figure".
            if (min(w, h) < 2.5 and (w > 0.35 * W or h > 0.35 * H)):
                continue
            # A full-page wash or frame. Not lower: English books bleed their
            # opening photo over half the page, and that photo is the figure.
            if area(b) > 0.6 * W * H:
                continue
            # Header/footer bands and side tabs: wide-and-flat or tall-and-thin
            # pieces hugging a page edge.
            edge = b[0] < 3 or b[1] < 3 or b[2] > W - 3 or b[3] > H - 3
            if edge and ((w > 0.6 * W and h < 0.2 * H) or (h > 0.6 * H and w < 0.12 * W)):
                continue
            if b[1] > 0.9 * H or b[3] < 0.06 * H:
                continue  # page number badge, running header
            if w > 0.7 * W and (b[1] > 0.82 * H or b[3] < 0.12 * H):
                continue  # a footer wave or header band set in from the edge
            self.graphics.append(b)
            if d is not None:
                self._paths[b] = d
        # Text lines with their size, from the extractor's own text dict.
        sizes: dict[float, int] = {}
        lines = []
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            blines = []
            for ln in block["lines"]:
                spans = [s for s in ln["spans"] if s["text"].strip()]
                # Rotated text is the «نسخة قيد الإعداد» draft watermark across
                # the page. Its box covers the photos under it, so counting it
                # as text erased them from the figure mask.
                if not spans or abs(ln["dir"][1]) > 0.05:
                    continue
                text = "".join(s["text"] for s in spans).strip()
                size = max(s["size"] for s in spans)
                n = sum(len(s["text"].strip()) for s in spans)
                key = round(size * 2) / 2
                # Weighted by width as well as characters: Grade 8 science p.11
                # prints more characters of 14pt labels than of 18pt prose, but
                # in lines half as long.
                sizes[key] = sizes.get(key, 0) + n * (ln["bbox"][2] - ln["bbox"][0])
                blines.append({"bbox": tuple(ln["bbox"]), "text": text, "size": size, "n": n})
            widest = max((bl["bbox"][2] - bl["bbox"][0] for bl in blines), default=0)
            for bl in blines:
                bl["blockLines"] = len(blines)
                bl["block"] = tuple(block["bbox"])
                bl["blockWidth"] = widest
            lines.extend(blines)
        self.body_size = max(sizes, key=sizes.get) if sizes else 0
        # The text column's width: what a full line of body text measures.
        # Relative, not a share of the page — Grade 9 physics sets its prose in
        # columns a third of the page wide.
        widths = sorted((ln["bbox"][2] - ln["bbox"][0], ln["n"]) for ln in lines
                        if abs(ln["size"] - self.body_size) <= 0.5 and ln["n"] >= 10)
        # Too little prose to measure (an opener page, a full-page diagram):
        # fall back to 38% of the page.
        # The 90th percentile by characters, not the median: on a page whose
        # figure carries paragraph-long labels (Grade 8 science p.11) the labels
        # outweigh the prose, and Arabic lines with English in them are split
        # into shorter pieces by the text layer.
        total, acc, col = sum(n for _, n in widths), 0, 0.38 * W / 0.75
        if total < 300:
            widths = []
        for w_, n in widths:
            acc += n
            if acc >= 0.9 * total:
                col = w_
                break
        self.col = col
        for ln in lines:
            ln["caption"] = is_caption(ln["text"])
            # Body text: near the page's running size, in a paragraph as wide as
            # its text column. A figure's label boxes are narrower than that even
            # when they run to three lines (Grade 8 science p.11's nervous system).
            w = ln["bbox"][2] - ln["bbox"][0]
            ln["body"] = not ln["caption"] and ln["n"] >= 15 and ln["size"] >= self.body_size - 1.5 and (
                ln["blockWidth"] >= 0.75 * col or (ln["n"] >= 25 and w >= 0.6 * col))
        self.lines = [ln for ln in lines if not (ln["bbox"][1] > 0.92 * H or ln["bbox"][3] < 0.05 * H)]
        # What is actually visible of those graphics, on a 1pt grid. Their
        # boxes alone over-claim: these books clip large fills to a shape (one
        # Grade 8 vocational page holds a dozen page-sized tint panels clipped
        # to a footer strip) and place photos with transparent padding that
        # runs over the paragraph above. A box cell counts only where the
        # rendered page has ink.
        pm = page.get_pixmap(matrix=pymupdf.Matrix(1, 1), alpha=False)
        px = np.frombuffer(pm.samples, np.uint8).reshape(pm.height, pm.width, pm.n)[:, :, :3].astype(np.int16)
        q = (px // 16).reshape(-1, 3)
        keys, counts = np.unique(q[:, 0] * 256 + q[:, 1] * 16 + q[:, 2], return_counts=True)
        k = int(keys[counts.argmax()])
        bg = np.array([k // 256, (k // 16) % 16, k % 16]) * 16 + 8
        ink = np.abs(px - bg).max(axis=2) > 28
        self.px, self.bg = px, bg
        self.ink_px = ink
        # Highlighter marks and underlines sit on a line of text: decoration of
        # the prose, and a bridge from a figure into the paragraph above it.
        # Panels and frames (see `_panel`) are the page's furniture too.
        boxes = [ln["bbox"] for ln in lines]
        self.graphics = [b for b in self.graphics
                         if not any(area(inter(b, t)) >= 0.7 * max(area(b), 1.0) for t in boxes)
                         and not self._panel(b, lines)]
        boxmask = np.zeros(ink.shape, bool)
        for b in self.graphics:
            boxmask[int(b[1]):int(b[3]) + 1, int(b[0]):int(b[2]) + 1] = True
        # Text is admitted as a label, never chased: glyphs inside a graphic's
        # box (a caption printed in a frame, a sentence under a photo) would
        # otherwise join the figure to the paragraph and make it uncuttable.
        for ln in lines:
            t = ln["bbox"]
            boxmask[max(0, int(t[1])):int(t[3]) + 1, max(0, int(t[0])):int(t[2]) + 1] = False
        self.mask = ink & boxmask
        self.labels, _ = ndimage.label(ndimage.binary_dilation(self.mask, iterations=int(GAP // 2)))

    def text_box(self, r) -> bool:
        """A callout of prose in a tinted box («أتذكّر», «معلومة»): text over one flat fill."""
        x0, y0, x1, y1 = (max(0, int(v)) for v in r)
        inside = [ln["bbox"] for ln in self.lines if area(inter(ln["bbox"], r)) > 0.5 * area(ln["bbox"])]
        text_area = sum(area(b) for b in inside)
        if len(inside) < 2 or text_area < 0.3 * area(r):
            return False
        keep = np.ones((y1 - y0, x1 - x0), bool)
        for b in inside:
            keep[max(0, int(b[1]) - y0):max(0, int(b[3]) + 1 - y0), max(0, int(b[0]) - x0):max(0, int(b[2]) + 1 - x0)] = False
        px = self.px[y0:y1, x0:x1][keep]
        px = px[np.abs(px - self.bg).max(axis=1) > 28]
        if px.size == 0:
            return True
        q = (px // 24)
        _, counts = np.unique(q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2], return_counts=True)
        return counts.max() >= 0.8 * len(px)

    def _panel(self, b, lines) -> bool:
        """An activity or note panel: a drawn box (outline or tint) holding prose.

        Its border is ink all the way round, so without this every figure
        inside a «نشاط» or «مفهوم أساسي» card grew to the whole card, text and
        all. Some books draw the panel as a raster (Grade 9 maths frames each
        column in one 400x650pt image), so an image counts too — but only one
        holding prose: a photo with a few labels printed over it is a figure.
        """
        if b[2] - b[0] < 60 or b[3] - b[1] < 40:
            return False
        inside = [ln for ln in lines if area(inter(ln["bbox"], b)) > 0.8 * area(ln["bbox"])]
        if self._frame(b, inside):
            return True
        if b not in self._paths:
            return sum(1 for ln in inside if ln["body"]) >= 2
        return any(ln["body"] for ln in inside) or (len(inside) >= 3 and sum(ln["n"] for ln in inside) >= 60)

    def _frame(self, b, inside) -> bool:
        """A raster outline round some text: sparse ink, and a sentence inside.

        Grade 4 vocational draws each activity's rounded border as page-wide
        raster slices with white interiors, which neither a tint nor a
        stroke-only path describes. A photo is inked throughout. Rasters only:
        a vector graph is just as sparse and can carry as many labels.
        """
        if b in self._paths or sum(ln["n"] for ln in inside) < 20:
            return False
        x0, y0, x1, y1 = (int(v) for v in b)
        return self.ink_px[y0:y1 + 1, x0:x1 + 1].mean() < 0.2

    def ink(self, r) -> int:
        return int(self.mask[max(0, int(r[1])):int(r[3]) + 1, max(0, int(r[0])):int(r[2]) + 1].sum())

    def seed_box(self, seed):
        """Bounding box of the figure the seed rect is cutting at.

        The connected (within GAP) groups of visible graphics that make up a
        real share of what the seed shows, or sit mostly inside it — never a
        neighbour that merely grazes its edge.
        """
        mask, labels = self.mask, self.labels
        # (The extractors padded their crops, so "the seed is one picture" is
        # containment, not equality.)
        whole = [b for b in self.graphics if b not in self._paths and min(b[2] - b[0], b[3] - b[1]) >= 80
                 and area(inter(b, seed)) >= 0.9 * area(b) and area(b) >= 0.6 * area(seed)]
        if whole:
            # The committed crop is already one whole picture. Keep it one:
            # let its arrows, leader lines and labels join, but not the next
            # photo along (Grade 4 social studies scatters four overlapping
            # photos down a column, each illustrating its own bullet).
            pic = whole[0]
            mask = mask.copy()
            for o in self.graphics:
                if o not in self._paths and o != pic:
                    mask[max(0, int(o[1])):int(o[3]) + 1, max(0, int(o[0])):int(o[2]) + 1] = False
            own = (slice(max(0, int(pic[1])), int(pic[3]) + 1), slice(max(0, int(pic[0])), int(pic[2]) + 1))
            mask[own] = self.mask[own]
            labels, _ = ndimage.label(ndimage.binary_dilation(mask, iterations=int(GAP // 2)))
        y0, y1 = max(0, int(seed[1])), int(seed[3]) + 1
        x0, x1 = max(0, int(seed[0])), int(seed[2]) + 1
        inside = labels[y0:y1, x0:x1][mask[y0:y1, x0:x1]]
        if inside.size == 0:
            return None
        ids, n_in = np.unique(inside, return_counts=True)
        totals = ndimage.sum_labels(mask, labels, ids)
        keep = [int(i) for i, n, t in zip(ids, n_in, totals) if n >= 0.1 * inside.size or n >= 0.5 * t]
        self.figure_ink = mask & np.isin(labels, keep)
        ys, xs = np.nonzero(self.figure_ink)
        return (float(xs.min()), float(ys.min()), float(xs.max() + 1), float(ys.max() + 1))


def trim_body(pg: Page, box, keep=()):
    """Cut body-text lines off the edges of `box` where that costs no figure."""
    total = pg.ink(box) or 1
    for ln in sorted((ln for ln in pg.lines if ln["body"] and ln not in keep), key=lambda ln: ln["bbox"][1]):
        b = ln["bbox"]
        if area(inter(b, box)) < 0.15 * area(b):
            continue  # a line the box only grazes is cut off too, never sliced
        # The four ways to cut the line off, cheapest in figure ink first.
        cuts = [(box[0], b[3], box[2], box[3]), (box[0], box[1], box[2], b[1]),
                (b[2], box[1], box[2], box[3]), (box[0], box[1], b[0], box[3])]
        best = max(cuts, key=lambda c: pg.ink(c) if area(c) > 0 else -1)
        if area(best) > 0 and pg.ink(best) >= 0.95 * total:
            box = best
    return box


def rebuild(pg: Page, seed) -> tuple[tuple | None, dict]:
    """The printed figure the committed rect was cutting at. None if no graphics."""
    note = {}
    box = pg.seed_box(seed)
    if box is None:
        return None, {"why": "no figure under the rect (text or blank)"}
    # Labels. Whatever the figure's own ink touches is one — its leader line
    # runs into it, or it is printed on the picture — at any size or length:
    # Grade 8 science p.11 labels its nervous system with three-line
    # paragraphs. Beyond that, only a word or two near the figure («cm»),
    # never a line that continues the prose beside it.
    body = [ln["bbox"] for ln in pg.lines if ln["body"]]
    ink = pg.figure_ink

    def touched(ln) -> bool:
        # 6pt: a leader line stops a few points short of its label.
        b = ln["bbox"]
        near_ink = ink[max(0, int(b[1]) - 6):int(b[3]) + 7, max(0, int(b[0]) - 6):int(b[2]) + 7]
        # Never prose: Grade 10 history p.48's globe runs into the paragraph
        # above it, which is touched but no label.
        return not ln["body"] and bool(near_ink.any())

    def in_prose(b, n) -> bool:
        # A «+x» or «(20)» the text layer split off a body line is that line,
        # not a label: it shares the row with body text right beside it.
        if n > 6:
            return False
        h = b[3] - b[1]
        return any(t != b and min(b[3], t[3]) - max(b[1], t[1]) > 0.5 * h and (t[0] - 15 <= b[2] and b[0] <= t[2] + 15)
                   for t in body)

    labels = [ln for ln in pg.lines if not in_prose(ln["bbox"], ln["n"]) and touched(ln)]
    # Labelled first, trimmed second: the body-text trim must not cut away a
    # label paragraph and the leader line running into it.
    box = trim_body(pg, box, keep=labels)
    graphic_box = box
    for ln in labels:
        box = union(box, ln["bbox"])
    # A short line that ends a paragraph («الشكلَ (1).») is prose, not a label.
    prose = {ln["block"] for ln in pg.lines if ln["body"]}
    for _ in range(2):
        for ln in pg.lines:
            if (not ln["body"] and not ln["caption"] and ln["n"] <= 12 and ln["block"] not in prose
                    and not in_prose(ln["bbox"], ln["n"]) and near(box, ln["bbox"], LABEL_PAD)):
                box = union(box, ln["bbox"])
    # Caption, above or below, overlapping the figure horizontally.
    cap, cap_gap = None, 0.0
    for ln in pg.lines:
        b = ln["bbox"]
        overlap = min(b[2], box[2]) - max(b[0], box[0])
        if overlap < 0.3 * min(b[2] - b[0], box[2] - box[0]):
            continue
        below = 0 <= b[1] - box[3] <= CAPTION_REACH
        above = 0 <= box[1] - b[3] <= CAPTION_REACH
        # Without «الشكل», only a small block that sits within the figure's
        # width — a step heading running past it is the next paragraph.
        small_block = (not ln["body"] and ln["blockLines"] <= 3 and ln["size"] < pg.body_size
                       and ln["block"][0] >= box[0] - 10 and ln["block"][2] <= box[2] + 10)
        # A caption without «الشكل» sits under the figure; above it, a small
        # block is the end of a sidebar paragraph.
        if (ln["caption"] and (below or above)) or (small_block and below):
            gap = b[1] - box[3] if below else box[1] - b[3]
            if cap is None or gap < cap_gap:
                cap, cap_gap = ln, gap
    if cap:
        # The whole caption block: «الشكلُ (20): تحليلُ المتّجهِ» runs to two lines.
        for ln in pg.lines:
            if ln["block"] == cap["block"]:
                box = union(box, ln["bbox"])
        # ...and its second line, when the text layer split it into a block of
        # its own (Grade 10 physics p.23: «A إلى مُركّبتيه»).
        for ln in sorted(pg.lines, key=lambda ln: ln["bbox"][1]):
            b = ln["bbox"]
            if (not ln["body"] and b[1] - box[3] <= 4 and b[3] > box[3] and b[0] < box[2] and b[2] > box[0]
                    and abs(ln["size"] - cap["size"]) <= 1):
                box = union(box, b)
        note["caption"] = cap["text"][:60]
    # Never slice a label or caption line: take whole any that the box cuts
    # (Grade 10 physics p.23's caption runs to a second, separately stored line).
    for _ in range(3):
        cut = [ln["bbox"] for ln in pg.lines if not ln["body"]
               and 0.2 * area(ln["bbox"]) <= area(inter(ln["bbox"], box)) < 0.98 * area(ln["bbox"])]
        if not cut:
            break
        for b in cut:
            box = union(box, b)
    body_inside = sum(1 for ln in pg.lines if ln["body"] and ln not in labels
                      and area(inter(ln["bbox"], box)) > 0.5 * area(ln["bbox"]))
    note["bodyLinesInside"] = body_inside
    note["graphicBox"] = [round(v, 1) for v in graphic_box]
    return pad(pg, box), note


def pad(pg: Page, box):
    """Add MARGIN, but stop short of any text line the figure left out —
    a 6pt margin otherwise picks up the tops of the next paragraph's letters."""
    x0, y0, x1, y1 = box[0] - MARGIN, box[1] - MARGIN, box[2] + MARGIN, box[3] + MARGIN
    for ln in pg.lines:
        b = ln["bbox"]
        if area(inter(b, box)) >= 0.5 * area(b):
            continue
        across = b[0] < box[2] and b[2] > box[0]
        down = b[1] < box[3] and b[3] > box[1]
        if across and b[3] <= box[1] + 1:
            y0 = max(y0, min(b[3] + 0.5, box[1]))
        if across and b[1] >= box[3] - 1:
            y1 = min(y1, max(b[1] - 0.5, box[3]))
        if down and b[2] <= box[0] + 1:
            x0 = max(x0, min(b[2] + 0.5, box[0]))
        if down and b[0] >= box[2] - 1:
            x1 = min(x1, max(b[0] - 0.5, box[2]))
    return (max(pg.rect[0], x0), max(pg.rect[1], y0), min(pg.rect[2], x1), min(pg.rect[3], y1))


def classify(fig: dict, pg: Page) -> dict:
    old = tuple(fig["rect"])
    new, note = rebuild(pg, old)
    row = {"key": f"{fig['sourceId']}/{fig['file']}", "old": list(old), **note}
    if pg.text_box(old):
        row["class"] = "drop"
        row["why"] = "text callout, not a figure"
        return row
    if new is None:
        # Nothing visible but text or blank page under the rect.
        row["class"] = "drop"
        return row
    row["rect"] = [round(v, 1) for v in new]
    row["iou"] = round(iou(old, new), 3)
    page_frac = area(new) / (pg.W * pg.H)
    gb = note["graphicBox"]
    small = max(gb[2] - gb[0], gb[3] - gb[1]) < 60
    if page_frac > 0.7 or note["bodyLinesInside"] >= 4:
        row["class"] = "manual"
        row["why"] = "rebuild swallowed the page" if page_frac > 0.7 else "body text inside"
    elif small and not note.get("caption"):
        row["class"] = "drop"
        row["why"] = "lone small shape"
    elif pg.text_box(new):
        row["class"] = "drop"
        row["why"] = "text callout, not a figure"
    elif row["iou"] >= OK_IOU:
        row["class"] = "ok"
    else:
        row["class"] = "recrop"
    return row


# ── contact sheets ──────────────────────────────────────────────────────────

def sheet_row(doc, fig, row, width=1500, height=380):
    pg = doc[fig["pdfPage"] - 1]
    z = height / pg.rect.height
    pm = pg.get_pixmap(matrix=pymupdf.Matrix(z, z))
    page_im = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
    d = ImageDraw.Draw(page_im)
    d.rectangle([v * z for v in row["old"]], outline=(230, 0, 0), width=3)
    if row.get("rect"):
        d.rectangle([v * z for v in row["rect"]], outline=(0, 170, 0), width=3)
    old_im = Image.open(ROOT / Path(fig["index"]).parent / fig["file"]).convert("RGB")
    new_im = None
    if row.get("rect") and row["class"] == "recrop":
        nz = 1.6
        p2 = pg.get_pixmap(clip=pymupdf.Rect(row["rect"]), matrix=pymupdf.Matrix(nz, nz))
        new_im = Image.frombytes("RGB", (p2.width, p2.height), p2.samples)
    out = Image.new("RGB", (width, height + 22), "white")
    out.paste(page_im, (0, 22))
    x = page_im.width + 10
    slot = (width - x - 10) // 2
    for im in (old_im, new_im):
        if im is not None:
            im = im.copy()
            im.thumbnail((slot, height))
            out.paste(im, (x, 22))
        x += slot + 10
    d = ImageDraw.Draw(out)
    label = f"{row['key']}  [{row['class']}]  iou={row.get('iou')}  {row.get('why', '')}"
    d.text((4, 4), label, fill=(0, 0, 0))
    return out


def write_sheets(out: Path, sid: str, items, per=6):
    sheets = out / "sheets"
    sheets.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf_for(sid))
    for i in range(0, len(items), per):
        rows = [sheet_row(doc, fig, row) for fig, row in items[i:i + per]]
        im = Image.new("RGB", (rows[0].width, sum(r.height for r in rows) + 4 * len(rows)), (90, 90, 90))
        y = 0
        for r in rows:
            im.paste(r, (0, y))
            y += r.height + 4
        im.save(sheets / f"{items[i][1]['class']}-{sid}-{i // per:02d}.jpg", quality=82)


def audit_source(sid: str, figs: list[dict], out: Path) -> list[dict]:
    """One book: classify its figures, de-duplicate per page, write its sheets."""
    pdf = pdf_for(sid)
    if pdf is None or not pdf.exists():
        return [{"key": f"{sid}/{f['file']}", "old": f["rect"], "class": "manual", "why": "pdf missing",
                 "kbLessonId": f["kbLessonId"], "rankInLesson": f["rankInLesson"]} for f in figs]
    doc = pymupdf.open(pdf)
    pages, rows = {}, []
    for fig in figs:
        n = fig["pdfPage"]
        if n not in pages:
            pages[n] = Page(doc[n - 1])
        row = classify(fig, pages[n])
        row["kbLessonId"] = fig["kbLessonId"]
        row["rankInLesson"] = fig["rankInLesson"]
        rows.append((fig, row))
    # Two crops of one page that rebuild to the same figure: keep the first.
    seen: dict[int, list] = {}
    for fig, row in rows:
        if row["class"] not in ("ok", "recrop"):
            continue
        for other in seen.get(fig["pdfPage"], []):
            if area(inter(other["rect"], row["rect"])) > 0.8 * min(area(other["rect"]), area(row["rect"])):
                row["class"] = "drop"
                row["why"] = f"same figure as {other['key']}"
                break
        else:
            seen.setdefault(fig["pdfPage"], []).append(row)
    for cls in ("recrop", "drop", "manual", "ok"):
        items = [(f, r) for f, r in rows if r["class"] == cls]
        if items:
            write_sheets(out, sid, items)
    done = [r for _, r in rows]
    (out / "rows").mkdir(exist_ok=True)
    (out / "rows" / f"{sid}.json").write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
    return done


def audit(out: Path, only: set[str]) -> None:
    from concurrent.futures import ProcessPoolExecutor
    figs = [f for f in deck_figures()
            if not only or f["sourceId"] in only or f"{f['sourceId']}/{f['file']}" in only]
    by_src: dict[str, list] = {}
    for f in figs:
        by_src.setdefault(f["sourceId"], []).append(f)
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    # Rendering dominates (seconds a page on the heavy science books), so books
    # run in parallel, largest first.
    with ProcessPoolExecutor(max_workers=6) as pool:
        # A book already audited into <out>/rows is not redone: a run that dies
        # part-way (it once filled the disk) resumes where it stopped.
        todo = []
        for sid, fl in sorted(by_src.items(), key=lambda kv: -len(kv[1])):
            done = out / "rows" / f"{sid}.json"
            if done.exists():
                rows.extend(json.loads(done.read_text(encoding="utf-8")))
            else:
                todo.append(pool.submit(audit_source, sid, fl, out))
        for j in todo:
            rows.extend(j.result())
    (out / "audit.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["class"]] = counts.get(r["class"], 0) + 1
    print(json.dumps(counts))


def _dump_like(raw: str, data) -> str:
    """Serialise `data` the way `raw` was, so the diff is only the figures that changed."""
    for indent in (1, 2):
        for ascii_ in (False, True):
            for nl in ("\n", ""):
                if json.dumps(json.loads(raw), indent=indent, ensure_ascii=ascii_) + nl == raw:
                    return json.dumps(data, indent=indent, ensure_ascii=ascii_) + nl
    raise SystemExit("index.json in an unrecognised format; refusing to rewrite it")


def next_version(name: str) -> str:
    """`p011.png` → `p011-v2.png` → `p011-v3.png`.

    A re-crop gets a new key instead of overwriting the old one: the R2
    uploader skips keys the bucket already has, and every installed build
    still asks for the old name until an update ships the new list.
    """
    m = re.match(r"^(p\d{3}[a-z]?)(?:-v(\d+))?\.png$", name)
    if not m:
        raise SystemExit(f"unexpected figure name {name}")
    return f"{m.group(1)}-v{int(m.group(2) or 1) + 1}.png"


def apply(decisions_path: Path) -> None:
    """Write reviewed decisions back: `[{key, action: recrop|drop, rect?}]`."""
    decisions = {d["key"]: d for d in json.loads(decisions_path.read_text(encoding="utf-8"))}
    figs = {f"{f['sourceId']}/{f['file']}": f for f in deck_figures()}
    unknown = set(decisions) - set(figs)
    if unknown:
        raise SystemExit(f"not deck figures: {sorted(unknown)[:5]}")
    by_index: dict[str, list] = {}
    for key, d in decisions.items():
        by_index.setdefault(figs[key]["index"], []).append(d)
    docs = {}
    for rel, ds in sorted(by_index.items()):
        path = ROOT / rel
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        want = {d["key"].split("/", 1)[1]: d for d in ds}
        kept = []
        for f in data["figures"]:
            d = want.get(f["file"])
            if d is None:
                kept.append(f)
                continue
            old_png = path.parent / f["file"]
            if d["action"] == "drop":
                old_png.unlink()
                continue
            assert d["action"] == "recrop", d
            sid = f["sourceId"]
            if sid not in docs:
                docs[sid] = pymupdf.open(pdf_for(sid))
            new_name = next_version(f["file"])
            page = docs[sid][f["pdfPage"] - 1]
            page.get_pixmap(clip=pymupdf.Rect(d["rect"]), dpi=dpi_for(sid)).save(path.parent / new_name)
            old_png.unlink()
            kept.append({**f, "file": new_name, "rect": [round(v, 1) for v in d["rect"]]})
        data["figures"] = kept
        path.write_text(_dump_like(raw, data), encoding="utf-8")
        print(f"{rel}: {len(ds)} changed")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[2] == "--apply":
        apply(Path(sys.argv[3]))
    else:
        audit(Path(sys.argv[1]), set(sys.argv[2:]))
