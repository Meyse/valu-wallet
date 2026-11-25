// Motion model of the shared onboarding background. Ported from the accepted mockup
// (docs/redesign/mockups/onboarding-first-screen.html): one 180 s clock drives colour,
// glow position and field drift. Colours mix in OKLCH. All functions run as worklets.
import {GLOW_DATA} from './gradientData';

export const SEG = 45; // seconds per colour set
export const CYCLE = SEG * 4; // 180 s
const DWELL = 0.15;
const TAU = Math.PI * 2;

const lin = c => {
  'worklet';
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const unlin = c => {
  'worklet';
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
};

// [L, C, h, a, b]
export const toLCh = rgb => {
  'worklet';
  const R = lin(rgb[0]);
  const G = lin(rgb[1]);
  const B = lin(rgb[2]);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(a, bb), Math.atan2(bb, a), a, bb];
};

const clamp255 = v => {
  'worklet';
  return Math.max(0, Math.min(255, unlin(Math.max(0, v))));
};

const fromLab = (L, a, b) => {
  'worklet';
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    clamp255(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp255(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp255(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};

// Mix two LCh colours in OKLCH along the short hue arc.
export const mixLCh = (A, B, e) => {
  'worklet';
  if (Math.min(A[1], B[1]) < 0.04) {
    return fromLab(A[0] + (B[0] - A[0]) * e, A[3] + (B[3] - A[3]) * e, A[4] + (B[4] - A[4]) * e);
  }
  let dh = B[2] - A[2];
  if (dh > Math.PI) dh -= TAU;
  if (dh < -Math.PI) dh += TAU;
  const L = A[0] + (B[0] - A[0]) * e;
  const C = A[1] + (B[1] - A[1]) * e;
  const h = A[2] + dh * e;
  return fromLab(L, C * Math.cos(h), C * Math.sin(h));
};

// Colour phase as a pure function of time: set i, next set j, eased blend e.
export const phaseOf = t => {
  'worklet';
  const p = (((t / SEG) % 4) + 4) % 4;
  const i = Math.floor(p);
  const f = p - i;
  const x = Math.min(1, Math.max(0, (f - DWELL) / (1 - 2 * DWELL)));
  return {p, i, j: (i + 1) % 4, e: x * x * (3 - 2 * x)};
};

// "Slow drift" (the mockup default): amplitude px, period CYCLE / k, phase.
export const DRIFT = [
  [34, 26, 6, 5, 0.0], [30, 36, 4, 5, 1.7], [38, 30, 5, 4, 3.1], [32, 34, 4, 6, 4.4],
  [44, 20, 3, 4, 2.2], [28, 26, 5, 3, 5.3], [26, 32, 4, 5, 0.9], [30, 28, 6, 4, 2.7],
  [28, 30, 5, 6, 3.9], [34, 24, 3, 5, 1.1], [26, 30, 4, 3, 4.9],
];

export const drift = (k, t) => {
  'worklet';
  const d = DRIFT[k % DRIFT.length];
  return [
    d[0] * Math.sin((TAU * d[2] * t) / CYCLE + d[4]),
    d[1] * Math.sin((TAU * d[3] * t) / CYCLE + d[4] * 1.3),
  ];
};

// Precomputed on the JS thread, captured by the worklets.
export const SETS = GLOW_DATA.sets.map(set => ({
  centre: set.centre,
  hex: set.hex,
  lch: [set.base, ...set.cols].map(toLCh),
}));
export const FIELDS = GLOW_DATA.fields;

// Everything one frame needs. rgb arrays are 0..255.
export const frameAt = (t, still) => {
  'worklet';
  const ph = phaseOf(still ? 0 : t);
  const e = still ? 0 : ph.e;
  const A = SETS[ph.i];
  const B = SETS[ph.j];
  const colours = [];
  for (let k = 0; k < A.lch.length; k++) colours.push(mixLCh(A.lch[k], B.lch[k], e));
  const offsets = [];
  for (let k = 0; k < FIELDS.length; k++) offsets.push(still ? [0, 0] : drift(k, t));
  return {
    base: colours[0],
    cols: colours.slice(1),
    offsets,
    centre: [A.centre[0] + (B.centre[0] - A.centre[0]) * e, A.centre[1] + (B.centre[1] - A.centre[1]) * e],
    hex: [A.hex[0] + (B.hex[0] - A.hex[0]) * e, A.hex[1] + (B.hex[1] - A.hex[1]) * e],
    phase: ph,
  };
};
