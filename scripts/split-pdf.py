"""Split the menu PDF into one file per page and list each page's title, so Claude can read them one by one.

    uv run --with pypdf python -I scripts/split-pdf.py <menu.pdf> <out-dir>

Prints one line per page: "<file>  <title>  <month line>". Titles come from text extraction, which is fine for
headers; the day grid itself must be read from the page image (text extraction mixes the weekday columns).
"""
import re
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
reader = PdfReader(src)
for i, page in enumerate(reader.pages, start=1):
    writer = PdfWriter()
    writer.add_page(page)
    path = out / f"p{i:02d}.pdf"
    with path.open("wb") as f:
        writer.write(f)
    lines = [l.strip() for l in (page.extract_text() or "").splitlines() if l.strip()]
    # Title = lines before the "<MONTH> <YEAR>" line (some titles wrap onto two lines)
    month_idx = next((j for j, l in enumerate(lines[:4]) if re.search(r"\b20\d\d\b", l)), 1)
    title = " ".join(lines[:month_idx])
    month = lines[month_idx] if month_idx < len(lines) else ""
    print(f"{path}\t{title}\t{month}")
