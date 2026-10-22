# Menú Mellis — project rules

Phone-first page with the CIDE school lunch for today (+ dinner idea), from the monthly menu PDF. Plain HTML/CSS/JS, no build step, GitHub Pages under `/menu-mellis/` (relative paths only). Plan and roadmap: `SPEC.md`.

## Data
Update flow: `/update-menu` (`.claude/commands/update-menu.md`). Pipeline: `scripts/fetch-menu.mjs` → `scripts/split-pdf.py` → Claude writes `data/src/YYYY-MM.json` → `scripts/build-month.mjs` → `scripts/validate.mjs`.

- `data/variants.json`: the canonical menus (id, PDF title, name in CA/ES/EN). Ids are fixed slugs; never rename one (phones remember them). A new or dropped menu in the PDF is a decision for Guille.
- `data/src/YYYY-MM.json`: **the source of truth, written by Claude from the PDF**. The general menu in full, every other variant as differences from a `base` (format at the top of `scripts/build-month.mjs`). Review data changes here.
- `data/YYYY-MM.json`: generated (minified), what the app loads. Never edit by hand.
  - `source`: `{ url, sha256, processedAt }` of the PDF it came from (the watcher compares `sha256`).
  - `variants.<id>.days["YYYY-MM-DD"]`: `{ status, courses, dinner }`
    - `status`: `school` | `holiday` (FESTIU) | `no-classes` (CLASSES SUSPESES). Non-school days have `courses: []`.
    - `courses[]`: `{ role: first|second|side|dessert|bread, emoji, text: {ca,es,en}, allergens: [1–14], note?, changed? }`. `note` = diabetic portions (`3R: 195 g …`). `changed` (non-general variants) = differs from the general menu's course.
    - `dinner`: `{ items: [{ emoji, text, allergens }], fromGeneral }` or `null`. Diet menus without their own dinner idea show the general one (`fromGeneral: true`); the puréed menu has none.
- `data/index.json` → `{ "months": ["2026-10", …] }`, sorted, maintained by the build.
- **CA is the source.** ES comes from the ES page when it matches CA; when the two pages disagree, follow CA and translate. EN is always translated. Keep local dish names (arròs brut, tumbet, trempó, sopes mallorquines, raoles) and explain them briefly in EN. Fix obvious typos (`910` → `9,10`, "hamburguesa se soja" → "de soja").
- Allergen numbers are kept but not shown yet.
- Emoji = the head noun of the dish, picked by keyword in `build-month.mjs` (🥗 salad, 🥣 soup/cream, 🫘 legumes, 🍝 pasta, 🍚 rice, 🐟 fish, 🍗 poultry, 🍳 egg/omelette, 🥔 potato, 🍎 fruit, 🥛 yogurt, 🍞 bread). Add a keyword or an `emoji` field when the build warns.
- `node scripts/validate.mjs` must pass before every commit that touches `data/`.

## Reading the PDF
The Read tool needs ≤10 pages per PDF, and this Mac has no `pdftoppm`: split it into single pages (pypdf) and read each one. Text extraction (pypdf `extract_text`) mixes the 5 weekday columns together, so don't parse that; read the page image.

## Small phones
Today's lunch must be readable at **320×568** without scrolling, and the ‹ › arrows always on screen (sticky day bar). Check 320×568 and 390×844, light and dark, after any UI change.

## Conventions
- CA / ES / EN for every UI string (`TEXT` in `app.js`).
- `CHANGELOG.md` (Keep a Changelog + SemVer) updated in the same commit. Monthly data refreshes = patch.
- Commits use the GitHub noreply email (repo-local git config), never a work address.
