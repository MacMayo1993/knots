// Checks the braid diagram editor's drawing and the knot relaxation.
//
// Editor: in the drawn diagram every crossing's sign, read off the picture (over-
// and under-strand directions, strands running left to right), equals the sign of
// its generator; strands are continuous from column to column and keep their
// component; components match knotmath.
// Relaxation: on every step no vertex moves as much as half the smallest gap
// between segments that share no vertex (so no two segments can pass through each
// other), and the Gauss linking numbers between components are unchanged.
//
// Run: node test/editor-relax.test.cjs
const assert = require('node:assert/strict');
const KM = require('../knotmath.js'), BE = require('../braid-editor.js'), RX = require('../relax.js');
let checks = 0;
const ok = (c, m) => { checks++; assert(c, m); };
let seed = 21;
const rnd = k => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % k; };
const randomWord = (n, len) => Array.from({ length: len }, () => (1 + rnd(n - 1)) * (rnd(2) ? 1 : -1));

// 1. editor diagrams
for (let t = 0; t < 120; t++) {
  const n = 2 + rnd(6), w = randomWord(n, rnd(16)), D = BE.diagram(n, w);
  // crossing signs read off the picture: screen y points down, so flip it
  w.forEach((g, k) => {
    const over = D.segs.find(s => s.column === k && s.role === 'over'), under = D.segs.find(s => s.column === k && s.role === 'under');
    const o = [over.x2 - over.x1, -(over.y2 - over.y1)], u = [under.x2 - under.x1, -(under.y2 - under.y1)];
    // right-handed (positive): turning the over-strand a quarter turn counterclockwise gives the under-strand
    ok(Math.sign(o[0] * u[1] - o[1] * u[0]) === Math.sign(g), 'sign of crossing ' + k + ' in ' + w);
  });
  // continuity: each segment's end is the next column's start, with the same component
  const byStart = new Map(D.segs.map(s => [s.x1 + ',' + s.y1, s]));
  for (const s of D.segs) {
    if (s.x2 >= D.width - BE.PAD - 1e-9) continue;
    const nx = byStart.get(s.x2 + ',' + s.y2);
    ok(nx && nx.comp === s.comp, 'strand continues with its component in ' + w);
  }
  const comps = new Set(D.segs.map(s => s.comp));
  ok(comps.size === KM.cycles(KM.permutation(n, w)).length, 'components in ' + w);
  ok(JSON.stringify(BE.componentOf(n, w)) === JSON.stringify(KM.readBraid(n, w).compOf), 'component numbering matches knotmath');
}

// 2. relaxation
function gaussLink(P, Q) {
  let s = 0;
  const seg = C => C.map((p, i) => { const q = C[(i + 1) % C.length]; return [[(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], [q[0] - p[0], q[1] - p[1], q[2] - p[2]]]; });
  for (const [m1, d1] of seg(P)) for (const [m2, d2] of seg(Q)) {
    const r = [m1[0] - m2[0], m1[1] - m2[1], m1[2] - m2[2]], L = Math.hypot(...r);
    s += (r[0] * (d1[1] * d2[2] - d1[2] * d2[1]) + r[1] * (d1[2] * d2[0] - d1[0] * d2[2]) + r[2] * (d1[0] * d2[1] - d1[1] * d2[0])) / (L * L * L);
  }
  return s / (4 * Math.PI);
}
const cases = [[2, [1, 1, 1]], [3, [1, -2, 1, -2]], [3, [1, -2, 1, -2, 1, -2]], [2, [1, 1, 1, 1]], [3, [1, 1, -2, 1, -2]]];
// Exact polygonal Gauss integral via spherical quadrilaterals. The midpoint rule
// above is too inaccurate when a long braid puts neighbouring turns very close.
function polygonLink(P, Q) {
  const sub = (a, b) => a.map((x, k) => x - b[k]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const solidAngle = (a, b, c) => {
    const la = Math.hypot(...a), lb = Math.hypot(...b), lc = Math.hypot(...c);
    const det = a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    return 2 * Math.atan2(det, la * lb * lc + dot(a, b) * lc + dot(b, c) * la + dot(c, a) * lb);
  };
  let sum = 0;
  for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) {
    const a = sub(P[i], Q[j]), b = sub(P[i], Q[(j + 1) % Q.length]);
    const c = sub(P[(i + 1) % P.length], Q[(j + 1) % Q.length]), d = sub(P[(i + 1) % P.length], Q[j]);
    sum += solidAngle(a, b, c) + solidAngle(a, c, d);
  }
  return sum / (4 * Math.PI);
}
for (const crossings of [2, 72, 144, -144, 400]) {
  const w = Array(Math.abs(crossings)).fill(Math.sign(crossings));
  const C = RX.fromBraid(KM, 2, w);
  ok(C.every(c => c.length >= 8 * w.length), 'each crossing is resolved in ' + crossings);
  const lk = polygonLink(C[0], C[1]);
  ok(Math.abs(lk - crossings / 2) < 1e-6, 'initial T(2,' + crossings + ') linking: ' + lk);
  if (crossings === 144) {
    const S = RX.create(C);
    for (let k = 0; k < 3; k++) RX.step(S);
    const after = RX.curves(S);
    ok(Math.abs(polygonLink(after[0], after[1]) - 72) < 1e-6, 'dense link survives relaxation steps');
  }
}
assert.throws(() => RX.fromBraid(KM, 10, Array(400).fill(1)), /too large to relax/);
const tinyRequest = RX.fromBraid(KM, 2, [1, 1], 1);
ok(tinyRequest[0].length >= 16, 'a small per argument cannot skip crossings');
for (let t = 0; t < 6; t++) { const n = 2 + rnd(3); cases.push([n, randomWord(n, 2 + rnd(7))]); }
for (const [n, w] of cases) {
  const S = RX.create(RX.fromBraid(KM, n, w, 48)), rb = KM.readBraid(n, w);
  let worst = 0;
  for (let k = 0; k < 500; k++) {
    const r = RX.step(S);
    ok(r.gap > 0 && r.move < 0.5 * r.gap, 'step ' + k + ' of ' + w + ' moves ' + r.move + ' with gap ' + r.gap);
    worst = Math.max(worst, r.move / r.gap);
  }
  const C = RX.curves(S);
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
    const lk = gaussLink(C[i], C[j]);
    ok(Math.abs(lk - rb.linking[i][j]) < 0.1, 'lk(' + i + ',' + j + ') of ' + w + ' after relaxing: ' + lk.toFixed(3) + ' vs ' + rb.linking[i][j]);
  }
}
// segment distance helper agrees with brute force sampling
for (let t = 0; t < 200; t++) {
  const P = Float64Array.from({ length: 12 }, () => rnd(1000) / 250 - 2);
  const d = RX.segDist(P, 0, 1, 2, 3);
  let best = Infinity;
  for (let a = 0; a <= 60; a++) for (let b = 0; b <= 60; b++) {
    const s = a / 60, u = b / 60, x = [0, 1, 2].map(k => P[k] + s * (P[3 + k] - P[k]) - P[6 + k] - u * (P[9 + k] - P[6 + k]));
    best = Math.min(best, Math.hypot(...x));
  }
  ok(d <= best + 1e-9 && d >= best - 0.08, 'segment distance ' + d + ' vs sampled ' + best);
}
console.log('PASS: ' + checks + ' checks — editor crossing signs read off the drawing, strand continuity and components; relaxation never moves a vertex half the smallest gap and keeps every linking number; segment distances.');
