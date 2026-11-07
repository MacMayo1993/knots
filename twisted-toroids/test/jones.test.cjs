// Checks the Jones polynomial and the knot-table names.
//
// 1. Published values for small knots and links (the braid conventions make a
//    positive braid close to a right-handed knot, so sigma1^3 is t + t^3 - t^4).
// 2. Identities on random braids: Markov moves (conjugation and stabilization)
//    leave V unchanged, V(1) = (-2)^(components - 1), |V(-1)| equals the
//    determinant |Alexander(-1)| computed by the separate Burau code, and the
//    mirror braid gives V(1/t).
// 3. Every table entry's stored polynomials are recomputed from its braid word,
//    and each entry (and its mirror) is named correctly.
//
// Run: node test/jones.test.cjs
const assert = require('node:assert/strict');
const KM = require('../knotmath.js');
const TABLE = require('../knot-table.js');

let checks = 0;
const ok = (c, msg) => { checks++; assert(c, msg); };
const poly = (o, c) => ({ o, c });
const same = (p, q, msg) => { checks++; assert.equal(KM.polyKey(p), KM.polyKey(q), msg + ': ' + KM.jonesText(p) + ' vs ' + KM.jonesText(q)); };

// 1. Published values (Jones polynomials in powers of t^(1/2): o is the lowest power of s = t^(1/2)).
same(KM.jones(1, []), poly(0, [1]), 'unknot');
same(KM.jones(2, [1, 1, 1]), poly(2, [1, 0, 0, 0, 1, 0, -1]), 'right-handed trefoil t + t^3 - t^4');
same(KM.jones(2, [-1, -1, -1]), poly(-8, [-1, 0, 1, 0, 0, 0, 1]), 'left-handed trefoil');
same(KM.jones(3, [1, -2, 1, -2]), poly(-4, [1, 0, -1, 0, 1, 0, -1, 0, 1]), 'figure-eight');
same(KM.jones(2, [1, 1, 1, 1, 1]), poly(4, [1, 0, 0, 0, 1, 0, -1, 0, 1, 0, -1]), 'cinquefoil t^2 + t^4 - t^5 + t^6 - t^7');
same(KM.jones(3, [1, 1, 1, 2, -1, 2]), poly(2, [1, 0, -1, 0, 2, 0, -1, 0, 1, 0, -1]), '5_2');
same(KM.jones(2, [1, 1]), poly(1, [-1, 0, 0, 0, -1]), 'positive Hopf link -t^(1/2) - t^(5/2)');
same(KM.jones(2, []), poly(-1, [-1, 0, -1]), 'two-component unlink');
same(KM.jones(3, [1, -2, 1, -2, 1, -2]), poly(-6, [-1, 0, 3, 0, -2, 0, 4, 0, -2, 0, 3, 0, -1]), 'Borromean rings');
same(KM.jones(3, [1, 1, -2, 1, -2]), poly(-3, [-1, 0, 1, 0, -2, 0, 1, 0, -2, 0, 1]), 'Whitehead link');

// 2. Identities on random braids
let seed = 12345;
const rnd = k => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % k; };
const randomWord = (n, len) => Array.from({ length: len }, () => (1 + rnd(n - 1)) * (rnd(2) ? 1 : -1));
const det = (n, w) => Math.abs(KM.alexander(n, w).reduce((s, c, i) => s + c * (i % 2 ? -1 : 1), 0));
for (let trial = 0; trial < 160; trial++) {
  const n = 2 + rnd(4), w = randomWord(n, 1 + rnd(14));
  const V = KM.jones(n, w), mu = KM.cycles(KM.permutation(n, w)).length;
  ok(Math.abs(KM.jonesAt(V, 1) - (-2) ** (mu - 1)) < 1e-9, 'V(1) = (-2)^(mu-1) for ' + w);
  ok(Math.abs(KM.jonesAt(V, -1) - det(n, w)) < 1e-9, '|V(-1)| = |Delta(-1)| for ' + w);
  same(KM.jones(n, KM.mirrorWord(w)), KM.mirrorPoly(V), 'mirror of ' + w);
  // conjugate by a random generator: g w g^-1
  const g = (1 + rnd(n - 1)) * (rnd(2) ? 1 : -1);
  same(KM.jones(n, [g, ...w, -g]), V, 'conjugation of ' + w);
  // cyclic rotation is also a conjugation
  if (w.length > 1) same(KM.jones(n, [...w.slice(1), w[0]]), V, 'rotation of ' + w);
  // stabilization: add a strand and sigma_n^(+-1)
  same(KM.jones(n + 1, [...w, rnd(2) ? n : -n]), V, 'stabilization of ' + w);
  // a braid relation: s_i s_(i+1) s_i = s_(i+1) s_i s_(i+1), inserted with its inverse
  if (n >= 3) {
    const i = 1 + rnd(n - 2);
    same(KM.jones(n, [...w, i, i + 1, i, -(i + 1), -i, -(i + 1)]), V, 'braid relation on ' + w);
  }
}

// 3. The table: stored polynomials, names, and mirrors
const tableName = KM.tableName;
let undetected = [], collisions = 0;
for (const e of TABLE) {
  const V = KM.jones(e.n, e.word, { budget: 1e9 });
  same(V, { o: e.jones[0], c: e.jones[1] }, 'stored Jones of ' + e.name);
  ok(KM.alexander(e.n, e.word).join(',') === e.alexander.join(','), 'stored Alexander of ' + e.name);
  ok(KM.cycles(KM.permutation(e.n, e.word)).length === e.components, 'components of ' + e.name);
  const id = KM.identify(e.n, e.word, { budget: 1e9 }), mine = id.matches.filter(m => m.name === e.name);
  ok(mine.length === 1, e.name + ' names itself: ' + JSON.stringify(id.matches));
  if (id.matches.length > 1) collisions++;
  const mid = KM.identify(e.n, KM.mirrorWord(e.word), { budget: 1e9 }).matches.filter(m => m.name === e.name);
  ok(mid.length === 1, 'the mirror of ' + e.name + ' is named');
  if (e.kind === 'knot') {
    if (e.amphichiral) {
      ok(mine[0].chirality === 'amphichiral' && mid[0].chirality === 'amphichiral', e.name + ' is amphichiral');
      same(V, KM.mirrorPoly(V), 'amphichiral ' + e.name + ' has a symmetric Jones polynomial');
    } else if (KM.polyKey(V) === KM.polyKey(KM.mirrorPoly(V))) {
      undetected.push(e.name);
      ok(mine[0].chirality === 'undetected' && mine[0].label.includes('or its mirror'), e.name + ' says the Jones polynomial cannot tell');
    } else {
      ok(mine[0].chirality === 'as listed' && mid[0].chirality === 'mirror', e.name + ' and its mirror are told apart');
      ok(e.torus ? /handed/.test(mine[0].label) : !mine[0].label.startsWith('mirror') && mid[0].label.startsWith('mirror image of'), e.name + ' labels');
    }
  }
  ok(mine[0].label.includes(tableName(e.name)), e.name + ' label has its table name');
}
// Chiral knots up to 10 crossings that the Jones polynomial cannot tell from their mirrors.
assert.deepEqual(undetected, ['9_42', '10_48', '10_71', '10_91', '10_104', '10_125']);
// Torus knots by handedness: positive braids close to right-handed knots.
assert.match(KM.identify(2, [1, 1, 1]).matches[0].label, /^right-handed trefoil/);
assert.match(KM.identify(2, [-1, -1, -1]).matches[0].label, /^left-handed trefoil/);
assert.match(KM.identify(3, [1, 2, 1, 2, 1, 2, 1, 2]).matches[0].label, /^right-handed T\(3,4\)/);
// Composites
assert.match(KM.identify(3, [1, 1, 1, 2, 2, 2]).matches.map(m => m.label).join('|'), /granny knot/);
assert.match(KM.identify(3, [1, 1, 1, -2, -2, -2]).matches.map(m => m.label).join('|'), /square knot/);
assert.equal(KM.identify(3, [1, 1, 1, -2, -2, -2]).matches.find(m => /square/.test(m.label)).chirality, 'amphichiral');
// Unlinks and the unknot
assert.equal(KM.identify(3, [1, 2]).matches[0].label, 'unknot');
assert.match(KM.identify(3, []).matches[0].label, /^unlink of 3 components/);
// Links: the Hopf link is its own mirror as an unoriented link; the Whitehead link is not.
assert.equal(KM.identify(2, [1, 1]).matches[0].chirality, 'either');
assert.notEqual(KM.identify(3, [1, 1, -2, 1, -2]).matches[0].chirality, 'either');
assert.notEqual(KM.identify(3, [1, 1, -2, 1, -2]).matches[0].chirality, KM.identify(3, [-1, -1, 2, -1, 2]).matches[0].chirality);
// A braid that is too large for the work budget reports it rather than hanging.
assert(KM.identify(10, randomWord(10, 400), { budget: 1e5 }).error);
console.log('PASS: ' + checks + ' checks — published Jones values, Markov moves, V(1), |V(-1)| = determinant, mirrors, '
  + TABLE.length + ' table entries recomputed and named (' + collisions + ' with shared polynomials), chirality where Jones detects it.');
