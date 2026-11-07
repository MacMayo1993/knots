// Checks knotmath.js against the model's own geometry.
//
// For every shape and a range of twists, this samples the stripe cores and edges
// exactly as index.html places them (cross-section point turned by k * theta, then
// carried around a circle of radius R in the x-z plane, y up), computes linking
// numbers with the Gauss integral, and compares them with what knotmath.js reads
// off the braid word: linking matrix, framings, and the sign convention.
//
// Run: node test/geometry.test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const KM = require('../knotmath.js');

const TAU = Math.PI * 2, R = 1.6;
// pieces per shape and kind, as in index.html's SHAPES (colors.length, open)
const SHAPES = {
  circle: ['ring', 2, 0], oval: ['ring', 2, 2], egg: ['ring', 2, 1], tri: ['ring', 3, 3], square: ['ring', 4, 4],
  pent: ['ring', 5, 5], hex: ['ring', 6, 6], hept: ['ring', 7, 7], oct: ['ring', 8, 8], star: ['ring', 5, 5],
  cross: ['ring', 4, 4], rect: ['ring', 2, 2], diamond: ['ring', 2, 2], heart: ['ring', 2, 1], star3: ['ring', 3, 3],
  star4: ['ring', 4, 4], star6: ['ring', 6, 6], gear: ['ring', 8, 8], band2: ['line', 2, 2], band3: ['line', 3, 2]
};
const HALF = 0.62, RAD = 0.62;

// A closed curve: the point at cross-section offset (a, b) carried `laps` times around.
function curve(a0, b0, k, laps, perLap = 500) {
  const N = laps * perLap, pts = [];
  for (let i = 0; i < N; i++) {
    const th = (i / perLap) * TAU, al = k * th, ca = Math.cos(al), sa = Math.sin(al);
    const a = a0 * ca - b0 * sa, b = a0 * sa + b0 * ca;
    pts.push([(R + a) * Math.cos(th), b, (R + a) * Math.sin(th)]);
  }
  return pts;
}
// Gauss linking integral, midpoint rule on the two polygons.
function gaussLink(P, Q) {
  let s = 0;
  const seg = C => C.map((p, i) => { const q = C[(i + 1) % C.length]; return [[(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], [q[0] - p[0], q[1] - p[1], q[2] - p[2]]]; });
  const A = seg(P), B = seg(Q);
  for (const [m1, d1] of A) for (const [m2, d2] of B) {
    const r = [m1[0] - m2[0], m1[1] - m2[1], m1[2] - m2[2]];
    const L = Math.hypot(...r);
    const cx = d1[1] * d2[2] - d1[2] * d2[1], cy = d1[2] * d2[0] - d1[0] * d2[2], cz = d1[0] * d2[1] - d1[1] * d2[0];
    s += (r[0] * cx + r[1] * cy + r[2] * cz) / (L * L * L);
  }
  return s / (4 * Math.PI);
}
function offsetFor(kind, n, pos) {   // pos is a piece index; +0.5 is the edge on its far side
  if (kind === 'ring') { const phi = pos * TAU / n; return [RAD * Math.cos(phi), RAD * Math.sin(phi)]; }
  const lw = 2 * HALF / n; return [-HALF + lw * (pos + 0.5), 0];
}

let checks = 0, failures = 0;
function expect(cond, msg) { checks++; if (!cond) { failures++; console.error('FAIL ' + msg); } }

for (const [name, [kind, n, sym]] of Object.entries(SHAPES)) {
  const step = sym ? 1 / sym : 0.25;
  for (let j = -Math.round(2 / step); j <= Math.round(2 / step); j++) {
    const k = j * step;
    const d = KM.describe({ kind, pieces: n, turn: k });
    const label = name + ' turn ' + k.toFixed(3);
    if (!d.ok) { expect(kind === 'ring' && Math.abs(k * n - Math.round(k * n)) > 1e-6, label + ' should close up'); continue; }
    expect(d.components.length === KM.gcd(d.steps, n) || kind === 'line', label + ' ring stripes = gcd(steps, n)');
    const cores = d.components.map(c => curve(...offsetFor(kind, n, c.pieces[0]), k, c.laps, 240));
    // linking matrix
    for (let a = 0; a < cores.length; a++) for (let b = a + 1; b < cores.length; b++) {
      const g = gaussLink(cores[a], cores[b]);
      expect(Math.abs(g - d.linking[a][b]) < 0.05, label + ' lk(' + a + ',' + b + ') braid ' + d.linking[a][b] + ' vs Gauss ' + g.toFixed(3));
    }
    // framing: core against its edge pushed along the stripe
    d.components.forEach((c, a) => {
      if (c.oneSided) { expect(kind === 'line' && Math.round(2 * k) % 2 !== 0, label + ' only Möbius stripes are one-sided'); return; }
      const [ea, eb] = offsetFor(kind, n, c.pieces[0] + 0.5);
      const edge = curve(ea, eb, k, c.laps, 240);
      const g = gaussLink(cores[a], edge);
      expect(Math.abs(g - c.framing) < 0.05, label + ' framing of stripe ' + a + ' braid ' + c.framing + ' vs Gauss ' + g.toFixed(3));
      // on a torus a (laps, turns) curve's surface framing is laps * turns; the centre lane carries the band's twist
      const centre = c.turns === 0 && kind === 'line';
      expect(c.framing === (centre ? k : c.laps * c.turns), label + ' framing formula for stripe ' + a);
    });
  }
}
console.log(checks + ' checks, ' + failures + ' failures');
process.exit(failures ? 1 : 0);
