#!/usr/bin/env python3
"""Extract dolphin profiles, embedded photos and page renders from the source PDF.

Usage: python3 -I scripts/extract_content.py
Requires poppler (pdftotext, pdfimages, pdftoppm) and Pillow.

Outputs (all committed so deploys don't need poppler):
  data/dolphins.json
  server/content/photos/<slug>-<n>.jpg        full-size (max 1600px)
  server/content/thumbs/<slug>-<n>.jpg        thumbnails (max 480px)
  server/content/pages/page-<NN>.jpg          rendered source slides
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "resources" / "Dolphin ID Slideshow.pptx - Google Slides.pdf"
OUT = ROOT / "server" / "content"
DATA = ROOT / "data" / "dolphins.json"

FIELD_RE = re.compile(
    r"^(DOB|Parents|Place of Origin|Offspring|Rescued|Defining Features?)\s*:\s*(.*)$"
)
FIELD_KEYS = {
    "DOB": "dob",
    "Parents": "parents",
    "Place of Origin": "placeOfOrigin",
    "Offspring": "offspring",
    "Rescued": "rescued",
    "Defining Feature": "definingFeatures",
    "Defining Features": "definingFeatures",
}


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def page_count():
    info = run("pdfinfo", str(PDF))
    return int(re.search(r"^Pages:\s+(\d+)", info, re.M).group(1))


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def parse_page(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    name, rest = lines[0], lines[1:]
    d = {"name": name, "bornAtDrc": False}
    current = None
    for line in rest:
        if line == "Born at DRC":
            d["bornAtDrc"] = True
            continue
        m = FIELD_RE.match(line)
        if m:
            current = FIELD_KEYS[m.group(1)]
            d[current] = m.group(2).strip()
        elif current:
            d[current] = (d[current] + " " + line).strip()
        else:
            raise ValueError(f"unparsed line on {name}: {line!r}")
    return d


# Each slide may carry one small "animal sign" picture (a symbol on a pole, ring, frisbee...)
# next to the animal photos. Anything placed smaller than this (in PDF points^2) is a sign.
SIGN_MAX_AREA = 30000


def placed_sizes(reader):
    """Placed (width, height) in points of each image drawn on each page, in draw order."""
    def mul(a, b):
        return [a[0]*b[0]+a[1]*b[2], a[0]*b[1]+a[1]*b[3], a[2]*b[0]+a[3]*b[2], a[2]*b[1]+a[3]*b[3],
                a[4]*b[0]+a[5]*b[2]+b[4], a[4]*b[1]+a[5]*b[3]+b[5]]
    result = {}
    for pn, page in enumerate(reader.pages, 1):
        sizes, stack, ctm = [], [], [1, 0, 0, 1, 0, 0]
        xobjs = page["/Resources"].get("/XObject", {})
        for args, op in ContentStream(page.get_contents(), reader).operations:
            if op == b"q":
                stack.append(ctm)
            elif op == b"Q":
                ctm = stack.pop() if stack else [1, 0, 0, 1, 0, 0]
            elif op == b"cm":
                ctm = mul([float(x) for x in args], ctm)
            elif op == b"Do" and xobjs[args[0]].get_object().get("/Subtype") == "/Image":
                w, h = abs(ctm[0]), abs(ctm[3])
                sizes.append((w, h))
        result[pn] = sizes
    return result


def fit(img, max_side):
    img = img.convert("RGB")
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    return img


def main():
    n_pages = page_count()
    for sub in ("photos", "thumbs", "pages"):
        shutil.rmtree(OUT / sub, ignore_errors=True)
        (OUT / sub).mkdir(parents=True)

    placed = placed_sizes(PdfReader(str(PDF)))
    dolphins = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        # Embedded photos, original JPEG bytes, one file per image, tagged by page.
        run("pdfimages", "-j", "-p", str(PDF), str(tmp / "img"))
        # Rendered pages for the source viewer.
        run("pdftoppm", "-r", "130", "-jpeg", "-jpegopt", "quality=82", str(PDF), str(tmp / "pg"))

        for page in range(1, n_pages + 1):
            shutil.copy(next(tmp.glob(f"pg-{page:02d}.jpg")), OUT / "pages" / f"page-{page:02d}.jpg")
            if page == 1:
                continue  # title slide
            text = run("pdftotext", "-f", str(page), "-l", str(page), "-layout", str(PDF), "-")
            d = parse_page(text)
            d["slug"] = slugify(d["name"])
            d["page"] = page
            photos = sorted(tmp.glob(f"img-{page:03d}-*.jpg"))
            sizes = placed[page]
            if len(sizes) != len(photos):
                raise SystemExit(f"page {page}: {len(photos)} extracted vs {len(sizes)} placed images")
            d["photos"], d["animalSigns"] = [], []
            for i, p in enumerate(photos, 1):
                w, h = sizes[i - 1]
                # A few slides have malformed transform numbers, so the placed size reads as 0.
                # Those are always the small sign picture (checked against the rendered slides).
                im0 = Image.open(p)
                if w * h and abs(im0.width / im0.height - w / h) > 0.15 * (w / h) and not (w * h > 300000):
                    print(f"  warn: page {page} image {i} aspect differs (cropped?)")
                fname = f"{d['slug']}-{i}.jpg"
                im = Image.open(p)
                fit(im, 1600).save(OUT / "photos" / fname, quality=84, optimize=True)
                fit(im, 480).save(OUT / "thumbs" / fname, quality=80, optimize=True)
                (d["animalSigns"] if w * h < SIGN_MAX_AREA else d["photos"]).append(fname)
            dolphins.append(d)

    DATA.parent.mkdir(exist_ok=True)
    DATA.write_text(json.dumps(dolphins, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(dolphins)} dolphins, {sum(len(d['photos']) for d in dolphins)} photos -> {DATA}")


if __name__ == "__main__":
    sys.exit(main())
