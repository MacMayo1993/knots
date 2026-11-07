/* A braid diagram you can edit: strands run left to right, one column per crossing.

   diagram(n, word) is pure geometry (testable without a browser). mount() draws it
   as SVG and handles taps: a tap on a crossing flips it (sigma <-> sigma inverse) or
   deletes it, buttons add crossings at the end, and the strand count can change.

   Drawing convention: with the strands running left to right, a positive crossing
   sigma_i has its over-strand running from upper left to lower right (a right-handed
   crossing), so sigma1^3 closes to the right-handed trefoil, as in the 3D model and
   SnapPy. Strand position 1 is the top row. */
(function (root) {
  'use strict';
  const COL = 34, ROW = 30, PAD = 18;

  // Segments of the diagram: each strand's piece in each column, with its component
  // and whether it passes over or under at a crossing.
  function diagram(n, word) {
    const m = word.length, width = PAD * 2 + Math.max(1, m) * COL, height = PAD * 2 + Math.max(0, n - 1) * ROW;
    const at = Array.from({ length: n }, (_, i) => i);   // at[row] = strand
    const comp = componentOf(n, word);
    const y = r => PAD + r * ROW, segs = [], cols = [];
    for (let k = 0; k < Math.max(1, m); k++) {
      const x0 = PAD + k * COL, x1 = x0 + COL;
      const g = word[k], i = g ? Math.abs(g) - 1 : -1;
      for (let r = 0; r < n; r++) {
        if (g && (r === i || r === i + 1)) continue;
        segs.push({ x1: x0, y1: y(r), x2: x1, y2: y(r), comp: comp[at[r]], role: 'straight' });
      }
      if (g) {
        // the strand at row i (top) moves down; at row i + 1 moves up
        const down = { x1: x0, y1: y(i), x2: x1, y2: y(i + 1), comp: comp[at[i]] };
        const up = { x1: x0, y1: y(i + 1), x2: x1, y2: y(i), comp: comp[at[i + 1]] };
        // positive: the strand going down (upper left to lower right) is on top
        const over = g > 0 ? down : up, under = g > 0 ? up : down;
        segs.push(Object.assign(under, { role: 'under', column: k }), Object.assign(over, { role: 'over', column: k }));
        cols.push({ k, x: x0 + COL / 2, y: (y(i) + y(i + 1)) / 2, gen: g });
        [at[i], at[i + 1]] = [at[i + 1], at[i]];
      }
    }
    return { width, height, segs, cols, rowY: y, n, m };
  }
  // component (cycle of the permutation) of each starting strand, numbered as knotmath does
  function componentOf(n, word) {
    const at = Array.from({ length: n }, (_, i) => i);
    for (const g of word) { const i = Math.abs(g) - 1; [at[i], at[i + 1]] = [at[i + 1], at[i]]; }
    const perm = new Array(n); at.forEach((s, p) => { perm[s] = p; });
    const comp = new Array(n).fill(-1); let c = 0;
    for (let s = 0; s < n; s++) { if (comp[s] >= 0) continue; let t = s; do { comp[t] = c; t = perm[t]; } while (t !== s); c++; }
    return comp;
  }
  const genText = g => 'σ' + String(Math.abs(g)).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]) + (g < 0 ? '⁻¹' : '');

  // opts: { color(comp) -> css color, ink, paper, onChange(n, word), maxStrands, maxCrossings }
  function mount(box, opts) {
    const doc = opts.document || box.ownerDocument || root.document, NS = 'http://www.w3.org/2000/svg';
    let n = 2, word = [], mode = 'flip';
    const el = (tag, attrs = {}, parent) => { const e = doc.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
    const sv = (tag, attrs = {}, parent) => { const e = doc.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
    box.textContent = '';
    const tools = el('div', { class: 'be-tools' }, box);
    const strands = el('div', { class: 'be-strands' }, tools);
    const minusB = el('button', { type: 'button', class: 'step', 'aria-label': 'One strand fewer' }, strands); minusB.textContent = '−';
    const count = el('output', { class: 'be-count', 'aria-live': 'polite' }, strands);
    const plusB = el('button', { type: 'button', class: 'step', 'aria-label': 'One strand more' }, strands); plusB.textContent = '+';
    const modeSeg = el('div', { class: 'seg be-mode', role: 'group', 'aria-label': 'Tapping a crossing' }, tools);
    const flipB = el('button', { type: 'button', 'aria-pressed': 'true' }, modeSeg); flipB.textContent = 'Tap flips';
    const delB = el('button', { type: 'button', 'aria-pressed': 'false' }, modeSeg); delB.textContent = 'Tap deletes';
    const scroller = el('div', { class: 'be-scroll' }, box);
    const svg = sv('svg', { class: 'be-svg', role: 'group', 'aria-label': 'Braid diagram' }, scroller);
    const add = el('div', { class: 'be-add', role: 'group', 'aria-label': 'Add a crossing at the end' }, box);
    const actions = el('div', { class: 'be-actions' }, box);
    const undoB = el('button', { type: 'button', class: 'link-btn' }, actions); undoB.textContent = 'Remove last crossing';
    const clearB = el('button', { type: 'button', class: 'link-btn' }, actions); clearB.textContent = 'Clear';
    const status = el('p', { class: 'be-status', 'aria-live': 'polite' }, box);
    const change = (msg) => { if (msg) status.textContent = msg; opts.onChange(n, word.slice()); };
    function setMode(m) { mode = m; flipB.setAttribute('aria-pressed', String(m === 'flip')); delB.setAttribute('aria-pressed', String(m === 'delete')); render(n, word); }
    flipB.addEventListener('click', () => setMode('flip'));
    delB.addEventListener('click', () => setMode('delete'));
    minusB.addEventListener('click', () => {
      if (n <= 2) return;
      if (word.some(g => Math.abs(g) >= n - 1)) { status.textContent = 'The bottom strand still crosses: remove its crossings first.'; return; }
      n--; change('Removed the bottom strand.');
    });
    plusB.addEventListener('click', () => { if (n >= (opts.maxStrands || 10)) return; n++; change('Added a strand at the bottom.'); });
    undoB.addEventListener('click', () => { if (!word.length) return; const g = word.pop(); change('Removed ' + genText(g) + '.'); });
    clearB.addEventListener('click', () => { if (!word.length) return; word = []; change('Cleared the crossings.'); });
    function act(k) {
      const g = word[k];
      if (mode === 'delete') { word.splice(k, 1); change('Deleted crossing ' + (k + 1) + ' (' + genText(g) + ').'); }
      else { word[k] = -g; change('Crossing ' + (k + 1) + ' is now ' + genText(-g) + '.'); }
    }
    function render(nn, ww) {
      n = nn; word = ww.slice();
      count.textContent = n + ' strands';
      minusB.disabled = n <= 2; plusB.disabled = n >= (opts.maxStrands || 10);
      const D = diagram(n, word);
      svg.setAttribute('viewBox', '0 0 ' + D.width + ' ' + D.height);
      svg.setAttribute('width', String(D.width)); svg.setAttribute('height', String(D.height));
      svg.textContent = '';
      const line = (s, w, color) => sv('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, style: 'stroke:' + color, 'stroke-width': w, 'stroke-linecap': 'round' }, svg);
      // under-strands first, then each over-strand on a halo of paper so the under one looks broken
      for (const s of D.segs) if (s.role !== 'over') line(s, 4, opts.color(s.comp));
      for (const s of D.segs) if (s.role === 'over') { line(s, 11, opts.paper()); line(s, 4, opts.color(s.comp)); }
      D.cols.forEach(c => {
        const hit = sv('rect', { x: c.x - 15, y: c.y - ROW / 2 - 4, width: 30, height: ROW + 8, rx: 6, class: 'be-hit', tabindex: '0', role: 'button',
          'aria-label': 'Crossing ' + (c.k + 1) + ': ' + genText(c.gen) + (mode === 'delete' ? '. Activate to delete.' : '. Activate to flip.') }, svg);
        hit.addEventListener('click', () => act(c.k));
        hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(c.k); } });
      });
      // the add-a-crossing buttons, one pair per gap between neighbouring strands
      add.textContent = '';
      for (let i = 1; i < n; i++) for (const sgn of [1, -1]) {
        const b = el('button', { type: 'button', class: 'be-gen', 'aria-label': 'Add ' + genText(sgn * i) + ' at the end' }, add);
        b.textContent = genText(sgn * i);
        b.addEventListener('click', () => {
          if (word.length >= (opts.maxCrossings || 400)) { status.textContent = 'That is the most crossings allowed.'; return; }
          word.push(sgn * i); change('Added ' + genText(sgn * i) + '.');
          scroller.scrollLeft = 1e6;
        });
      }
      undoB.disabled = clearB.disabled = !word.length;
    }
    return { render, setMode, get word() { return word.slice(); }, get n() { return n; } };
  }

  const api = { diagram, componentOf, mount, genText, COL, ROW, PAD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BraidEditor = api;
})(typeof window !== 'undefined' ? window : globalThis);
