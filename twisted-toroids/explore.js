/* Pure topology and coordinate helpers. No renderer or DOM dependencies. */
(function (root) {
  'use strict';
  const TAU = 2 * Math.PI;
  const wrap = x => ((x % 1) + 1) % 1;
  const CUTS = {
    closed: { label: 'Uncut torus', components: 1, boundaries: 0, euler: 0,
      result: 'One torus. No boundary loops.',
      why: 'Both pairs of opposite edges are glued. This is the surface of a hollow tube, not a solid doughnut.' },
    meridian: { label: 'Around the tube', components: 1, boundaries: 2, euler: 0,
      result: 'One annulus · two boundary loops.',
      why: 'A meridian cut opens the tube across its circular cross-section. The surface stays connected; its two new circular edges are boundaries.' },
    longitude: { label: 'Around the central hole', components: 1, boundaries: 2, euler: 0,
      result: 'One annulus · two boundary loops.',
      why: 'A longitude cut follows the ring once. This cut also leaves one annulus, although it sits differently in space.' },
    patch: { label: 'Around a small patch', components: 2, boundaries: 2, euler: 0,
      result: 'A disk + a torus with one hole · one boundary loop each.',
      why: 'This rectangular loop can shrink to a point on the original surface. Cutting it separates a disk from a once-punctured torus. Their Euler characteristics are +1 and −1.' }
  };
  const patchInside = (u, v) => u > 3 / 8 && u < 5 / 8 && v > 1 / 8 && v < 3 / 8;
  const cutComponent = (kind, u, v) => kind === 'patch' && patchInside(u, v) ? 1 : 0;
  // The cut edges are duplicated, not capped. Opening the gaps changes the
  // embedding only. Patch translation keeps the original disk and its paint.
  function cutPoint(kind, u, v, component = cutComponent(kind, u, v), lift = 0) {
    if (!CUTS[kind]) throw new Error('Unknown cut');
    const gap = 0.13;
    const th = kind === 'meridian' ? gap + (TAU - 2 * gap) * u : TAU * u;
    const ph = kind === 'longitude' ? gap + (TAU - 2 * gap) * v : TAU * v;
    const r = 0.62 + lift, a = 1.55 + r * Math.cos(ph);
    return [a * Math.cos(th), r * Math.sin(ph) + (component === 1 ? 0.7 : 0), a * Math.sin(th)];
  }
  function makeCutMesh(kind, nu = 96, nv = 48) {
    if (!CUTS[kind]) throw new Error('Unknown cut');
    if (![nu, nv].every(n => Number.isInteger(n) && n >= 8 && n % 8 === 0)) throw new Error('Grid sizes must be multiples of eight');
    const positions = [], params = [], components = [], indices = [], vertices = new Map();
    function vertex(i, j, c) {
      const ii = kind === 'meridian' ? i : i % nu;
      const jj = kind === 'longitude' ? j : j % nv;
      const key = c + ':' + ii + ':' + jj;
      if (vertices.has(key)) return vertices.get(key);
      const id = components.length, u = ii / nu, v = jj / nv;
      vertices.set(key, id);
      components.push(c); params.push(u, v);
      positions.push(...cutPoint(kind, u, v, c));
      return id;
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const c = cutComponent(kind, (i + 0.5) / nu, (j + 0.5) / nv);
      const a = vertex(i, j, c), b = vertex(i + 1, j, c), d = vertex(i, j + 1, c), e = vertex(i + 1, j + 1, c);
      indices.push(a, b, e, a, e, d);
    }
    return { positions, params, components, indices };
  }
  // Flat map uses painted coordinates: row p occupies [p/n, (p+1)/n].
  // At the right seam, (1,v) is glued to (0,v+turn mod 1).
  function mapPoint(u, v, n) {
    v = Math.max(0, Math.min(1 - 1e-12, v));
    return { u: Math.max(0, Math.min(1, u)), v, piece: Math.floor(v * n), phi: TAU * (v - 0.5 / n) };
  }
  const seamMate = (v, turn) => wrap(v + turn);
  const CHALLENGES = [
    { id: 'three', title: 'Make exactly three strips',
      goal: 'Choose a closed tube and a twist, then cut the paint boundaries into exactly three connected strips.',
      hint: 'For n painted pieces shifted by s = n × turn places, the number of strips is gcd(n, s). Try a hexagon and a half turn.',
      start: { shape: 'hex', turn: 0 } },
    { id: 'trefoils', title: 'Make two linked trefoils',
      goal: 'Make exactly two ribbons, each with a trefoil centerline, linked with each other.',
      hint: 'Each trefoil needs 3 laps and 2 tube turns. Six faces shifted by four places give two cycles of length three.',
      start: { shape: 'hex', turn: 0 } },
    { id: 'mirror', title: 'Build the mirror trefoil',
      goal: 'The starting triangle with +⅔ turn gives a right-handed trefoil. Build one left-handed trefoil ribbon.',
      hint: 'Reverse the twist to −⅔. The lap count stays three; the signed tube turns change from +2 to −2.',
      start: { shape: 'tri', turn: 2 / 3 } }
  ];
  function checkChallenge(id, input) {
    const task = CHALLENGES.find(c => c.id === id);
    if (!task) throw new Error('Unknown challenge');
    const { description: d, pieces: n, turn, cut, ready, ring } = input;
    if (!ring) return { pass: false, message: 'Use a closed tube in Twisted torus mode for this challenge.' };
    if (!ready) return { pass: false, message: 'Finish building and turning the tube before checking.' };
    if (!d || !d.ok) return { pass: false, message: 'The ends and paint boundaries must line up before these strips close.' };
    if (!cut) return { pass: false, message: 'Cut along the color lines, then check the resulting ribbons.' };
    const cs = d.components, count = cs.length;
    const trefoil = c => c.knot && c.knot.crossingNumber === 3 && c.knot.genus === 1;
    let pass = false;
    if (id === 'three') pass = count === 3;
    if (id === 'trefoils') pass = count === 2 && cs.every(trefoil) && Math.abs(d.linking[0][1]) > 0;
    if (id === 'mirror') pass = count === 1 && trefoil(cs[0]) && cs[0].knot.chirality === 'left-handed';
    const s = Math.round(n * turn);
    const facts = 'gcd(' + n + ', ' + s + ') = ' + count + '. ' + cs.map((c, i) => 'Strip ' + (i + 1) + ': ' + c.laps + ' lap' + (c.laps === 1 ? '' : 's') + ', ' + c.knot.name).join('; ') + '.';
    const links = count === 2 ? ' Linking number: ' + d.linking[0][1] + '.' : '';
    return { pass, message: (pass ? 'Solved! ' : 'Not yet. ') + facts + links };
  }
  const api = { CUTS, CHALLENGES, wrap, cutComponent, cutPoint, makeCutMesh, mapPoint, seamMate, checkChallenge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TorusExplore = api;
})(typeof window !== 'undefined' ? window : globalThis);
