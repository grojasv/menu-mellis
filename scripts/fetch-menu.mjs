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

// fetch with a timeout and a few retries (the school's server can be slow); errors name the URL.
export async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30_000),
        headers: { 'user-agent': 'menu-mellis (+https://github.com/grojasv/menu-mellis)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      console.error(`GET ${url} → ${r.status}, ${buf.length} bytes, ${Date.now() - t0} ms`);
      return buf;
    } catch (e) {
      const msg = `GET ${url} failed (try ${i}/${tries}, ${Date.now() - t0} ms): ${e.cause?.code || e.name}: ${e.message}`;
      if (i >= tries) throw new Error(msg);
      console.error(msg);
      await new Promise((r) => setTimeout(r, 5_000 * i));
    }
  }
}

export async function findMenuUrl() {
  const html = (await get(PAGE)).toString('utf8');
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
  const buf = await get(url);
  if (buf.subarray(0, 5).toString() !== '%PDF-') throw new Error(`${url} is not a PDF`);
  const file = join(out, 'menu.pdf');
  writeFileSync(file, buf);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  console.log(JSON.stringify({ url, file, sha256, processedIn: processedIn(sha256) }, null, 2));
}
