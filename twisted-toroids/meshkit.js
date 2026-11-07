/* Triangle-mesh topology and export. No renderer or DOM dependencies.

   A mesh is { positions: number[] (x, y, z per vertex), indices: number[] (three
   vertex numbers per triangle) }. Everything here works from the indices alone, so
   two vertices are the same point of the surface only if they share a number;
   weld() merges vertices that sit at the same place first, when that is wanted.

   - analyze(): connected pieces, and for each its Euler characteristic, boundary
     loops and whether it is orientable (two-sided), by walking the triangles.
   - splitAlong(): cut the surface along a set of edges by giving each side of the
     cut its own copy of the vertices.
   - thicken() and toSTL(): a printable solid for 3D printers. */
(function (root) {
  'use strict';
  const ekey = (a, b) => a < b ? a + ':' + b : b + ':' + a;

  // Merge vertices closer than eps. Returns the merged mesh and old -> new numbers.
  function weld(positions, indices, eps = 1e-6) {
    const grid = new Map(), map = new Int32Array(positions.length / 3), out = [];
    const q = x => Math.round(x / eps);
    for (let v = 0; v < map.length; v++) {
      const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
      const kx = q(x), ky = q(y), kz = q(z);
      let found = -1;
      for (let dx = -1; dx <= 1 && found < 0; dx++) for (let dy = -1; dy <= 1 && found < 0; dy++) for (let dz = -1; dz <= 1 && found < 0; dz++) {
        const list = grid.get((kx + dx) + ',' + (ky + dy) + ',' + (kz + dz));
        if (list) for (const w of list) if (Math.abs(out[3 * w] - x) <= eps && Math.abs(out[3 * w + 1] - y) <= eps && Math.abs(out[3 * w + 2] - z) <= eps) { found = w; break; }
      }
      if (found < 0) {
        found = out.length / 3; out.push(x, y, z);
        const k = kx + ',' + ky + ',' + kz;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(found);
      }
      map[v] = found;
    }
    const idx = [];
    for (let t = 0; t < indices.length; t += 3) {
      const a = map[indices[t]], b = map[indices[t + 1]], c = map[indices[t + 2]];
      if (a !== b && b !== c && a !== c) idx.push(a, b, c);   // drop triangles that collapsed
    }
    return { positions: out, indices: idx, map };
  }

  // edge -> list of [triangle, direction] where direction is +1 if the triangle runs a -> b (a < b)
  function edgeFaces(indices) {
    const E = new Map();
    for (let t = 0; t < indices.length / 3; t++) for (let k = 0; k < 3; k++) {
      const a = indices[3 * t + k], b = indices[3 * t + (k + 1) % 3], key = ekey(a, b);
      if (!E.has(key)) E.set(key, []);
      E.get(key).push([t, a < b ? 1 : -1]);
    }
    return E;
  }

  // Orient every triangle consistently where possible. Returns flips (1 = keep,
  // -1 = reverse), and the edges where no consistent choice exists (a one-sided piece).
  function orient(indices, E = edgeFaces(indices)) {
    const nT = indices.length / 3, flip = new Int8Array(nT), conflicts = [];
    const nbrs = Array.from({ length: nT }, () => []);
    for (const [key, list] of E) if (list.length === 2) {
      const [[s, ds], [t, dt]] = list;
      nbrs[s].push([t, ds, dt, key]); nbrs[t].push([s, dt, ds, key]);
    }
    for (let s0 = 0; s0 < nT; s0++) {
      if (flip[s0]) continue;
      flip[s0] = 1;
      const stack = [s0];
      while (stack.length) {
        const s = stack.pop();
        for (const [t, ds, dt, key] of nbrs[s]) {
          // consistent: the two triangles cross their shared edge in opposite directions
          const want = -flip[s] * ds * dt;
          if (!flip[t]) { flip[t] = want; stack.push(t); }
          else if (flip[t] !== want) conflicts.push(key);
        }
      }
    }
    return { flip, conflicts: [...new Set(conflicts)] };
  }

  // Boundary loops: the edges used by exactly one triangle, joined end to end.
  function boundaryLoops(indices, E = edgeFaces(indices)) {
    const next = new Map(), edges = [];
    for (const [key, list] of E) if (list.length === 1) {
      const [a, b] = key.split(':').map(Number);
      edges.push([a, b]);
      for (const [x, y] of [[a, b], [b, a]]) { if (!next.has(x)) next.set(x, []); next.get(x).push(y); }
    }
    const used = new Set(), loops = [];
    for (const [a, b] of edges) {
      if (used.has(ekey(a, b))) continue;
      const loop = [a];
      let prev = a, cur = b;
      used.add(ekey(a, b));
      while (cur !== a) {
        loop.push(cur);
        const options = (next.get(cur) || []).filter(w => w !== prev && !used.has(ekey(cur, w)));
        const nxt = options.length ? options[0] : (next.get(cur) || []).find(w => !used.has(ekey(cur, w)));
        if (nxt === undefined) break;
        used.add(ekey(cur, nxt)); prev = cur; cur = nxt;
      }
      loops.push(loop);
    }
    return loops;
  }

  // Pieces of the surface, with V - E + F, boundary loops and orientability for each.
  function analyze(indices, nVerts) {
    const nT = indices.length / 3, E = edgeFaces(indices);
    const parent = Array.from({ length: nT }, (_, i) => i);
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (const list of E.values()) for (let k = 1; k < list.length; k++) parent[find(list[k][0])] = find(list[0][0]);
    const comp = new Int32Array(nT), ids = new Map();
    for (let t = 0; t < nT; t++) { const r = find(t); if (!ids.has(r)) ids.set(r, ids.size); comp[t] = ids.get(r); }
    const pieces = Array.from({ length: ids.size }, () => ({ faces: 0, vertices: new Set(), edges: 0, boundaries: 0, orientable: true, nonManifoldEdges: 0 }));
    for (let t = 0; t < nT; t++) { const P = pieces[comp[t]]; P.faces++; for (let k = 0; k < 3; k++) P.vertices.add(indices[3 * t + k]); }
    for (const list of E.values()) { const P = pieces[comp[list[0][0]]]; P.edges++; if (list.length > 2) P.nonManifoldEdges++; }
    const { conflicts } = orient(indices, E);
    for (const key of conflicts) pieces[comp[E.get(key)[0][0]]].orientable = false;
    const loops = boundaryLoops(indices, E), vComp = new Map();
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) vComp.set(indices[3 * t + k], comp[t]);
    const loopPiece = loops.map(L => vComp.get(L[0]));
    loopPiece.forEach(c => { pieces[c].boundaries++; });
    const out = pieces.map(P => {
      const euler = P.vertices.size - P.edges + P.faces;
      // closed-up genus: orientable chi = 2 - 2g - b; one-sided chi = 2 - k - b (k cross-caps)
      const genus = P.orientable ? (2 - euler - P.boundaries) / 2 : null, crosscaps = P.orientable ? 0 : 2 - euler - P.boundaries;
      return { faces: P.faces, vertices: P.vertices.size, edges: P.edges, euler, boundaries: P.boundaries, orientable: P.orientable, genus, crosscaps, nonManifoldEdges: P.nonManifoldEdges };
    });
    void nVerts;
    return { pieces: out, faceComponent: comp, loops, loopPiece, euler: out.reduce((s, p) => s + p.euler, 0) };
  }

  // Cut along edges: around each vertex, triangles that meet across an uncut edge
  // share one copy of the vertex; each group separated by cut edges gets its own.
  // cut: Set of edge keys "a:b" (a < b). Returns new indices and source[] (new -> old).
  function splitAlong(indices, cut) {
    const nT = indices.length / 3, around = new Map();
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
      const v = indices[3 * t + k];
      if (!around.has(v)) around.set(v, []);
      around.get(v).push(t);
    }
    const corner = new Int32Array(indices.length), source = [];
    for (const [v, faces] of around) {
      const parent = new Map(faces.map(t => [t, t]));
      const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
      // edges at v: other end w -> triangles using edge v-w
      const byEdge = new Map();
      for (const t of faces) for (let k = 0; k < 3; k++) {
        const a = indices[3 * t + k], b = indices[3 * t + (k + 1) % 3];
        if (a !== v && b !== v) continue;
        const w = a === v ? b : a;
        if (!byEdge.has(w)) byEdge.set(w, []);
        byEdge.get(w).push(t);
      }
      for (const [w, ts] of byEdge) if (!cut.has(ekey(v, w))) for (let k = 1; k < ts.length; k++) parent.set(find(ts[k]), find(ts[0]));
      const copy = new Map();
      for (const t of faces) {
        const r = find(t);
        if (!copy.has(r)) { copy.set(r, source.length); source.push(v); }
        for (let k = 0; k < 3; k++) if (indices[3 * t + k] === v) corner[3 * t + k] = copy.get(r);
      }
    }
    return { indices: Array.from(corner), source };
  }

  // Area-weighted vertex normals.
  function normals(positions, indices) {
    const N = new Float64Array(positions.length);
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const i of [a, b, c]) { N[i] += nx; N[i + 1] += ny; N[i + 2] += nz; }
    }
    for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
    return N;
  }

  // A closed solid around a surface: two copies pushed apart along the normals,
  // joined along every boundary edge. One-sided pieces (a Möbius band) are first
  // slit along the edges where the normal would flip, so each side is consistent.
  function thicken(positions, indices, half, opts = {}) {
    let mesh = opts.weld === false ? { positions: Array.from(positions), indices: Array.from(indices) } : weld(positions, indices, opts.eps || 1e-5);
    let E = edgeFaces(mesh.indices);
    let { flip, conflicts } = orient(mesh.indices, E);
    let idx = mesh.indices.slice(), pos = mesh.positions.slice();
    if (conflicts.length) {
      const split = splitAlong(idx, new Set(conflicts));
      idx = split.indices;
      pos = []; split.source.forEach(v => pos.push(mesh.positions[3 * v], mesh.positions[3 * v + 1], mesh.positions[3 * v + 2]));
      E = edgeFaces(idx); ({ flip } = orient(idx, E));
    }
    for (let t = 0; t < flip.length; t++) if (flip[t] < 0) { const x = idx[3 * t + 1]; idx[3 * t + 1] = idx[3 * t + 2]; idx[3 * t + 2] = x; }
    const N = normals(pos, idx), nV = pos.length / 3, P = new Array(pos.length * 2), I = [];
    for (let v = 0; v < nV; v++) for (let k = 0; k < 3; k++) {
      P[3 * v + k] = pos[3 * v + k] + half * N[3 * v + k];
      P[3 * (v + nV) + k] = pos[3 * v + k] - half * N[3 * v + k];
    }
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      I.push(a, b, c, a + nV, c + nV, b + nV);
    }
    // side walls along the boundary, following each triangle's own direction a -> b
    for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = idx[t + k], b = idx[t + (k + 1) % 3];
      if (E.get(ekey(a, b)).length !== 1) continue;
      I.push(a, a + nV, b + nV, a, b + nV, b);
    }
    return { positions: P, indices: I };
  }

  // Binary STL (little-endian), with the model scaled to millimetres.
  function toSTL(positions, indices, scale = 1, header = 'Twisted Toroids') {
    const nT = indices.length / 3, buf = new ArrayBuffer(84 + 50 * nT), dv = new DataView(buf);
    for (let i = 0; i < Math.min(80, header.length); i++) dv.setUint8(i, header.charCodeAt(i) & 127);
    dv.setUint32(80, nT, true);
    let o = 84;
    for (let t = 0; t < nT; t++) {
      const p = [0, 1, 2].map(k => [0, 1, 2].map(j => positions[3 * indices[3 * t + k] + j] * scale));
      const u = p[1].map((x, j) => x - p[0][j]), v = p[2].map((x, j) => x - p[0][j]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1;
      for (const x of n) { dv.setFloat32(o, x / l, true); o += 4; }
      for (const q of p) for (const x of q) { dv.setFloat32(o, x, true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  const api = { ekey, weld, edgeFaces, orient, boundaryLoops, analyze, splitAlong, normals, thicken, toSTL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MeshKit = api;
})(typeof window !== 'undefined' ? window : globalThis);
