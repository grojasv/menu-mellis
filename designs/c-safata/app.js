// Menú Mellis — design C "Safata" (bold tiles, like a lunch tray). Same behaviour as the live app.js; only the markup in render() differs.
// Prototype extras: ?date=YYYY-MM-DD opens on that day, ?theme=light|dark forces the colour scheme.
(() => {
  const DATA = '../../data/';
  const LANGS = ['ca', 'es', 'en'];
  const LOCALE = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB' };
  const params = new URLSearchParams(location.search);
  const VARIANT = params.get('menu') || 'general';
  const START = params.get('date');
  if (['light', 'dark'].includes(params.get('theme'))) document.documentElement.dataset.theme = params.get('theme');
  const SCHOOL_PAGE = 'https://www.cide.es/espai-migdia-menjadors/';
  const TZ = 'Europe/Madrid';

  const TEXT = {
    today: { ca: 'Avui', es: 'Hoy', en: 'Today' },
    tomorrow: { ca: 'Demà', es: 'Mañana', en: 'Tomorrow' },
    yesterday: { ca: 'Ahir', es: 'Ayer', en: 'Yesterday' },
    lunch: { ca: 'Dinar a l’escola', es: 'Comida en el cole', en: 'School lunch' },
    dinner: { ca: 'Proposta de sopar', es: 'Propuesta de cena', en: 'Dinner idea' },
    holiday: { ca: 'Festiu, no hi ha escola', es: 'Festivo, no hay cole', en: 'Holiday, no school' },
    noClasses: { ca: 'No hi ha classes', es: 'No hay clases', en: 'No classes today' },
    holidayTitle: { ca: 'Festiu', es: 'Festivo', en: 'Holiday' },
    noClassesTitle: { ca: 'Sense classes', es: 'Sin clases', en: 'No classes' },
    holidaySub: { ca: 'No hi ha escola', es: 'No hay cole', en: 'No school' },
    noClassesSub: { ca: 'Classes suspeses', es: 'Clases suspendidas', en: 'Classes cancelled' },
    missing: { ca: 'Aquest menú encara no està carregat.', es: 'Este menú aún no está cargado.', en: 'This menu isn’t loaded yet.' },
    openPdf: { ca: 'Obre el menú oficial', es: 'Abre el menú oficial', en: 'Open the official menu' },
    loadError: { ca: 'No s’ha pogut carregar el menú.', es: 'No se ha podido cargar el menú.', en: 'Couldn’t load the menu.' },
    fromGeneral: { ca: 'Del menú general', es: 'Del menú general', en: 'From the general menu' },
    pdf: { ca: 'PDF oficial', es: 'PDF oficial', en: 'Official PDF' },
    role: {
      first: { ca: 'Primer', es: 'Primero', en: 'Starter' },
      second: { ca: 'Segon', es: 'Segundo', en: 'Main' },
      side: { ca: 'Guarnició', es: 'Guarnición', en: 'Side' },
      dessert: { ca: 'Postres', es: 'Postre', en: 'Dessert' },
      bread: { ca: 'Pa', es: 'Pan', en: 'Bread' },
    },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const guess = (navigator.language || '').slice(0, 2);
  let lang = LANGS.includes(params.get('lang')) ? params.get('lang')
    : LANGS.includes(store.get('menu-mellis.lang')) ? store.get('menu-mellis.lang')
    : LANGS.includes(guess) ? guess : 'ca';
  const t = (o) => o[lang] || o.ca;
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Dates are plain 'YYYY-MM-DD' strings in Madrid time; Date objects only at noon UTC to avoid DST edges.
  function todayKey() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  const toDate = (key) => new Date(`${key}T12:00:00Z`);
  const keyOf = (d) => d.toISOString().slice(0, 10);
  const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);

  const $ = (id) => document.getElementById(id);
  const el = { day: $('day'), date: $('date'), rel: $('rel'), prev: $('prev'), next: $('next'), foot: $('foot') };

  let days = [];      // sorted [{ key, day, source }]
  let variantName = null; // { ca, es, en } from data/variants.json
  let pos = 0;        // index into days; days.length = "next month not loaded"
  let today = todayKey();
  const startPos = (from) => { const i = days.findIndex((d) => d.key >= from); return i === -1 ? days.length : i; };

  async function load() {
    const [index, variants] = await Promise.all(['index.json', 'variants.json'].map((u) =>
      fetch(DATA + u, { cache: 'no-cache' }).then((r) => r.json())));
    variantName = (variants.find((v) => v.id === VARIANT) || variants[0]).name;
    const months = await Promise.all(index.months.map((m) =>
      fetch(`${DATA}${m}.json`, { cache: 'no-cache' }).then((r) => r.json())));
    for (const m of months) {
      const v = m.variants[VARIANT] || m.variants.general;
      if (!v) continue;
      for (const [key, day] of Object.entries(v.days)) days.push({ key, day, source: m.source });
    }
    days.sort((a, b) => a.key.localeCompare(b.key));
    // Today, or the next day with a menu (weekends open on Monday).
    pos = startPos(START || today);
  }

  function monthName(key) {
    return new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(toDate(key));
  }

  function dishList(items, withRoles) {
    return `<ol class="dishes">${items.map((c) => `
      <li class="${withRoles ? c.role : ''}"><span class="e" aria-hidden="true">${c.emoji}</span>
      <span class="t">${withRoles ? `<span class="role">${esc(t(TEXT.role[c.role]))}</span>` : ''}<span class="name">${esc(t(c.text))}</span>${c.note ? `<small>${esc(t(c.note))}</small>` : ''}</span></li>`).join('')}</ol>`;
  }

  // Lunch as tray tiles: first and second course full width, side / dessert / bread as small tiles two by two.
  function tray(courses) {
    const tile = (c) => `<li class="tile ${c.role}"><span class="e" aria-hidden="true">${c.emoji}</span>
      <span class="t"><span class="role">${esc(t(TEXT.role[c.role]))}</span><span class="name">${esc(t(c.text))}</span>${c.note ? `<small>${esc(t(c.note))}</small>` : ''}</span></li>`;
    const big = courses.filter((c) => c.role === 'first' || c.role === 'second');
    const small = courses.filter((c) => !big.includes(c));
    return `<ol class="tray">${big.map(tile).join('')}${small.length ? `<li class="smalls"><ol>${small.map(tile).join('')}</ol></li>` : ''}</ol>`;
  }

  function render(dir) {
    const entry = days[pos];
    el.prev.disabled = pos <= 0;
    el.next.disabled = pos >= days.length;

    if (!entry) {
      // Past the last loaded day: the next month's PDF hasn't been processed yet.
      const last = days.length ? days[days.length - 1].key : null;
      const nextMonth = last && keyOf(new Date(Date.UTC(+last.slice(0, 4), +last.slice(5, 7), 1, 12)));
      const missingMonth = nextMonth && nextMonth > today ? nextMonth : today;
      el.rel.textContent = '';
      el.date.textContent = monthName(missingMonth);
      el.day.innerHTML = `<section class="card missing"><div class="big">🗓️</div>
        <p>${esc(t(TEXT.missing))}</p>
        <a class="btn" href="${SCHOOL_PAGE}" target="_blank" rel="noopener">${esc(t(TEXT.openPdf))} ↗</a></section>`;
      el.foot.innerHTML = '';
    } else {
      const { key, day, source } = entry;
      const diff = daysBetween(today, key);
      el.rel.textContent = diff === 0 ? t(TEXT.today) : diff === 1 ? t(TEXT.tomorrow) : diff === -1 ? t(TEXT.yesterday) : '';
      el.date.textContent = new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(toDate(key));

      let html = '';
      if (day.status === 'school') {
        html += `<section class="lunch"><h2>${esc(t(TEXT.lunch))}</h2>${tray(day.courses)}</section>`;
      } else {
        const [icon, title, label] = day.status === 'holiday'
          ? ['🎉', TEXT.holidayTitle, TEXT.holidaySub] : ['🏠', TEXT.noClassesTitle, TEXT.noClassesSub];
        html += `<section class="card closed"><div class="big" aria-hidden="true">${icon}</div>
          <h2>${esc(t(title))}</h2><p>${esc(t(label))}</p></section>`;
      }
      if (day.dinner) {
        const from = day.dinner.fromGeneral ? `<p class="from">${esc(t(TEXT.fromGeneral))}</p>` : '';
        html += `<section class="card dinner"><h2><span aria-hidden="true">🌙</span> ${esc(t(TEXT.dinner))}</h2>${dishList(day.dinner.items, false)}${from}</section>`;
      }
      el.day.innerHTML = html;
      el.foot.innerHTML = `${esc(t(variantName))} · <a href="${source.url}" target="_blank" rel="noopener">${esc(t(TEXT.pdf))} ↗</a>`;
    }

    if (dir) {
      el.day.classList.remove('slide-l', 'slide-r');
      void el.day.offsetWidth; // restart the animation
      el.day.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
    }
  }

  function go(step) {
    const next = Math.min(days.length, Math.max(0, pos + step));
    if (next === pos) return;
    pos = next;
    render(step);
  }

  function setLang(next) {
    lang = next;
    store.set('menu-mellis.lang', next);
    document.documentElement.lang = next;
    document.querySelectorAll('.langs button').forEach((b) => b.classList.toggle('active', b.dataset.lang === next));
    render();
  }

  el.prev.addEventListener('click', () => go(-1));
  el.next.addEventListener('click', () => go(1));
  document.querySelector('.langs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-lang]');
    if (b) setLang(b.dataset.lang);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });

  // Horizontal swipe anywhere on the page.
  let touch = null;
  document.addEventListener('touchstart', (e) => {
    const p = e.changedTouches[0];
    touch = { x: p.clientX, y: p.clientY };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!touch) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - touch.x, dy = p.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  // Back to the right day when the app is reopened on a later date.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || todayKey() === today) return;
    today = todayKey();
    pos = startPos(today);
    render();
  });

  load().then(() => setLang(lang)).catch(() => {
    el.day.innerHTML = `<section class="card missing"><div class="big">⚠️</div><p>${esc(t(TEXT.loadError))}</p>
      <a class="btn" href="${SCHOOL_PAGE}" target="_blank" rel="noopener">${esc(t(TEXT.openPdf))} ↗</a></section>`;
  });
})();
