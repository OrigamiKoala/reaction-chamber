import * as THREE from 'three';

/**
 * Procedural CanvasTextures (no external image files). Shared textures are cached singletons —
 * never dispose them from per-object code.
 */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Deterministic PRNG so textures look the same every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tex(c: HTMLCanvasElement, srgb: boolean, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached<T extends THREE.Texture>(key: string, make: () => T): T {
  let t = cache.get(key) as T | undefined;
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** Soft round sprite (white, radial falloff). */
export function softSpriteTexture(): THREE.Texture {
  return cached('soft', () => {
    const [c, g] = canvas(64, 64);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.65)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return tex(c, false);
  });
}

/** Billowy smoke/steam puff (noisy soft disc). */
export function smokePuffTexture(): THREE.Texture {
  return cached('smoke', () => {
    const S = 128;
    const [c, g] = canvas(S, S);
    const rnd = mulberry32(7);
    g.clearRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * S * 0.22;
      const x = S / 2 + Math.cos(a) * d;
      const y = S / 2 + Math.sin(a) * d;
      const r = S * (0.16 + rnd() * 0.2);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${0.18 + rnd() * 0.12})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
    }
    // radial fade so edges are always clean
    const img = g.getImageData(0, 0, S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (x - S / 2) / (S / 2);
        const dy = (y - S / 2) / (S / 2);
        const f = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
        const i = (y * S + x) * 4 + 3;
        img.data[i] = Math.min(255, img.data[i] * Math.min(1, f * 2.2));
      }
    }
    g.putImageData(img, 0, 0);
    return tex(c, false);
  });
}

/** Ring glow decal (selection / hover). */
export function ringGlowTexture(): THREE.Texture {
  return cached('ring', () => {
    const S = 256;
    const [c, g] = canvas(S, S);
    const grd = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return tex(c, false);
  });
}

/** Contact-shadow blob (black, soft edge). */
export function blobShadowTexture(): THREE.Texture {
  return cached('blob', () => {
    const S = 128;
    const [c, g] = canvas(S, S);
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.85)');
    grd.addColorStop(0.55, 'rgba(0,0,0,0.5)');
    grd.addColorStop(0.8, 'rgba(0,0,0,0.12)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return tex(c, false);
  });
}

/** Condensation: many tiny droplets + a few runs. RGBA (alpha = droplet coverage). Tileable-ish. */
export function dropletsTexture(): THREE.Texture {
  return cached('droplets', () => {
    const S = 512;
    const [c, g] = canvas(S, S);
    const rnd = mulberry32(42);
    g.clearRect(0, 0, S, S);
    // haze
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(0, 0, S, S);
    const drop = (x: number, y: number, r: number) => {
      const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.35, 'rgba(235,242,248,0.35)');
      grd.addColorStop(0.85, 'rgba(200,210,220,0.55)');
      grd.addColorStop(1, 'rgba(200,210,220,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.9 + rnd() * 0.25), 0, 0, Math.PI * 2);
      g.fill();
    };
    for (let i = 0; i < 2600; i++) drop(rnd() * S, rnd() * S, 0.8 + Math.pow(rnd(), 3) * 3.5);
    for (let i = 0; i < 90; i++) drop(rnd() * S, rnd() * S, 4 + rnd() * 6);
    // runs
    for (let i = 0; i < 7; i++) {
      const x = rnd() * S;
      let y = rnd() * S * 0.5;
      const len = 60 + rnd() * 200;
      g.strokeStyle = 'rgba(230,238,245,0.35)';
      g.lineWidth = 2 + rnd() * 2;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < len; k += 8) {
        y += 8;
        g.lineTo(x + Math.sin(k * 0.05) * 1.5, y);
      }
      g.stroke();
      drop(x, y, 4 + rnd() * 3);
    }
    return tex(c, false, true);
  });
}

/** Charcoal epoxy-resin worktop: albedo with fine speckle + roughness variation. */
export function countertopTextures(): { map: THREE.Texture; roughnessMap: THREE.Texture } {
  const map = cached('counter_map', () => {
    const S = 1024;
    const [c, g] = canvas(S, S);
    const rnd = mulberry32(11);
    g.fillStyle = '#25282b';
    g.fillRect(0, 0, S, S);
    // large soft mottling
    for (let i = 0; i < 160; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 40 + rnd() * 140;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const l = rnd() < 0.5 ? '255,255,255' : '0,0,0';
      grd.addColorStop(0, `rgba(${l},0.035)`);
      grd.addColorStop(1, `rgba(${l},0)`);
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // speckle
    for (let i = 0; i < 26000; i++) {
      const v = rnd();
      g.fillStyle = v < 0.5 ? `rgba(120,124,128,${0.15 + rnd() * 0.3})` : `rgba(10,10,12,${0.2 + rnd() * 0.3})`;
      const s = rnd() < 0.97 ? 1 : 2;
      g.fillRect(rnd() * S, rnd() * S, s, s);
    }
    return tex(c, true, true);
  });
  const roughnessMap = cached('counter_rough', () => {
    const S = 512;
    const [c, g] = canvas(S, S);
    const rnd = mulberry32(13);
    g.fillStyle = 'rgb(105,105,105)';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 220; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 20 + rnd() * 90;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const v = rnd() < 0.5 ? 150 : 70;
      grd.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
      grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // fine wipe marks
    g.strokeStyle = 'rgba(160,160,160,0.08)';
    for (let i = 0; i < 60; i++) {
      g.lineWidth = 4 + rnd() * 10;
      g.beginPath();
      const x = rnd() * S;
      const y = rnd() * S;
      g.arc(x, y, 30 + rnd() * 120, rnd() * 6, rnd() * 6 + 1.5);
      g.stroke();
    }
    return tex(c, false, true);
  });
  return { map, roughnessMap };
}

/** White subway tile wall (albedo + roughness with grout). */
export function tileTextures(): { map: THREE.Texture; roughnessMap: THREE.Texture; bumpMap: THREE.Texture } {
  const build = (mode: 'map' | 'rough' | 'bump') => {
    const S = 1024;
    const [c, g] = canvas(S, S);
    const rnd = mulberry32(21);
    const tw = S / 4;
    const th = S / 8;
    const grout = 6;
    g.fillStyle = mode === 'map' ? '#b9bcbc' : mode === 'rough' ? 'rgb(235,235,235)' : 'rgb(0,0,0)';
    g.fillRect(0, 0, S, S);
    for (let row = 0; row < 8; row++) {
      const off = row % 2 === 0 ? 0 : tw / 2;
      for (let col = -1; col < 5; col++) {
        const x = col * tw + off + grout / 2;
        const y = row * th + grout / 2;
        const w = tw - grout;
        const h = th - grout;
        if (mode === 'map') {
          const v = 238 + Math.floor(rnd() * 10);
          const grd = g.createLinearGradient(x, y, x, y + h);
          grd.addColorStop(0, `rgb(${v},${v},${v - 2})`);
          grd.addColorStop(1, `rgb(${v - 8},${v - 8},${v - 9})`);
          g.fillStyle = grd;
        } else if (mode === 'rough') {
          g.fillStyle = 'rgb(40,40,40)';
        } else {
          g.fillStyle = 'rgb(255,255,255)';
        }
        g.beginPath();
        g.roundRect(x, y, w, h, 7);
        g.fill();
        if (mode === 'bump') {
          // bevel edge
          g.strokeStyle = 'rgba(0,0,0,0.25)';
          g.lineWidth = 6;
          g.stroke();
        }
      }
    }
    return tex(c, mode === 'map', true);
  };
  return {
    map: cached('tile_map', () => build('map')),
    roughnessMap: cached('tile_rough', () => build('rough')),
    bumpMap: cached('tile_bump', () => build('bump')),
  };
}

/** Painted wall with subtle roller texture. */
export function paintTexture(hex = '#d9dcd6'): THREE.Texture {
  return cached('paint' + hex, () => {
    const S = 512;
    const [c, g] = canvas(S, S);
    const rnd = mulberry32(31);
    g.fillStyle = hex;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
      g.fillRect(rnd() * S, rnd() * S, 2, 2);
    }
    return tex(c, true, true);
  });
}

/** Oak-ish wood grain for shelves. */
export function woodTexture(): THREE.Texture {
  return cached('wood', () => {
    const W = 1024;
    const H = 128;
    const [c, g] = canvas(W, H);
    const rnd = mulberry32(5);
    g.fillStyle = '#a77b4f';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const y = rnd() * H;
      const amp = 2 + rnd() * 6;
      const f = 0.002 + rnd() * 0.01;
      g.strokeStyle = rnd() < 0.5 ? `rgba(90,58,30,${0.12 + rnd() * 0.2})` : `rgba(210,170,120,${0.08 + rnd() * 0.12})`;
      g.lineWidth = 0.6 + rnd() * 2.2;
      g.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const yy = y + Math.sin(x * f + i) * amp;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
    return tex(c, true, true);
  });
}

/** Grey vinyl lab floor. */
export function floorTexture(): THREE.Texture {
  return cached('floor', () => {
    const S = 512;
    const [c, g] = canvas(S, S);
    const rnd = mulberry32(3);
    g.fillStyle = '#8d9293';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 12000; i++) {
      const v = rnd();
      g.fillStyle = v < 0.33 ? 'rgba(255,255,255,0.18)' : v < 0.66 ? 'rgba(40,44,48,0.18)' : 'rgba(120,130,140,0.25)';
      g.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 2, 2 + rnd() * 2);
    }
    g.strokeStyle = 'rgba(60,60,60,0.25)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, S, S);
    return tex(c, true, true);
  });
}

/** Cabinet doors / drawers below the worktop. */
export function cabinetTexture(): THREE.Texture {
  return cached('cabinet', () => {
    const W = 1024;
    const H = 512;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#d4d8d6';
    g.fillRect(0, 0, W, H);
    const cols = 4;
    for (let i = 0; i < cols; i++) {
      const x = (i * W) / cols;
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 4;
      g.strokeRect(x + 6, 8, W / cols - 12, 110);
      g.strokeRect(x + 6, 130, W / cols - 12, H - 140);
      // handles
      g.fillStyle = '#8a9096';
      g.fillRect(x + W / cols / 2 - 40, 52, 80, 10);
      g.fillRect(x + W / cols / 2 - 40, 160, 80, 10);
    }
    return tex(c, true);
  });
}

/** Rectangular glow for window light / ceiling panels. */
export function windowTexture(): THREE.Texture {
  return cached('window', () => {
    const W = 512;
    const H = 512;
    const [c, g] = canvas(W, H);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#dfeefc');
    grd.addColorStop(0.6, '#f4f8fb');
    grd.addColorStop(1, '#e8eef0');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // distant tree line / buildings, very soft
    g.fillStyle = 'rgba(150,170,160,0.35)';
    g.beginPath();
    g.moveTo(0, H * 0.78);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, H * 0.78 - Math.abs(Math.sin(x * 0.03)) * 40 - Math.sin(x * 0.011) * 20);
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();
    // mullions
    g.fillStyle = '#c9cdd0';
    g.fillRect(W / 2 - 6, 0, 12, H);
    g.fillRect(0, H / 2 - 6, W, 12);
    g.lineWidth = 16;
    g.strokeStyle = '#c9cdd0';
    g.strokeRect(0, 0, W, H);
    return tex(c, true);
  });
}

/** Ceramic hot-plate heating glow (emissive map): concentric coil rings. */
export function hotplateGlowTexture(): THREE.Texture {
  return cached('hotglow', () => {
    const S = 256;
    const [c, g] = canvas(S, S);
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.48);
    grd.addColorStop(0, 'rgba(255,90,20,0.55)');
    grd.addColorStop(0.7, 'rgba(255,60,10,0.4)');
    grd.addColorStop(1, 'rgba(255,40,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    for (let r = 18; r < S * 0.44; r += 13) {
      g.strokeStyle = 'rgba(255,120,40,0.85)';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
      g.stroke();
    }
    return tex(c, true);
  });
}

/** Ceramic top albedo (dark glass-ceramic with subtle centering ring and safety marking). */
export function hotplateTopTexture(): THREE.Texture {
  return cached('hottop', () => {
    const S = 256;
    const [c, g] = canvas(S, S);
    // Dark charcoal/slate glass-ceramic surface (e.g. Schott Ceran / dark Pyroceram)
    g.fillStyle = '#1c1f22';
    g.fillRect(0, 0, S, S);
    // Fine subtle ceramic micro-texture
    const rnd = mulberry32(42);
    for (let i = 0; i < 3500; i++) {
      const v = rnd();
      g.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)';
      g.fillRect(rnd() * S, rnd() * S, 1, 1);
    }
    // Heating zone boundary ring (subtle, high-precision lab marking)
    g.strokeStyle = 'rgba(220,225,230,0.32)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.38, 0, Math.PI * 2);
    g.stroke();
    // Inner vessel centering ring
    g.strokeStyle = 'rgba(200,210,220,0.2)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.2, 0, Math.PI * 2);
    g.stroke();
    // Subtle cross tick marks at the perimeter
    g.strokeStyle = 'rgba(220,225,230,0.28)';
    g.lineWidth = 1.5;
    for (let a = 0; a < 4; a++) {
      const angle = (a * Math.PI) / 2;
      const r0 = S * 0.34;
      const r1 = S * 0.42;
      g.beginPath();
      g.moveTo(S / 2 + Math.cos(angle) * r0, S / 2 + Math.sin(angle) * r0);
      g.lineTo(S / 2 + Math.cos(angle) * r1, S / 2 + Math.sin(angle) * r1);
      g.stroke();
    }
    // Warning marking
    g.fillStyle = 'rgba(235,65,45,0.85)';
    g.font = 'bold 12px system-ui, -apple-system, sans-serif';
    g.textAlign = 'center';
    g.fillText('⚠ HOT SURFACE', S / 2, S - 14);
    return tex(c, true);
  });
}

/** Foam head bubbles, used as albedo + alpha. */
export function foamTexture(): THREE.Texture {
  return cached('foam', () => {
    const S = 256;
    const [c, g] = canvas(S, S);
    const rnd = mulberry32(17);
    g.fillStyle = 'rgba(245,247,248,1)';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 1.5 + Math.pow(rnd(), 2) * 9;
      g.strokeStyle = `rgba(170,180,190,${0.35 + rnd() * 0.3})`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(x - r * 0.4, y - r * 0.5, 1.5, 1.5);
    }
    return tex(c, true, true);
  });
}

// ------------------------------------------------------------------ graduation / label decals
const INK = 'rgba(8,12,20,0.97)';
const HALO = 'rgba(255,255,255,0.62)';
const FONT = '"Helvetica Neue", Arial, sans-serif';

export interface GradMark {
  /** Height of the mark in cm above the bottom of the decal. */
  y: number;
  /** 0 = minor (short), 1 = mid, 2 = major (long, numeral). */
  tier: 0 | 1 | 2;
  label?: string;
}

export interface GradTextureSpec {
  key: string;
  /** Physical size of the decal patch (cm): arc width x height. */
  widthCm: number;
  heightCm: number;
  marks: GradMark[];
  /** Numeral height (cm). */
  fontCm: number;
  /** Smallest vertical distance between two marks (cm): keeps the strokes thin enough to stay separate. */
  minSpacingCm: number;
  /** Text lines in the title block: y = centre in cm above the decal bottom. */
  title: { text: string; y: number; sizeCm: number }[];
}

/** Pixels per cm for a decal of this height (the canvas stays <= 4096 px tall). */
function decalScale(heightCm: number): number {
  return Math.max(24, Math.min(110, 4096 / Math.max(1, heightCm)));
}

/**
 * Dark-ink graduation decal with a faint light halo (reads on dark and light backgrounds): minor ticks are short
 * half-ring ticks, mid ticks longer, major ticks long with a numeral beside them. All sizes are physical (cm).
 */
export function graduationTexture(spec: GradTextureSpec): THREE.Texture {
  return cached('grad_' + spec.key, () => {
    const s = decalScale(spec.heightCm);
    const W = Math.max(64, Math.min(1024, Math.round(spec.widthCm * s)));
    const H = Math.max(64, Math.min(4096, Math.round(spec.heightCm * s)));
    const [c, g] = canvas(W, H);
    g.clearRect(0, 0, W, H);
    const px = (cm: number) => cm * s;
    const x0 = W * 0.06;
    const len = [W * 0.2, W * 0.34, W * 0.52];
    const thick = [0.036, 0.05, 0.068].map((t) => Math.min(t, spec.minSpacingCm * 0.34));
    const halo = Math.min(0.026, spec.minSpacingCm * 0.14);
    const fontPx = px(spec.fontCm);
    // halo pass first so ink is always on top
    for (const pass of [0, 1]) {
      g.fillStyle = pass === 0 ? HALO : INK;
      for (const m of spec.marks) {
        const y = H - px(m.y);
        const t = px(thick[m.tier] + (pass === 0 ? halo * 2 : 0));
        const pad = pass === 0 ? px(halo) : 0;
        g.fillRect(x0 - pad, y - t / 2, len[m.tier] + pad * 2, t);
      }
    }
    // numerals
    g.font = `700 ${fontPx}px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (const m of spec.marks) {
      if (!m.label) continue;
      const y = H - px(m.y);
      const x = x0 + len[2] + W * 0.04;
      g.lineWidth = Math.max(2, fontPx * 0.2);
      g.strokeStyle = HALO;
      g.strokeText(m.label, x, y);
      g.fillStyle = INK;
      g.fillText(m.label, x, y);
    }
    // title block (units / nominal volume)
    g.textAlign = 'center';
    for (const t of spec.title) {
      const size = px(t.sizeCm);
      g.font = `700 ${size}px ${FONT}`;
      g.lineWidth = Math.max(2, size * 0.2);
      g.strokeStyle = HALO;
      g.strokeText(t.text, W * 0.5, H - px(t.y));
      g.fillStyle = INK;
      g.fillText(t.text, W * 0.5, H - px(t.y));
    }
    const t = tex(c, true);
    t.anisotropy = 8;
    return t;
  });
}

/** Title-only enamel label (volumetric flask / pipette bulb). */
export function labelTexture(key: string, lines: string[], widthCm: number, heightCm: number): THREE.Texture {
  return cached('label_' + key, () => {
    const s = Math.min(90, 1024 / Math.max(widthCm, heightCm));
    const W = Math.max(64, Math.round(widthCm * s));
    const H = Math.max(64, Math.round(heightCm * s));
    const [c, g] = canvas(W, H);
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const n = lines.length;
    // largest font that fits every line in the width and all lines in the height
    const base = (H / (n + 0.6)) * 0.78;
    let size = base;
    g.font = `700 ${base}px ${FONT}`;
    for (const l of lines) size = Math.min(size, base * ((W * 0.9) / Math.max(1, g.measureText(l).width)));
    lines.forEach((l, i) => {
      const sz = i === 0 ? size : size * 0.78;
      g.font = `700 ${sz}px ${FONT}`;
      const y = (H * (i + 0.7)) / (n + 0.4);
      g.lineWidth = Math.max(2, sz * 0.2);
      g.strokeStyle = HALO;
      g.strokeText(l, W / 2, y);
      g.fillStyle = i === n - 1 && n > 2 ? 'rgba(20,60,150,0.97)' : INK;
      g.fillText(l, W / 2, y);
    });
    const t = tex(c, true);
    t.anisotropy = 8;
    return t;
  });
}

/** Thermometer scale strip (-20..110 °C). */
export function thermometerScaleTexture(): THREE.Texture {
  return cached('thermoscale', () => {
    const W = 64;
    const H = 2048;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#f3f1e8';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b1b1b';
    for (let t = -20; t <= 110; t += 1) {
      const v = (t + 20) / 130;
      const y = H - v * H * 0.96 - H * 0.02;
      const major = t % 10 === 0;
      const mid = t % 5 === 0;
      g.fillRect(0, y - 1, major ? 30 : mid ? 22 : 14, major ? 3 : 2);
      if (major) {
        g.save();
        g.translate(54, y);
        g.rotate(-Math.PI / 2);
        g.font = 'bold 18px Arial';
        g.textAlign = 'center';
        g.fillText(String(t), 0, 0);
        g.restore();
      }
    }
    return tex(c, true);
  });
}
