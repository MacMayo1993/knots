// Checks the Seifert surfaces drawn for closed braids, and meshkit's topology tools.
//
// For every braid tried, the triangle mesh itself is walked (meshkit.analyze) to
// count pieces, boundary loops and the Euler characteristic, and to check it is
// orientable. The boundary loops are traced as curves and their Gauss linking
// integrals compared with the braid's linking matrix, which also fixes the sign
// convention of the bands (a positive generator must give a positive crossing).
// Thickening for 3D printing must give closed solids: every edge on two faces.
//
// Run: node test/seifert.test.cjs
const assert = require('node:assert/strict');
const KM = require('../knotmath.js'), SF = require('../seifert.js'), MK = require('../meshkit.js');

let checks = 0;
const ok = (c, m) => { checks++; assert(c, m); };
function gaussLink(P, Q) {
  let s = 0;
  const seg = C => C.map((p, i) => { const q = C[(i + 1) % C.length]; return [[(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], [q[0] - p[0], q[1] - p[1], q[2] - p[2]]]; });
  for (const [m1, d1] of seg(P)) for (const [m2, d2] of seg(Q)) {
    const r = [m1[0] - m2[0], m1[1] - m2[1], m1[2] - m2[2]], L = Math.hypot(...r);
    s += (r[0] * (d1[1] * d2[2] - d1[2] * d2[1]) + r[1] * (d1[2] * d2[0] - d1[0] * d2[2]) + r[2] * (d1[0] * d2[1] - d1[1] * d2[0])) / (L * L * L);
  }
  return s / (4 * Math.PI);
}
function check(n, word) {
  const S = SF.build(n, word), A = MK.analyze(S.indices);
  const rb = KM.readBraid(n, word), mu = rb.components.length;
  // pieces: levels joined by a band
  const used = new Set(word.map(g => Math.abs(g)));
  let groups = 1; for (let i = 1; i < n; i++) if (!used.has(i)) groups++;
  ok(A.pieces.length === groups, 'pieces for ' + word);
  ok(A.euler === n - word.length, 'chi = n - c for ' + word + ': ' + A.euler);
  ok(A.loops.length === mu, 'boundary loops = components for ' + word);
  ok(A.pieces.every(p => p.orientable && p.nonManifoldEdges === 0), 'orientable, manifold for ' + word);
  ok(A.pieces.length === KM.seifertPieces(n, word), 'surface piece count for ' + word);
  ok(A.pieces.reduce((sum, p) => sum + p.genus, 0) === KM.seifertGenus(n, word), 'total genus formula for ' + word);
  // boundary curves follow the braid: the linking numbers match
  const loops = SF.orientLoops(S, A.loops), comp = SF.loopComponents(S, loops, rb.compOf);
  ok(new Set(comp).size === mu, 'each loop is a different component for ' + word);
  const curve = L => L.map(v => [S.positions[3 * v], S.positions[3 * v + 1], S.positions[3 * v + 2]]);
  for (let i = 0; i < mu; i++) for (let j = i + 1; j < mu; j++) {
    const lk = gaussLink(curve(loops[comp.indexOf(i)]), curve(loops[comp.indexOf(j)]));
    ok(Math.abs(lk - rb.linking[i][j]) < 0.1, 'lk(' + i + ',' + j + ') for ' + word + ': Gauss ' + lk.toFixed(3) + ', braid ' + rb.linking[i][j]);
  }
  return { S, A };
}
// small cases with known answers
check(2, [1, 1]);               // Hopf link: lk +1
check(2, [-1, -1]);             // lk -1
check(2, [1, 1, 1, 1]);         // T(2,4): lk 2
check(3, [1, -2, 1, -2, 1, -2]); // Borromean rings
check(3, []);                   // three disks, unlink
check(4, [1, 3, 1, 3]);          // two Hopf links, split
check(4, [1, 1, 1]);             // a trefoil surface and two isolated disks
ok(KM.seifertGenus(3, []) === 0, 'three disks have total genus zero');
ok(KM.seifertGenus(4, [1, 1, 1]) === 1, 'a split trefoil and two unknots have total genus one');
const tre = check(2, [1, 1, 1]);
ok(tre.A.pieces[0].genus === 1, 'trefoil Seifert surface has genus 1');
ok(check(2, [1, 1, 1, 1, 1]).A.pieces[0].genus === 2, 'cinquefoil: genus 2');
ok(check(3, [1, -2, 1, -2]).A.pieces[0].genus === 1, 'figure-eight: genus 1');
// random braids
let seed = 99;
const rnd = k => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % k; };
for (let t = 0; t < 40; t++) {
  const n = 2 + rnd(3), w = Array.from({ length: 1 + rnd(9) }, () => (1 + rnd(n - 1)) * (rnd(2) ? 1 : -1));
  check(n, w);
}
// homogeneous braids: Seifert's algorithm gives least genus (verify.py checks against knot Floer homology)
ok(KM.homogeneous([1, 1, -2, 1, -2]) && !KM.homogeneous([1, -1, 2]), 'homogeneous test');

// meshkit on simple shapes: a disk, an annulus, a Möbius band, a torus grid
function grid(nu, nv, glue) {
  const id = (i, j) => glue(i, j, nu, nv), idx = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1); idx.push(a, b, c, a, c, d); }
  return idx;
}
const plain = (i, j, nu, nv) => i * (nv + 1) + j;
const annulus = (i, j, nu, nv) => (i % nu) * (nv + 1) + j;
const mobius = (i, j, nu, nv) => i === nu ? nv - j : i * (nv + 1) + j;
const torus = (i, j, nu, nv) => (i % nu) * nv + (j % nv);
const klein = (i, j, nu, nv) => i === nu ? ((nv - j) % nv) : i * nv + (j % nv);
const desc = idx => { const A = MK.analyze(idx); return A.pieces.map(p => [p.euler, p.boundaries, p.orientable]); };
assert.deepEqual(desc(grid(6, 4, plain)), [[1, 1, true]], 'disk');
assert.deepEqual(desc(grid(8, 3, annulus)), [[0, 2, true]], 'annulus');
assert.deepEqual(desc(grid(8, 3, mobius)), [[0, 1, false]], 'Möbius band');
assert.deepEqual(desc(grid(8, 4, torus)), [[0, 0, true]], 'torus');
assert.deepEqual(desc(grid(8, 4, klein)), [[0, 0, false]], 'Klein bottle');
checks += 5;
// thickening: a closed solid (every edge on exactly two triangles), for the Möbius band too
const pts = (nu, nv, glue, f) => { const P = []; for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const v = glue(i, j, nu, nv); const [x, y, z] = f(i / nu, j / nv); P[3 * v] = x; P[3 * v + 1] = y; P[3 * v + 2] = z; } return P; };
const mob = (u, v) => { const th = 2 * Math.PI * u, w = (v - 0.5) * 0.6, a = th / 2; return [(1 + w * Math.cos(a)) * Math.cos(th), w * Math.sin(a), (1 + w * Math.cos(a)) * Math.sin(th)]; };
for (const [name, idx, P] of [['Möbius band', grid(40, 4, mobius), pts(40, 4, mobius, mob)], ['trefoil Seifert surface', tre.S.indices, tre.S.positions]]) {
  const T = MK.thicken(P, idx, 0.02), E = MK.edgeFaces(T.indices);
  ok([...E.values()].every(l => l.length === 2), name + ': thickened solid is closed');
  ok(MK.orient(T.indices).conflicts.length === 0, name + ': solid is consistently oriented');
  const stl = MK.toSTL(T.positions, T.indices, 25);
  ok(stl.byteLength === 84 + 50 * T.indices.length / 3 && new DataView(stl).getUint32(80, true) === T.indices.length / 3, name + ': STL size');
}

// The immersed Klein bottle must not silently become a nonmanifold STL when its
// distinct sheets meet in space. This reproduced 192 bad edges before the guard.
const SL = require('../surfaces.js'), bottle = SL.build('klein', []);
assert.throws(() => MK.thicken(Array.from(Float32Array.from(bottle.positions)), bottle.indices, 0.6 / 22), /intersecting or nonmanifold/);

console.log('PASS: ' + checks + ' checks — Seifert surfaces of closed braids: pieces, χ = n − c, boundary loops = components, orientable, genus, boundary linking numbers by Gauss integral; meshkit disks/annuli/Möbius/torus/Klein topology and closed thickened solids for STL.');
