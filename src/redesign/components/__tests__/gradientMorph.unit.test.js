import {FIELD_RANK, SCENES, initialMotion, nextMotion} from '../gradientMorph';

const FRAME = 1 / 60;
const run = (m, scene, seconds, reduce = false, dt = FRAME) => {
  const trace = [m];
  for (let t = 0; t < seconds - 1e-9; t += dt) trace.push((m = nextMotion(m, scene, dt, reduce)));
  return {m, trace};
};

describe('gradient morph between Paper scenes', () => {
  it('moves from Welcome (hero) to Create password (dense) and settles there without overshoot', () => {
    const {m, trace} = run(initialMotion(SCENES.hero), SCENES.dense, 2);
    expect(m.box).toBeCloseTo(-297, 0);
    expect(m.hex).toBeCloseTo(-232, 0);
    m.fields.forEach(y => expect(y).toBeCloseTo(-297, 0));
    // Never past the target, never back up.
    trace.forEach(s => {
      expect(s.box).toBeGreaterThanOrEqual(-297.01);
      s.fields.forEach(y => expect(y).toBeGreaterThanOrEqual(-297.01));
    });
    expect(m.stretch).toBeCloseTo(1, 2);
  });

  it('is still moving after one card transition (0.35 s) but past half way', () => {
    const {m} = run(initialMotion(SCENES.hero), SCENES.dense, 0.35);
    expect(m.box).toBeLessThan(-297 / 2);
    expect(m.box).toBeGreaterThan(-290);
  });

  it('lets the top fields lead on the way up and the bottom fields lead on the way down', () => {
    const up = run(initialMotion(SCENES.hero), SCENES.dense, 0.2).m;
    const down = run(initialMotion(SCENES.dense), SCENES.hero, 0.2).m;
    const spreadUp = Math.max(...up.fields) - Math.min(...up.fields);
    expect(spreadUp).toBeGreaterThan(20); // the glow changes shape while it moves
    const most = f => f.indexOf(Math.min(...f));
    const least = f => f.indexOf(Math.max(...f));
    // Way up: the highest field has moved furthest. Way down: the lowest field has.
    expect(most(up.fields)).toBe(FIELD_RANK.indexOf(0));
    expect(least(down.fields)).toBe(FIELD_RANK.indexOf(1));
  });

  it('turns back without a jump when Back comes in the middle of a move', () => {
    let {m} = run(initialMotion(SCENES.hero), SCENES.dense, 0.2);
    const before = m.box;
    const next = nextMotion(m, SCENES.hero, FRAME, false);
    // One frame later the glow is still next to where it was (no restart, no cut).
    expect(Math.abs(next.box - before)).toBeLessThan(15);
    m = run(next, SCENES.hero, 1.5).m;
    expect(m.box).toBeCloseTo(0, 0);
  });

  it('gives the same end state at 30, 60 and 120 frames per second', () => {
    const ends = [1 / 30, 1 / 60, 1 / 120].map(dt => run(initialMotion(SCENES.hero), SCENES.icon, 0.3, false, dt).m.box);
    expect(Math.abs(ends[0] - ends[2])).toBeLessThan(1);
    expect(Math.abs(ends[1] - ends[2])).toBeLessThan(1);
  });

  it('stretches the soft edge only while the glow moves, and at most 18 %', () => {
    const {trace} = run(initialMotion(SCENES.hero), SCENES.dense, 1.5);
    const most = Math.max(...trace.map(s => s.stretch));
    expect(most).toBeGreaterThan(1.05);
    expect(most).toBeLessThanOrEqual(1.18);
    expect(trace[0].stretch).toBe(1);
  });

  it('fades the glow out and in again for the camera screen without moving it', () => {
    const {m} = run(initialMotion(SCENES.dense), {...SCENES.dense, strength: 0}, 1.5);
    expect(m.strength).toBeCloseTo(0, 2);
    expect(m.box).toBeCloseTo(-297, 5);
  });

  it('with Reduce Motion, puts the glow at the new place at once and dissolves in 0.4 s', () => {
    const start = initialMotion(SCENES.hero);
    const first = nextMotion(start, SCENES.dense, FRAME, true);
    expect(first.box).toBe(-297);
    expect(first.from.box).toBe(0);
    expect(first.mix).toBe(0);
    const {m} = run(first, SCENES.dense, 0.45, true);
    expect(m.from).toBeNull();
    expect(m.mix).toBe(1);
  });
});
