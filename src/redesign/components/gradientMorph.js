// Screen-to-screen morph of the shared onboarding background. Pure worklet functions: the
// background calls nextMotion once per frame on the UI thread.
//
// Scenes come from the "Gradient header" layer of each Paper artboard (p-2-0, p-5-0), relative to
// Welcome. All artboards use the same glow image, size and colour, so a scene is a vertical place
// and a strength. The colour keeps its own time cycle.
//   hero  (Welcome, Creating wallet): glow box top -193, hex top 162
//   icon  (Use Face ID):              glow box top -260, hex top 160
//   dense (Create password, phrase):  the icon layout in a header moved up by 230
import {FIELDS} from './gradientMotion';

export const SCENES = {
  hero: {glow: 0, hex: 0, strength: 1},
  icon: {glow: -67, hex: -2, strength: 1},
  dense: {glow: -297, hex: -232, strength: 1},
};

const ROTATE = (-21.57 * Math.PI) / 180;
const BOX_W = 614;
const BOX_H = 699;
// Height of each colour field on the screen (0 = highest, 1 = lowest), for the order of the flow.
const ys = FIELDS.map(([x, y]) => Math.sin(ROTATE) * (x - BOX_W / 2) + Math.cos(ROTATE) * (y - BOX_H / 2));
const yMin = Math.min(...ys);
const yMax = Math.max(...ys);
export const FIELD_RANK = ys.map(y => (y - yMin) / (yMax - yMin));

// Spring stiffness (rad/s). Critically damped: no overshoot, about 0.6 to 0.9 s to settle.
// The glow box uses the same spring as the screen content (CARD_SPRING), so both arrive together.
export const W_BOX = 8;
const W_FIELD_MIN = 6;
const W_FIELD_MAX = 10;
const W_HEX = 5.5;
const W_STRENGTH = 6;
const STRETCH_PER_SPEED = 0.00022; // per px/s of the glow
const STRETCH_MAX = 0.18;
const DISSOLVE_S = 0.4;
const SUBSTEP = 1 / 120;

export const initialMotion = scene => {
  'worklet';
  return {
    box: scene.glow,
    bv: 0,
    fields: FIELDS.map(() => scene.glow),
    fv: FIELDS.map(() => 0),
    hex: scene.hex,
    hv: 0,
    strength: scene.strength,
    sv: 0,
    stretch: 1,
    target: {glow: scene.glow, hex: scene.hex, strength: scene.strength},
    from: null,
    mix: 1,
  };
};

const step = (x, v, target, w, h) => {
  'worklet';
  const a = w * w * (target - x) - 2 * w * v;
  const nv = v + a * h;
  return [x + nv * h, nv];
};

const sameScene = (a, b) => {
  'worklet';
  return a.glow === b.glow && a.hex === b.hex && a.strength === b.strength;
};

export const nextMotion = (m, scene, dt, reduceMotion) => {
  'worklet';
  const target = {glow: scene.glow, hex: scene.hex, strength: scene.strength};

  if (reduceMotion) {
    // Calm fallback: no movement. The glow at the old place fades out, the new one fades in.
    if (!sameScene(target, m.target)) {
      return {
        ...initialMotion(target),
        from: {box: m.box, fields: m.fields, hex: m.hex, strength: m.strength, stretch: 1},
        mix: 0,
      };
    }
    if (!m.from) return m;
    const mix = Math.min(1, m.mix + dt / DISSOLVE_S);
    return {...m, mix, from: mix >= 1 ? null : m.from};
  }

  let {box, bv, hex, hv, strength, sv} = m;
  const fields = m.fields.slice();
  const fv = m.fv.slice();
  // Moving up: the top fields lead. Moving down: the bottom fields lead.
  const up = target.glow < box;
  const n = Math.max(1, Math.ceil(dt / SUBSTEP));
  const h = dt / n;
  for (let s = 0; s < n; s++) {
    [box, bv] = step(box, bv, target.glow, W_BOX, h);
    for (let k = 0; k < fields.length; k++) {
      const lead = up ? 1 - FIELD_RANK[k] : FIELD_RANK[k];
      const w = W_FIELD_MIN + (W_FIELD_MAX - W_FIELD_MIN) * lead;
      [fields[k], fv[k]] = step(fields[k], fv[k], target.glow, w, h);
    }
    [hex, hv] = step(hex, hv, target.hex, W_HEX, h);
    [strength, sv] = step(strength, sv, target.strength, W_STRENGTH, h);
  }
  strength = Math.min(1, Math.max(0, strength));
  const stretch = 1 + Math.min(STRETCH_MAX, Math.abs(bv) * STRETCH_PER_SPEED);
  return {box, bv, fields, fv, hex, hv, strength, sv, stretch, target, from: null, mix: 1};
};
