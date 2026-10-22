// Menú Mellis — today's CIDE lunch on the phone, in the Mellis twins' candy-lab look. No build step; data in data/*.json.
(() => {
  const DATA = 'data/';
  const LANGS = ['ca', 'es', 'en'];
  const LOCALE = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB' };
  // Variant picker comes later (spec step 4); until then ?menu=<id> (ids in data/variants.json) switches it.
  const VARIANT = new URLSearchParams(location.search).get('menu') || 'general';
  const SCHOOL_PAGE = 'https://www.cide.es/espai-migdia-menjadors/';
  const TZ = 'Europe/Madrid';

  const TEXT = {
    today: { ca: 'Avui', es: 'Hoy', en: 'Today' },
    tomorrow: { ca: 'Demà', es: 'Mañana', en: 'Tomorrow' },
    yesterday: { ca: 'Ahir', es: 'Ayer', en: 'Yesterday' },
    lunch: { ca: 'Què dinen les mellis?', es: '¿Qué comen las mellis?', en: 'What are the twins having?' },
    dinner: { ca: 'I per sopar…', es: 'Y para cenar…', en: 'And for dinner…' },
    holiday: { ca: 'Festiu, no hi ha escola', es: 'Festivo, no hay cole', en: 'Holiday, no school' },
    noClasses: { ca: 'No hi ha classes', es: 'No hay clases', en: 'No classes today' },
    holidayTitle: { ca: 'Festa!', es: '¡Fiesta!', en: 'Day off!' },
    noClassesTitle: { ca: 'A casa!', es: '¡En casa!', en: 'Home day!' },
    missing: { ca: 'Aquest menú encara no està carregat.', es: 'Este menú aún no está cargado.', en: 'This menu isn’t loaded yet.' },
    openPdf: { ca: 'Obre el menú oficial', es: 'Abre el menú oficial', en: 'Open the official menu' },
    loadError: { ca: 'No s’ha pogut carregar el menú.', es: 'No se ha podido cargar el menú.', en: 'Couldn’t load the menu.' },
    fromGeneral: { ca: 'Del menú general', es: 'Del menú general', en: 'From the general menu' },
    pdf: { ca: 'PDF oficial', es: 'PDF oficial', en: 'Official PDF' },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const guess = (navigator.language || '').slice(0, 2);
  let lang = LANGS.includes(store.get('menu-mellis.lang')) ? store.get('menu-mellis.lang')
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
    pos = startPos(today);
  }

  function monthName(key) {
    return new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(toDate(key));
  }

  function dishList(items, withRoles) {
    return `<ol class="dishes">${items.map((c) => `
      <li class="${withRoles ? c.role : ''}"><span class="e" aria-hidden="true">${c.emoji}</span>
      <span class="t"><span class="name">${esc(t(c.text))}</span>${c.note ? `<small>${esc(t(c.note))}</small>` : ''}</span></li>`).join('')}</ol>`;
  }

  // The Mellis twins (from Laboratori Mellis): pigtails with bows in each twin's colour, lab goggles up.
  // headsOnly = small header badge; otherwise lab coats, arms up when cheering.
  function twinsSVG({ headsOnly = false, cheer = false } = {}) {
    const INK = '#3a3a5c';
    const kid = (x, goggles, accent) => {
      const hair = `M${x - 38} 78 q-6 -38 38 -42 q42 0 40 40 q-14 -18 -40 -14 q-24 -2 -38 16 z`
        + `M${x - 34} 70 q-28 8 -26 44 q4 14 16 4 q-8 -22 12 -40 z`
        + `M${x + 34} 70 q28 8 26 44 q-4 14 -16 4 q8 -22 -12 -40 z`;
      const bow = (bx) => `<path d="M${bx} 72 l-11 -8 v16 z M${bx} 72 l11 -8 v16 z" fill="${accent}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${bx}" cy="72" r="4" fill="${accent}" stroke="${INK}" stroke-width="2.5"/>`;
      const line = `fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"`;
      const face = cheer
        ? `<path d="M${x - 16} 92 q4 -6 8 0 M${x + 8} 92 q4 -6 8 0" ${line}/><path d="M${x - 10} 102 q10 14 20 0 z" fill="${INK}"/>`
        : `<circle cx="${x - 12}" cy="92" r="3.5" fill="${INK}"/><circle cx="${x + 12}" cy="92" r="3.5" fill="${INK}"/><path d="M${x - 8} 104 q8 7 16 0" ${line}/>`;
      const arms = cheer ? [`M${x - 26} 132 q-14 -30 -6 -50`, `M${x + 26} 132 q14 -30 6 -50`]
        : [`M${x - 26} 134 q-10 18 -4 30`, `M${x + 26} 134 q10 18 4 30`];
      const body = headsOnly ? '' : arms.map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`).join('')
        + `<path d="M${x - 30} 190 q0 -62 30 -64 q30 2 30 64 z" fill="#fff" stroke="${INK}" stroke-width="3"/>`
        + `<path d="M${x - 9} 128 l9 18 l9 -18" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="${x + 14}" cy="160" r="3" fill="${accent}"/>`;
      return `${body}
        <circle cx="${x}" cy="88" r="38" fill="#ffd9b8" stroke="${INK}" stroke-width="3"/>
        <path d="${hair}" fill="#6b3f2a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        ${bow(x - 40)}${bow(x + 40)}
        <rect x="${x - 38}" y="62" width="76" height="8" rx="4" fill="${INK}"/>
        <circle cx="${x - 14}" cy="64" r="11" fill="${goggles}" stroke="${INK}" stroke-width="3"/>
        <circle cx="${x + 14}" cy="64" r="11" fill="${goggles}" stroke="${INK}" stroke-width="3"/>
        <circle cx="${x - 22}" cy="104" r="6" fill="#ff9ec7" opacity=".7"/><circle cx="${x + 22}" cy="104" r="6" fill="#ff9ec7" opacity=".7"/>
        ${face}`;
    };
    const box = headsOnly ? '34 24 232 104' : '34 20 232 175';
    return `<svg class="twins" viewBox="${box}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${kid(100, '#ffb3d9', '#ff6fb5')}${kid(200, '#d4b8ff', '#9b5de5')}</svg>`;
  }
  document.querySelector('.brand').insertAdjacentHTML('afterbegin', twinsSVG({ headsOnly: true }));

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
        html += `<section class="card lunch"><h2><span aria-hidden="true">🧪</span> ${esc(t(TEXT.lunch))}</h2>${dishList(day.courses, true)}</section>`;
      } else {
        const holiday = day.status === 'holiday';
        const [title, label] = holiday ? [TEXT.holidayTitle, TEXT.holiday] : [TEXT.noClassesTitle, TEXT.noClasses];
        html += `<section class="card closed ${holiday ? 'holiday' : ''}"><div class="art">${twinsSVG({ cheer: holiday })}</div>
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
