---
description: Read the new CIDE menu PDF and publish it to Menú Mellis (download, read all pages, build, validate, commit, push)
argument-hint: "[--force] (re-read even if this PDF was already processed)"
---

Update Menú Mellis from the school's current menu PDF. Data format and rules are in `CLAUDE.md` — read it first.

## 1. Fetch
```bash
node scripts/fetch-menu.mjs --out <scratch dir>/menu
```
- `processedIn` not null and no `--force` in "$ARGUMENTS" → say "already up to date (<month>)", close any open
  "New CIDE menu PDF" issue (`gh issue list --label menu-pdf --state open`) with a comment, and stop.
- Errors (page changed, 0 or 2+ menu PDFs) → stop and show the message. Don't guess a URL.

## 2. Split and map pages
```bash
uv run --with pypdf python -I scripts/split-pdf.py <menu.pdf> <scratch dir>/menu/pages
```
- Read the month from the page headers (e.g. `NOVEMBRE 2026` → `2026-11`).
- Map every page title to a variant in `data/variants.json` (`pdfTitle`, and `pdfTitleEs` for the Spanish general
  page). A title that matches nothing, or a variant with no page → **stop and ask Guille** (new or dropped menu:
  `data/variants.json` and the app need a decision; never rename an existing id).

## 3. Read the pages (one page per Read call)
Read each `pNN.pdf` and look at the page image; don't parse the extracted text (the weekday columns get mixed).
1. **General (CA page)** in full: every weekday's status, courses (`first`, `second`, `side`, `dessert`) with
   allergen numbers, and the "Proposta de sopar" items. Mind the first week (the month may start mid-week).
2. **General (ES page)**: use its wording for `es`, but CA wins where they disagree. List the disagreements for the
   final report.
3. **Every other variant**: compare cell by cell with its base and write only the differences. Bold text marks
   changes, but compare the whole cell: allergen numbers change without bold (e.g. gluten-free breaded hake `(4)`).
   - Pick the closest `base` (another variant if the page is identical or nearly identical to it, e.g. 5.1 = 3,
     5.2.1 = 4 in October 2026; diabetic 7R = 6R + fruit/bread portions). Re-check every month; never assume.
   - `dinner`: `"page"` if the page has "Proposta de sopar" rows, `"none"` for the puréed menu, else `"general"`.
   - Diabetic pages: portion notes go in `note` (`3R: 195 g de patata bullida o crua`), bread is the `bread`
     course (`Pa integral` + note, or `Sense pa`), fruit carries its `1R`/`2R` note.
4. Translate to ES and EN as described in `CLAUDE.md` (local dish names kept, explained briefly in EN).

## 4. Write the source and build
- Write `data/src/YYYY-MM.json` (format at the top of `scripts/build-month.mjs`). If the file exists (mid-month
  "modificat" PDF), edit only what changed and say what changed.
- `node scripts/build-month.mjs data/src/YYYY-MM.json` → must end with ✔. Fix every ✖; add an `emoji` to dishes
  with a ⚠ emoji warning.

## 5. Check
- Spot-check 3 random days × 3 variants against the page images (`node -e` on `data/YYYY-MM.json`).
- Look at the page in the browser: `python3 -m http.server` and open today (or the month's first school day) for
  `general` and one diet variant via `?menu=<id>`, at 320×568.

## 6. Publish
- `CHANGELOG.md`: patch version, "Data: <month> menu (<PDF filename>)" + anything notable (ES/CA disagreements,
  new dishes, mid-month changes).
- Show Guille a short summary (month, days, holidays/no-class days, disagreements, anything odd) and **ask before
  committing**. Then commit (repo git config, noreply email) and push.
- Close the open `menu-pdf` issue with a comment linking the commit.
