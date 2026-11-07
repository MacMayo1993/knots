// Checks the braid studio's helpers and the changes behind faster, clearer views.
//
// 1. Packing: crossings that share a column use disjoint strand pairs, crossings
//    that share a strand keep their order, and the packed drawing is the same link
//    (Gauss linking numbers of the drawn curves match the braid).
// 2. Rope sampling: dense only where a strand crosses, at least 48 points per lap
//    elsewhere, the size limit still enforced, and the drawn polygon keeps every
//    linking number. The gap search never reports more than the true smallest gap
//    (brute force), including while pulling, and steps report when the rope settles.
// 3. The rope tube: closed, outward, centered on the polygon, smooth frames, and
//    buffers reused between frames.
// 4. Seifert construction stages: smoothing first, then disks, bands, trace; the
//    draw groups cover exactly what is drawn, ghost the disks above the band being
//    attached, and light the part being built.
// 5. Toolbar placement, reserved space, framing and view names.
//
// Run: node test/studio.test.cjs
const assert = require('node:assert/strict');
const KM = require('../knotmath.js'), RX = require('../relax.js'), SF = require('../seifert.js'), BS = require('../braid-studio.js'), MK = require('../meshkit.js');
let checks = 0;
const ok = (c, m) => { checks++; assert(c, m); };
let seed = 2026;
const rnd = k => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % k; };
const randomWord = (n, len) => Array.from({ length: len }, () => (1 + rnd(n - 1)) * (rnd(2) ? 1 : -1));
function gaussLink(P, Q) {
  let s = 0;
  const seg = C => C.map((p, i) => { const q = C[(i + 1) % C.length]; return [[(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], [q[0] - p[0], q[1] - p[1], q[2] - p[2]]]; });
  for (const [m1, d1] of seg(P)) for (const [m2, d2] of seg(Q)) {
    const r = [m1[0] - m2[0], m1[1] - m2[1], m1[2] - m2[2]], L = Math.hypot(...r);
    s += (r[0] * (d1[1] * d2[2] - d1[2] * d2[1]) + r[1] * (d1[2] * d2[0] - d1[0] * d2[2]) + r[2] * (d1[0] * d2[1] - d1[1] * d2[0])) / (L * L * L);
  }
  return s / (4 * Math.PI);
}

// 1. packing
for (let t = 0; t < 300; t++) {
  const n = 2 + rnd(7), w = randomWord(n, rnd(30)), col = KM.braidColumns(w);
  ok(JSON.stringify(SF.columns(w)) === JSON.stringify(col), 'seifert.js and knotmath.js pack alike');
  const byCol = new Map();
  w.forEach((g, k) => { const c = col[k]; if (!byCol.has(c)) byCol.set(c, []); byCol.get(c).push(Math.abs(g)); });
  for (const gens of byCol.values()) {
    const pos = gens.flatMap(i => [i, i + 1]);
    ok(new Set(pos).size === pos.length, 'a column uses disjoint strand pairs: ' + w);
  }
  for (let a = 0; a < w.length; a++) for (let b = a + 1; b < w.length; b++)
    if (Math.abs(Math.abs(w[a]) - Math.abs(w[b])) <= 1) ok(col[a] < col[b], 'crossings sharing a strand keep their order');
  const lay = KM.braidLayout(n, w);
  ok(lay.slots === (w.length ? Math.max(...col) + 1 : 1) && lay.slots <= Math.max(1, w.length), 'slot count');
}
ok(KM.braidLayout(4, [1, 3, 1, 3]).slots === 2 && KM.braidLayout(3, [1, 2, 1, 2]).slots === 4, 'far-commuting crossings share slots');
ok(KM.braidLayout(4, [1, 3, 1, 3], { pack: false }).slots === 4, 'packing can be turned off');
// the packed drawing is the same link: linking numbers of the drawn centerlines
for (let t = 0; t < 25; t++) {
  const n = 3 + rnd(3), w = randomWord(n, 2 + rnd(10)), rb = KM.readBraid(n, w), C = RX.fromBraid(KM, n, w);
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++)
    ok(Math.abs(gaussLink(C[i], C[j]) - rb.linking[i][j]) < 0.05, 'packed drawing keeps lk for ' + w);
}

// 2. rope sampling, gap search, settling
for (let t = 0; t < 60; t++) {
  const n = 2 + rnd(7), w = randomWord(n, 1 + rnd(40)), plan = RX.samplePlan(KM, n, w);
  for (let st = 0; st < n; st++) {
    let lap = 0;
    for (let s = 0; s < plan.slots; s++) {
      const busy = plan.lay.busy[s][plan.lay.position(st, s)];
      ok(plan.counts[st][s] === (busy ? plan.dense : plan.sparse), 'dense exactly where a strand crosses');
      ok(!busy || plan.counts[st][s] >= 8, 'at least 8 samples per crossing');
      lap += plan.counts[st][s];
    }
    ok(lap >= 48, 'at least 48 samples per lap');
  }
}
assert.throws(() => RX.fromBraid(KM, 10, Array(400).fill(1)), /too large to relax/); checks++;
ok(RX.samplePlan(KM, 10, Array(110).fill(1)).total < RX.MAX_POINTS, 'a long 2-strand twist on 10 strands is now affordable');
function trueGap(S) {
  let best = Infinity;
  for (let i = 0; i < S.N; i++) for (let j = i + 1; j < S.N; j++) {
    const i1 = S.next[i], j1 = S.next[j];
    if (i1 === j || j1 === i || i1 === j1) continue;
    best = Math.min(best, RX.segDist(S.P, i, i1, j, j1));
  }
  return best;
}
for (const [n, w] of [[2, [1, 1, 1]], [3, [1, -2, 1, -2]], [3, [1, -2, 1, -2, 1, -2]], [4, [1, 3, -2, 1, 3, -2]]]) {
  const S = RX.create(RX.fromBraid(KM, n, w));
  for (let k = 0; k < 60; k++) {
    const g = RX.minGap(S), tg = trueGap(S);
    ok(g <= tg + 1e-12, 'gap search is a lower bound: ' + g + ' vs ' + tg);
    ok(g >= tg - 1e-12, 'and finds the true gap');
    RX.step(S, k % 2 ? { handle: { vertex: S.start[0], target: [3 * Math.cos(k), 1.5, 3 * Math.sin(k)], whole: k % 4 === 1 } } : undefined);
  }
}
{
  const S = RX.create(RX.fromBraid(KM, 2, [1, 1, 1]));
  let settledAt = -1;
  for (let k = 0; k < 6000 && settledAt < 0; k++) if (RX.step(S).settled) settledAt = k;
  ok(settledAt > 0, 'the trefoil rope settles (step ' + settledAt + ')');
}

// 3. the rope tube
{
  const S = RX.create(RX.fromBraid(KM, 3, [1, -2, 1, -2]));
  for (let k = 0; k < 200; k++) RX.step(S);
  const C = RX.curves(S), t = BS.tube(C[0], 0.07, 12);
  const E = MK.edgeFaces(Array.from(t.index));
  ok([...E.values()].every(l => l.length === 2) && MK.orient(Array.from(t.index)).conflicts.length === 0, 'tube is closed and consistently oriented');
  let inward = 0, centre = 0, turn = 0;
  for (let i = 0; i < t.index.length; i += 3) {
    const [a, b, c] = [t.index[i], t.index[i + 1], t.index[i + 2]], P = k => [0, 1, 2].map(d => t.positions[3 * k + d]);
    const u = P(b).map((x, d) => x - P(a)[d]), v = P(c).map((x, d) => x - P(a)[d]);
    const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if ([0, 1, 2].reduce((s, d) => s + nrm[d] * (t.normals[3 * a + d] + t.normals[3 * b + d] + t.normals[3 * c + d]), 0) <= 0) inward++;
  }
  for (let i = 0; i < C[0].length; i++) {
    for (let d = 0; d < 3; d++) { let s = 0; for (let j = 0; j < 12; j++) s += t.positions[3 * (i * 12 + j) + d]; centre = Math.max(centre, Math.abs(s / 12 - C[0][i][d])); }
    const k = (i + 1) % C[0].length; turn = Math.max(turn, Math.acos(Math.min(1, [0, 1, 2].reduce((s, d) => s + t.normals[3 * i * 12 + d] * t.normals[3 * k * 12 + d], 0))));
  }
  ok(inward === 0, 'every triangle faces outward');
  ok(centre < 1e-6, 'rings are centered on the polygon');
  ok(turn < 0.35, 'frames turn smoothly (max ' + (turn * 180 / Math.PI).toFixed(1) + ' degrees)');
  const again = BS.tube(C[0], 0.07, 12, t);
  ok(again.positions === t.positions && again.index === t.index, 'buffers are reused');
  ok(BS.tube(C[0].slice(0, -1), 0.07, 12, t).positions !== t.positions, 'a different vertex count gets new buffers');
}

// 4. Seifert construction stages
for (const [n, w] of [[3, [1, -2, 1, -2]], [2, [1, 1, 1]], [4, [1, 3, -2, 1, 3]], [3, []]]) {
  const S = SF.build(n, w), total = S.indices.length, disks = S.parts.filter(q => q.kind === 'disk');
  const disksEnd = disks[disks.length - 1].start + disks[disks.length - 1].count;
  let last = '';
  const phases = [];
  for (let k = 0; k <= 400; k++) {
    const f = SF.constructionAt(S, k / 400), G = SF.constructionGroups(S, f);
    if (f.phase !== last) { phases.push(f.phase); last = f.phase; }
    const covered = G.reduce((s, q) => s + q.count, 0);
    ok(covered === f.count, 'groups cover exactly the drawn triangles at ' + k);
    ok(G.every((q, i) => i === 0 || q.start === G[i - 1].start + G[i - 1].count), 'groups are contiguous');
    if (f.phase === 'smooth') ok(f.count === 0 && G.length === 0, 'nothing drawn while smoothing');
    if (f.phase === 'band') {
      const top = Math.abs(w[f.part.crossing]);
      const ghost = G.filter(q => q.role === 'ghost');
      ok(top + 1 >= disks.length ? !ghost.length : ghost.length === 1 && ghost[0].start === disks[top + 1].start && ghost[0].start + ghost[0].count === disksEnd, 'disks above the band are ghosted');
      if (f.count > f.part.start) ok(G[G.length - 1].role === 'active' && G[G.length - 1].start === f.part.start, 'the band being attached is lit');
    }
    if (f.phase === 'disk' && f.count > f.part.start) ok(G[G.length - 1].role === 'active', 'the disk being filled is lit');
    if (f.done) ok(f.count === total && G.length === 1 && G[0].role === 'solid', 'finished surface is all solid');
  }
  const want = ['smooth', 'disk', ...(w.length ? ['band'] : []), 'trace', 'done'];
  ok(JSON.stringify(phases) === JSON.stringify(want), 'stages in order: ' + phases.join(' > '));
}

// 5. placement, reserved space, framing, view names
ok(BS.placement({ braid: true, lab: false, phone: false, sheet: 'peek', stageWidth: 900 }) === 'rail', 'desktop rail');
ok(BS.placement({ braid: true, lab: false, phone: false, sheet: 'peek', stageWidth: 500 }) === 'top', 'narrow desktop row');
ok(BS.placement({ braid: true, lab: false, phone: true, sheet: 'half', stageWidth: 390 }) === 'top', 'phone row, also with a half sheet');
ok(BS.placement({ braid: true, lab: false, phone: true, sheet: 'full', stageWidth: 390 }) === 'hidden', 'hidden behind a full sheet');
ok(BS.placement({ braid: false, lab: false, phone: false, sheet: 'peek', stageWidth: 900 }) === 'hidden' && BS.placement({ braid: true, lab: true, phone: false, sheet: 'peek', stageWidth: 900 }) === 'hidden', 'only for braids, not in the cut explorer');
{
  const R = BS.reserve('rail', 830, 620, { left: 12, top: 60, right: 200, bottom: 500 }, { left: 12, top: 12, right: 200, bottom: 50 });
  ok(R.tx === -105 && R.ty === 0 && R.freeW === 620 && R.freeH === 620, 'rail: model moves right of it, full height kept');
  const T = BS.reserve('top', 390, 844, { left: 10, top: 40, right: 380, bottom: 110 }, { left: 10, top: 10, right: 380, bottom: 40 });
  ok(T.tx === 0 && T.ty === -59 && T.freeH === 844 - 118, 'top row: model moves below it');
  const B = BS.reserve('rail', 830, 620, { left: 0, top: 0, right: NaN, bottom: 1 }, null);
  ok(B.tx === 0 && B.freeW === 830, 'a bad measurement reserves nothing');
}
{
  const a = { center: [0, 0, 0], scale: 1 }, b = { center: [2, -2, 4], scale: 4 };
  ok(JSON.stringify(BS.followFrame(a, b, 1)) === JSON.stringify(b), 'follow jumps at t = 1');
  const h = BS.followFrame(a, b, 0.5);
  ok(Math.abs(h.scale - 2) < 1e-12 && h.center[0] === 1, 'scale eases geometrically');
  ok(BS.followFrame(null, b, 0.1).scale === 4, 'no frame yet: take the target');
}
ok(BS.viewOf({ rope: false, pull: false, surface: false }) === 'ribbon' && BS.viewOf({ rope: true, pull: false, surface: false }) === 'rope'
  && BS.viewOf({ rope: false, pull: false, surface: true }) === 'surface' && BS.viewOf({ rope: true, pull: true, surface: false }) === 'pull', 'view names');
ok(BS.ropeKey({ n: 3, word: [1, -2] }) === '3:1,-2' && BS.ropeKey(null) === '', 'rope keys');
console.log('PASS: ' + checks + ' studio checks — crossing packing (disjoint columns, order, same link), adaptive rope sampling, gap search equals brute force under pulling, settling, closed outward rope tubes with smooth frames and reused buffers, Seifert stages and draw groups, toolbar placement, reserved space, framing.');
