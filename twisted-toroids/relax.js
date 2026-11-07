/* Relax a closed braid into a smooth, tight knot. No renderer or DOM dependencies.

   Each component is a closed polygon. Every step pulls each vertex toward the
   midpoint of its neighbours (the rope tightens and smooths) and pushes apart any
   two vertices closer than the rope's thickness that are not neighbours along the
   rope. The knot type never changes: each step moves every vertex by less than
   half the smallest distance between two segments that do not share a vertex, so
   no two segments can pass through each other (a point of a segment moves no more
   than its endpoints do). test/relax.test.cjs checks that rule on every step and
   compares linking numbers before and after with the Gauss integral. */
(function (root) {
  'use strict';
  const TAU = 2 * Math.PI, R = 1.6;

  // Resolve every crossing, including its over/under midpoint. A fixed number of
  // samples per lap aliases long words (sigma_1^144 used to become two circles).
  // Keep slot boundaries aligned; `per` is a minimum, never a downsampling limit.
  const SAMPLES_PER_CROSSING = 8, MAX_POINTS = 8192;
  function fromBraid(KM, n, word, per = 72) {
    const slots = Math.max(1, word.length);
    per = slots * Math.max(SAMPLES_PER_CROSSING, 2 * Math.ceil(per / (2 * slots)));
    if (n * per > MAX_POINTS) throw new Error('This braid is too large to relax while preserving every crossing. Try a shorter braid or fewer strands.');
    const lay = KM.braidLayout(n, word), comps = KM.cycles(KM.permutation(n, word));
    return comps.map(c => {
      const pts = [];
      for (const st of c) for (let i = 0; i < per; i++) {
        const th = (i / per) * TAU, [a, b] = lay[st](Math.min(th, TAU - 1e-9));
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
  // A spatial hash of segment midpoints; returns pairs of segments (by first vertex)
  // that might be within `reach` of each other.
  function nearPairs(S, reach, fn) {
    const { P, N, next } = S, cell = reach, grid = new Map();
    const key = (x, y, z) => x + ',' + y + ',' + z;
    const cx = new Int32Array(N), cy = new Int32Array(N), cz = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      const j = next[i];
      cx[i] = Math.floor((P[3 * i] + P[3 * j]) / 2 / cell); cy[i] = Math.floor((P[3 * i + 1] + P[3 * j + 1]) / 2 / cell); cz[i] = Math.floor((P[3 * i + 2] + P[3 * j + 2]) / 2 / cell);
      const k = key(cx[i], cy[i], cz[i]);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }
    for (let i = 0; i < N; i++) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = grid.get(key(cx[i] + dx, cy[i] + dy, cz[i] + dz));
      if (list) for (const j of list) if (j > i) fn(i, j);
    }
  }
  // The smallest distance between two segments that share no vertex.
  function minGap(S) {
    const { P, next } = S;
    let maxSeg = 0;
    for (let i = 0; i < S.N; i++) { const j = next[i]; maxSeg = Math.max(maxSeg, Math.hypot(P[3 * j] - P[3 * i], P[3 * j + 1] - P[3 * i + 1], P[3 * j + 2] - P[3 * i + 2])); }
    const reach = Math.max(S.thick * 2, maxSeg * 2);
    let best = reach;
    nearPairs(S, reach, (i, j) => {
      const i1 = next[i], j1 = next[j];
      if (i === j || i1 === j || j1 === i || i1 === j1) return;
      const d = segDist(P, i, i1, j, j1);
      if (d < best) best = d;
    });
    return best;
  }
  // One step. Returns { gap, move }: the smallest gap before the step and the largest
  // distance any vertex moved (always less than gap / 2).
  function step(S) {
    const { P, N, prev, next, thick } = S, F = new Float64Array(3 * N);
    for (let i = 0; i < N; i++) for (let d = 0; d < 3; d++) F[3 * i + d] = S.pull * ((P[3 * prev[i] + d] + P[3 * next[i] + d]) / 2 - P[3 * i + d]);
    // vertices closer than the thickness push apart (unless they are neighbours on the rope)
    const grid = new Map(), cell = thick, key = (x, y, z) => x + ',' + y + ',' + z, C = new Int32Array(3 * N);
    for (let i = 0; i < N; i++) {
      for (let d = 0; d < 3; d++) C[3 * i + d] = Math.floor(P[3 * i + d] / cell);
      const k = key(C[3 * i], C[3 * i + 1], C[3 * i + 2]);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }
    const near = Math.max(3, Math.ceil(S.N / S.len.length / 40));
    for (let i = 0; i < N; i++) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = grid.get(key(C[3 * i] + dx, C[3 * i + 1] + dy, C[3 * i + 2] + dz));
      if (!list) continue;
      for (const j of list) {
        if (j <= i || ropeNear(S, i, j, near)) continue;
        const ex = P[3 * i] - P[3 * j], ey = P[3 * i + 1] - P[3 * j + 1], ez = P[3 * i + 2] - P[3 * j + 2], dd = Math.hypot(ex, ey, ez);
        if (dd >= thick || dd < 1e-12) continue;
        const f = S.push * (thick - dd) / dd / 2;
        F[3 * i] += f * ex; F[3 * i + 1] += f * ey; F[3 * i + 2] += f * ez;
        F[3 * j] -= f * ex; F[3 * j + 1] -= f * ey; F[3 * j + 2] -= f * ez;
      }
    }
    // the safety rule: no vertex moves as much as half the smallest gap
    const gap = minGap(S), cap = 0.45 * gap;
    let move = 0;
    for (let i = 0; i < N; i++) {
      let m = Math.hypot(F[3 * i], F[3 * i + 1], F[3 * i + 2]);
      if (m > cap) { const s = cap / m; F[3 * i] *= s; F[3 * i + 1] *= s; F[3 * i + 2] *= s; m = cap; }
      if (m > move) move = m;
      P[3 * i] += F[3 * i]; P[3 * i + 1] += F[3 * i + 1]; P[3 * i + 2] += F[3 * i + 2];
    }
    S.steps++;
    return { gap, move };
  }
  // The curves, centered and scaled so they fit a ball of the given radius.
  function curves(S, radius = 2.1) {
    const { P, N } = S;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < N; i++) { cx += P[3 * i] / N; cy += P[3 * i + 1] / N; cz += P[3 * i + 2] / N; }
    let far = 0;
    for (let i = 0; i < N; i++) far = Math.max(far, Math.hypot(P[3 * i] - cx, P[3 * i + 1] - cy, P[3 * i + 2] - cz));
    const s = far > 1e-9 ? radius / far : 1;
    return S.start.map((o, k) => Array.from({ length: S.len[k] }, (_, i) => [(P[3 * (o + i)] - cx) * s, (P[3 * (o + i) + 1] - cy) * s, (P[3 * (o + i) + 2] - cz) * s]));
  }
  // The tube radius to draw with, in the same scaled units as curves().
  function tubeRadius(S, radius = 2.1) {
    const { P, N } = S;
    let cx = 0, cy = 0, cz = 0, far = 0;
    for (let i = 0; i < N; i++) { cx += P[3 * i] / N; cy += P[3 * i + 1] / N; cz += P[3 * i + 2] / N; }
    for (let i = 0; i < N; i++) far = Math.max(far, Math.hypot(P[3 * i] - cx, P[3 * i + 1] - cy, P[3 * i + 2] - cz));
    return Math.min(0.12, 0.42 * S.thick * radius / Math.max(far, 1e-9));
  }

  const api = { fromBraid, create, step, curves, tubeRadius, minGap, segDist };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KnotRelax = api;
})(typeof window !== 'undefined' ? window : globalThis);
