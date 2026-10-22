#!/usr/bin/env node
// Daily watcher (GitHub Action): if the menu PDF link on the CIDE page isn't one the site already has, open (or
// update) one "menu-pdf" issue so Guille runs /update-menu. If it is, close any leftover open issue.
// Loads only the page, never the PDF: cide.es blocks GitHub's servers after their first request. So a PDF replaced
// under the same URL is not detected (the school has so far uploaded changes under new names, e.g. "-modificat").
//   node scripts/watch-menu.mjs [--dry-run] [--pretend-new]
// --dry-run prints what it would do; --pretend-new treats the current link as new (to test the issue flow).
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE, findMenuUrl } from './fetch-menu.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const PRETEND = process.argv.includes('--pretend-new');
const LABEL = 'menu-pdf';
const ASSIGNEE = 'grojasv';

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();
const act = (desc, ...args) => { console.log(`${DRY ? '[dry-run] ' : ''}${desc}`); return DRY ? '' : gh(...args); };
const summary = (line) => { console.log(line); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`); };

function monthWithUrl(url) {
  const { months } = JSON.parse(readFileSync(join(ROOT, 'data/index.json'), 'utf8'));
  return months.find((m) => JSON.parse(readFileSync(join(ROOT, `data/${m}.json`), 'utf8')).source?.url === url) || null;
}

const url = await findMenuUrl();
const done = PRETEND ? null : monthWithUrl(url);
const open = JSON.parse(gh('issue', 'list', '--label', LABEL, '--state', 'open', '--json', 'number,body', '--limit', '20'));

if (done) {
  summary(`✔ Menu PDF already in the site (${done}): ${url}`);
  for (const i of open) {
    act(`close #${i.number} (already processed)`, 'issue', 'close', String(i.number),
      '--comment', `This PDF is already in the site (data/${done}.json). Closing.`);
  }
  process.exit(0);
}

const file = decodeURIComponent(basename(new URL(url).pathname));
const title = `${PRETEND ? '[test] ' : ''}New CIDE menu PDF: ${file}`;
const body = [
  `The school's menjador page links a menu PDF the site doesn't have yet.${PRETEND ? ' **(Test run: this PDF is actually already processed. Close this issue.)**' : ''}`,
  '',
  `- PDF: ${url}`,
  `- Page: ${PAGE}`,
  `- Found: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
  '',
  '**To publish it:** open Claude Code in `~/lab/menu-mellis` and run `/update-menu`.',
  'It downloads this PDF, reads every page, builds and validates the data, and asks before pushing.',
].join('\n');

const same = open.find((i) => i.body.includes(`- PDF: ${url}\n`));
if (same) {
  summary(`ℹ New menu PDF still waiting for /update-menu (issue #${same.number}): ${url}`);
} else if (open.length) {
  // The school replaced the PDF again before it was processed: keep one issue, point it at the newest PDF.
  act(`update #${open[0].number} with the newer PDF`, 'issue', 'edit', String(open[0].number), '--title', title, '--body', body);
  act(`comment on #${open[0].number}`, 'issue', 'comment', String(open[0].number), '--body', `The PDF changed again: ${url}`);
  summary(`🔁 Menu PDF replaced again, updated issue #${open[0].number}: ${url}`);
} else {
  act(`ensure label "${LABEL}"`, 'label', 'create', LABEL, '--color', '3f7d4e',
    '--description', 'New CIDE menu PDF waiting for /update-menu', '--force');
  const created = act(`open issue "${title}"`, 'issue', 'create', '--title', title, '--body', body,
    '--label', LABEL, '--assignee', ASSIGNEE);
  summary(`🆕 New menu PDF, opened ${created || 'an issue'}: ${url}`);
}
