# Menú Mellis — spec (v1)

What the twins eat at CIDE today, on the phone, in one glance. Built from the school's monthly menu PDF
(https://www.cide.es/espai-migdia-menjadors/), refreshed by Claude on Guille's Mac — no API key anywhere.

Refined with Guille on 2026-10-22.

## Decisions

| Topic | Decision |
|---|---|
| Audience | Our family. Public GitHub Pages site, but tuned for us. |
| Repo | New repo `grojasv/menu-mellis` → `https://grojasv.github.io/menu-mellis/` |
| Main view | **Today** card first; swipe / arrows for next & previous school day. Weekend opens on Monday. |
| Variants | All 16 menus. First visit asks "which menu?"; choice remembered in `localStorage`. |
| Languages | CA / ES / EN with flag buttons (as in Laboratorio Mellis), remembered. |
| Extras v1 | Dinner suggestion · afternoon snack (berenar) · add to home screen (PWA, offline). |
| Not in v1 | Allergen icons (numbers kept in the data for later). |
| Style | Calm & readable: big type, one food emoji per dish, light/dark mode. |
| Stale data | Banner "Menu for November not loaded yet" + button to the official PDF. |
| Updates | GitHub Action watches daily (free, no key) → opens an issue → Guille runs `/update-menu` in Claude Code. |

## How the update works

```
 every morning                            when the PDF changed (≈1–2×/month)
┌──────────────────────┐   issue + push   ┌────────────────────────────────────┐
│ GitHub Action        │ ───────────────▶ │ Guille: `claude` in repo           │
│ watch-menu.yml       │  to the phone    │ → /update-menu                     │
│ curl page → find PDF │                  │ download · split pages · Claude    │
│ sha256 ≠ data? alert │                  │ reads · JSON · validate · commit   │
└──────────────────────┘                  └────────────────────────────────────┘
```

### 1. Watcher — `.github/workflows/watch-menu.yml`
- Cron daily ~07:00 Madrid + manual `workflow_dispatch`.
- `curl` the menjador page, take the `<a href>` whose filename matches `menu` and is **not** `Berenars`/`Resolucio`.
  Filename and upload folder change every month (`/2026/09/Menu-octubre-modificat.pdf`), so never build the URL.
- Download, `sha256sum`, compare with `source.sha256` in the newest `data/*.json`. Same → exit quietly.
- Different → open an issue "New CIDE menu PDF: <filename>" with the link, **only if no such issue is already open**
  (otherwise update its body). `/update-menu` closes it.
- Why daily and not day 1–2: the October PDF was replaced on 19 Oct ("modificat"); new months may also arrive late
  or early.
- ⚠️ Verify on first run that cide.es doesn't block GitHub runner IPs (curl only tested from the Mac).

### 2. `/update-menu` — project command `.claude/commands/update-menu.md`
Run by Claude Code on the Mac, using Guille's normal Claude subscription. Steps:
1. Fetch the page, resolve the PDF link (same rule as the watcher), download to a temp folder.
2. Split into single-page PDFs (`pypdf`, via `uv run --with pypdf` so nothing is installed globally) — the
   Read tool needs ≤10 pages per file and the Mac has no `pdftoppm`. Proven: a single page reads as a clean image
   with the day grid intact.
3. Claude reads each page and maps it to one of the **16 canonical variants** (table below). Pages are identified
   by title, not position. Unknown or missing variant → **stop and report**, don't guess.
4. Write `data/YYYY-MM.json` (schema below). CA is the source; ES comes from page 2 for the general menu and is
   translated for the other variants; EN is always translated. Keep dish names local where natural
   ("Tumbet", "Sopes mallorquines", "Trempó").
5. Validate (`scripts/validate.mjs`, Node, no deps): every weekday of the month present for every variant,
   status in the allowed set, 3 languages on every string, allergens are integers 1–14.
6. Show Guille a short diff summary (days/dishes changed vs the previous version), then commit
   (noreply email) + push, close the watcher issue.

### Canonical variants (stable ids — never rename)
| id | PDF title |
|---|---|
| `general` | MENÚ AMB PROPOSTES DE SOPARS (p1 CA / p2 ES) |
| `petit-cide` | MENÚ PETIT CIDE AMB PROPOSTES DE SOPARS |
| `petit-cide-triturat` | MENÚ PETIT CIDE TRITURAT |
| `diabetic-6r` | MENÚ 0.1 DIABÈTIC 6R |
| `diabetic-7r` | MENÚ 0.2 DIABÈTIC 7R |
| `no-gluten` | MENÚ 1 NO GLUTEN |
| `no-gluten-lactosa-plv` | MENÚ 1.2 NO GLUTEN NI LACTOSA NI PLV |
| `no-lactosa-plv` | MENÚ 2 NO LACTOSA NI PLV |
| `no-ou` | MENÚ 3 NO OU |
| `no-peix-marisc` | MENÚ 4 NO PEIX NI MARISC |
| `no-fruits-secs` | MENÚ 5 NO FRUITS SECS |
| `no-fruits-secs-ou` | MENÚ 5.1 NO FRUITS SECS NI OU |
| `no-fruits-secs-marisc` | MENÚ 5 NO FRUITS SECS NI MARISC (NI CEFALÒPODES) |
| `no-fruits-secs-peix` | MENÚ 5.2.1 NO FRUITS SECS NI PEIX NI … (confirm full title on next PDF) |
| `vegetaria` | MENÚ 6 OVO-LACTI-VEGETARIÀ |

(15 ids + the ES page of `general` = 16 pages.) Menu codes aren't unique ("MENÚ 5" twice), hence slugs.

## Data — `data/YYYY-MM.json` + `data/index.json`

```jsonc
// data/index.json — which months exist (front end loads current + neighbours for swiping)
{ "months": ["2026-10", "2026-11"] }

// data/2026-10.json
{
  "month": "2026-10",
  "source": { "url": "https://www.cide.es/wp-content/uploads/2026/09/Menu-octubre-modificat.pdf",
              "sha256": "…", "processedAt": "2026-10-22T09:00:00+02:00" },
  "variants": {
    "general": {
      "days": {
        "2026-10-01": {
          "status": "school",                 // school | holiday (FESTIU) | no-classes (CLASSES SUSPESES)
          "courses": [
            { "role": "first",   "emoji": "🥗", "text": { "ca": "…", "es": "…", "en": "…" }, "allergens": [7],
              "changed": false },             // true when bold on a variant page (differs from general)
            { "role": "second",  "emoji": "🍝", "text": {…}, "allergens": [1,3,6,7] },
            { "role": "side",    "emoji": "🥬", "text": {…}, "allergens": [] },
            { "role": "dessert", "emoji": "🍎", "text": {…}, "allergens": [] }
          ],
          "dinner": { "items": [ { "emoji": "🐟", "text": {…}, "allergens": [4] } ], "fromGeneral": false }  // null if none
        }
      }
    }
  }
}
```
- Alternatives ("Arròs brut o Gaspatxo", "Iogurt (7) o Fruita") stay in one `text`; the UI shows them as-is.
- Variants with no "Proposta de sopar" (e.g. no-gluten) get the general menu's dinner with `fromGeneral: true`
  and a small "suggestion from the general menu" note. (Open: confirm with Guille once he sees it.)
- `status` other than `school` → card shows "No school 🎉" / "No classes" instead of dishes; the triturat page
  still lists a dish on 19 Oct — keep it in `raw`, status wins.

### Berenars — `data/berenars-2026-27.json` (static, once per school year)
Fixed weekly rotation for Infantil + 1st cycle Primary: Mon apple · Tue tomato & cheese sandwich · Wed pear ·
Thu banana · Fri tomato, olive & cheese sandwich (allergen notes kept). CA PDF is the source (ES differs slightly).
Re-check when "Berenars-2027-28.pdf" appears.

## Front end
- Plain HTML/CSS/JS, **no build step**, relative paths only (served under `/menu-mellis/`).
- Screens: **variant picker** (first visit, re-open from ⚙️) → **Today card**: date, 4 dishes with emoji,
  🍪 berenar, 🌙 dinner suggestion. Swipe/arrow to the next school day, crossing month files.
- Small-phones rule from Mellis: the whole Today card readable at **320×568** and 390×844 with no need to scroll
  to find navigation; arrows always on screen.
- PWA: `manifest.webmanifest` + service worker. **Network-first for `data/*.json`** (cache fallback offline),
  cache-first for app shell — so a fresh push is never hidden behind the cache.
- Stale banner: if today's month isn't in `index.json` → banner + link to the official PDF.

## Repo conventions (carried from Laboratorio Mellis)
- `CLAUDE.md`: schema, canonical variant table, `/update-menu` rules, small-phones rule.
- `CHANGELOG.md` with SemVer, updated in the same commit as each change (data refreshes logged as patch entries).
- Commits with `4202945+grojasv@users.noreply.github.com`, never the work address.

## Build order
1. Repo + Pages + static shell with hand-made `2026-10.json` for `general` (prove the UI).
2. `/update-menu` command + validator → generate the full October file from the real PDF.
3. Watcher Action + issue flow.
4. PWA + stale banner + berenars.
5. First real run on the November PDF.

## Open questions
- Which variant(s) do the twins use? (Pre-select it.)
- Dinner fallback for variants without a dinner suggestion: show the general one (proposed) or hide?
- Should the Today card also show tomorrow's first dish as a teaser at night (after ~18:00)?
