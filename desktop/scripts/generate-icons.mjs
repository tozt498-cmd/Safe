// Génère build/icon.ico et build/icon.png (mark émeraude + éclair "boost").
// Pur Node, sans dépendance : rastérisation maison + encodage PNG/ICO.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZE = 256;
const SS = 2; // supersampling pour anti-aliasing

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Couleurs (RGB)
const BRIGHT = [56, 224, 162];
const DEEP = [5, 110, 80];
const BOLT = [240, 255, 250];

function roundedRectInside(x, y, w, h, r) {
  const rx = Math.min(r, w / 2);
  const cx = Math.max(rx, Math.min(x, w - rx));
  const cy = Math.max(rx, Math.min(y, h - rx));
  return (x - cx) ** 2 + (y - cy) ** 2 <= rx * rx || (x >= rx && x <= w - rx) || (y >= rx && y <= h - rx);
}

// Éclair stylisé (polygone)
const BOLT_POLY = [
  [150, 30], [84, 150], [124, 150], [106, 226], [180, 100], [140, 100], [168, 30],
];

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function sample(x, y) {
  // hors du carré arrondi -> transparent
  if (!roundedRectInside(x, y, SIZE, SIZE, 58)) return [0, 0, 0, 0];
  // dégradé diagonal
  const t = clamp01((x + y) / (2 * SIZE));
  let r = lerp(BRIGHT[0], DEEP[0], t);
  let g = lerp(BRIGHT[1], DEEP[1], t);
  let b = lerp(BRIGHT[2], DEEP[2], t);
  // léger glow central
  const dc = Math.hypot(x - SIZE / 2, y - SIZE / 2) / (SIZE / 2);
  const glow = clamp01(1 - dc) * 0.12;
  r = clamp01((r / 255 + glow)) * 255;
  g = clamp01((g / 255 + glow)) * 255;
  b = clamp01((b / 255 + glow)) * 255;
  if (pointInPoly(x, y, BOLT_POLY)) return [BOLT[0], BOLT[1], BOLT[2], 255];
  return [r, g, b, 255];
}

function render() {
  const out = Buffer.alloc(SIZE * SIZE * 4);
  const n = SS * SS;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let R = 0, G = 0, B = 0, A = 0; // prémultiplié
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb, pa] = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
          const af = pa / 255;
          R += pr * af; G += pg * af; B += pb * af; A += af;
        }
      }
      const idx = (y * SIZE + x) * 4;
      out[idx] = A > 0 ? Math.round(R / A) : 0;
      out[idx + 1] = A > 0 ? Math.round(G / A) : 0;
      out[idx + 2] = A > 0 ? Math.round(B / A) : 0;
      out[idx + 3] = Math.round((A / n) * 255);
    }
  }
  return out;
}

// ---- Encodage PNG ----------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(rgba, size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function encodeICO(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0; entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

const buildDir = join(__dirname, '..', 'build');
mkdirSync(buildDir, { recursive: true });
const rgba = render();
const png = encodePNG(rgba, SIZE);
writeFileSync(join(buildDir, 'icon.png'), png);
writeFileSync(join(buildDir, 'icon.ico'), encodeICO(png, SIZE));
console.log('Icônes générées : build/icon.png, build/icon.ico');
