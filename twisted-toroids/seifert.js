/* Seifert surface of a closed braid. No renderer or DOM dependencies.

   Seifert's algorithm: smoothing every crossing of a closed braid the oriented way
   leaves n concentric circles, one per strand position. Each circle bounds a disk;
   the disks are stacked at different heights, and every crossing becomes a band
   with a half twist joining the disks of the two strands that cross. The surface
   is orientable (its two sides can be painted two colors), its boundary is the
   closed braid, and its Euler characteristic is n - c for n strands and c
   crossings, so its genus is (2 - n + c - components) / 2.

   Here the braid is drawn standing up: strand position p runs around a circle of
   radius RADIUS at height level(p), and at a crossing the two strands swap heights
   along the edges of the band, which bulges outward. The positive generator gives
   a positive crossing (test/seifert.test.cjs checks the linking numbers of the
   boundary against the braid with the Gauss integral). */
(function (root) {
  'use strict';
  const TAU = 2 * Math.PI;
  const RADIUS = 1.3, SLOT = 16, RINGS = 6, ALONG = 12;

  function build(n, word, opts = {}) {
    const m = Math.max(word.length, 1), N = m * SLOT;
    const gap = opts.gap || Math.min(0.95, 2.6 / Math.max(1, n - 1));
    const bulge = opts.bulge || 0.5, width = opts.width || 0.55;
    const level = p => (p - (n - 1) / 2) * gap;
    const positions = [], indices = [], vLevel = [], vTheta = [], vRim = [];
    const add = (x, y, z, lv = -1, ti = -1, rim = false) => { positions.push(x, y, z); vLevel.push(lv); vTheta.push(ti); vRim.push(rim); return positions.length / 3 - 1; };
    const thetaOf = i => (i / N) * TAU;
    // disks: a center, rings out to the rim, one vertex per angle step
    const rim = [];
    for (let p = 0; p < n; p++) {
      const y = level(p), c = add(0, y, 0, p, -1), rings = [];
      for (let q = 1; q <= RINGS; q++) {
        const r = RADIUS * q / RINGS, row = [];
        for (let i = 0; i < N; i++) row.push(add(r * Math.cos(thetaOf(i)), y, r * Math.sin(thetaOf(i)), p, i, q === RINGS));
        rings.push(row);
      }
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        indices.push(c, rings[0][j], rings[0][i]);
        for (let q = 0; q + 1 < RINGS; q++) {
          const a = rings[q][i], b = rings[q][j], d = rings[q + 1][i], e = rings[q + 1][j];
          indices.push(a, b, e, a, e, d);
        }
      }
      rim.push(rings[RINGS - 1]);
    }
    // bands: one per crossing, attached along the middle of its slot
    const bands = [];
    word.forEach((g, k) => {
      const lo = Math.abs(g) - 1, sgn = Math.sign(g);
      const a = k * SLOT + 3, b = (k + 1) * SLOT - 3, S = b - a;
      const grid = [];
      for (let v = 0; v <= ALONG; v++) {
        const row = [];
        for (let s = 0; s <= S; s++) {
          if (v === 0) { row.push(rim[lo][a + s]); continue; }
          if (v === ALONG) { row.push(rim[lo + 1][b - s]); continue; }
          const f = v / ALONG, ss = s / S;
          const th = thetaOf(a + S * (ss + f * (1 - 2 * ss)));
          const out = Math.sin(Math.PI * f);
          // the edge from the lower disk passes outside for a negative crossing, inside for a positive one
          const r = RADIUS + out * (bulge - sgn * width * (ss - 0.5));
          const y = level(lo) + gap * (0.5 - 0.5 * Math.cos(Math.PI * f));
          row.push(add(r * Math.cos(th), y, r * Math.sin(th)));
        }
        grid.push(row);
      }
      for (let v = 0; v < ALONG; v++) for (let s = 0; s < S; s++) {
        const p = grid[v][s], q = grid[v][s + 1], r = grid[v + 1][s], t = grid[v + 1][s + 1];
        indices.push(p, q, t, p, t, r);
      }
      bands.push({ crossing: k, levels: [lo, lo + 1], sign: sgn });
    });
    return { positions, indices, vLevel, vTheta, vRim, n, word, slot: SLOT, steps: N, gap, level, bands };
  }

  // Which braid component each boundary loop follows: read off a rim vertex of the
  // loop that lies outside every band, from the strand at that position in that slot.
  function loopComponents(surface, loops, compOfStrand) {
    const { n, word, slot } = surface, at = Array.from({ length: n }, (_, i) => i), atSlot = [at.slice()];
    for (const g of word) { const i = Math.abs(g) - 1; [at[i], at[i + 1]] = [at[i + 1], at[i]]; atSlot.push(at.slice()); }
    return loops.map(L => {
      for (const v of L) {
        if (!surface.vRim[v]) continue;
        const k = Math.floor(surface.vTheta[v] / slot), off = surface.vTheta[v] % slot;
        // in the first few steps of a slot the strands have not crossed yet
        if (off < 3) return compOfStrand[atSlot[Math.min(k, atSlot.length - 1)][surface.vLevel[v]]];
      }
      return 0;
    });
  }

  // Turn each boundary loop to run the way the braid's strands do (angle increasing).
  function orientLoops(surface, loops) {
    return loops.map(L => {
      for (let k = 0; k < L.length; k++) {
        const v = L[k], w = L[(k + 1) % L.length];
        if (!surface.vRim[v] || !surface.vRim[w] || surface.vLevel[v] !== surface.vLevel[w]) continue;
        const d = (surface.vTheta[w] - surface.vTheta[v] + surface.steps) % surface.steps;
        return d === 1 ? L : L.slice().reverse();
      }
      return L;
    });
  }

  const api = { build, loopComponents, orientLoops, RADIUS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SeifertSurface = api;
})(typeof window !== 'undefined' ? window : globalThis);
