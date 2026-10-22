#!/usr/bin/env node
// Finds the current menu PDF on the CIDE menjador page, downloads it and says whether it is new.
//   node scripts/fetch-menu.mjs [--out <dir>]
// Prints JSON: { url, file, sha256, processedIn }  (processedIn = month whose data already came from this PDF, or null)
// The filename and upload folder change every month (e.g. /2026/09/Menu-octubre-modificat.pdf), so never build the URL.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PAGE = 'https://www.cide.es/espai-migdia-menjadors/';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function findMenuUrl() {
  const html = await fetch(PAGE, { headers: { 'user-agent': 'menu-mellis (+https://github.com/grojasv/menu-mellis)' } })
    .then((r) => { if (!r.ok) throw new Error(`${PAGE} → HTTP ${r.status}`); return r.text(); });
  const links = [...html.matchAll(/href="([^"]+\.pdf)"/gi)].map((m) => new URL(m[1], PAGE).href);
  const menus = [...new Set(links)].filter((u) => {
    const name = decodeURIComponent(basename(new URL(u).pathname)).toLowerCase();
    return /men[uú]/.test(name) && !/berenar|merienda|resoluci/.test(name);
  });
  if (menus.length !== 1) {
    throw new Error(`expected 1 menu PDF on ${PAGE}, found ${menus.length}: ${menus.join(' ') || '(none)'}\nall PDFs: ${links.join(' ')}`);
  }
  return menus[0];
}

export function processedIn(sha256) {
  const { months } = JSON.parse(readFileSync(join(ROOT, 'data/index.json'), 'utf8'));
  return months.find((m) => JSON.parse(readFileSync(join(ROOT, `data/${m}.json`), 'utf8')).source?.sha256 === sha256) || null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : join(tmpdir(), `menu-mellis-${Date.now()}`);
  if (!existsSync(out)) mkdirSync(out, { recursive: true });

  const url = await findMenuUrl();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== '%PDF-') throw new Error(`${url} is not a PDF`);
  const file = join(out, 'menu.pdf');
  writeFileSync(file, buf);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  console.log(JSON.stringify({ url, file, sha256, processedIn: processedIn(sha256) }, null, 2));
}
