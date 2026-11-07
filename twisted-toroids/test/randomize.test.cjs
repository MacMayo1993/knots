const assert = require('node:assert/strict');
const R = require('../randomize.js'), KM = require('../knotmath.js');
let seed = 7321;
const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
for (const [level, spec] of Object.entries(R.LEVELS)) {
  let previous = null;
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const b = R.braid(level, previous, rng);
    assert(b.n >= spec.strands[0] && b.n <= spec.strands[1]);
    assert(b.word.length >= spec.crossings[0] && b.word.length <= spec.crossings[1]);
    assert(b.word.every(g => Number.isInteger(g) && g !== 0 && Math.abs(g) < b.n));
    assert(b.word.every((g, j) => j === 0 || g !== -b.word[j - 1]));
    assert.equal(new Set(b.word.map(Math.abs)).size, b.n - 1, 'no unused outer strands');
    assert.notDeepEqual(b, previous);
    assert.equal(KM.cycles(KM.permutation(b.n, b.word)).flat().length, b.n);
    if (i < 3) assert.doesNotThrow(() => KM.jones(b.n, b.word));
    seen.add(b.n); previous = b;
  }
  assert.equal(seen.size, spec.strands[1] - spec.strands[0] + 1);
  for (const x of [0, .5, 1 - Number.EPSILON]) {
    const a = R.braid(level, null, () => x), b = R.braid(level, a, () => x);
    assert.notDeepEqual(a, b, 'a repeating RNG still produces a different word');
  }
}
// Geometry and paint may impose different periods: the shared period is required.
const shapes = {
  round: { sym: 0, colors: [0, 1] },
  egg: { sym: 1, colors: [0, 1] },
  hex: { sym: 6, colors: [0, 1, 2, 3, 4, 5] },
  differentPeriods: { sym: 4, colors: [0, 1, 2, 3, 4, 5] },
  band: { sym: 2, colors: [0, 1, 2], open: true },
  gear: { sym: 8, colors: Array(8).fill(0) }
};
for (const [shape, sh] of Object.entries(shapes)) {
  for (const turn of R.turns(sh)) {
    assert(Math.abs(turn) <= 2);
    if (sh.sym) assert(Math.abs(turn * sh.sym - Math.round(turn * sh.sym)) < 1e-9);
    const steps = KM.stepsFor({ kind: sh.open ? 'line' : 'ring', pieces: sh.colors.length, turn });
    assert.notEqual(steps, null, 'paint closes at the seam');
    const d = KM.describe({ kind: sh.open ? 'line' : 'ring', pieces: sh.colors.length, turn });
    assert(d.ok); assert(d.braid.word.length <= 48);
    const next = R.toroid(shapes, { shape, turn }, true, rng);
    assert.equal(next.shape, shape); assert.notEqual(next.turn, turn);
    assert.notEqual(R.toroid(shapes, { shape, turn }, false, rng).shape, shape);
  }
}
console.log('PASS: 1,500 bounded valid random braids, nonrepeating results, crossing coverage, Jones evaluation and seam-compatible toroid twists.');
