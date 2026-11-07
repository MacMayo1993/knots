// Exact combinatorics for the twisted-torus model.
//
// Every construction in the model is a set of points on a cross-section that is
// carried once around the core circle while the cross-section turns. Read as a
// braid around the core, that is:
//
//   ring  n points evenly spaced around a closed cross-section, turned by s/n of a
//         turn:  delta^s,  delta = s1 s2 ... s(n-1)
//   line  n points along a flat strip, turned by h half turns:  Delta^h,
//         Delta = s1 (s2 s1) (s3 s2 s1) ...  (the half twist)
//
// Convention: generator i (written +i) is a positive crossing between strands i
// and i+1, as in SnapPy / Spherogram's braid_closure. A positive twist in the
// model (x, y, z right-handed, the cross-section turning from +radial toward +y as
// the loop angle grows) gives positive generators; test/geometry.test.mjs checks
// this against the model's own curves with the Gauss linking integral.
//
// Everything below (components, laps, linking matrix, framing) is read off the
// braid word itself, so it is an independent check on the model's readouts.
//
// Works as a classic <script> (window.KnotMath) and as a CommonJS module.
(function (root) {
  'use strict';

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
  const mod = (x, p) => ((x % p) + p) % p;

  // ---------- braid words ----------
  function power(word, e) {
    const base = e >= 0 ? word : word.slice().reverse().map(g => -g);
    const out = [];
    for (let i = 0; i < Math.abs(e); i++) out.push(...base);
    return out;
  }
  const delta = n => Array.from({ length: n - 1 }, (_, i) => i + 1);
  function halfTwist(n) {
    const w = [];
    for (let j = 1; j < n; j++) for (let i = j; i >= 1; i--) w.push(i);
    return w;
  }
  // kind 'ring': turn = s / n of a full turn. kind 'line': turn = h / 2.
  function braidWord(kind, n, steps) {
    if (n < 2) return [];
    return kind === 'ring' ? power(delta(n), steps) : power(halfTwist(n), steps);
  }

  // ---------- reading a braid ----------
  // perm[i] = position where the strand starting at position i ends.
  function permutation(n, word) {
    const at = Array.from({ length: n }, (_, i) => i);   // at[pos] = strand
    for (const g of word) { const i = Math.abs(g) - 1; [at[i], at[i + 1]] = [at[i + 1], at[i]]; }
    const perm = new Array(n);
    at.forEach((strand, pos) => { perm[strand] = pos; });
    return perm;
  }
  function cycles(perm) {
    const seen = new Array(perm.length).fill(false), out = [];
    for (let i = 0; i < perm.length; i++) {
      if (seen[i]) continue;
      const c = []; let j = i;
      do { c.push(j); seen[j] = true; j = perm[j]; } while (j !== i);
      out.push(c);
    }
    return out;
  }
  // Components of the closure, the linking matrix, and the writhe of each component.
  function readBraid(n, word) {
    const comps = cycles(permutation(n, word));
    const compOf = new Array(n);
    comps.forEach((c, k) => c.forEach(p => { compOf[p] = k; }));
    const N = comps.length;
    const twice = Array.from({ length: N }, () => new Array(N).fill(0));
    const writhe = new Array(N).fill(0);
    const at = Array.from({ length: n }, (_, i) => i);
    for (const g of word) {
      const i = Math.abs(g) - 1, sgn = Math.sign(g);
      const A = compOf[at[i]], B = compOf[at[i + 1]];
      if (A === B) writhe[A] += sgn; else { twice[A][B] += sgn; twice[B][A] += sgn; }
      [at[i], at[i + 1]] = [at[i + 1], at[i]];
    }
    return { components: comps, compOf, linking: twice.map(r => r.map(x => x / 2)), writhe };
  }

  // ---------- the model's constructions ----------
  // spec: { kind: 'ring' | 'line', pieces: n, turn: twist in full turns (number) }
  // Returns null if the paint lines don't meet at the cut (no braid of the stripes).
  function stepsFor(spec) {
    const x = spec.kind === 'ring' ? spec.turn * spec.pieces : spec.turn * 2;
    const r = Math.round(x);
    return Math.abs(x - r) < 1e-6 ? r : null;
  }
  function torusKnot(q, p) {
    q = Math.abs(q); p = Math.abs(p);
    if (q < 2 || p < 2) return { name: 'unknot', genus: 0, crossingNumber: 0 };
    const a = Math.min(q, p), b = Math.max(q, p);
    const named = { '2,3': 'trefoil', '2,5': 'cinquefoil', '2,7': '7_1', '3,4': '8_19', '3,5': '10_124' };
    return { name: named[a + ',' + b] || 'T(' + a + ',' + b + ')', torus: [a, b], genus: (a - 1) * (b - 1) / 2, crossingNumber: Math.min(q * (p - 1), p * (q - 1)) };
  }

  function describe(spec) {
    const { kind } = spec, n = spec.pieces, steps = stepsFor(spec);
    if (steps === null) return { ok: false, reason: 'The color lines do not meet at the cut, so the stripes do not close up.' };
    const word = braidWord(kind, n, steps);
    const rb = readBraid(n, word);
    // Map braid positions to painted pieces. A ring turn moves piece p to piece p + steps.
    const perm = permutation(n, word);
    const pieceAt = new Array(n);
    if (kind === 'ring' && n > 1) {
      const fwd = perm.every((q, i) => q === mod(i + steps, n));
      for (let i = 0; i < n; i++) pieceAt[i] = fwd ? i : mod(-i, n);
    } else for (let i = 0; i < n; i++) pieceAt[i] = i;

    // Ribbon braid: each stripe's core plus the edge on one side of it, so the
    // stripe's framing is the linking number of its core with that edge.
    // ring: 2n points, cores at even positions, edges between them.
    // line: 2n+1 points, edges at even positions, cores at odd positions.
    const rn = kind === 'ring' ? 2 * n : 2 * n + 1;
    const rsteps = kind === 'ring' ? 2 * steps : steps;
    const ribbonWord = braidWord(kind, rn, rsteps);
    const ribbon = readBraid(rn, ribbonWord);
    const rPerm = permutation(rn, ribbonWord);
    const rFwd = kind === 'ring' && rPerm.every((q, i) => q === mod(i + rsteps, rn));
    const rPos = x => (kind === 'ring' && !rFwd) ? mod(-x, rn) : x;
    const corePos = i => rPos(kind === 'ring' ? 2 * i : 2 * i + 1);
    const edgePos = i => rPos(kind === 'ring' ? 2 * i + 1 : 2 * i + 2);

    const components = rb.components.map((c, idx) => {
      const laps = c.length;
      const pieces = c.map(p => pieceAt[p]).sort((a, b) => a - b);
      const lane = pieces[0];
      const centre = kind === 'line' && n % 2 === 1 && lane === (n - 1) / 2;
      // turns around the core per trip home (signed)
      const turns = centre ? 0 : (kind === 'ring' ? steps * laps / n : steps * laps / 2);
      const cc = ribbon.compOf[corePos(lane)], ec = ribbon.compOf[edgePos(lane)];
      const oneSided = ribbon.components[ec].length !== laps;
      const framing = oneSided ? null : ribbon.linking[cc][ec];
      return { braidStrands: c, pieces, laps, turns, knot: torusKnot(laps, turns), framing, oneSided, writhe: rb.writhe[idx] };
    });
    return {
      ok: true,
      kind, pieces: n, steps,
      braid: { strands: n, word },
      ribbonBraid: { strands: rn, word: ribbonWord, cores: Array.from({ length: n }, (_, i) => corePos(i)), edges: Array.from({ length: n }, (_, i) => edgePos(i)) },
      components,
      linking: rb.linking
    };
  }

  const SUP = e => String(e).replace('-', '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
  // Compact text for a braid word: s1 s2 s1^-1 ... with runs collapsed.
  function wordText(word) {
    if (!word.length) return '(empty: the identity braid)';
    const out = [];
    for (let i = 0; i < word.length;) {
      let j = i; while (j < word.length && word[j] === word[i]) j++;
      const e = (j - i) * Math.sign(word[i]);
      out.push('σ' + Math.abs(word[i]) + (e === 1 ? '' : SUP(e)));
      i = j;
    }
    return out.join(' ');
  }

  // The word as a power of delta or Delta, e.g. (σ1 σ2)⁴.
  function wordFormula(kind, n, steps) {
    if (n < 2 || steps === 0) return 'identity';
    const base = kind === 'ring' ? delta(n) : halfTwist(n);
    const inner = base.map(g => 'σ' + g).join(' ');
    const e = steps === 1 ? '' : SUP(steps);
    return base.length === 1 || !e ? inner + e : '(' + inner + ')' + e;
  }

  const api = { gcd, wordFormula, braidWord, permutation, cycles, readBraid, stepsFor, torusKnot, describe, wordText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KnotMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
