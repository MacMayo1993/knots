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
      const sub = keepStrands(n, word, c);
      return { braidStrands: c, pieces, laps, turns, knot: torusKnot(laps, turns), framing, oneSided, writhe: rb.writhe[idx], alexander: alexander(sub.n, sub.word) };
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


  // ---------- general braids ----------
  // Parse a braid word. Accepts integers (1 -2 3), s1 / σ1 / sigma1 with ^-1, ^3,
  // ⁻¹ or ' for inverse, uppercase S for an inverse generator, and (…)^k groups.
  const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function parseBraid(text) {
    const src = String(text).replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => '^' + m.replace('⁻', '-').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, d => SUPS.indexOf(d)))
      .replace(/sigma/gi, 's').replace(/σ/g, 's').replace(/[−–]/g, '-').replace(/\{|\[/g, '(').replace(/\}|\]/g, ')');
    let i = 0;
    const fail = msg => { throw new Error(msg + (i < src.length ? ' near "' + src.slice(i, i + 8) + '"' : '')); };
    const skip = () => { while (i < src.length && /[\s,.·*]/.test(src[i])) i++; };
    function exponent() {
      skip();
      if (src[i] === "'") { i++; return -1; }
      if (src[i] !== '^') return 1;
      i++; skip();
      const m = /^\(?\s*(-?\d+)\s*\)?/.exec(src.slice(i));
      if (!m) fail('Expected a number after ^');
      i += m[0].length;
      return Number(m[1]);
    }
    function seq(depth) {
      const out = [];
      for (;;) {
        skip();
        if (i >= src.length) { if (depth) fail('Missing )'); return out; }
        const ch = src[i];
        if (ch === ')') { if (!depth) fail('Unmatched )'); i++; return out; }
        let part;
        if (ch === '(') { i++; part = seq(depth + 1); }
        else {
          const m = /^([sS]?)\s*(-?)\s*(\d+)/.exec(src.slice(i));
          if (!m) fail('Unexpected "' + ch + '"');
          i += m[0].length;
          const g = Number(m[3]);
          if (g < 1) fail('Generators start at 1');
          part = [(m[1] === 'S' ? -1 : 1) * (m[2] ? -1 : 1) * g];
        }
        const e = exponent();
        const base = e >= 0 ? part : part.slice().reverse().map(g => -g);
        for (let k = 0; k < Math.abs(e); k++) out.push(...base);
        if (out.length > 5000) fail('Word is too long');
      }
    }
    return seq(0);
  }
  // Freely reduce s s^-1 pairs (does not change the braid).
  function freeReduce(word) {
    const out = [];
    for (const g of word) { if (out.length && out[out.length - 1] === -g) out.pop(); else out.push(g); }
    return out;
  }
  // The sub-braid on the strands that start at the given positions.
  function keepStrands(n, word, keep) {
    const K = new Set(keep), at = Array.from({ length: n }, (_, i) => i), out = [];
    for (const g of word) {
      const i = Math.abs(g) - 1, a = at[i], b = at[i + 1];
      if (K.has(a) && K.has(b)) { let r = 0; for (let p = 0; p < i; p++) if (K.has(at[p])) r++; out.push(Math.sign(g) * (r + 1)); }
      at[i] = b; at[i + 1] = a;
    }
    return { n: K.size, word: out };
  }

  // ---------- Laurent polynomials in t with BigInt coefficients ----------
  // { o: lowest exponent, c: [coefficients] }
  const P = {
    norm(p) {
      let a = 0, b = p.c.length;
      while (a < b && p.c[a] === 0n) a++;
      while (b > a && p.c[b - 1] === 0n) b--;
      return a === b ? { o: 0, c: [] } : { o: p.o + a, c: p.c.slice(a, b) };
    },
    k(v, e = 0) { return P.norm({ o: e, c: [BigInt(v)] }); },
    zero() { return { o: 0, c: [] }; },
    isZero(p) { return p.c.length === 0; },
    add(p, q, sign = 1n) {
      if (!p.c.length) return sign === 1n ? q : P.norm({ o: q.o, c: q.c.map(x => -x) });
      if (!q.c.length) return p;
      const o = Math.min(p.o, q.o), hi = Math.max(p.o + p.c.length, q.o + q.c.length), c = new Array(hi - o).fill(0n);
      p.c.forEach((x, i) => { c[p.o + i - o] += x; });
      q.c.forEach((x, i) => { c[q.o + i - o] += sign * x; });
      return P.norm({ o, c });
    },
    sub(p, q) { return P.add(p, q, -1n); },
    mul(p, q) {
      if (!p.c.length || !q.c.length) return P.zero();
      const c = new Array(p.c.length + q.c.length - 1).fill(0n);
      for (let i = 0; i < p.c.length; i++) if (p.c[i]) for (let j = 0; j < q.c.length; j++) c[i + j] += p.c[i] * q.c[j];
      return P.norm({ o: p.o + q.o, c });
    },
    // exact division (throws if not exact)
    div(p, q) {
      if (!q.c.length) throw new Error('division by zero');
      if (!p.c.length) return P.zero();
      const r = p.c.slice(), qn = q.c.length, lead = q.c[qn - 1], out = new Array(Math.max(0, r.length - qn + 1)).fill(0n);
      for (let i = r.length - qn; i >= 0; i--) {
        const x = r[i + qn - 1];
        if (x % lead !== 0n) throw new Error('inexact division');
        const f = x / lead; out[i] = f;
        if (f) for (let j = 0; j < qn; j++) r[i + j] -= f * q.c[j];
      }
      if (r.some(x => x !== 0n)) throw new Error('inexact division');
      return P.norm({ o: p.o - q.o, c: out });
    },
    // Alexander normalization, as in knot tables: lowest term t^0, positive leading coefficient
    alex(p) {
      p = P.norm(p);
      if (!p.c.length) return [];
      let c = p.c.slice();
      if (c[c.length - 1] < 0n) c = c.map(x => -x);
      return c.map(Number);
    }
  };
  // Determinant of a square matrix of Laurent polynomials (fraction-free Bareiss).
  function det(M) {
    const n = M.length;
    if (!n) return P.k(1);
    const A = M.map(r => r.slice());
    let sign = 1n, prev = P.k(1);
    for (let k = 0; k < n - 1; k++) {
      if (P.isZero(A[k][k])) {
        let r = k + 1; while (r < n && P.isZero(A[r][k])) r++;
        if (r === n) return P.zero();
        [A[k], A[r]] = [A[r], A[k]]; sign = -sign;
      }
      for (let i = k + 1; i < n; i++) for (let j = k + 1; j < n; j++)
        A[i][j] = P.div(P.sub(P.mul(A[i][j], A[k][k]), P.mul(A[i][k], A[k][j])), prev);
      prev = A[k][k];
    }
    const d = A[n - 1][n - 1];
    return sign === 1n ? d : P.sub(P.zero(), d);
  }
  // Reduced Burau representation applied as column operations: M <- M * rho(g).
  function buraApply(M, n, g) {
    const i = Math.abs(g), d = n - 1, t = P.k(1, 1), ti = P.k(1, -1), one = P.k(1);
    // rho(s_i) is the identity except in columns i-2, i-1, i (0-based i-1 is the middle)
    const c = i - 1;   // 0-based index of the -t entry
    for (const row of M) {
      const L = c - 1 >= 0 ? row[c - 1] : null, Mi = row[c], Rr = c + 1 < d ? row[c + 1] : null;
      if (g > 0) {
        // columns: new[c-1] = old[c-1]; new[c] = t*old[c-1] - t*old[c] + old[c+1]; new[c+1] = old[c+1]
        let v = P.mul(P.k(-1, 1), Mi);
        if (L) v = P.add(v, P.mul(t, L));
        if (Rr) v = P.add(v, Rr);
        row[c] = v;
      } else {
        // inverse: new[c] = old[c-1] - t^-1 old[c] + t^-1 old[c+1]
        let v = P.mul(P.k(-1, -1), Mi);
        if (L) v = P.add(v, L);
        if (Rr) v = P.add(v, P.mul(ti, Rr));
        row[c] = v;
      }
    }
    void one;
  }
  // One-variable Alexander polynomial of the closure (coefficients, lowest degree first).
  // For a link with several components this is the Conway-normalized one-variable
  // polynomial up to sign and powers of t; it is 0 for split links.
  function alexander(n, word) {
    if (n < 2) return [1];
    const d = n - 1;
    const M = Array.from({ length: d }, (_, r) => Array.from({ length: d }, (_, c) => P.k(r === c ? 1 : 0)));
    for (const g of word) buraApply(M, n, g);
    const IM = M.map((r, i) => r.map((x, j) => P.sub(P.k(i === j ? 1 : 0), x)));
    const D = det(IM);
    const num = P.norm({ o: 0, c: Array.from({ length: n }, () => 1n) });   // 1 + t + ... + t^(n-1)
    return P.alex(P.div(D, num));
  }
  function polyText(c) {
    if (!c.length) return '0';
    const terms = [];
    c.forEach((x, e) => {
      if (!x) return;
      const a = Math.abs(x), co = a === 1 && e ? '' : String(a);
      const v = e === 0 ? '' : e === 1 ? 't' : 't' + SUP(e);
      terms.push({ neg: x < 0, s: co + v });
    });
    terms.reverse();
    return terms.map((tm, k) => (k ? (tm.neg ? ' − ' : ' + ') : (tm.neg ? '−' : '')) + tm.s).join('');
  }

  // Blackboard ribbon: each strand doubled by a parallel edge on its +a side.
  // Generator i becomes the pair of strands i crossing the pair i+1 flat.
  function blackboardRibbon(n, word) {
    const out = [];
    for (const g of word) {
      const i = Math.abs(g), s = Math.sign(g);
      out.push(s * 2 * i, s * (2 * i - 1), s * (2 * i + 1), s * 2 * i);
    }
    return { strands: 2 * n, word: out };
  }

  // Everything about the closure of an arbitrary braid.
  function describeBraid(n, word) {
    const rb = readBraid(n, word);
    const rib = blackboardRibbon(n, word);
    const rr = readBraid(rib.strands, rib.word);
    const components = rb.components.map((c, idx) => {
      const core = rr.compOf[2 * c[0]], edge = rr.compOf[2 * c[0] + 1];
      const sub = keepStrands(n, word, c);
      return {
        braidStrands: c, laps: c.length,
        framing: rr.linking[core][edge], writhe: rb.writhe[idx],
        alexander: alexander(sub.n, sub.word), subBraid: sub
      };
    });
    return {
      ok: true, kind: 'braid', strands: n, word,
      braid: { strands: n, word },
      ribbonBraid: { strands: rib.strands, word: rib.word, cores: Array.from({ length: n }, (_, i) => 2 * i), edges: Array.from({ length: n }, (_, i) => 2 * i + 1), framing: 'blackboard' },
      components, linking: rb.linking,
      alexander: alexander(n, word)
    };
  }

  // ---------- geometry of a closed braid ----------
  // Strand positions along a line in the cross-section (a radial, b up). Each
  // generator gets an equal slice of the loop; inside it, strands i and i+1 turn
  // half a turn about their midpoint, positive generators the same way as a
  // positive twist of the model (so the strand moving inward passes above).
  // Returns, for each starting position, a function theta in [0, 2pi] -> [a, b].
  const laneWidth = n => Math.min(0.4, 1.6 / Math.max(n, 1));
  function braidLayout(n, word, opts = {}) {
    const lw = opts.laneWidth || laneWidth(n);
    const lift = opts.lift || 2.2;
    const lane = j => (j - (n - 1) / 2) * lw;
    const m = Math.max(word.length, 1), slot = (2 * Math.PI) / m;
    // where each strand is at the start of each slot
    const posAt = [Array.from({ length: n }, (_, i) => i)];   // posAt[k][strand] = position
    const at = Array.from({ length: n }, (_, i) => i);
    word.forEach(g => { const i = Math.abs(g) - 1; [at[i], at[i + 1]] = [at[i + 1], at[i]]; const p = new Array(n); at.forEach((s, q) => { p[s] = q; }); posAt.push(p); });
    const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
    return Array.from({ length: n }, (_, strand) => theta => {
      let k = Math.floor(theta / slot);
      if (k >= m) k = m - 1; if (k < 0) k = 0;
      const p0 = posAt[k][strand];
      if (!word.length) return [lane(p0), 0];
      const g = word[k], i = Math.abs(g) - 1;
      if (p0 !== i && p0 !== i + 1) return [lane(p0), 0];
      const u = ease((theta / slot - k - 0.1) / 0.8);
      const mid = (lane(i) + lane(i + 1)) / 2, r = lw / 2;
      const start = p0 === i + 1 ? 0 : Math.PI;            // angle about the midpoint
      const al = start + Math.sign(g) * Math.PI * u;
      return [mid + r * Math.cos(al), lift * r * Math.sin(al)];
    });
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

  const api = { laneWidth, gcd, wordFormula, parseBraid, freeReduce, keepStrands, alexander, polyText, blackboardRibbon, describeBraid, braidLayout, braidWord, permutation, cycles, readBraid, stepsFor, torusKnot, describe, wordText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KnotMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
