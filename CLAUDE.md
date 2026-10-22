# Menú Mellis — project rules

Phone-first page with the CIDE school lunch for today (+ dinner idea), from the monthly menu PDF. Plain HTML/CSS/JS, no build step, GitHub Pages under `/menu-mellis/` (relative paths only). Plan and roadmap: `SPEC.md`.

## Data
- `data/index.json` → `{ "months": ["2026-10", …] }`, sorted. The app loads every listed month (swiping crosses months).
- `data/YYYY-MM.json`:
  - `source`: `{ url, sha256, processedAt }` of the PDF it came from (the watcher compares `sha256`).
  - `variants.<id>.days["YYYY-MM-DD"]`: `{ status, courses, dinner }`
    - `status`: `school` | `holiday` (FESTIU) | `no-classes` (CLASSES SUSPESES). Non-school days have `courses: []`.
    - `courses[]`: `{ role: first|second|side|dessert, emoji, text: {ca,es,en}, allergens: [1–14] }`. Days with only 2 dishes skip `side`.
    - `dinner`: `{ items: [{ emoji, text, allergens }], fromGeneral }` or `null`.
- Variant ids are fixed slugs (table in `SPEC.md`); never rename one. Only `general` exists so far.
- **CA is the source.** ES comes from the ES page when it matches CA; when the two pages disagree, follow CA and translate. EN is always translated. Keep local dish names (arròs brut, tumbet, trempó, sopes mallorquines, raoles) and explain them briefly in EN.
- Allergen numbers are kept but not shown yet. Fix the PDF's `910` typo as `9,10`.
- Emoji = the head noun of the dish (🥗 salad, 🥣 soup/cream, 🫘 legumes, 🍝 pasta, 🍚 rice, 🐟 fish, 🍗 poultry, 🍳 egg/omelette, 🥔 potato, 🍎 fruit, 🥛 yogurt).

## Reading the PDF
The Read tool needs ≤10 pages per PDF, and this Mac has no `pdftoppm`: split it into single pages (pypdf) and read each one. Text extraction (pypdf `extract_text`) mixes the 5 weekday columns together, so don't parse that; read the page image.

## Small phones
Today's lunch must be readable at **320×568** without scrolling, and the ‹ › arrows always on screen (sticky day bar). Check 320×568 and 390×844, light and dark, after any UI change.

## Conventions
- CA / ES / EN for every UI string (`TEXT` in `app.js`).
- `CHANGELOG.md` (Keep a Changelog + SemVer) updated in the same commit. Monthly data refreshes = patch.
- Commits use the GitHub noreply email (repo-local git config), never a work address.
