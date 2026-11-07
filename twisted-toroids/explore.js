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
  // kind: 'torus' (cut a twisted torus), 'braid' (draw a braid), 'lab' (cut explorer).
  const CHALLENGES = [
    { id: 'three', kind: 'torus', title: 'Make exactly three strips',
      goal: 'Choose a closed tube and a twist, then cut the paint boundaries into exactly three connected strips.',
      hint: 'For n painted pieces shifted by s = n × turn places, the number of strips is gcd(n, s). Try a hexagon and a half turn.',
      start: { shape: 'hex', turn: 0 } },
    { id: 'trefoils', kind: 'torus', title: 'Make two linked trefoils',
      goal: 'Make exactly two ribbons, each with a trefoil centerline, linked with each other.',
      hint: 'Each trefoil needs 3 laps and 2 tube turns. Six faces shifted by four places give two cycles of length three.',
      start: { shape: 'hex', turn: 0 } },
    { id: 'mirror', kind: 'torus', title: 'Build the mirror trefoil',
      goal: 'The starting triangle with +⅔ turn gives a right-handed trefoil. Build one left-handed trefoil ribbon.',
      hint: 'Reverse the twist to −⅔. The lap count stays three; the signed tube turns change from +2 to −2.',
      start: { shape: 'tri', turn: 2 / 3 } },
    { id: 'hopf', kind: 'torus', title: 'Make a Hopf link',
      goal: 'Cut a tube into two unknotted ribbons that are linked exactly once.',
      hint: 'Two strips that each come home after one lap need a whole number of turns, and they link once for every turn. A round tube with one full turn does it.',
      start: { shape: 'circle', turn: 0 } },
    { id: 'cinquefoil', kind: 'torus', title: 'Make a cinquefoil ribbon',
      goal: 'Cut a tube into a single ribbon tied in the cinquefoil, the (2, 5) torus knot.',
      hint: 'A strip that goes around twice and turns five times around the tube is a (2, 5) torus knot. On a round tube that is 2½ turns.',
      start: { shape: 'circle', turn: 0 } },
    { id: 'four', kind: 'torus', title: 'Make exactly four strips',
      goal: 'Choose any closed tube and twist that cuts into exactly four strips.',
      hint: 'You need gcd(n, s) = 4: a square with one full turn, or an octagon with half a turn.',
      start: { shape: 'tri', turn: 0 } },
    { id: 'figure8', kind: 'braid', title: 'Find a braid for the figure-eight knot',
      goal: 'Starting from an empty braid on 3 strands, build a braid whose closure is the figure-eight knot 4₁ (without the example button).',
      hint: 'Alternate the signs: σ₁ σ₂⁻¹, done twice. Use the diagram editor or type s1 S2 s1 S2.',
      start: { strands: 3, word: [] } },
    { id: 'amphichiral', kind: 'braid', title: 'A knot that is its own mirror image',
      goal: 'Draw a knot, not the unknot, that is the same as its mirror image.',
      hint: 'The Jones polynomial of such a knot reads the same with t and 1/t swapped. The figure-eight knot works, and so does 6₃: try σ₁² σ₂⁻¹ σ₁ σ₂⁻².',
      start: { strands: 3, word: [1, 1, 1] } },
    { id: 'genus2', kind: 'braid', title: 'A knot of genus two',
      goal: 'Draw a knot whose Seifert surface (from a braid with each generator used with one sign only) has genus 2.',
      hint: 'For such a braid on n strands with c crossings the genus is (c − n + 1) / 2. On 2 strands, σ₁⁵ (the cinquefoil) has genus 2.',
      start: { strands: 2, word: [1, 1, 1] } },
    { id: 'brunnian', kind: 'braid', title: 'Three rings, no two linked',
      goal: 'Make three loops so that any two of them come apart, but the three together do not.',
      hint: 'Each pair must come apart on its own, so linking numbers alone can\'t show it. The Borromean rings (σ₁ σ₂⁻¹)³ do it.',
      start: { strands: 3, word: [] } },
    { id: 'disk', kind: 'lab', title: 'Cut the torus into one disk',
      goal: 'In the cut explorer, cut the torus along your own loops so that it opens into a single disk.',
      hint: 'Two loops: one across the map (around the hole) and one up the map (around the tube). Together they unroll the torus into its square.',
      start: { surface: 'torus', cut: 'draw' } },
    { id: 'mobius', kind: 'lab', title: 'Two Möbius bands from a Klein bottle',
      goal: 'Cut the Klein bottle into exactly two Möbius bands.',
      hint: 'Cut along the line between the two colors. Drawn by hand: a loop a quarter of the way up, straight across the map; it comes back three quarters up.',
      start: { surface: 'klein', cut: 'k-draw' } }
  ];
  // input: { description, pieces, turn, cut, ready, ring } for torus challenges,
  //   braid: { n, word, components, names, labels, homogeneous, genus, pairsApart, allApart } or null,
  //   lab: { surface, pieces: [names] } or null.
  function checkChallenge(id, input) {
    const task = CHALLENGES.find(c => c.id === id);
    if (!task) throw new Error('Unknown challenge');
    if (task.kind === 'braid') {
      const b = input.braid;
      if (!b) return { pass: false, message: 'Switch to Any braid and draw a braid for this challenge.' };
      if (b.error) return { pass: false, message: 'This braid is too large to name here.' };
      const named = b.labels.length ? 'It matches the ' + b.labels.join('; or the ') + '.' : b.components === 1 ? 'It is not in the table of small knots.' : 'It has ' + b.components + ' components.';
      let pass = false, extra = '';
      if (id === 'figure8') pass = b.components === 1 && b.names.length === 1 && b.names[0] === '4_1';
      if (id === 'amphichiral') pass = b.components === 1 && b.names.length >= 1 && !b.names.includes('unknot') && b.chiralities.every(c => c === 'amphichiral');
      if (id === 'genus2') { pass = b.components === 1 && b.homogeneous && b.genus === 2 && !b.names.includes('unknot'); extra = ' Seifert surface genus ' + b.genus + (b.homogeneous ? '' : ', but some generator has both signs, so the knot\'s genus may be smaller') + '.'; }
      if (id === 'brunnian') { pass = b.components === 3 && b.pairsApart && !b.allApart; extra = b.components !== 3 ? '' : !b.pairsApart ? ' Some pair of loops does not come apart.' : b.allApart ? ' All three come apart too.' : ''; }
      return { pass, message: (pass ? 'Solved! ' : 'Not yet. ') + named + extra };
    }
    if (task.kind === 'lab') {
      const L = input.lab;
      if (!L) return { pass: false, message: 'Open the cut explorer (Start challenge) to cut the ' + (task.start.surface === 'klein' ? 'Klein bottle' : 'torus') + '.' };
      const got = L.pieces.length + (L.pieces.length === 1 ? ' piece: ' : ' pieces: ') + L.pieces.join(', ') + '.';
      let pass = false;
      if (id === 'disk') pass = L.surface === 'torus' && L.pieces.length === 1 && L.pieces[0] === 'disk';
      if (id === 'mobius') pass = L.surface === 'klein' && L.pieces.length === 2 && L.pieces.every(p => p === 'Möbius band');
      return { pass, message: (pass ? 'Solved! ' : 'Not yet. ') + got };
    }
    const { description: d, pieces: n, turn, cut, ready, ring } = input;
    if (!ring) return { pass: false, message: 'Use a closed tube in Twisted torus mode for this challenge.' };
    if (!ready) return { pass: false, message: 'Finish building and turning the tube before checking.' };
    if (!d || !d.ok) return { pass: false, message: 'The ends and paint boundaries must line up before these strips close.' };
    if (!cut) return { pass: false, message: 'Cut along the color lines, then check the resulting ribbons.' };
    const cs = d.components, count = cs.length;
    const trefoil = c => c.knot && c.knot.crossingNumber === 3 && c.knot.genus === 1;
    let pass = false;
    if (id === 'three') pass = count === 3;
    if (id === 'four') pass = count === 4;
    if (id === 'trefoils') pass = count === 2 && cs.every(trefoil) && Math.abs(d.linking[0][1]) > 0;
    if (id === 'mirror') pass = count === 1 && trefoil(cs[0]) && cs[0].knot.chirality === 'left-handed';
    if (id === 'hopf') pass = count === 2 && cs.every(c => c.knot && c.knot.name === 'unknot') && Math.abs(d.linking[0][1]) === 1;
    if (id === 'cinquefoil') pass = count === 1 && !!cs[0].knot.torus && cs[0].knot.torus[0] === 2 && Math.abs(cs[0].knot.torus[1]) === 5;
    const s = Math.round(n * turn);
    const facts = 'gcd(' + n + ', ' + s + ') = ' + count + '. ' + cs.map((c, i) => 'Strip ' + (i + 1) + ': ' + c.laps + ' lap' + (c.laps === 1 ? '' : 's') + ', ' + c.knot.name).join('; ') + '.';
    const links = count === 2 ? ' Linking number: ' + d.linking[0][1] + '.' : '';
    return { pass, message: (pass ? 'Solved! ' : 'Not yet. ') + facts + links };
  }
  const api = { CUTS, CHALLENGES, wrap, cutComponent, cutPoint, makeCutMesh, mapPoint, seamMate, checkChallenge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TorusExplore = api;
})(typeof window !== 'undefined' ? window : globalThis);
