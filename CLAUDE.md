# Menú Mellis — project rules

Phone-first page with the CIDE school lunch for today (+ dinner idea), from the monthly menu PDF. Plain HTML/CSS/JS, no build step, GitHub Pages under `/menu-mellis/` (relative paths only). Plan and roadmap: `SPEC.md`.

## Data
Update flow: the Action `.github/workflows/watch-menu.yml` (`scripts/watch-menu.mjs`, first 3 and last 3 days of each month) opens a `menu-pdf` issue when the school's page links a menu PDF the site doesn't have (it compares the link with `source.url` and never downloads the PDF: cide.es blocks GitHub's servers after one request) → Guille runs `/update-menu` (`.claude/commands/update-menu.md`), which closes it. Pipeline: `scripts/fetch-menu.mjs` → `scripts/split-pdf.py` → Claude writes `data/src/YYYY-MM.json` → `scripts/build-month.mjs` → `scripts/validate.mjs`.

- **Only the general menu is published** (decided by Guille, November 2026). The PDF's other pages (Petit CIDE, diets, allergies…) are ignored; their October data is in git history (≤ 0.5.0).
- `data/variants.json`: just `general` (PDF titles CA/ES, name in CA/ES/EN). The variant machinery in `build-month.mjs`/the app stays but is unused; `?menu=<anything>` shows the general menu.
- `data/src/YYYY-MM.json`: **the source of truth, written by Claude from the PDF**: the general menu in full (format at the top of `scripts/build-month.mjs`). Review data changes here.
- `data/YYYY-MM.json`: generated (minified), what the app loads. Never edit by hand.
  - `source`: `{ url, sha256, processedAt }` of the PDF it came from (the watcher compares `url`; `/update-menu` compares `sha256`).
  - `variants.<id>.days["YYYY-MM-DD"]`: `{ status, courses, dinner }`
    - `status`: `school` | `holiday` (FESTIU) | `no-classes` (CLASSES SUSPESES). Non-school days have `courses: []`.
    - `courses[]`: `{ role: first|second|side|dessert, emoji, text: {ca,es,en}, allergens: [1–14] }`. Two dishes in one cell ("Lassanya … / Canelons …") become one course "A o B" with both dishes' allergens.
    - `dinner`: `{ items: [{ emoji, text, allergens }], fromGeneral: false }` or `null`.
- `data/index.json` → `{ "months": ["2026-10", …] }`, sorted, maintained by the build.
- **CA is the source.** ES comes from the ES page when it matches CA; when the two pages disagree, follow CA and translate. EN is always translated. Keep local dish names (arròs brut, tumbet, trempó, sopes mallorquines, raoles) and explain them briefly in EN. Fix obvious typos (`910` → `9,10`, "hamburguesa se soja" → "de soja").
- Allergen numbers are kept but not shown yet.
- Emoji = the head noun of the dish, picked by keyword in `build-month.mjs` (🥗 salad, 🥣 soup/cream, 🫘 legumes, 🍝 pasta, 🍚 rice, 🐟 fish, 🍗 poultry, 🍳 egg/omelette, 🥔 potato, 🍎 fruit, 🥛 yogurt, 🍞 bread). Add a keyword or an `emoji` field when the build warns.
- `node scripts/validate.mjs` must pass before every commit that touches `data/`.

## Reading the PDF
The Read tool needs ≤10 pages per PDF, and this Mac has no `pdftoppm`: split it into single pages (pypdf) and read each one. Text extraction (pypdf `extract_text`) mixes the 5 weekday columns together, so don't parse that; read the page image.

## Small phones
Today's lunch must be readable at **320×568** without scrolling, and the ‹ › arrows always on screen (sticky day bar). Check 320×568 and 390×844, light and dark, after any UI change.

## App install (PWA)
- `manifest.webmanifest` + `sw.js` (network-first for everything; the cache is only the offline fallback). Bump `CACHE` in `sw.js` when its `SHELL` list changes.
- Icons in `icons/` are generated: `node scripts/make-icons.mjs` (same twins drawing as `app.js`; needs uv).

## Conventions
- CA / ES / EN for every UI string (`TEXT` in `app.js`).
- `CHANGELOG.md` (Keep a Changelog + SemVer) updated in the same commit. Monthly data refreshes = patch.
- Commits use the GitHub noreply email (repo-local git config), never a work address.
