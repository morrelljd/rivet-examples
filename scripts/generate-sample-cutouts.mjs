// Regenerates the placeholder clothing cutouts in public/wardrobe/.
// These stand in until you extract real cutouts from your photos with the
// `extract-clothing-cutouts` skill (see .claude/skills/).
//
// Run: npm run samples

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'wardrobe')
mkdirSync(OUT, { recursive: true })

const CX = 200

// ---------- geometry helpers ----------

function unit(ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  return [dx / len, dy / len, len]
}

// Polyline with quadratic-rounded interior corners.
function roundedPath(pts, r) {
  const n = pts.length
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < n - 1; i++) {
    const [px, py] = pts[i - 1]
    const [vx, vy] = pts[i]
    const [nx, ny] = pts[i + 1]
    const [iux, iuy, ilen] = unit(px, py, vx, vy)
    const [oux, ouy, olen] = unit(vx, vy, nx, ny)
    const ri = Math.min(r, ilen / 2, olen / 2)
    const ex = vx - iux * ri
    const ey = vy - iuy * ri
    const sx = vx + oux * ri
    const sy = vy + ouy * ri
    d += ` L ${ex.toFixed(1)} ${ey.toFixed(1)} Q ${vx} ${vy} ${sx.toFixed(1)} ${sy.toFixed(1)}`
  }
  d += ` L ${pts[n - 1][0]} ${pts[n - 1][1]}`
  return d
}

// Build a closed, symmetric garment outline from a left-half point list
// (x as negative offset from center, ordered neck -> bottom center) plus a neckline.
function outline(half, neck) {
  const left = half.map(([x, y]) => [CX + x, y])
  const right = half.slice(0, -1).reverse().map(([x, y]) => [CX - x, y])
  const pts = [...left, ...right]
  let d = roundedPath(pts, 12)
  const [fx, fy] = pts[0]
  if (neck.type === 'v') {
    d += ` L ${CX} ${neck.depth} L ${fx} ${fy} Z`
  } else {
    d += ` Q ${CX} ${neck.depth} ${fx} ${fy} Z`
  }
  return d
}

// ---------- color helpers ----------

function shade(hex, amt) {
  const v = hex.replace('#', '')
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16))
  const out = c.map((x) => Math.max(0, Math.min(255, Math.round(x * (1 + amt)))))
  return `#${out.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

// ---------- garment templates (left half, neck -> hem center) ----------

const HALF = {
  tee: [
    [-54, 88], [-102, 104], [-150, 160], [-116, 198], [-84, 170], [-92, 336], [0, 344],
  ],
  camp: [
    [-58, 92], [-106, 106], [-146, 168], [-112, 200], [-86, 174], [-98, 330], [0, 336],
  ],
  longsleeve: [
    [-54, 88], [-102, 104], [-130, 210], [-140, 308], [-108, 314], [-100, 220], [-82, 172], [-92, 340], [0, 348],
  ],
}

// ---------- overlay pieces ----------

const collarButtonDown = (base) => `
  <path d="M 146 86 Q 200 68 254 86 L 240 102 Q 200 86 160 102 Z" fill="${shade(base, -0.14)}" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>
  <path d="M 146 86 L 196 102 L 170 142 Z" fill="${shade(base, -0.08)}" stroke="rgba(0,0,0,0.18)" stroke-width="2" stroke-linejoin="round"/>
  <path d="M 254 86 L 204 102 L 230 142 Z" fill="${shade(base, -0.08)}" stroke="rgba(0,0,0,0.18)" stroke-width="2" stroke-linejoin="round"/>`

const collarCamp = (base) => `
  <path d="M 140 92 L 200 110 L 164 152 Z" fill="${shade(base, -0.08)}" stroke="rgba(0,0,0,0.18)" stroke-width="2" stroke-linejoin="round"/>
  <path d="M 260 92 L 200 110 L 236 152 Z" fill="${shade(base, -0.08)}" stroke="rgba(0,0,0,0.18)" stroke-width="2" stroke-linejoin="round"/>`

const collarPolo = (base) => `
  <path d="M 150 87 Q 200 70 250 87 L 240 100 Q 200 86 160 100 Z" fill="${shade(base, -0.14)}" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>
  <path d="M 150 87 L 196 100 L 177 132 Z" fill="${shade(base, -0.08)}" stroke="rgba(0,0,0,0.18)" stroke-width="2" stroke-linejoin="round"/>
  <path d="M 250 87 L 204 100 L 223 132 Z" fill="${shade(base, -0.08)}" stroke="rgba(0,0,0,0.18)" stroke-width="2" stroke-linejoin="round"/>`

const placket = (top, bottom, base, buttonYs) => `
  <rect x="193" y="${top}" width="14" height="${bottom - top}" fill="rgba(0,0,0,0.07)" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>
  ${buttonYs
    .map((y) => `<circle cx="200" cy="${y}" r="3.5" fill="${shade(base, 0.55)}" stroke="rgba(0,0,0,0.28)" stroke-width="1.2"/>`)
    .join('\n  ')}`

const crewBand = (base, depth) => `
  <path d="M 146 88 Q 200 ${depth} 254 88" fill="none" stroke="${shade(base, -0.16)}" stroke-width="9" stroke-linecap="round"/>`

const standCollar = (base) => `
  <rect x="152" y="60" width="96" height="42" rx="13" fill="${shade(base, -0.1)}" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>
  <rect x="159" y="67" width="82" height="28" rx="9" fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="2"/>`

const zipper = () => `
  <line x1="200" y1="102" x2="200" y2="216" stroke="rgba(0,0,0,0.35)" stroke-width="3"/>
  <rect x="195" y="214" width="10" height="15" rx="2.5" fill="rgba(0,0,0,0.4)"/>`

const chestPockets = (base) => ['136', '212']
  .map(
    (x) => `
  <rect x="${x}" y="192" width="52" height="52" rx="6" fill="rgba(0,0,0,0.08)" stroke="rgba(0,0,0,0.2)" stroke-width="2"/>
  <rect x="${x}" y="188" width="52" height="15" rx="4" fill="${shade(base, -0.08)}" stroke="rgba(0,0,0,0.2)" stroke-width="2"/>
  <circle cx="${Number(x) + 26}" cy="196" r="3" fill="${shade(base, 0.5)}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>`,
  )
  .join('')

// ---------- patterns (clipped to the body) ----------

function stripes(color) {
  let s = ''
  for (let x = 106; x <= 294; x += 12) {
    s += `<line x1="${x}" y1="50" x2="${x}" y2="360" stroke="${color}" stroke-width="5" opacity="0.75"/>`
  }
  return s
}

function plaid(c1, c2) {
  let s = ''
  for (let y = 100; y <= 360; y += 48) {
    s += `<rect x="40" y="${y}" width="320" height="17" fill="${c1}" opacity="0.5"/>`
    s += `<line x1="40" y1="${y + 26}" x2="360" y2="${y + 26}" stroke="${c2}" stroke-width="3" opacity="0.55"/>`
  }
  for (let x = 88; x <= 320; x += 52) {
    s += `<rect x="${x}" y="50" width="17" height="320" fill="${c1}" opacity="0.5"/>`
    s += `<line x1="${x + 26}" y1="50" x2="${x + 26}" y2="370" stroke="${c2}" stroke-width="3" opacity="0.55"/>`
  }
  return s
}

const logoRedBox = () => `
  <rect x="184" y="146" width="32" height="15" rx="2.5" fill="#c13a2e"/>
  <rect x="190" y="151" width="20" height="5" rx="1" fill="rgba(255,255,255,0.85)"/>`

const logoEmblem = () => `
  <circle cx="200" cy="154" r="10" fill="none" stroke="#2d4a73" stroke-width="3.5"/>
  <circle cx="200" cy="154" r="3" fill="#2d4a73"/>`

const logoTruck = () => `
  <g transform="translate(174,142)">
    <rect x="0" y="8" width="30" height="13" rx="2" fill="#a63d2c"/>
    <path d="M 30 12 L 42 12 L 46 18 L 46 21 L 30 21 Z" fill="#a63d2c"/>
    <circle cx="9" cy="23" r="4" fill="#3a3a3a"/>
    <circle cx="38" cy="23" r="4" fill="#3a3a3a"/>
  </g>`

const logoPrint = () => `
  <g transform="translate(158,142)" fill="rgba(60,60,60,0.55)">
    <rect x="0" y="0" width="30" height="5" rx="1.5"/>
    <rect x="0" y="9" width="22" height="5" rx="1.5"/>
    <rect x="0" y="18" width="26" height="5" rx="1.5"/>
  </g>`

// ---------- svg assembly ----------

function svg({ base, template, neck, pattern = '', overlays = '' }) {
  const body = outline(HALF[template], neck)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.15"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.11"/>
    </linearGradient>
    <clipPath id="body"><path d="${body}"/></clipPath>
  </defs>
  <path d="${body}" fill="${base}"/>
  <g clip-path="url(#body)">${pattern}</g>
  <path d="${body}" fill="url(#shade)"/>
  <path d="${body}" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="3"/>
  ${overlays}
</svg>
`
}

// ---------- the wardrobe ----------

const crew = { type: 'crew', depth: 126 }
const vneck = { type: 'v', depth: 134 }

const ITEMS = {
  'tee-black-logo': svg({
    base: '#1a1a1e', template: 'tee', neck: crew,
    overlays: crewBand('#1a1a1e', 126) + logoRedBox(),
  }),
  'polo-navy': svg({
    base: '#22304a', template: 'tee', neck: crew,
    overlays: placket(102, 158, '#22304a', [120, 144]) + collarPolo('#22304a'),
  }),
  'tee-sand': svg({
    base: '#d3c5ab', template: 'tee', neck: crew,
    overlays: crewBand('#d3c5ab', 126),
  }),
  'shirt-sky-stripe': svg({
    base: '#a5cae7', template: 'longsleeve', neck: vneck,
    pattern: stripes('#e9f4fc'),
    overlays: placket(104, 344, '#a5cae7', [122, 164, 206, 248, 290, 326]) + collarButtonDown('#a5cae7'),
  }),
  'shirt-flannel': svg({
    base: '#3c4b42', template: 'longsleeve', neck: vneck,
    pattern: plaid('#22304d', '#e6dec6'),
    overlays: placket(104, 344, '#3c4b42', [122, 168, 214, 260, 306]) + collarButtonDown('#3c4b42'),
  }),
  'tee-white': svg({
    base: '#e9e8e3', template: 'tee', neck: crew,
    overlays: crewBand('#e9e8e3', 126),
  }),
  'shirt-tan-camp': svg({
    base: '#c8ab80', template: 'camp', neck: { type: 'v', depth: 148 },
    overlays: placket(112, 336, '#c8ab80', [130, 172, 214, 256, 298]) + collarCamp('#c8ab80'),
  }),
  'longsleeve-cream': svg({
    base: '#e2d5b8', template: 'longsleeve', neck: crew,
    overlays: crewBand('#e2d5b8', 126),
  }),
  'tee-white-graphic': svg({
    base: '#edece6', template: 'tee', neck: crew,
    overlays: crewBand('#edece6', 126) + logoEmblem(),
  }),
  'tee-truck': svg({
    base: '#cfd8e0', template: 'tee', neck: crew,
    overlays: crewBand('#cfd8e0', 126) + logoTruck(),
  }),
  'tee-print-cream': svg({
    base: '#e4dcc4', template: 'tee', neck: crew,
    overlays: crewBand('#e4dcc4', 126) + logoPrint(),
  }),
  'shirt-blue-camp': svg({
    base: '#7799c2', template: 'camp', neck: { type: 'v', depth: 148 },
    overlays: placket(112, 336, '#7799c2', [130, 172, 214, 256, 298]) + collarCamp('#7799c2'),
  }),
  'overshirt-denim': svg({
    base: '#31507b', template: 'longsleeve', neck: vneck,
    overlays: chestPockets('#31507b') + placket(104, 348, '#31507b', [122, 168, 260, 306]) + collarButtonDown('#31507b'),
  }),
  'quarterzip-gray': svg({
    base: '#b6bac0', template: 'longsleeve', neck: { type: 'crew', depth: 116 },
    overlays: standCollar('#b6bac0') + zipper(),
  }),
  'shirt-rose': svg({
    base: '#d5a49b', template: 'longsleeve', neck: vneck,
    overlays: placket(104, 344, '#d5a49b', [122, 168, 214, 260, 306]) + collarButtonDown('#d5a49b'),
  }),
}

for (const [slug, content] of Object.entries(ITEMS)) {
  writeFileSync(join(OUT, `${slug}.svg`), content)
}
console.log(`Wrote ${Object.keys(ITEMS).length} sample cutouts to ${OUT}`)
