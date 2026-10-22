// Menú Mellis — today's CIDE lunch on the phone. No build step; data in data/*.json.
(() => {
  const LANGS = ['ca', 'es', 'en'];
  const LOCALE = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB' };
  const VARIANT = 'general'; // variant picker comes later (spec step 4)
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
    missing: { ca: 'Aquest menú encara no està carregat.', es: 'Este menú aún no está cargado.', en: 'This menu isn’t loaded yet.' },
    openPdf: { ca: 'Obre el menú oficial', es: 'Abre el menú oficial', en: 'Open the official menu' },
    loadError: { ca: 'No s’ha pogut carregar el menú.', es: 'No se ha podido cargar el menú.', en: 'Couldn’t load the menu.' },
    general: { ca: 'Menú general', es: 'Menú general', en: 'General menu' },
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
  const addDays = (key, n) => { const d = toDate(key); d.setUTCDate(d.getUTCDate() + n); return keyOf(d); };
  const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);

  const $ = (id) => document.getElementById(id);
  const el = { day: $('day'), date: $('date'), rel: $('rel'), prev: $('prev'), next: $('next'), foot: $('foot') };

  let days = [];      // sorted [{ key, day, source }]
  let pos = 0;        // index into days; days.length = "next month not loaded"
  let today = todayKey();

  async function load() {
    const index = await fetch('data/index.json', { cache: 'no-cache' }).then((r) => r.json());
    const months = await Promise.all(index.months.map((m) =>
      fetch(`data/${m}.json`, { cache: 'no-cache' }).then((r) => r.json())));
    for (const m of months) {
      const v = m.variants[VARIANT];
      if (!v) continue;
      for (const [key, day] of Object.entries(v.days)) days.push({ key, day, source: m.source });
    }
    days.sort((a, b) => a.key.localeCompare(b.key));
    // Today, or the next day with a menu (weekends open on Monday).
    const i = days.findIndex((d) => d.key >= today);
    pos = i === -1 ? days.length : i;
  }

  function monthName(key) {
    return new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(toDate(key));
  }

  function dishList(items, withRoles) {
    return `<ul class="dishes">${items.map((c) => `
      <li class="${withRoles ? c.role : ''}"><span class="e" aria-hidden="true">${c.emoji}</span>
      <span class="t">${esc(t(c.text))}</span></li>`).join('')}</ul>`;
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
        html += `<section class="card"><h2>🍽️ ${esc(t(TEXT.lunch))}</h2>${dishList(day.courses, true)}</section>`;
      } else {
        const [icon, label] = day.status === 'holiday' ? ['🎉', TEXT.holiday] : ['🏠', TEXT.noClasses];
        html += `<section class="card closed"><div class="big">${icon}</div><p>${esc(t(label))}</p></section>`;
      }
      if (day.dinner) {
        html += `<section class="card dinner"><h2>🌙 ${esc(t(TEXT.dinner))}</h2>${dishList(day.dinner.items, false)}</section>`;
      }
      el.day.innerHTML = html;
      el.foot.innerHTML = `${esc(t(TEXT.general))} · <a href="${source.url}" target="_blank" rel="noopener">${esc(t(TEXT.pdf))} ↗</a>`;
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
    const i = days.findIndex((d) => d.key >= today);
    pos = i === -1 ? days.length : i;
    render();
  });

  load().then(() => setLang(lang)).catch(() => {
    el.day.innerHTML = `<section class="card missing"><div class="big">⚠️</div><p>${esc(t(TEXT.loadError))}</p>
      <a class="btn" href="${SCHOOL_PAGE}" target="_blank" rel="noopener">${esc(t(TEXT.openPdf))} ↗</a></section>`;
  });
})();
