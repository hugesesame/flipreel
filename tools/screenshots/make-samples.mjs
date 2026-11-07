// Makes the sample "photos" and song used for the README screenshots.
// The photos are simple illustrations drawn here (no real photos, nothing copyrighted);
// the song is a short synthesized tune. The output is deterministic.
//
//   node tools/screenshots/make-samples.mjs
//
// Writes tools/screenshots/samples/*.jpg and golden-hour.wav. Needs Google Chrome (via Playwright).

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'samples');
const W = 1500;
const H = 1000;

// Small seeded random, so every run draws the same pictures.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A ridge line across the picture, filled down to the bottom. */
function ridge(r, base, amp, color, waves = 3) {
  const ph = Array.from({ length: waves }, () => r() * Math.PI * 2);
  const fr = Array.from({ length: waves }, (_, i) => (i + 1) * (0.6 + r() * 0.8));
  let d = `M0 ${H}`;
  for (let x = 0; x <= W; x += 20) {
    let y = base;
    for (let i = 0; i < waves; i++) y += (amp / (i + 1)) * Math.sin((x / W) * Math.PI * 2 * fr[i] + ph[i]);
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return `<path d="${d} L${W} ${H} Z" fill="${color}"/>`;
}

const sky = (id, stops) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;

const glow = (id, color) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="0.75"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

const SCENES = {
  'sunset-beach': (r) => {
    let lines = '';
    for (let i = 0; i < 9; i++) {
      const y = 630 + i * 22;
      const w = 150 - i * 12 + r() * 30;
      lines += `<rect x="${830 - w / 2}" y="${y}" width="${w}" height="3" rx="1.5" fill="#ffe3b0" opacity="${0.7 - i * 0.06}"/>`;
    }
    return `<defs>${sky('s', [[0, '#3f2a5c'], [0.45, '#e0725c'], [0.62, '#f6b26b']])}${sky('sea', [[0, '#5a6a8c'], [1, '#33415e']])}${glow('g', '#ffd08a')}</defs>
      <rect width="${W}" height="${H}" fill="url(#s)"/>
      <circle cx="830" cy="560" r="230" fill="url(#g)"/>
      <circle cx="830" cy="580" r="62" fill="#ffe7a8"/>
      <rect y="610" width="${W}" height="400" fill="url(#sea)"/>${lines}
      ${ridge(r, 880, 22, '#e8c9a0', 2)}`;
  },
  'morning-mountains': (r) => `<defs>${sky('s', [[0, '#f3c9a8'], [1, '#f6e1cc']])}${glow('g', '#fff1d6')}</defs>
      <rect width="${W}" height="${H}" fill="url(#s)"/>
      <circle cx="500" cy="300" r="160" fill="url(#g)"/><circle cx="500" cy="300" r="48" fill="#fff4e0"/>
      ${ridge(r, 520, 70, '#c98d7a')}${ridge(r, 620, 60, '#a8665a')}${ridge(r, 740, 50, '#82473f')}${ridge(r, 860, 40, '#5e302b')}`,
  'city-night': (r) => {
    let stars = '';
    for (let i = 0; i < 90; i++) stars += `<circle cx="${r() * W}" cy="${r() * 520}" r="${1 + r() * 1.6}" fill="#fff" opacity="${0.3 + r() * 0.6}"/>`;
    let city = '';
    let x = -20;
    while (x < W) {
      const bw = 70 + r() * 110;
      const bh = 220 + r() * 480;
      const top = H - bh;
      city += `<rect x="${x}" y="${top}" width="${bw}" height="${bh}" fill="${r() < 0.5 ? '#1c1b33' : '#24223f'}"/>`;
      for (let wy = top + 18; wy < H - 20; wy += 22)
        for (let wx = x + 12; wx < x + bw - 12; wx += 18)
          if (r() < 0.42) city += `<rect x="${wx}" y="${wy}" width="7" height="9" fill="${r() < 0.8 ? '#ffd27a' : '#fff0c8'}" opacity="${0.55 + r() * 0.45}"/>`;
      x += bw + 6 + r() * 20;
    }
    return `<defs>${sky('s', [[0, '#14122a'], [1, '#3a2d58']])}</defs><rect width="${W}" height="${H}" fill="url(#s)"/>${stars}
      <circle cx="1220" cy="160" r="40" fill="#f3ead2" opacity="0.9"/>${city}`;
  },
  'autumn-forest': (r) => {
    const colors = ['#d9531e', '#e88a2a', '#f2b33d', '#c0392b', '#e4672b', '#b8481f'];
    let trees = '';
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 16; i++) {
        const cx = (i / 15) * W + (r() - 0.5) * 80;
        const cy = 420 + row * 170 + (r() - 0.5) * 60;
        const rad = 70 + row * 25 + r() * 35;
        trees += `<rect x="${cx - 6}" y="${cy}" width="12" height="${H - cy}" fill="#6b3a24"/>`;
        trees += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${colors[Math.floor(r() * colors.length)]}" opacity="${0.85 + row * 0.05}"/>`;
      }
    }
    return `<defs>${sky('s', [[0, '#f7dfb8'], [1, '#f1c68f']])}</defs><rect width="${W}" height="${H}" fill="url(#s)"/>${trees}`;
  },
  balloons: (r) => {
    const colors = ['#e2552d', '#f0a531', '#c9454f', '#e57b3a'];
    let b = '';
    for (let i = 0; i < 6; i++) {
      const cx = 150 + r() * 1200;
      const cy = 140 + r() * 420;
      const s = 0.35 + r() * 0.75;
      const c = colors[i % colors.length];
      b += `<g transform="translate(${cx} ${cy}) scale(${s})">
        <path d="M0 -70 C 55 -70 70 -20 50 20 C 35 50 15 60 10 75 L -10 75 C -15 60 -35 50 -50 20 C -70 -20 -55 -70 0 -70 Z" fill="${c}"/>
        <path d="M0 -70 C 20 -40 20 40 4 75 M0 -70 C -20 -40 -20 40 -4 75" stroke="#000" stroke-opacity="0.12" stroke-width="3" fill="none"/>
        <rect x="-11" y="88" width="22" height="16" rx="3" fill="#7a4a2c"/><path d="M-9 75 L-9 88 M9 75 L9 88" stroke="#7a4a2c" stroke-width="2"/></g>`;
    }
    return `<defs>${sky('s', [[0, '#f6c9a2'], [1, '#f8e2c6']])}</defs><rect width="${W}" height="${H}" fill="url(#s)"/>${b}
      ${ridge(r, 840, 30, '#d9a47e', 2)}${ridge(r, 900, 25, '#b97a58', 2)}`;
  },
  'desert-dunes': (r) => `<defs>${sky('s', [[0, '#efd9c2'], [1, '#f6e6d2']])}</defs><rect width="${W}" height="${H}" fill="url(#s)"/>
      ${ridge(r, 520, 60, '#efc28f', 2)}${ridge(r, 650, 70, '#e6a86e', 2)}${ridge(r, 790, 60, '#d68d55', 2)}${ridge(r, 900, 40, '#c27745', 2)}`,
  'flower-field': (r) => {
    const colors = ['#e2552d', '#f2b33d', '#ffffff', '#d9467a', '#f08a3c'];
    let f = '';
    for (let i = 0; i < 1400; i++) {
      const y = 470 + Math.pow(r(), 0.8) * 530;
      const size = 2 + ((y - 470) / 530) * 7 * (0.6 + r() * 0.6);
      f += `<circle cx="${r() * W}" cy="${y}" r="${size}" fill="${colors[Math.floor(r() * colors.length)]}" opacity="0.9"/>`;
    }
    return `<defs>${sky('s', [[0, '#e8e7dc'], [1, '#f3eedf']])}${sky('g', [[0, '#9aab62'], [1, '#6f8a3e']])}</defs>
      <rect width="${W}" height="${H}" fill="url(#s)"/><rect y="460" width="${W}" height="540" fill="url(#g)"/>${f}`;
  },
  'lake-moon': (r) => {
    let lines = '';
    for (let i = 0; i < 8; i++) lines += `<rect x="${750 - (110 - i * 10) / 2}" y="${700 + i * 26}" width="${110 - i * 10}" height="3" rx="1.5" fill="#f3ead2" opacity="${0.55 - i * 0.05}"/>`;
    return `<defs>${sky('s', [[0, '#1d2140'], [1, '#3b3d63']])}${glow('g', '#f3ead2')}</defs>
      <rect width="${W}" height="${H}" fill="url(#s)"/>
      <circle cx="750" cy="260" r="170" fill="url(#g)" opacity="0.6"/><circle cx="750" cy="260" r="46" fill="#f6efdc"/>
      ${ridge(r, 600, 40, '#2a2b4a')}<rect y="670" width="${W}" height="330" fill="#1a1c33"/>${lines}`;
  },
};

/** A gentle tune: a I–vi–IV–V arpeggio with a soft envelope. 16-bit mono WAV. */
function song(seconds = 32, rate = 22050) {
  const n = seconds * rate;
  const pcm = new Int16Array(n);
  const chords = [
    [261.63, 329.63, 392.0],
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [196.0, 246.94, 293.66],
  ];
  const beat = 0.25;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const bar = Math.floor(t / 2) % 4;
    const step = Math.floor(t / beat);
    const tone = chords[bar][step % 3] * (step % 6 >= 3 ? 2 : 1);
    const local = t - step * beat;
    const env = Math.exp(-local * 6);
    const pad = chords[bar].reduce((s, f) => s + Math.sin(2 * Math.PI * (f / 2) * t), 0) * 0.05;
    const v = Math.sin(2 * Math.PI * tone * t) * env * 0.35 + pad;
    pcm[i] = Math.max(-1, Math.min(1, v)) * 30000;
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + n * 2, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(n * 2, 40);
  return Buffer.concat([head, Buffer.from(pcm.buffer)]);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H } });
let seed = 1;
for (const [name, draw] of Object.entries(SCENES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${draw(rng(seed++ * 7919))}</svg>`;
  await page.setContent(`<style>body{margin:0}</style>${svg}`);
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 86 });
  console.log('wrote', `${name}.jpg`);
}
await browser.close();
await writeFile(join(OUT, 'golden-hour.wav'), song());
console.log('wrote golden-hour.wav');
