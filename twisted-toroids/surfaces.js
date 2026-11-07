/* Reference surfaces for the cut explorer: a torus and a Klein bottle on a grid,
   cut along any closed paths drawn on their flat maps. No renderer or DOM.

   Flat map coordinates: u (horizontal) and v (vertical) in [0, 1].
     torus:        (1, v) ~ (0, v)      and (u, 1) ~ (u, 0)
     Klein bottle: (1, v) ~ (0, 1 - v)  and (u, 1) ~ (u, 0)
   The Klein bottle's left and right edges are glued with a flip, so it is one-sided.

   A cut is a closed path along grid lines, given in the "unrolled" plane where the
   map is repeated: crossing the right edge of the Klein bottle's map continues
   from the left edge upside down. Loops drawn by hand are straightened into grid
   steps. Cutting gives every side of the cut its own copy of the grid points, and
   the result is described by walking the triangles (meshkit.analyze): pieces,
   Euler characteristic, boundary loops, and whether each piece is one-sided.

   3D: the torus is the usual ring. The Klein bottle is the "figure-eight" bottle: a
   figure-eight cross-section carried around a circle while turning half a turn,
   which brings it back onto itself traversed the other way. It passes through
   itself along the circle where the figure-eight crosses itself (no Klein bottle
   fits in 3D without doing so). */
(function (root) {
  'use strict';
  const MK = root.MeshKit || (typeof require === 'function' ? require('./meshkit.js') : null);
  const TAU = 2 * Math.PI, NU = 96, NV = 48;
  const mod = (x, p) => ((x % p) + p) % p;
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

  const SURFACES = {
    torus: {
      label: 'Torus',
      // grid point (I, J) of the unrolled plane -> the point of the surface
      fold(I, J) { return [mod(I, NU), mod(J, NV)]; },
      point(u, v, lift = 0) {
        const th = TAU * u, ph = TAU * v, r = 0.62 + lift, a = 1.55 + r * Math.cos(ph);
        return [a * Math.cos(th), r * Math.sin(ph), a * Math.sin(th)];
      },
      paint: () => 5
    },
    klein: {
      label: 'Klein bottle',
      fold(I, J) { const k = Math.floor(I / NU); return [I - k * NU, mod(k % 2 ? -J : J, NV)]; },
      point(u, v, lift = 0) {
        const th = TAU * u, ph = TAU * v, c = Math.cos(th / 2), s = Math.sin(th / 2), sc = 0.5 + lift;
        const a = 1.5 + sc * (c * Math.sin(ph) - s * Math.sin(2 * ph)), y = sc * (s * Math.sin(ph) + c * Math.sin(2 * ph));
        return [a * Math.cos(th), y, a * Math.sin(th)];
      },
      // two Möbius bands: |v| < 1/4 and |v - 1/2| < 1/4
      paint: (u, v) => (mod(v + 0.25, 1) < 0.5 ? 0 : 2)
    }
  };
  const vid = (i, j) => i * NV + j;

  // A straight run of grid steps from (I0, J0) to (I1, J1), staying close to the line.
  function gridLine(I0, J0, I1, J1) {
    const out = [[I0, J0]], dI = I1 - I0, dJ = J1 - J0, sI = Math.sign(dI), sJ = Math.sign(dJ);
    let i = 0, j = 0;
    const nI = Math.abs(dI), nJ = Math.abs(dJ);
    while (i < nI || j < nJ) {
      // step in whichever direction keeps the path nearest the true segment
      const errI = Math.abs((i + 1) * nJ - j * nI), errJ = Math.abs(i * nJ - (j + 1) * nI);
      if (j >= nJ || (i < nI && errI <= errJ)) i++; else j++;
      out.push([I0 + sI * i, J0 + sJ * j]);
    }
    return out;
  }
  // Points of the unrolled plane where the same surface point sits: P and its copies.
  // The shortest way from P to Q on the surface (for tapping out a loop).
  function nearestCopy(surface, P, Q) {
    let best = null;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      // copies of Q: shift by whole maps; on the Klein bottle, odd shifts flip v
      const k = Math.floor(P[0]) + di;
      let I = Q[0] + k, J = Q[1];
      if (surface === 'klein' && mod(k, 2)) J = 1 - J;
      J += Math.round(P[1] - J) + dj;
      const d = Math.hypot(I - P[0], J - P[1]);
      if (!best || d < best.d) best = { d, p: [I, J] };
    }
    return best.p;
  }
  // A drawn loop: points in map coordinates [u, v] in [0, 1]. Each step takes the
  // shortest way across the map's edges; the last joins back to the first.
  // Returns grid paths in the unrolled plane plus the loop's class: how many times it
  // goes around the hole (a) and around the tube (b).
  function loopPath(surface, pts) {
    if (pts.length < 2) return null;
    // snap to grid points first, so the loop closes exactly (also across a flipped edge)
    pts = pts.map(([u, v]) => [Math.round(u * NU) / NU, Math.round(v * NV) / NV]);
    const cover = [pts[0].slice()];
    for (let k = 1; k <= pts.length; k++) cover.push(nearestCopy(surface, cover[cover.length - 1], pts[k % pts.length]));
    const S = cover.map(([u, v]) => [Math.round(u * NU), Math.round(v * NV)]);
    const path = [];
    for (let k = 0; k + 1 < S.length; k++) {
      const seg = gridLine(S[k][0], S[k][1], S[k + 1][0], S[k + 1][1]);
      if (k) seg.shift();
      path.push(...seg);
    }
    // the loop's class: times around the hole (a) and around the tube (b)
    const first = S[0], last = S[S.length - 1], a = Math.round((last[0] - first[0]) / NU);
    const b = Math.round((surface === 'klein' && mod(a, 2) ? last[1] - (NV - first[1]) : last[1] - first[1]) / NV);
    return { path, a, b, cover };
  }
  // Preset loops, as paths in the unrolled plane.
  function presetPaths(surface, kind, opts = {}) {
    const P = [];
    if (kind === 'meridian') P.push(gridLine(0, 0, 0, NV));
    if (kind === 'longitude') P.push(gridLine(0, NV / 2, NU, NV / 2));
    if (kind === 'patch') { const a = [3 * NU / 8, NV / 8], b = [5 * NU / 8, 3 * NV / 8]; P.push([...gridLine(a[0], a[1], b[0], a[1]), ...gridLine(b[0], a[1], b[0], b[1]).slice(1), ...gridLine(b[0], b[1], a[0], b[1]).slice(1), ...gridLine(a[0], b[1], a[0], a[1]).slice(1)]); }
    if (kind === 'slope') {
      const a = opts.a | 0, b = opts.b | 0, g = gcd(a, b);
      if (!g) return P;
      const p = a / g, q = b / g;
      // g parallel copies of the (p, q) curve, spread evenly between each other
      for (let k = 0; k < g; k++) {
        const shift = p ? [0, Math.round(k * NV / (g * Math.abs(p)))] : [Math.round(k * NU / (g * Math.abs(q))), 0];
        P.push(gridLine(shift[0], shift[1] + (p ? 0 : 0), shift[0] + p * NU, shift[1] + q * NV));
      }
    }
    if (kind === 'between') P.push(gridLine(0, NV / 4, 2 * NU, NV / 4));      // Klein: the curve between its two Möbius bands
    if (kind === 'core') P.push(gridLine(0, 0, NU, 0));                       // Klein: the center line of one Möbius band
    return P;
  }
  // The cut edges of a set of paths, as surface grid edges.
  function cutEdges(surface, paths) {
    const S = SURFACES[surface], cut = new Set();
    for (const path of paths) for (let k = 0; k + 1 < path.length; k++) {
      const [i0, j0] = S.fold(...path[k]), [i1, j1] = S.fold(...path[k + 1]);
      const a = vid(i0, j0), b = vid(i1, j1);
      if (a !== b) cut.add(MK.ekey(a, b));
    }
    return cut;
  }
  // Names for the pieces, from their Euler characteristic, boundary and sidedness.
  function pieceName(p) {
    const b = p.boundaries;
    const holes = b === 1 ? 'one hole' : b + ' holes';
    if (p.orientable) {
      const g = p.genus;
      if (g === 0) return b === 0 ? 'sphere' : b === 1 ? 'disk' : b === 2 ? 'annulus' : 'disk with ' + (b - 1) + ' holes';
      if (g === 1) return b === 0 ? 'torus' : 'torus with ' + holes;
      return 'genus-' + g + ' surface' + (b ? ' with ' + holes : '');
    }
    const k = p.crosscaps;
    if (k === 1) return b === 0 ? 'projective plane' : b === 1 ? 'Möbius band' : 'Möbius band with ' + (b - 1) + (b === 2 ? ' hole' : ' holes');
    if (k === 2) return b === 0 ? 'Klein bottle' : 'Klein bottle with ' + holes;
    return 'one-sided surface (' + k + ' cross-caps' + (b ? ', ' + holes : '') + ')';
  }
  // Build the surface, cut it, and describe it.
  // Returns { positions, params, components, indices, colors, info, pointAt, componentAt }.
  function build(surface, paths, opts = {}) {
    const S = SURFACES[surface];
    if (!S) throw new Error('Unknown surface');
    const indices = [], corner = [];   // corner: local grid coords of each triangle corner
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      for (const tri of [[0, 1, 2], [0, 2, 3]]) for (const t of tri) {
        const [I, J] = c[t], [fi, fj] = S.fold(I, J);
        indices.push(vid(fi, fj)); corner.push([I, J]);
      }
    }
    const cut = cutEdges(surface, paths);
    const split = cut.size ? MK.splitAlong(indices, cut) : { indices: indices.slice(), source: Array.from({ length: NU * NV }, (_, v) => v) };
    const A = MK.analyze(split.indices);
    const nV = split.source.length, pos = new Float64Array(nV * 3), params = new Array(nV * 2), comp = new Array(nV).fill(0);
    // each vertex copy: its map position (from one triangle corner using it) and its piece
    const seen = new Uint8Array(nV), cen = new Float64Array(nV * 3), cnt = new Uint32Array(nV);
    for (let t = 0; t < split.indices.length / 3; t++) {
      const pts = [0, 1, 2].map(k => { const [I, J] = corner[3 * t + k]; return S.point(I / NU, J / NV); });
      const c = [0, 1, 2].map(d => (pts[0][d] + pts[1][d] + pts[2][d]) / 3);
      for (let k = 0; k < 3; k++) {
        const v = split.indices[3 * t + k];
        comp[v] = A.faceComponent[t];
        cen[3 * v] += c[0]; cen[3 * v + 1] += c[1]; cen[3 * v + 2] += c[2]; cnt[v]++;
        if (!seen[v]) {
          seen[v] = 1;
          const [I, J] = corner[3 * t + k], [fi, fj] = S.fold(I, J);
          params[2 * v] = fi / NU; params[2 * v + 1] = fj / NV;
          const p = S.point(I / NU, J / NV);
          pos[3 * v] = p[0]; pos[3 * v + 1] = p[1]; pos[3 * v + 2] = p[2];
        }
      }
    }
    // open a small gap along every cut: copies of a cut point move toward their own side
    const copies = new Map();
    split.source.forEach((s, v) => copies.set(s, (copies.get(s) || 0) + 1));
    const gap = opts.gap === undefined ? 0.75 : opts.gap;
    for (let v = 0; v < nV; v++) if (copies.get(split.source[v]) > 1 && cnt[v]) {
      for (let d = 0; d < 3; d++) pos[3 * v + d] += gap * (cen[3 * v + d] / cnt[v] - pos[3 * v + d]);
    }
    // pull separate pieces apart a little
    const nP = A.pieces.length, pc = Array.from({ length: nP }, () => [0, 0, 0, 0]);
    for (let v = 0; v < nV; v++) { const q = pc[comp[v]]; q[0] += pos[3 * v]; q[1] += pos[3 * v + 1]; q[2] += pos[3 * v + 2]; q[3]++; }
    const all = pc.reduce((s, q) => [s[0] + q[0], s[1] + q[1], s[2] + q[2], s[3] + q[3]], [0, 0, 0, 0]).map((x, i, a) => i < 3 ? x / a[3] : x);
    const shift = pc.map((q, k) => {
      if (nP < 2) return [0, 0, 0];
      const d = [q[0] / q[3] - all[0], q[1] / q[3] - all[1], q[2] / q[3] - all[2]], L = Math.hypot(...d);
      const amt = opts.explode === undefined ? 0.45 : opts.explode;
      // pieces that share a center (two Möbius bands) separate up and down
      return L < 0.08 ? [0, (k % 2 ? -1 : 1) * amt, 0] : d.map(x => amt * x / L);
    });
    for (let v = 0; v < nV; v++) for (let d = 0; d < 3; d++) pos[3 * v + d] += shift[comp[v]][d];
    const colors = new Array(nV);
    for (let v = 0; v < nV; v++) colors[v] = S.paint(params[2 * v], params[2 * v + 1]);
    // the boundary edges, for drawing the new edges brightly
    const boundary = [];
    for (const L of A.loops) for (let k = 0; k < L.length; k++) boundary.push(L[k], L[(k + 1) % L.length]);
    const pieces = A.pieces.map(p => Object.assign({ name: pieceName(p) }, p));
    const info = {
      surface, pieces, count: pieces.length, boundaries: A.loops.length, euler: A.euler,
      orientable: pieces.every(p => p.orientable)
    };
    // the piece and 3D point at a map position (a point on a cut belongs to the side it was tapped on)
    function componentAt(u, v) {
      const i = Math.min(NU - 1, Math.max(0, Math.floor(u * NU))), j = Math.min(NV - 1, Math.max(0, Math.floor(v * NV)));
      const fu = u * NU - i, fv = v * NV - j, t = 2 * (i * NV + j) + (fv > fu ? 1 : 0);
      return A.faceComponent[t];
    }
    function pointAt(u, v, lift = 0.02) {
      const c = componentAt(u, v), p = S.point(u, v, lift);
      return [p[0] + shift[c][0], p[1] + shift[c][1], p[2] + shift[c][2]];
    }
    return { positions: Array.from(pos), params, components: comp, indices: split.indices, colors, boundary, info, componentAt, pointAt, cutCount: cut.size };
  }
  // Segments to draw a path on the flat map, folded into one copy of the map:
  // [[u0, v0, u1, v1], ...]. Each grid step lies in one copy of the unrolled map.
  function mapSegments(surface, paths) {
    const out = [];
    for (const path of paths) for (let k = 0; k + 1 < path.length; k++) {
      const [I0, J0] = path[k], [I1, J1] = path[k + 1];
      const kk = Math.floor(Math.min(I0, I1) / NU), flip = surface === 'klein' && mod(kk, 2);
      const j0 = flip ? -J0 : J0, j1 = flip ? -J1 : J1, m = Math.floor(Math.min(j0, j1) / NV);
      out.push([(I0 - kk * NU) / NU, (j0 - m * NV) / NV, (I1 - kk * NU) / NU, (j1 - m * NV) / NV]);
    }
    return out;
  }

  // A straight segment of the unrolled plane drawn on the map: split where it crosses
  // the map's edges and fold each piece back in. P, Q are [u, v] in unrolled coordinates.
  function mapLine(surface, P, Q) {
    const ts = [0, 1];
    for (const d of [0, 1]) {
      const a = P[d], b = Q[d];
      if (a === b) continue;
      for (let k = Math.ceil(Math.min(a, b)); k <= Math.floor(Math.max(a, b)); k++) { const t = (k - a) / (b - a); if (t > 0 && t < 1) ts.push(t); }
    }
    ts.sort((x, y) => x - y);
    const at = t => [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];
    const fold = ([u, v], k) => { let vv = surface === 'klein' && mod(k, 2) ? -v : v; return [u - k, vv]; };
    const out = [];
    for (let i = 0; i + 1 < ts.length; i++) {
      if (ts[i + 1] - ts[i] < 1e-12) continue;
      const mid = at((ts[i] + ts[i + 1]) / 2), k = Math.floor(mid[0]);
      const A = fold(at(ts[i]), k), B = fold(at(ts[i + 1]), k), m = Math.floor(Math.min(A[1], B[1]) + 1e-12);
      out.push([A[0], A[1] - m, B[0], B[1] - m]);
    }
    return out;
  }

  const api = { NU, NV, SURFACES, gridLine, loopPath, nearestCopy, presetPaths, cutEdges, build, pieceName, mapSegments, mapLine, gcd };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SurfaceLab = api;
})(typeof window !== 'undefined' ? window : globalThis);
