// Checks the cut explorer's general cutting engine (surfaces.js).
//
// The engine cuts a torus or Klein bottle grid along any closed grid path and
// describes the pieces by walking the triangles. These checks compare it with
// known answers: the four preset torus cuts of explore.js, (a, b) curves on the
// torus (gcd(a, b) parallel annuli), the classic Klein bottle cuts (two Möbius
// bands, or one), the square made by cutting a meridian and a longitude, and
// small loops drawn by hand anywhere on either map (always a disk and the rest).
//
// Run: node test/surfaces.test.cjs
const assert = require('node:assert/strict');
const SL = require('../surfaces.js'), EX = require('../explore.js'), MK = require('../meshkit.js');
let checks = 0;
const ok = (c, m) => { checks++; assert(c, m); };
const names = r => r.info.pieces.map(p => p.name).sort().join(' + ');

// 1. the explore.js presets
for (const kind of ['closed', 'meridian', 'longitude', 'patch']) {
  const r = SL.build('torus', SL.presetPaths('torus', kind)), c = EX.CUTS[kind];
  ok(r.info.count === c.components && r.info.boundaries === c.boundaries && r.info.euler === c.euler, 'preset ' + kind);
  ok(r.info.orientable, kind + ' pieces are two-sided');
}
assert.equal(names(SL.build('torus', SL.presetPaths('torus', 'patch'))), 'disk + torus with one hole');

// 2. (a, b) curves: gcd(a, b) parallel copies of a simple curve, each cut leaves an annulus
for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
  if (!a && !b) continue;
  const g = SL.gcd(a, b), r = SL.build('torus', SL.presetPaths('torus', 'slope', { a, b }));
  ok(r.info.count === g && r.info.boundaries === 2 * g && r.info.euler === 0, '(' + a + ',' + b + ') gives ' + g + ' annuli, got ' + names(r));
  ok(r.info.pieces.every(p => p.name === 'annulus'), '(' + a + ',' + b + ') pieces are annuli');
}

// 3. the Klein bottle
assert.equal(names(SL.build('klein', [])), 'Klein bottle'); checks++;
ok(!SL.build('klein', []).info.orientable, 'the Klein bottle is one-sided');
assert.equal(names(SL.build('klein', SL.presetPaths('klein', 'meridian'))), 'annulus'); checks++;
assert.equal(names(SL.build('klein', SL.presetPaths('klein', 'between'))), 'Möbius band + Möbius band'); checks++;
assert.equal(names(SL.build('klein', SL.presetPaths('klein', 'core'))), 'Möbius band'); checks++;
// the 3D figure-eight bottle obeys the gluing: (1, v) and (0, 1 - v) are the same point
for (let v = 0; v <= 1; v += 0.05) {
  const p = SL.SURFACES.klein.point(1, v), q = SL.SURFACES.klein.point(0, 1 - v);
  ok(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-9, 'Klein seam at v = ' + v.toFixed(2));
  const a = SL.SURFACES.torus.point(1, v), b = SL.SURFACES.torus.point(0, v);
  ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9, 'torus seam');
}

// 4. meridian + longitude together: one square, a disk
const both = [...SL.presetPaths('torus', 'meridian'), ...SL.presetPaths('torus', 'longitude')];
assert.equal(names(SL.build('torus', both)), 'disk'); checks++;
const kboth = [...SL.presetPaths('klein', 'meridian'), ...SL.presetPaths('klein', 'core')];
assert.equal(names(SL.build('klein', kboth)), 'disk'); checks++;

// 5. drawn loops: classes of loops that go around, and small loops anywhere
const L1 = SL.loopPath('torus', [[0.1, 0.5], [0.4, 0.5], [0.7, 0.5]]);
ok(L1.a === 1 && L1.b === 0, 'a loop drawn across the map goes around the hole once');
assert.equal(names(SL.build('torus', [L1.path])), 'annulus'); checks++;
const L2 = SL.loopPath('torus', [[0.1, 0.1], [0.4, 0.4], [0.7, 0.7]]);
ok(L2.a === 1 && L2.b === 1, 'a diagonal loop is a (1, 1) curve: ' + L2.a + ',' + L2.b);
assert.equal(names(SL.build('torus', [L2.path])), 'annulus'); checks++;
let seed = 3;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
for (let t = 0; t < 30; t++) for (const surf of ['torus', 'klein']) {
  // a small convex loop, possibly straddling the map's edges
  const cu = rnd(), cv = rnd(), rad = 0.06 + 0.08 * rnd(), k = 4 + Math.floor(rnd() * 5);
  // fold each point into the map the way the surface does: across the Klein bottle's
  // left/right edge, v becomes 1 - v
  const fold = (u, v) => { const k = Math.floor(u); if (surf === 'klein' && k % 2) v = 1 - v; return [u - k, ((v % 1) + 1) % 1]; };
  const pts = Array.from({ length: k }, (_, i) => { const ang = 2 * Math.PI * i / k; return fold(cu + rad * Math.cos(ang), cv + 0.8 * rad * Math.sin(ang)); });
  const L = SL.loopPath(surf, pts);
  ok(L.a === 0 && L.b === 0, 'small loop is contractible');
  const r = SL.build(surf, [L.path]);
  const want = surf === 'torus' ? 'disk + torus with one hole' : 'Klein bottle with one hole + disk';
  assert.equal(names(r), want, surf + ' small loop at ' + cu.toFixed(2) + ',' + cv.toFixed(2)); checks++;
  // every map segment lies inside the map
  ok(SL.mapSegments(surf, [L.path]).every(s => s.every(x => x >= -1e-9 && x <= 1 + 1e-9)), 'map segments in range');
  // the piece at the loop's center is the disk
  const disk = r.info.pieces.findIndex(p => p.name === 'disk');
  ok(r.componentAt(cu, cv) === disk, 'center of the loop is on the disk');
}
// 6. the mesh is a real cut: boundary edges sit exactly over the cut edges
const r = SL.build('torus', SL.presetPaths('torus', 'slope', { a: 1, b: 2 }));
ok(r.boundary.length / 2 === 2 * r.cutCount, 'each cut edge becomes two boundary edges');
ok(MK.analyze(r.indices).pieces.every(p => p.nonManifoldEdges === 0), 'manifold after cutting');
console.log('PASS: ' + checks + ' checks — explore.js presets reproduced, (a, b) curves give gcd(a, b) annuli, Klein bottle cuts (annulus, two Möbius bands, one Möbius band, a square), seams of both 3D surfaces, drawn loop classes, and small drawn loops anywhere on either map.');
