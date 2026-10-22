#!/usr/bin/env node
// Checks every data/*.json the app loads. Exit code 1 on any error.
//   node scripts/validate.mjs
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATUSES = ['school', 'holiday', 'no-classes'];
const ROLES = ['first', 'second', 'side', 'dessert', 'bread'];
const LANGS = ['ca', 'es', 'en'];

export function validateAll(root) {
  const errors = [];
  const err = (m) => errors.push(m);
  const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

  const canonical = read('data/variants.json');
  const ids = canonical.map((v) => v.id);
  if (new Set(ids).size !== ids.length) err('variants.json: duplicate ids');
  for (const v of canonical) {
    if (!/^[a-z0-9-]+$/.test(v.id)) err(`variants.json: bad id "${v.id}"`);
    for (const l of LANGS) if (!v.name?.[l]) err(`variants.json ${v.id}: missing name.${l}`);
  }

  const { months } = read('data/index.json');
  if (!Array.isArray(months) || !months.length) err('index.json: no months');
  if ([...months].sort().join() !== months.join()) err('index.json: months not sorted');

  const text = (t, where) => {
    for (const l of LANGS) if (typeof t?.[l] !== 'string' || !t[l].trim()) err(`${where}: missing text.${l}`);
  };
  const item = (c, where) => {
    text(c.text, where);
    if (c.note) text(c.note, `${where} note`);
    if (!c.emoji) err(`${where}: missing emoji`);
    if (!Array.isArray(c.allergens) || c.allergens.some((a) => !Number.isInteger(a) || a < 1 || a > 14)) {
      err(`${where}: allergens must be integers 1–14`);
    }
  };

  for (const m of months) {
    const file = `data/${m}.json`;
    if (!existsSync(join(root, file))) { err(`${file}: listed in index.json but missing`); continue; }
    const data = read(file);
    if (data.month !== m) err(`${file}: month is "${data.month}"`);
    if (!/^https:\/\/www\.cide\.es\/.+\.pdf$/i.test(data.source?.url || '')) err(`${file}: source.url is not a cide.es PDF`);
    if (!/^[0-9a-f]{64}$/.test(data.source?.sha256 || '')) err(`${file}: source.sha256 missing`);

    const variantIds = Object.keys(data.variants || {});
    for (const id of ids) if (!variantIds.includes(id)) err(`${file}: variant "${id}" missing`);
    for (const id of variantIds) if (!ids.includes(id)) err(`${file}: unknown variant "${id}"`);

    const generalDates = Object.keys(data.variants?.general?.days || {}).sort().join();
    const [y, mo] = m.split('-').map(Number);
    const weekdays = [];
    for (let d = 1; d <= new Date(Date.UTC(y, mo, 0)).getUTCDate(); d++) {
      const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
      if (wd > 0 && wd < 6) weekdays.push(`${m}-${String(d).padStart(2, '0')}`);
    }
    const firstDay = generalDates.split(',')[0];
    const lastDay = generalDates.split(',').at(-1);
    const gaps = weekdays.filter((d) => d > firstDay && d < lastDay && !generalDates.includes(d));
    if (gaps.length) err(`${file}: weekdays missing inside the month: ${gaps.join(', ')}`);

    for (const [id, v] of Object.entries(data.variants || {})) {
      const dates = Object.keys(v.days).sort();
      if (dates.join() !== generalDates) err(`${file} ${id}: days differ from general`);
      for (const date of dates) {
        const where = `${file} ${id} ${date}`;
        if (!date.startsWith(`${m}-`) || !weekdays.includes(date)) err(`${where}: not a weekday of ${m}`);
        const d = v.days[date];
        if (!STATUSES.includes(d.status)) err(`${where}: bad status "${d.status}"`);
        if (d.status === 'school' && !d.courses.some((c) => c.role === 'first')) err(`${where}: school day without a first course`);
        if (d.status !== 'school' && d.courses.length) err(`${where}: ${d.status} day with courses`);
        const roles = d.courses.map((c) => c.role);
        if (roles.some((r) => !ROLES.includes(r)) || new Set(roles).size !== roles.length
          || roles.join() !== ROLES.filter((r) => roles.includes(r)).join()) err(`${where}: bad course roles [${roles}]`);
        d.courses.forEach((c) => item(c, `${where} ${c.role}`));
        if (d.dinner !== null) {
          if (!d.dinner?.items?.length) err(`${where}: dinner must be null or have items`);
          else d.dinner.items.forEach((c, i) => item(c, `${where} dinner[${i}]`));
          if (typeof d.dinner?.fromGeneral !== 'boolean') err(`${where}: dinner.fromGeneral missing`);
        }
      }
    }
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const errors = validateAll(root);
  if (errors.length) { errors.forEach((e) => console.error(`✖ ${e}`)); process.exit(1); }
  console.log('✔ data is valid');
}
