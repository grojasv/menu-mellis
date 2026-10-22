# 🍽️ Menú Mellis

What the twins eat at CIDE today, on the phone, in CA / ES / EN.

**Live:** https://grojasv.github.io/menu-mellis/

Data comes from the school's monthly menu PDF on the [menjador page](https://www.cide.es/espai-migdia-menjadors/), read by Claude (no API key anywhere). See [SPEC.md](SPEC.md) for the plan.

## Structure
- `index.html`, `style.css`, `app.js`: the whole app. Plain HTML/CSS/JS, no build step.
- `data/index.json`: list of loaded months.
- `data/YYYY-MM.json`: one month of menus (schema in `CLAUDE.md`).

## Run locally
```bash
python3 -m http.server 8765
```
Then open http://localhost:8765/.
