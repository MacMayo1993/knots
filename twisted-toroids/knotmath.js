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
  // The (q, p) torus knot, keeping its handedness. Nontrivial torus knots are all
  // chiral: T(a, b) and its mirror T(a, -b) are different knots. With this file's
  // conventions a positive twist gives a positive braid, and a positive torus knot
  // is right-handed (verify/verify.py checks this with the tau invariant).
  function torusKnot(q, p) {
    const sign = Math.sign(q) * Math.sign(p);
    q = Math.abs(q); p = Math.abs(p);
    if (q < 2 || p < 2) return { name: 'unknot', genus: 0, crossingNumber: 0, chirality: null };
    const a = Math.min(q, p), b = Math.max(q, p);
    const hand = sign > 0 ? 'right-handed' : 'left-handed';
    const named = { '2,3': 'trefoil', '2,5': 'cinquefoil' }[a + ',' + b];
    return {
      name: named ? hand + ' ' + named : 'T(' + a + ',' + (sign < 0 ? '-' : '') + b + ')',
      torus: [a, sign * b], chirality: hand,
      genus: (a - 1) * (b - 1) / 2, crossingNumber: Math.min(q * (p - 1), p * (q - 1))
    };
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

    // Ribbon braid: each stripe's core plus a parallel copy pushed along the stripe,
    // so the stripe's framing is the linking number of its core with that copy.
    // ring: 2n points, cores at even positions, the boundaries between them odd.
    // line: 3n points, each lane as (push-off to one side, core, push-off to the
    //   other side), so the set is symmetric about the axis but no push-off ever
    //   sits on it. (A lane boundary can lie on the axis, and then it would be a
    //   one-lap curve that no longer follows a two-lap stripe.)
    const rn = kind === 'ring' ? 2 * n : 3 * n;
    const rsteps = kind === 'ring' ? 2 * steps : steps;
    const ribbonWord = braidWord(kind, rn, rsteps);
    const ribbon = readBraid(rn, ribbonWord);
    const rPerm = permutation(rn, ribbonWord);
    const rFwd = kind === 'ring' && rPerm.every((q, i) => q === mod(i + rsteps, rn));
    const rPos = x => (kind === 'ring' && !rFwd) ? mod(-x, rn) : x;
    const corePos = i => rPos(kind === 'ring' ? 2 * i : 3 * i + 1);
    const edgePos = i => rPos(kind === 'ring' ? 2 * i + 1 : 3 * i + 2);

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

  // ---------- Kauffman bracket and Jones polynomial ----------
  // The bracket of a closed braid, computed in the Temperley-Lieb algebra: each
  // crossing is A * (pass straight through) + A^-1 * (cup-cap), for sigma_i, and the
  // reverse for its inverse. A state is a planar matching of the 2n endpoints
  // (bottom 0..n-1, top n..2n-1); closing the braid joins bottom j to top j, and a
  // state with L loops contributes delta^(L-1), delta = -A^2 - A^-2.
  // Polynomials in A are { o: lowest exponent, c: number[] }. Coefficients stay far
  // below 2^53 for anything the page allows, and `bracket` refuses to go on if not.
  const MAX_SAFE = 2 ** 52;
  const AP = {
    shift(p, k) { return { o: p.o + k, c: p.c }; },
    addInto(acc, p) {
      if (!acc) return { o: p.o, c: p.c.slice() };
      const o = Math.min(acc.o, p.o), hi = Math.max(acc.o + acc.c.length, p.o + p.c.length);
      if (o === acc.o && hi === acc.o + acc.c.length) { p.c.forEach((x, i) => { acc.c[p.o - o + i] += x; }); return acc; }
      const c = new Array(hi - o).fill(0);
      acc.c.forEach((x, i) => { c[acc.o - o + i] += x; });
      p.c.forEach((x, i) => { c[p.o - o + i] += x; });
      return { o, c };
    },
    // times delta = -A^2 - A^-2
    delta(p) {
      const c = new Array(p.c.length + 4).fill(0);
      p.c.forEach((x, i) => { c[i] -= x; c[i + 4] -= x; });
      return { o: p.o - 2, c };
    },
    trim(p) {
      let a = 0, b = p.c.length;
      while (a < b && p.c[a] === 0) a++;
      while (b > a && p.c[b - 1] === 0) b--;
      return a === b ? { o: 0, c: [] } : { o: p.o + a, c: p.c.slice(a, b) };
    }
  };
  function bracket(n, word, opts = {}) {
    const budget = opts.budget || 6e7;
    let work = 0;
    const id = new Int8Array(2 * n);
    for (let j = 0; j < n; j++) { id[j] = n + j; id[n + j] = j; }
    let states = new Map([[String.fromCharCode(...id), { m: id, p: { o: 0, c: [1] } }]]);
    for (const g of word) {
      const i = Math.abs(g) - 1, e = Math.sign(g), a = n + i, b = n + i + 1, next = new Map();
      const put = (m, p) => {
        const key = String.fromCharCode(...m), cur = next.get(key);
        if (cur) cur.p = AP.addInto(cur.p, p); else next.set(key, { m, p: { o: p.o, c: p.c.slice() } });
      };
      for (const { m, p } of states.values()) {
        work += p.c.length + 8;
        put(m, AP.shift(p, e));                  // pass straight through
        if (m[a] === b) put(m, AP.delta(AP.shift(p, -e)));   // the cup-cap closes a loop
        else {
          const m2 = m.slice(), x = m[a], y = m[b];
          m2[x] = y; m2[y] = x; m2[a] = b; m2[b] = a;
          put(m2, AP.shift(p, -e));
        }
      }
      states = new Map();
      for (const [k, v] of next) {
        const p = AP.trim(v.p);
        if (!p.c.length) continue;
        if (p.c.some(x => Math.abs(x) > MAX_SAFE)) throw new Error('Coefficients are too large to compute exactly here.');
        states.set(k, { m: v.m, p });
      }
      if (work > budget) throw new Error('This braid is too large to compute its Jones polynomial here.');
    }
    // close up: count loops of matching edges plus closure edges j <-> n + j
    let out = null;
    for (const { m, p } of states.values()) {
      const seen = new Uint8Array(2 * n);
      let loops = 0;
      for (let s = 0; s < 2 * n; s++) {
        if (seen[s]) continue;
        loops++;
        let x = s;
        while (!seen[x]) { seen[x] = 1; const y = m[x]; seen[y] = 1; x = y < n ? y + n : y - n; }
      }
      let q = p;
      for (let k = 1; k < loops; k++) q = AP.delta(q);
      out = AP.addInto(out, q);
    }
    return AP.trim(out || { o: 0, c: [] });
  }
  // Jones polynomial V(t) = (-A^3)^(-writhe) <closure> at A = t^(-1/4). Links with an
  // even number of components have half-integer powers, so the result is written in
  // s = t^(1/2): { o, c } with c[i] the coefficient of t^((o + i) / 2).
  function jones(n, word, opts) {
    if (n < 1) return { o: 0, c: [1] };
    const br = bracket(n, word, opts);
    const w = word.reduce((s, g) => s + Math.sign(g), 0);
    const sign = w % 2 ? -1 : 1;
    // A^k -> t^(-k/4) = s^(-k/2): reverse and halve the exponents
    const terms = [];
    br.c.forEach((x, i) => {
      if (!x) return;
      const k = br.o + i - 3 * w;
      if (k % 2) throw new Error('odd exponent in the bracket');
      terms.push([-k / 2, sign * x]);
    });
    if (!terms.length) return { o: 0, c: [] };
    const lo = Math.min(...terms.map(t => t[0])), hi = Math.max(...terms.map(t => t[0]));
    const c = new Array(hi - lo + 1).fill(0);
    terms.forEach(([e, x]) => { c[e - lo] += x; });
    return { o: lo, c };
  }
  // The same polynomial for the mirror image: t -> 1/t.
  const mirrorPoly = p => p.c.length ? { o: -(p.o + p.c.length - 1), c: p.c.slice().reverse() } : p;
  const polyKey = p => p.c.length ? p.o + ':' + p.c.join(',') : '0';
  function jonesText(p) {
    if (!p.c.length) return '0';
    const exp = e => {
      if (e % 2 === 0) { const k = e / 2; return k === 0 ? '' : k === 1 ? 't' : 't' + SUP(k); }
      return 't' + SUP(e) + 'ᐟ²';
    };
    const terms = [];
    p.c.forEach((x, i) => {
      if (!x) return;
      const e = p.o + i, a = Math.abs(x), v = exp(e);
      terms.push({ neg: x < 0, s: (a === 1 && v ? '' : String(a)) + v });
    });
    terms.reverse();
    return terms.map((tm, k) => (k ? (tm.neg ? ' − ' : ' + ') : (tm.neg ? '−' : '')) + tm.s).join('');
  }
  // Evaluate at t = x (for checks): sum c * x^((o + i) / 2), for x > 0 or x = -1 via
  // |V(-1)|, which is the determinant of the link (equal to |Alexander(-1)|).
  function jonesAt(p, x) {
    if (x > 0) return p.c.reduce((s, c, i) => s + c * Math.pow(x, (p.o + i) / 2), 0);
    // t = -1, s = i: s^e cycles through 1, i, -1, -i
    let re = 0, im = 0;
    p.c.forEach((c, i) => { const e = ((p.o + i) % 4 + 4) % 4; if (e === 0) re += c; else if (e === 1) im += c; else if (e === 2) re -= c; else im -= c; });
    return Math.hypot(re, im);
  }
  // The braid's mirror image: every crossing changes sign.
  const mirrorWord = word => word.map(g => -g);
  // A braid is homogeneous if each generator appears with only one sign. Seifert's
  // algorithm on the closure of a homogeneous braid gives a surface of least genus
  // (Stallings; Cromwell), so its genus is the genus of the knot or link.
  function homogeneous(word) {
    const s = new Map();
    for (const g of word) { const i = Math.abs(g); if (s.has(i) && s.get(i) !== Math.sign(g)) return false; s.set(i, Math.sign(g)); }
    return true;
  }
  // Genus of the Seifert surface of a closed braid: n disks and one band per crossing,
  // chi = n - c, genus = (2 - chi - components) / 2.
  function seifertGenus(n, word) {
    const mu = cycles(permutation(n, word)).length;
    return (2 - (n - word.length) - mu) / 2;
  }

  // ---------- naming knots and links from the table ----------
  // knot-table.js lists prime knots up to 10 crossings and prime links up to 8, each
  // with a braid word and its Jones and Alexander polynomials. A knot is matched by
  // its exact Jones polynomial (which tells most knots from their mirror images)
  // and its Alexander polynomial. A link's Jones polynomial also depends on the
  // directions of its components, so a link is matched against every choice of
  // directions: reversing a set S of components multiplies V by t^(-3 lk(S, rest)).
  // A match means "has the same polynomials as": different knots with more than ten
  // crossings can share them, and the readouts say "matches".
  const SUB = s => String(s).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
  const tableName = nm => nm.includes('^') ? nm.replace(/^(\d+)\^(\d+)_(\d+)$/, (m, c, k, i) => c + SUP(k) + SUB(i)) : nm.replace(/^(\d+)_(\d+)$/, (m, c, i) => c + SUB(i));
  const polyMul = (p, q) => {
    if (!p.c.length || !q.c.length) return { o: 0, c: [] };
    const c = new Array(p.c.length + q.c.length - 1).fill(0);
    p.c.forEach((x, i) => q.c.forEach((y, j) => { c[i + j] += x * y; }));
    return { o: p.o + q.o, c };
  };
  const alexMul = (a, b) => { const c = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { c[i + j] += x * y; })); if (c[c.length - 1] < 0) return c.map(x => -x); return c; };
  const palindromic = p => polyKey(p) === polyKey(mirrorPoly(p));
  let TABLE = null;
  function knotTable() {
    if (TABLE) return TABLE;
    const entries = root.KnotTableEntries || (typeof require === 'function' ? require('./knot-table.js') : []);
    const primes = entries.map(e => Object.assign({}, e, { V: { o: e.jones[0], c: e.jones[1] }, label: tableName(e.name) }));
    // right-handed torus knots have a Jones polynomial with only positive powers
    primes.forEach(e => { if (e.torus) e.hand = e.V.o > 0 ? 'right-handed' : 'left-handed'; });
    // composites of two prime knots with ten crossings or fewer in all
    const small = primes.filter(e => e.kind === 'knot' && e.crossings <= 7);
    const composites = [];
    for (let i = 0; i < small.length; i++) for (let j = i; j < small.length; j++) {
      const A = small[i], B = small[j];
      if (A.crossings + B.crossings > 10) continue;
      const flips = A.amphichiral || B.amphichiral ? [false] : [false, true];
      for (const flipB of flips) {
        const VB = flipB ? mirrorPoly(B.V) : B.V;
        composites.push({ kind: 'knot', components: 1, composite: [[A, false], [B, flipB]], crossings: A.crossings + B.crossings, name: A.name + '#' + (flipB ? 'm' : '') + B.name,
          V: polyMul(A.V, VB), alexander: alexMul(A.alexander, B.alexander), amphichiral: A === B && flipB && !A.amphichiral ? true : (A.amphichiral && B.amphichiral) || null });
      }
    }
    TABLE = { primes, composites };
    return TABLE;
  }
  // Text for one prime factor, `mirrored` relative to the table's diagram.
  function primeLabel(e, mirrored) {
    const name = e.label + (e.alias ? ' ' + e.alias : '');
    if (e.torus) {
      const hand = mirrored ? (e.hand === 'right-handed' ? 'left-handed' : 'right-handed') : e.hand;
      return hand + ' ' + (e.alias || 'torus knot') + ' (' + e.label + ')';
    }
    if (e.amphichiral) return name;
    return mirrored ? 'mirror image of ' + name : name;
  }
  function compositeLabel(c, mirrored) {
    const parts = c.composite.map(([e, m]) => primeLabel(e, m !== mirrored));
    const [[A, ma], [B, mb]] = c.composite;
    let alias = '';
    if (A === B && A.name === '3_1') alias = (ma === mb ? 'granny knot: ' : 'square knot: ');
    return alias + parts.join(' # ');
  }
  // identify(n, word) -> { components, jones, matches: [{ label, chirality, name }], note }
  function identify(n, word, opts = {}) {
    const mu = cycles(permutation(n, word)).length;
    let V;
    try { V = jones(n, word, opts); } catch (err) { return { components: mu, error: err.message, matches: [] }; }
    const key = polyKey(V), mkey = polyKey(mirrorPoly(V)), T = knotTable(), matches = [];
    if (mu === 1) {
      const alex = alexander(n, word).join(',');
      if (key === '0:1') return { components: 1, jones: V, matches: [{ label: 'unknot', name: 'unknot', chirality: 'amphichiral' }] };
      const consider = (e, labelOf) => {
        if (e.alexander.join(',') !== alex) return;
        const same = polyKey(e.V) === key, mirr = polyKey(e.V) === mkey;
        if (!same && !mirr) return;
        if (e.amphichiral) matches.push({ label: labelOf(e, false), name: e.name || null, chirality: 'amphichiral' });
        else if (palindromic(V)) matches.push({ label: labelOf(e, false) + ' or its mirror image', name: e.name || null, chirality: 'undetected' });
        else matches.push({ label: labelOf(e, !same), name: e.name || null, chirality: same ? 'as listed' : 'mirror' });
      };
      T.primes.filter(e => e.kind === 'knot').forEach(e => consider(e, primeLabel));
      T.composites.forEach(c => consider(c, compositeLabel));
    } else {
      // the unlink: V = (-t^(1/2) - t^(-1/2))^(mu - 1)
      let U = { o: 0, c: [1] };
      for (let k = 1; k < mu; k++) U = polyMul(U, { o: -1, c: [-1, 0, -1] });
      if (key === polyKey(U)) matches.push({ label: 'unlink of ' + mu + ' components (as far as the Jones polynomial can tell)', name: 'unlink', chirality: 'amphichiral' });
      for (const e of T.primes) {
        if (e.kind !== 'link' || e.components !== mu) continue;
        // Compare with every choice of directions. If both the link and its mirror
        // match (possibly with different directions), the Jones polynomial cannot
        // tell them apart as unoriented links.
        let same = false, mirr = false;
        for (let S = 0; S < 1 << (mu - 1); S++) {
          let lam = 0;
          for (let i = 0; i < mu; i++) for (let j = 0; j < mu; j++) if (((S >> i) & 1) && !((S >> j) & 1)) lam += e.linking[i][j];
          const wk = polyKey({ o: e.V.o - 6 * lam, c: e.V.c });
          if (wk === key) same = true;
          if (wk === mkey) mirr = true;
        }
        if (!same && !mirr) continue;
        const found = same && mirr ? 'either' : same ? 'as listed' : 'mirror';
        const name = e.label + (e.alias ? ' ' + e.alias : '');
        matches.push({ label: found === 'mirror' && !e.amphichiral ? 'mirror image of ' + name : name, name: e.name, chirality: e.amphichiral ? 'amphichiral' : found });
      }
    }
    return { components: mu, jones: V, matches };
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

  const api = { laneWidth, gcd, wordFormula, parseBraid, freeReduce, keepStrands, alexander, polyText, blackboardRibbon, describeBraid, braidLayout, braidWord, permutation, cycles, readBraid, stepsFor, torusKnot, describe, wordText,
    bracket, jones, jonesText, jonesAt, mirrorPoly, polyKey, mirrorWord, homogeneous, seifertGenus, identify, knotTable, tableName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KnotMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
