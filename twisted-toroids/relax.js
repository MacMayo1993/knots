/* Relax a closed braid into a smooth, tight knot. No renderer or DOM dependencies.

   Each component is a closed polygon. Every step pulls each vertex toward the
   midpoint of its neighbours (the rope tightens and smooths) and pushes apart any
   two vertices closer than the rope's thickness that are not neighbours along the
   rope. The knot type never changes: each step moves every vertex by less than
   half the smallest distance between two segments that do not share a vertex, so
   no two segments can pass through each other (a point of a segment moves no more
   than its endpoints do). test/editor-relax.test.cjs checks that rule on every step and
   compares linking numbers before and after with the Gauss integral. */
(function (root) {
  'use strict';
  const TAU = 2 * Math.PI, R = 1.6;

  // Resolve every crossing, including its over/under midpoint. A fixed number of
  // samples per lap aliases long words (sigma_1^144 used to become two circles).
  // Slot boundaries stay aligned. A strand gets `dense` samples in each slot where
  // it crosses, and only enough elsewhere to follow its circular lane closely (at
  // least MIN_PER_LAP per lap): there it is an arc of its lane, and the chord of a
  // 7.5 degree step strays under 0.005 from it, far less than the lane spacing.
  // `per` is a minimum per crossing slot, never a downsampling limit.
  const SAMPLES_PER_CROSSING = 8, MIN_PER_LAP = 48, MAX_POINTS = 8192;
  function samplePlan(KM, n, word, per = 72) {
    const lay = KM.braidLayout(n, word), slots = lay.slots || Math.max(1, word.length);
    const dense = Math.max(SAMPLES_PER_CROSSING, 2 * Math.ceil(per / (2 * slots)));
    const sparse = Math.max(1, Math.ceil(MIN_PER_LAP / slots));
    // which positions cross in each slot (all of them for an old-style layout)
    const busy = lay.busy || Array.from({ length: slots }, () => Array(n).fill(true));
    const counts = Array.from({ length: n }, (_, st) => Array.from({ length: slots }, (_, s) => busy[s][lay.position ? lay.position(st, s) : st] ? dense : sparse));
    return { lay, slots, dense, sparse, counts, total: counts.reduce((t, c) => t + c.reduce((a, b) => a + b, 0), 0) };
  }
  function fromBraid(KM, n, word, per = 72) {
    const plan = samplePlan(KM, n, word, per);
    if (plan.total > MAX_POINTS) throw new Error('This braid is too large to relax while preserving every crossing. Try a shorter braid or fewer strands.');
    const { lay, slots, counts } = plan, comps = KM.cycles(KM.permutation(n, word)), width = TAU / slots;
    return comps.map(c => {
      const pts = [];
      for (const st of c) for (let s = 0; s < slots; s++) for (let j = 0; j < counts[st][s]; j++) {
        const th = (s + j / counts[st][s]) * width, [a, b] = lay[st](Math.min(th, TAU - 1e-9));
        pts.push([(R + a) * Math.cos(th), b, (R + a) * Math.sin(th)]);
      }
      return pts;
    });
  }

  function create(curves, opts = {}) {
    const N = curves.reduce((s, c) => s + c.length, 0), P = new Float64Array(3 * N);
    const start = [], len = [], comp = new Int32Array(N), prev = new Int32Array(N), next = new Int32Array(N), idx = new Int32Array(N);
    let o = 0;
    curves.forEach((c, k) => {
      start.push(o); len.push(c.length);
      c.forEach((p, i) => { P[3 * (o + i)] = p[0]; P[3 * (o + i) + 1] = p[1]; P[3 * (o + i) + 2] = p[2]; comp[o + i] = k; idx[o + i] = i; prev[o + i] = o + (i - 1 + c.length) % c.length; next[o + i] = o + (i + 1) % c.length; });
      o += c.length;
    });
    return { P, N, start, len, comp, prev, next, idx, thick: opts.thickness || 0.16, pull: opts.pull || 0.25, push: opts.push || 0.9, steps: 0 };
  }
  // vertices i, j are "near along the rope" if on one component within k steps
  function ropeNear(S, i, j, k) {
    if (S.comp[i] !== S.comp[j]) return false;
    const L = S.len[S.comp[i]], d = Math.abs(S.idx[i] - S.idx[j]);
    return Math.min(d, L - d) <= k;
  }
  // closest distance between segments p0-p1 and q0-q1
  function segDist(P, a0, a1, b0, b1) {
    const ux = P[3 * a1] - P[3 * a0], uy = P[3 * a1 + 1] - P[3 * a0 + 1], uz = P[3 * a1 + 2] - P[3 * a0 + 2];
    const vx = P[3 * b1] - P[3 * b0], vy = P[3 * b1 + 1] - P[3 * b0 + 1], vz = P[3 * b1 + 2] - P[3 * b0 + 2];
    const wx = P[3 * a0] - P[3 * b0], wy = P[3 * a0 + 1] - P[3 * b0 + 1], wz = P[3 * a0 + 2] - P[3 * b0 + 2];
    const a = ux * ux + uy * uy + uz * uz, b = ux * vx + uy * vy + uz * vz, c = vx * vx + vy * vy + vz * vz;
    const d = ux * wx + uy * wy + uz * wz, e = vx * wx + vy * wy + vz * wz, D = a * c - b * b;
    let sN, sD = D, tN, tD = D;
    if (D < 1e-14) { sN = 0; sD = 1; tN = e; tD = c; }
    else { sN = b * e - c * d; tN = a * e - b * d; if (sN < 0) { sN = 0; tN = e; tD = c; } else if (sN > sD) { sN = sD; tN = e + b; tD = c; } }
    if (tN < 0) { tN = 0; if (-d < 0) sN = 0; else if (-d > a) sN = sD; else { sN = -d; sD = a; } }
    else if (tN > tD) { tN = tD; if (-d + b < 0) sN = 0; else if (-d + b > a) sN = sD; else { sN = -d + b; sD = a; } }
    const sc = Math.abs(sN) < 1e-14 ? 0 : sN / sD, tc = Math.abs(tN) < 1e-14 ? 0 : tN / tD;
    return Math.hypot(wx + sc * ux - tc * vx, wy + sc * uy - tc * vy, wz + sc * uz - tc * vz);
  }
  // A spatial hash: cells of a given size, each a linked list of items (points), keyed
  // by a number. Cell coordinates wrap at 1024, so far-apart cells can share a key;
  // that only adds candidate pairs, which are then measured, never loses one.
  const cellKey = (x, y, z) => ((x & 1023) * 1024 + (y & 1023)) * 1024 + (z & 1023);
  function hashPoints(X, count, cell, cells, head, link) {
    head.clear();
    for (let i = 0; i < count; i++) {
      const cx = Math.floor(X[3 * i] / cell), cy = Math.floor(X[3 * i + 1] / cell), cz = Math.floor(X[3 * i + 2] / cell);
      cells[3 * i] = cx; cells[3 * i + 1] = cy; cells[3 * i + 2] = cz;
      const k = cellKey(cx, cy, cz), h = head.get(k);
      link[i] = h === undefined ? -1 : h; head.set(k, i);
    }
  }
  function scratch(S) {
    if (!S.scratch || S.scratch.N !== S.N) S.scratch = { N: S.N, mid: new Float64Array(3 * S.N), cells: new Int32Array(3 * S.N), link: new Int32Array(S.N), head: new Map(), seen: new Map() };
    return S.scratch;
  }
  // The smallest distance between two segments that share no vertex. Segments are
  // hashed by midpoint in cells of size `reach`, so every pair whose midpoints are
  // closer than `reach` is measured: that is every pair closer than reach - maxSeg.
  // The true smallest gap is never more than maxSeg (segments i and i + 2 are no
  // farther apart than segment i + 1 is long), and reach >= 2 maxSeg, so it is
  // always found. Returning at most reach - maxSeg keeps the answer a lower bound
  // even for a degenerate loop of three segments.
  function minGap(S) {
    const { P, N, next } = S, T = scratch(S), M = T.mid;
    let maxSeg = 0;
    for (let i = 0; i < N; i++) {
      const j = next[i];
      maxSeg = Math.max(maxSeg, Math.hypot(P[3 * j] - P[3 * i], P[3 * j + 1] - P[3 * i + 1], P[3 * j + 2] - P[3 * i + 2]));
      M[3 * i] = (P[3 * i] + P[3 * j]) / 2; M[3 * i + 1] = (P[3 * i + 1] + P[3 * j + 1]) / 2; M[3 * i + 2] = (P[3 * i + 2] + P[3 * j + 2]) / 2;
    }
    const reach = Math.max(S.thick * 2, maxSeg * 2);
    hashPoints(M, N, reach, T.cells, T.head, T.link);
    let best = reach - maxSeg;
    const C = T.cells, link = T.link, head = T.head;
    for (let i = 0; i < N; i++) {
      const i1 = next[i], cx = C[3 * i], cy = C[3 * i + 1], cz = C[3 * i + 2];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const h = head.get(cellKey(cx + dx, cy + dy, cz + dz));
        for (let j = h === undefined ? -1 : h; j >= 0; j = link[j]) {
          if (j <= i) continue;
          const j1 = next[j];
          if (i1 === j || j1 === i || i1 === j1) continue;
          const d = segDist(P, i, i1, j, j1);
          if (d < best) best = d;
        }
      }
    }
    return best;
  }
  // One step. Returns { gap, move }: the smallest gap before the step and the largest
  // distance any vertex moved (always less than gap / 2).
  function step(S, opts = {}) {
    const { P, N, prev, next, thick } = S, F = new Float64Array(3 * N);
    if (opts.relax !== false) {
      for (let i = 0; i < N; i++) for (let d = 0; d < 3; d++) F[3 * i + d] = S.pull * ((P[3 * prev[i] + d] + P[3 * next[i] + d]) / 2 - P[3 * i + d]);
      // vertices closer than the thickness push apart (unless they are neighbours on the rope)
      const T = scratch(S), C = T.cells, link = T.link, head = T.head;
      hashPoints(P, N, thick, C, head, link);
      const near = Math.max(3, Math.ceil(S.N / S.len.length / 40));
      for (let i = 0; i < N; i++) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const h = head.get(cellKey(C[3 * i] + dx, C[3 * i + 1] + dy, C[3 * i + 2] + dz));
        for (let j = h === undefined ? -1 : h; j >= 0; j = link[j]) {
          if (j <= i || ropeNear(S, i, j, near)) continue;
          const ex = P[3 * i] - P[3 * j], ey = P[3 * i + 1] - P[3 * j + 1], ez = P[3 * i + 2] - P[3 * j + 2], dd = Math.hypot(ex, ey, ez);
          if (dd >= thick || dd < 1e-12) continue;
          const f = S.push * (thick - dd) / dd / 2;
          F[3 * i] += f * ex; F[3 * i + 1] += f * ey; F[3 * i + 2] += f * ez;
          F[3 * j] -= f * ex; F[3 * j + 1] -= f * ey; F[3 * j + 2] -= f * ez;
        }
      }
    }
    // A mouse/touch handle adds forces, never overwrites positions. Whole-component
    // pulls translate all its vertices; a local pull tapers along the closed rope.
    const h = opts.handle;
    if (h && Number.isInteger(h.vertex) && h.vertex >= 0 && h.vertex < N && Array.isArray(h.target) && h.target.length === 3 && h.target.every(Number.isFinite)) {
      const v = h.vertex, c = S.comp[v], spread = Math.max(2, Math.ceil(S.len[c] * 0.035));
      for (let j = 0; j < S.len[c]; j++) {
        const i = S.start[c] + j, delta = Math.abs(j - S.idx[v]), dist = Math.min(delta, S.len[c] - delta);
        const weight = h.whole ? 1 : Math.max(0, 1 - dist / spread);
        for (let d = 0; d < 3; d++) F[3 * i + d] += weight * 0.6 * (h.target[d] - P[3 * v + d]);
      }
    }
    // the safety rule applies to ALL forces, including arbitrarily distant handles:
    // no vertex moves as much as half the smallest gap
    const gap = minGap(S);
    let scale = 1;
    for (const x of P) scale = Math.max(scale, Math.abs(x));
    // Stop before floating-point rounding can consume the gap/2 safety margin.
    // An impossible pull against a linked component must resist, not tunnel.
    if (!(gap > 1e-7 * scale)) { S.steps++; return { gap, move: 0, blocked: true }; }
    const cap = 0.45 * gap;
    let move = 0;
    for (let i = 0; i < N; i++) {
      let m = Math.hypot(F[3 * i], F[3 * i + 1], F[3 * i + 2]);
      if (m > cap) { const s = cap / m; F[3 * i] *= s; F[3 * i + 1] *= s; F[3 * i + 2] *= s; m = cap; }
      if (m > move) move = m;
      P[3 * i] += F[3 * i]; P[3 * i + 1] += F[3 * i + 1]; P[3 * i + 2] += F[3 * i + 2];
    }
    S.steps++;
    // Settled: the rope's length has stopped shrinking (under 0.05% in 50 steps), so
    // it is as tight as its thickness allows; the page stops stepping then. (The
    // largest single move is no guide: it jitters once the rope is pressed tight.)
    let settled = false;
    if (!opts.handle && S.steps % 50 === 0) {
      let L = 0;
      for (let i = 0; i < N; i++) { const j = S.next[i]; L += Math.hypot(P[3 * j] - P[3 * i], P[3 * j + 1] - P[3 * i + 1], P[3 * j + 2] - P[3 * i + 2]); }
      settled = S.lastLength > 0 && (S.lastLength - L) / S.lastLength < 5e-4;
      S.lastLength = L;
    }
    return { gap, move, settled };
  }
  // A frozen display transform keeps a pulled point under the pointer. Automatic
  // relaxation can still re-center/re-scale on each frame using the default.
  function displayFrame(S, radius = 2.1) {
    const center = [0, 0, 0];
    for (let i = 0; i < S.N; i++) for (let d = 0; d < 3; d++) center[d] += S.P[3 * i + d] / S.N;
    let far = 0;
    for (let i = 0; i < S.N; i++) far = Math.max(far, Math.hypot(...center.map((v, d) => S.P[3 * i + d] - v)));
    return { center, scale: far > 1e-9 ? radius / far : 1 };
  }
  function curves(S, radius = 2.1, frame = displayFrame(S, radius)) {
    return S.start.map((o, k) => Array.from({ length: S.len[k] }, (_, i) => frame.center.map((v, d) => (S.P[3 * (o + i) + d] - v) * frame.scale)));
  }
  function tubeRadius(S, radius = 2.1, frame = displayFrame(S, radius)) {
    return Math.min(0.12, 0.42 * S.thick * frame.scale);
  }
  function nearestVertex(S, point, component = -1) {
    let vertex = -1, best = Infinity;
    for (let i = 0; i < S.N; i++) {
      if (component >= 0 && S.comp[i] !== component) continue;
      const distance = Math.hypot(...point.map((v, d) => S.P[3 * i + d] - v));
      if (distance < best) { best = distance; vertex = i; }
    }
    return vertex;
  }

  const api = { fromBraid, samplePlan, create, step, curves, tubeRadius, minGap, segDist, displayFrame, nearestVertex, MAX_POINTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KnotRelax = api;
})(typeof window !== 'undefined' ? window : globalThis);
