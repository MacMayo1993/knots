/* Braid studio helpers: pure functions behind the braid views, with no renderer or
   DOM dependencies, so they can be tested directly (test/studio.test.cjs).

   - tube(): the rope drawn around a relaxed polygon, written into reusable buffers.
     It passes through exactly the polygon's vertices (the curve relax.js keeps
     collision-free); frames are rotation-minimizing and the leftover twist around
     the closed loop is spread evenly, so the tube never kinks or shears.
   - followFrame(): ease a display frame toward another (Pull view auto-fitting).
   - placement() and reserve(): where the braid toolbar goes, and the part of the
     stage it leaves for the model. Desktop: a rail down the left side, which costs
     nothing on a wide stage because the model is fitted to the stage height.
     Phone: one compact row along the top. Hidden on a phone with the full sheet.
   - viewOf(): which of the four views (Ribbons, Rope, Surface, Pull) is showing. */
(function (root) {
  'use strict';

  // positions/normals for `radial` points around each polygon vertex; prev (same
  // vertex and radial counts) is reused in place. The index is closed in both
  // directions, so the tube is a closed surface (watertight for STL).
  function tube(points, radius, radial = 12, prev = null) {
    const M = points.length, V = M * radial;
    const reuse = prev && prev.M === M && prev.radial === radial;
    const positions = reuse ? prev.positions : new Float32Array(3 * V), normals = reuse ? prev.normals : new Float32Array(3 * V);
    let index = reuse ? prev.index : null;
    if (!index) {
      index = new Uint32Array(6 * V);
      let o = 0;
      for (let i = 0; i < M; i++) for (let j = 0; j < radial; j++) {
        const a = i * radial + j, b = ((i + 1) % M) * radial + j, c = ((i + 1) % M) * radial + (j + 1) % radial, d = i * radial + (j + 1) % radial;
        index[o++] = a; index[o++] = d; index[o++] = c; index[o++] = a; index[o++] = c; index[o++] = b;
      }
    }
    if (M < 3) return { M, radial, positions, normals, index };
    const T = new Float64Array(3 * M), N = new Float64Array(3 * M);
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const unit = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    for (let i = 0; i < M; i++) {
      const t = unit(sub(points[(i + 1) % M], points[(i - 1 + M) % M]));
      T[3 * i] = t[0]; T[3 * i + 1] = t[1]; T[3 * i + 2] = t[2];
    }
    const tAt = i => [T[3 * i], T[3 * i + 1], T[3 * i + 2]];
    // first normal: perpendicular to the first tangent, away from its smallest axis
    const t0 = tAt(0), ax = Math.abs(t0[0]) < Math.abs(t0[1]) ? (Math.abs(t0[0]) < Math.abs(t0[2]) ? [1, 0, 0] : [0, 0, 1]) : (Math.abs(t0[1]) < Math.abs(t0[2]) ? [0, 1, 0] : [0, 0, 1]);
    let r = unit(sub(ax, t0.map(x => x * dot(ax, t0))));
    // double reflection (Wang et al. 2008): a rotation-minimizing frame along the polygon
    const transport = (r, i, k) => {
      const v1 = sub(points[k], points[i]), c1 = dot(v1, v1);
      if (c1 < 1e-24) return r;
      const ti = tAt(i), tk = tAt(k);
      const rL = r.map((x, d) => x - (2 / c1) * dot(v1, r) * v1[d]), tL = ti.map((x, d) => x - (2 / c1) * dot(v1, ti) * v1[d]);
      const v2 = sub(tk, tL), c2 = dot(v2, v2);
      const out = c2 < 1e-24 ? rL : rL.map((x, d) => x - (2 / c2) * dot(v2, rL) * v2[d]);
      return unit(sub(out, tk.map(x => x * dot(out, tk))));
    };
    for (let i = 0; i < M; i++) { N[3 * i] = r[0]; N[3 * i + 1] = r[1]; N[3 * i + 2] = r[2]; if (i + 1 < M) r = transport(r, i, i + 1); }
    // close the loop: the frame carried all the way round comes back turned by some
    // angle about the first tangent; undo it a little at each vertex
    const back = transport(r, M - 1, 0), n0 = [N[0], N[1], N[2]], b0 = unit([t0[1] * n0[2] - t0[2] * n0[1], t0[2] * n0[0] - t0[0] * n0[2], t0[0] * n0[1] - t0[1] * n0[0]]);
    const twist = Math.atan2(dot(back, b0), dot(back, n0));
    for (let i = 0; i < M; i++) {
      const t = tAt(i), n = [N[3 * i], N[3 * i + 1], N[3 * i + 2]], b = [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]];
      const a = -twist * i / M, ca = Math.cos(a), sa = Math.sin(a);
      const nn = n.map((x, d) => ca * x + sa * b[d]), bb = b.map((x, d) => ca * x - sa * n[d]);
      for (let j = 0; j < radial; j++) {
        const ph = 2 * Math.PI * j / radial, c = Math.cos(ph), s = Math.sin(ph), v = 3 * (i * radial + j);
        for (let d = 0; d < 3; d++) {
          const w = c * nn[d] + s * bb[d];
          normals[v + d] = w; positions[v + d] = points[i][d] + radius * w;
        }
      }
    }
    return { M, radial, positions, normals, index };
  }

  // Ease a display frame { center, scale } toward a target; t = 1 jumps.
  function followFrame(current, target, t) {
    if (!current) return { center: target.center.slice(), scale: target.scale };
    const k = Math.max(0, Math.min(1, t));
    return {
      center: current.center.map((c, d) => c + (target.center[d] - c) * k),
      scale: Math.exp(Math.log(current.scale) + (Math.log(target.scale) - Math.log(current.scale)) * k)
    };
  }

  // 'rail' (desktop: a column at the left), 'top' (phone: a compact row), 'hidden'.
  function placement({ braid, lab, phone, sheet, stageWidth }) {
    if (!braid || lab) return 'hidden';
    if (phone) return sheet === 'full' ? 'hidden' : 'top';
    return stageWidth >= 640 ? 'rail' : 'top';
  }
  // The stage area left for the model, in pixels: shifts (tx, ty) for the camera's
  // view offset (positive moves the model left / up) and the free width/height to
  // fit the model in. bar and hud are
  // rectangles relative to the stage ({ left, top, right, bottom }) or null.
  function reserve(where, W, H, bar, hud) {
    const ok = r => r && [r.right, r.bottom].every(Number.isFinite);
    if (!ok(bar)) bar = null; if (!ok(hud)) hud = null;
    if (where === 'rail' && bar) {
      // the readout sits above the rail, no wider than it, so only the left side is taken
      const right = Math.max(bar.right, hud ? hud.right : 0) + 10;
      // the camera's view offset moves the picture the other way: negative = right
      return { tx: -right / 2, ty: 0, freeW: Math.max(1, W - right), freeH: H };
    }
    if (where === 'top' && bar) {
      const below = Math.max(bar.bottom, hud ? hud.bottom : 0) + 8;
      return { tx: 0, ty: -below / 2, freeW: W, freeH: Math.max(1, H - below) };
    }
    return { tx: 0, ty: 0, freeW: W, freeH: H };
  }
  function viewOf({ rope, pull, surface }) {
    if (pull) return 'pull';
    if (rope) return 'rope';
    if (surface) return 'surface';
    return 'ribbon';
  }
  const ropeKey = b => b ? b.n + ':' + b.word.join(',') : '';

  const api = { tube, followFrame, placement, reserve, viewOf, ropeKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BraidStudio = api;
})(typeof window !== 'undefined' ? window : globalThis);
