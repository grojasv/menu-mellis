# Changelog

All notable changes to Menú Mellis. Format: [Keep a Changelog](https://keepachangelog.com/), versions: [SemVer](https://semver.org/). New feature = minor, fix or monthly data = patch.

## [0.3.0] — 2026-10-22
### Added
- **Watch CIDE menu** GitHub Action (`.github/workflows/watch-menu.yml`, every day 05:00 UTC + manual run): finds the menu PDF on the school page and, if it isn't in the site yet, opens one `menu-pdf` issue assigned to @grojasv with the link and "run `/update-menu`". The same issue is updated if the school replaces the PDF again; open issues are closed once the PDF is processed. No API key involved.
- `scripts/watch-menu.mjs` (`--dry-run`, `--pretend-new` to test the issue flow; the manual run has a "pretend new" switch).

## [0.2.0] — 2026-10-22
### Added
- All 15 October menus (general, Petit CIDE, puréed, diabetic 6R/7R, gluten-, lactose-, egg-, fish- and nut-free combinations, vegetarian), read from every page of the PDF.
- `/update-menu` Claude Code command: fetch the PDF, split it, read each page, build, validate, commit.
- `scripts/fetch-menu.mjs` (finds the menu PDF on the school page and says if it was already processed), `scripts/split-pdf.py`, `scripts/build-month.mjs` (expands `data/src/YYYY-MM.json`: general menu + differences per variant) and `scripts/validate.mjs`.
- `data/variants.json` with the canonical menu ids and their names in CA/ES/EN.
- Diabetic portion notes and bread under each dish; "From the general menu" under borrowed dinner ideas.
- `?menu=<id>` URL parameter to view another menu until the picker exists.
### Changed
- `data/2026-10.json` is now generated and minified (~14 KB gzipped). The general menu is unchanged.

## [0.1.0] — 2026-10-22
### Added
- Today card: school lunch (emoji per dish) and the school's dinner idea, with "Today / Tomorrow / Yesterday".
- ‹ › arrows, keyboard arrows and swipe to move between school days. Weekends open on Monday.
- Holiday (FESTIU) and no-classes days. "Menu not loaded yet" card with a link to the school's page after the last loaded day.
- CA / ES / EN switch (remembered on the phone), light and dark mode, layout checked at 320×568 and 390×844.
- October 2026 general menu (`data/2026-10.json`), hand-checked against the PDF. Where the ES page disagrees with CA (salads on 13 and 16 Oct, dinner on 23 Oct), CA wins.
