#!/usr/bin/env node
// Builds the app icons (twins' heads on the pink→purple lab gradient) from code, so they match app.js's twins.
//   node scripts/make-icons.mjs        (needs uv: rasterizes with resvg-py, nothing installed globally)
// Writes icons/icon.svg (favicon), icon-192.png, icon-512.png (also maskable: art stays inside the safe circle)
// and apple-touch-icon.png (180, opaque).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'icons');
const INK = '#3a3a5c';

// Same drawing as twinsSVG({ headsOnly: true }) in app.js.
const kid = (x, goggles, accent) => {
  const hair = `M${x - 38} 78 q-6 -38 38 -42 q42 0 40 40 q-14 -18 -40 -14 q-24 -2 -38 16 z`
    + `M${x - 34} 70 q-28 8 -26 44 q4 14 16 4 q-8 -22 12 -40 z`
    + `M${x + 34} 70 q28 8 26 44 q-4 14 -16 4 q8 -22 -12 -40 z`;
  const bow = (bx) => `<path d="M${bx} 72 l-11 -8 v16 z M${bx} 72 l11 -8 v16 z" fill="${accent}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${bx}" cy="72" r="4" fill="${accent}" stroke="${INK}" stroke-width="2.5"/>`;
  return `<circle cx="${x}" cy="88" r="38" fill="#ffd9b8" stroke="${INK}" stroke-width="3"/>
    <path d="${hair}" fill="#6b3f2a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    ${bow(x - 40)}${bow(x + 40)}
    <rect x="${x - 38}" y="62" width="76" height="8" rx="4" fill="${INK}"/>
    <circle cx="${x - 14}" cy="64" r="11" fill="${goggles}" stroke="${INK}" stroke-width="3"/>
    <circle cx="${x + 14}" cy="64" r="11" fill="${goggles}" stroke="${INK}" stroke-width="3"/>
    <circle cx="${x - 22}" cy="104" r="6" fill="#ff9ec7" opacity=".7"/><circle cx="${x + 22}" cy="104" r="6" fill="#ff9ec7" opacity=".7"/>
    <circle cx="${x - 12}" cy="92" r="3.5" fill="${INK}"/><circle cx="${x + 12}" cy="92" r="3.5" fill="${INK}"/>
    <path d="M${x - 8} 104 q8 7 16 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
};

// 512×512, full bleed. Heads (viewBox 34 24 232 104) scaled to 340 px wide, on a white plate, inside the
// maskable safe circle (radius 205 around the centre).
const s = 340 / 232;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff6fb5"/><stop offset="1" stop-color="#9b5de5"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <ellipse cx="256" cy="300" rx="190" ry="62" fill="#3a3a5c" opacity=".25"/>
  <ellipse cx="256" cy="290" rx="190" ry="62" fill="#fff" stroke="${INK}" stroke-width="8"/>
  <ellipse cx="256" cy="290" rx="140" ry="40" fill="none" stroke="#efe6f7" stroke-width="8"/>
  <g transform="translate(${256 - (34 + 116) * s} ${262 - (24 + 104) * s}) scale(${s})">
    ${kid(100, '#ffb3d9', '#ff6fb5')}${kid(200, '#d4b8ff', '#9b5de5')}
  </g>
</svg>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'icon.svg'), svg);
const py = `
import sys, resvg_py
src = sys.argv[1]
for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
    png = resvg_py.svg_to_bytes(svg_path=src + "/icon.svg", width=size, height=size)
    open(src + "/" + name, "wb").write(bytes(png))
    print(name, size)
`;
console.log(execFileSync('uv', ['run', '-q', '--with', 'resvg-py', 'python', '-I', '-c', py, OUT], { encoding: 'utf8' }).trim());
