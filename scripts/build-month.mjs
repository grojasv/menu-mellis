#!/usr/bin/env node
// Expands a hand-written month source (data/src/YYYY-MM.json) into the app's data file (data/YYYY-MM.json),
// adds it to data/index.json and validates everything.
//
//   node scripts/build-month.mjs data/src/2026-10.json
//
// Source format (written by Claude from the PDF, see CLAUDE.md):
//   { month, source: { url, sha256, processedAt },
//     general:  { "YYYY-MM-DD": Day },
//     variants: { "<id>": { base: "general" | "<id>", dinner: "page" | "general" | "none",
//                           days: { "YYYY-MM-DD": DayOverride } } } }
//   Day         = { status?: "school" | "holiday" | "no-classes", lunch?: { <role>: Dish }, dinner?: [Dish] }
//   DayOverride = { status?, lunch?: { <role>: Dish | partial Dish | null }, dinner?: [Dish] | null }
//   Dish        = { ca, es, en, a?: [allergens], note?: { ca, es, en }, emoji? }
// A partial Dish (e.g. only { a: [4] } or { note }) keeps the rest from the base variant's same course.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAll } from './validate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROLES = ['first', 'second', 'side', 'dessert', 'bread'];

// Emoji from the earliest keyword found in the CA text (the head noun usually comes first).
const EMOJI = [
  ['ensaladilla', '🥔'], ['ensalada adaptada', '🥗'], ['ensalada', '🥗'], ['tomàtiga trempada', '🍅'],
  ['tomàtiga trossejada', '🍅'], ['trempó', '🥗'],
  ['crema', '🥣'], ['sopa', '🥣'], ['sopes', '🥣'], ['gaspatxo', '🥣'], ['minestra', '🥦'],
  ['cuinat', '🫘'], ['ciurons', '🫘'], ['llenties', '🫘'],
  ['macarrons', '🍝'], ['espaguetis', '🍝'], ['caracolas', '🍝'], ['canelons', '🍝'], ['pasta', '🍝'],
  ['lasanya', '🍝'], ['lassanya', '🍝'],
  ['arròs', '🍚'], ['paella', '🥘'], ['tumbet', '🥘'],
  ['lluç', '🐟'], ['salmó', '🐟'], ['rap', '🐟'], ['raoles casolanes de lluç', '🐟'], ['raoles', '🥕'],
  ['pollastre', '🍗'], ['indiot', '🍗'], ['estofat de verdures', '🍲'], ['estofat', '🍲'],
  ['pilotes', '🧆'], ['hamburguesa', '🍔'], ['llom', '🥩'],
  ['truita', '🍳'], ['remenat', '🍳'], ['ous', '🍳'], ['pastís de verdures', '🥧'],
  ['wrap', '🌯'], ['quiche', '🥧'], ['carabassons', '🥒'], ['albergínies', '🍆'],
  ['verdures arrebossades', '🥦'], ['saltejat', '🥦'],
  ['patates', '🥔'], ['pastanaga', '🥕'],
  ['fruita triturada', '🍏'], ['iogurt', '🥛'], ['fruita', '🍎'], ['pa integral', '🍞'], ['sense pa', '🚫'],
];
const warnings = [];
function emojiFor(ca) {
  const s = ca.toLowerCase();
  let best = null;
  for (const [k, e] of EMOJI) {
    const i = s.search(new RegExp(`(^|[^a-zà-ú])${k}`));
    // earliest match wins; on a tie the longer (more specific) keyword wins
    if (i >= 0 && (!best || i < best.i || (i === best.i && k.length > best.k.length))) best = { i, e, k };
  }
  if (!best) warnings.push(`no emoji keyword for "${ca}" — add "emoji" to the dish or a keyword to EMOJI`);
  return best ? best.e : '🍽️';
}

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };

function mergeDish(base, over, where) {
  if (over === null) return null;
  const d = { ...(base || {}), ...over };
  for (const k of ['ca', 'es', 'en']) if (!d[k]) fail(`${where}: missing "${k}" (partial dish with no base course?)`);
  // A new text without its own allergens must not silently keep the old dish's allergens.
  if (base && over.ca && over.ca !== base.ca && !('a' in over)) d.a = [];
  // Same for ration notes on a different dish.
  if (base && over.ca && over.ca !== base.ca && !('note' in over)) delete d.note;
  return d;
}

function applyDay(base, over, where) {
  const day = clone(base) || { status: 'school', lunch: {}, dinner: null };
  if (!over) return day;
  if (over.status) day.status = over.status;
  if (over.lunch) {
    for (const [role, dish] of Object.entries(over.lunch)) {
      if (!ROLES.includes(role)) fail(`${where}: unknown course role "${role}"`);
      const merged = mergeDish(day.lunch?.[role], dish, `${where} ${role}`);
      if (merged) day.lunch[role] = merged; else delete day.lunch[role];
    }
  }
  if ('dinner' in over) day.dinner = clone(over.dinner);
  return day;
}

function normalizeGeneral(src) {
  const out = {};
  for (const [date, d] of Object.entries(src.general)) {
    out[date] = applyDay({ status: 'school', lunch: {}, dinner: null }, d, `general ${date}`);
  }
  return out;
}

function resolveVariant(id, src, general, seen = []) {
  if (id === 'general') return general;
  if (seen.includes(id)) fail(`base cycle: ${[...seen, id].join(' → ')}`);
  const v = src.variants[id];
  if (!v) fail(`variant "${id}" is used as a base but not defined`);
  const base = resolveVariant(v.base || 'general', src, general, [...seen, id]);
  for (const date of Object.keys(v.days || {})) {
    if (!general[date]) fail(`${id}: day ${date} is not in the general menu`);
  }
  const out = {};
  for (const date of Object.keys(general)) out[date] = applyDay(base[date], v.days?.[date], `${id} ${date}`);
  return out;
}

const toItem = (dish, role, generalDish) => {
  const item = {
    ...(role ? { role } : {}),
    emoji: dish.emoji || emojiFor(dish.ca),
    text: { ca: dish.ca, es: dish.es, en: dish.en },
    allergens: [...new Set(dish.a || [])].sort((x, y) => x - y),
  };
  if (dish.note) item.note = dish.note;
  // changed = differs from the general menu's same course (other dish, or same dish made differently)
  if (role && generalDish !== undefined) {
    item.changed = !generalDish || generalDish.ca !== dish.ca
      || item.allergens.join() !== [...new Set(generalDish.a || [])].sort((x, y) => x - y).join();
  }
  return item;
};

function expand(id, days, general, dinnerMode) {
  const out = {};
  for (const [date, d] of Object.entries(days)) {
    const g = general[date];
    const school = d.status === 'school';
    const courses = school
      ? ROLES.filter((r) => d.lunch[r]).map((r) => toItem(d.lunch[r], r, id === 'general' ? undefined : g.lunch[r] || null))
      : [];
    let dinner = null;
    if (dinnerMode === 'page' && d.dinner?.length) dinner = { items: d.dinner.map((x) => toItem(x)), fromGeneral: false };
    if (dinnerMode === 'general' && g.dinner?.length) dinner = { items: g.dinner.map((x) => toItem(x)), fromGeneral: true };
    out[date] = { status: d.status, courses, dinner };
  }
  return out;
}

// ---- main ----
const srcPath = process.argv[2];
if (!srcPath) fail('usage: node scripts/build-month.mjs data/src/YYYY-MM.json');
const src = JSON.parse(readFileSync(srcPath, 'utf8'));
const canonical = JSON.parse(readFileSync(join(ROOT, 'data/variants.json'), 'utf8')).map((v) => v.id);

const defined = ['general', ...Object.keys(src.variants || {})];
const missing = canonical.filter((id) => !defined.includes(id));
const unknown = defined.filter((id) => !canonical.includes(id));
if (missing.length || unknown.length) {
  fail(`variants don't match data/variants.json — missing: [${missing.join(', ')}], unknown: [${unknown.join(', ')}]`);
}

const general = normalizeGeneral(src);
const variants = {};
for (const id of canonical) {
  const mode = id === 'general' ? 'page' : src.variants[id].dinner;
  if (!['page', 'general', 'none'].includes(mode)) fail(`${id}: dinner must be "page", "general" or "none"`);
  variants[id] = { days: expand(id, resolveVariant(id, src, general), general, mode) };
}

const data = { month: src.month, source: src.source, variants };
const outPath = join(ROOT, 'data', `${src.month}.json`);
// Minified: ~350 KB → ~14 KB gzipped on Pages. Review changes in data/src instead.
writeFileSync(outPath, JSON.stringify(data) + '\n');

const indexPath = join(ROOT, 'data/index.json');
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
index.months = [...new Set([...index.months, src.month])].sort();
writeFileSync(indexPath, JSON.stringify(index) + '\n');

for (const w of [...new Set(warnings)]) console.warn(`⚠ ${w}`);
const errors = validateAll(ROOT);
if (errors.length) { errors.forEach((e) => console.error(`✖ ${e}`)); process.exit(1); }

const changed = Object.entries(variants).map(([id, v]) =>
  `${id}: ${Object.values(v.days).flatMap((d) => d.courses).filter((c) => c.changed).length} changed`);
console.log(`✔ wrote data/${src.month}.json (${Object.keys(general).length} days × ${canonical.length} variants)`);
console.log(`  ${changed.slice(1).join(' · ')}`);
