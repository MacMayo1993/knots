// The twist table: for every shape in the app, the twists that close up and, for each,
// the rule the Data page states (a turn p/q in lowest terms on a tube with n painted
// pieces gives n/q strips of q laps, each winding p times: the (q, p) torus knot, any
// two linked p·q times) checked against describe(), which reads the strips, laps and
// linking numbers off the braid itself. Flat strips follow the half-turn lane swap.
//
// Run: node test/twist-table.test.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
globalThis.KnotTableEntries = require('../knot-table.js');
const KM = require('../knotmath.js');
let checks = 0;
const ok = (c, m) => { checks++; assert(c, m); };
const near = x => Math.abs(x - Math.round(x)) < 1e-9;

// the app's own shape list: name, turning symmetry, paint pieces, flat strip or tube
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const shapes = [...html.matchAll(/^\s*(\w+):\s*\{ label: '([^']+)', sym: (\d+), colors: \[([\d, ]+)\], kind: '(\w+)'(, open: true)?/gm)]
  .map(m => ({ name: m[1], label: m[2], sym: Number(m[3]), pieces: m[4].split(',').length, open: !!m[6] }));
ok(shapes.length === 20, 'all 20 cross-sections found: ' + shapes.map(s => s.name).join(' '));

for (const sh of shapes) {
  const kind = sh.open ? 'line' : 'ring', n = sh.pieces;
  const T = KM.twistTable({ kind, pieces: n, sym: sh.sym });
  const per = sh.open ? 2 : KM.gcd(sh.sym || n, n);
  ok(T.per === per, sh.name + ': closes every 1/' + per + ' turn');
  ok(T.rows.length === per * Math.ceil(6 / per) && T.rows.length >= 6, sh.name + ': whole turns, at least six rows');
  ok(T.rows.every((r, i) => near(r.turn * per) && r.m === i + 1), sh.name + ': one row per closing twist, in order');
  // nothing in between closes: the paint must line up (describe) and so must the shape
  const max = T.rows[T.rows.length - 1].turn;
  for (let j = 1; j <= 24 * max; j++) {
    const x = j / 24, fits = sh.open ? near(2 * x) : (!sh.sym || near(x * sh.sym)) && KM.describe({ kind, pieces: n, turn: x }).ok;
    ok(fits === near(x * per), sh.name + ': ' + j + '/24 turn closes only when it is in the table');
  }
  for (const r of T.rows) {
    const where = sh.name + ' at ' + r.m + '/' + per + ' turn';
    if (!sh.open) {
      ok(KM.gcd(r.p, r.q) === 1 && r.p / r.q === r.turn, where + ': p/q is the turn in lowest terms');
      ok(r.strips === n / r.q, where + ': n / q strips');
      ok(r.laps.every(l => l === r.q), where + ': every strip takes q laps');
      ok(r.turns.every(t => t === r.p), where + ': and winds p times');
      ok(r.knots.every(k => k === KM.torusKnot(r.q, r.p).name), where + ': each the (q, p) torus knot');
      ok(r.strips === 1 ? r.linking.length === 0 : r.linking.length === 1 && r.linking[0] === r.p * r.q, where + ': any two strips link p·q times');
      ok(r.oneSided.every(o => !o), where + ': a tube has no Möbius strips');
    } else {
      const odd = r.m % 2 === 1;
      if (odd) {
        ok(r.strips === Math.ceil(n / 2), where + ': odd half turns pair the lanes');
        ok(r.laps.filter(l => l === 2).length === Math.floor(n / 2), where + ': each pair is one strip around twice');
        ok(r.oneSided.filter(Boolean).length === n % 2, where + ': the middle lane of an odd strip is a Möbius band');
        ok(r.laps.every((l, i) => l === 2 ? r.turns[i] === r.m : l === 1 && r.turns[i] === 0), where + ': a pair winds once per half turn');
      } else {
        ok(r.strips === n && r.laps.every(l => l === 1) && r.oneSided.every(o => !o), where + ': even half turns keep every lane');
      }
    }
  }
}
// the examples worked out on the Data page and in the README
const row = (pieces, sym, m) => KM.twistTable({ pieces, sym }).rows.find(r => r.m === m);
const tre = row(6, 6, 4);
ok(tre.strips === 2 && tre.knots.every(k => /trefoil/.test(k)) && tre.linking[0] === 6, 'hexagon ⅔: two trefoils linked 6 times');
ok(row(5, 5, 2).knots[0] === 'right-handed cinquefoil' && row(5, 5, 3).knots[0] === 'T(3,5)', 'pentagon ⅖ and ⅗: cinquefoil, T(3,5)');
ok(row(4, 4, 3).knots[0] === 'T(3,4)' && row(4, 4, 2).linking[0] === 2, 'square ¾: T(3,4); ½: two unknots linked twice');
ok(row(2, 0, 3).knots[0] === 'right-handed trefoil' && row(2, 0, 2).linking[0] === 1, 'round 1½: trefoil; one full turn: Hopf link');
const egg = KM.twistTable({ pieces: 2, sym: 1 });
ok(egg.per === 1 && egg.rows[0].turn === 1, 'no turning symmetry: whole turns only');

console.log('PASS: ' + checks + ' checks — twist table for all 20 cross-sections: closing twists exactly, and strips n/q, q laps, p windings, (q, p) torus knots, linking p·q against describe(); flat strips by the half-turn lane swap.');
