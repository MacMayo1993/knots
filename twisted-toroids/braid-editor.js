/* A braid diagram you can edit: strands run left to right, one column per crossing.

   diagram(n, word) is pure geometry (testable without a browser). mount() draws it
   as SVG with explicit selection, flip/delete tools and insertion beside a crossing.
   Application history unifies diagram, typed-word and preset changes.

   Drawing convention: with the strands running left to right, a positive crossing
   sigma_i has its over-strand running from upper left to lower right (a right-handed
   crossing), so sigma1^3 closes to the right-handed trefoil, as in the 3D model and
   SnapPy. Strand position 1 is the top row. */
(function (root) {
  'use strict';
  const COL = 52, ROW = 42, PAD = 26;

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

  // The application owns history so diagram edits, examples and typed words undo together.
  function mount(box, opts) {
    const doc = opts.document || box.ownerDocument || root.document, NS = 'http://www.w3.org/2000/svg';
    let n = 2, word = [], mode = 'select', selected = -1;
    const el = (tag, attrs = {}, parent) => { const e = doc.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
    const sv = (tag, attrs = {}, parent) => { const e = doc.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
    const button = (label, parent, fn, attrs = {}) => { const b = el('button', { type: 'button', ...attrs }, parent); b.textContent = label; b.addEventListener('click', fn); return b; };
    box.textContent = '';
    const tools = el('div', { class: 'be-tools' }, box), strands = el('div', { class: 'be-strands', role: 'group', 'aria-label': 'Strand count' }, tools);
    const minusB = button('−', strands, () => {
      if (n <= 1) return;
      if (word.some(g => Math.abs(g) >= n - 1)) { status.textContent = 'Remove the bottom strand’s crossings first, or undo an edit.'; return; }
      n--; change('Removed the bottom strand.');
    }, { class: 'step', 'aria-label': 'One strand fewer' });
    const count = el('output', { class: 'be-count', 'aria-live': 'polite' }, strands);
    const plusB = button('+', strands, () => { if (n < (opts.maxStrands || 10)) { n++; change('Added a strand.'); } }, { class: 'step', 'aria-label': 'One strand more' });
    const history = el('div', { class: 'be-history' }, tools);
    const undoB = button('↶ Undo', history, () => opts.onUndo?.(), { class: 'secondary', 'aria-label': 'Undo braid edit' });
    const redoB = button('↷ Redo', history, () => opts.onRedo?.(), { class: 'secondary', 'aria-label': 'Redo braid edit' });
    const modeSeg = el('div', { class: 'seg be-mode', role: 'group', 'aria-label': 'Diagram editing tool' }, box);
    const modes = [['select', 'Select'], ['flip', 'Tap flips'], ['delete', 'Tap deletes']].map(([key, label]) => [key, button(label, modeSeg, () => setMode(key))]);
    const scroller = el('div', { class: 'be-scroll' }, box);
    const svg = sv('svg', { class: 'be-svg', role: 'group', 'aria-label': 'Braid diagram' }, scroller);
    const selection = el('div', { class: 'be-selection' }, box);
    const selectedText = el('span', { class: 'be-selected-text', 'aria-live': 'polite' }, selection);
    const flipOne = button('Flip', selection, () => flip(), { class: 'secondary', 'aria-label': 'Flip selected crossing' });
    const deleteOne = button('Delete', selection, () => remove(), { class: 'secondary', 'aria-label': 'Delete selected crossing' });
    const insertion = el('label', { class: 'be-insertion' }, box); insertion.textContent = 'Add crossings';
    const where = el('select', { 'aria-label': 'Insert crossing position' }, insertion);
    for (const [value, label] of [['end', 'At the end'], ['before', 'Before selection'], ['after', 'After selection'], ['start', 'At the start']]) {
      const o = el('option', { value }, where); o.value = value; o.textContent = label;
    }
    where.value = 'end';
    const add = el('div', { class: 'be-add', role: 'group', 'aria-label': 'Add a crossing' }, box);
    const actions = el('div', { class: 'be-actions' }, box);
    const mirrorB = button('⇄ Mirror braid', actions, () => { word = word.map(g => -g); change('Mirrored every crossing. Undo restores the original.'); }, { class: 'secondary' });
    const lastB = button('Remove last crossing', actions, () => { if (word.length) { word.pop(); selected = -1; change('Removed the last crossing.'); } }, { class: 'link-btn' });
    const clearB = button('Clear', actions, () => { word = []; selected = -1; change('Cleared the crossings. Undo restores them.'); }, { class: 'link-btn' });
    const status = el('p', { class: 'be-status', 'aria-live': 'polite' }, box);
    function change(msg) { status.textContent = msg; render(n, word); opts.onChange(n, word.slice()); }
    function setMode(m) { mode = m; render(n, word); }
    function flip() { if (selected < 0) return; word[selected] = -word[selected]; change('Flipped crossing ' + (selected + 1) + '.'); }
    function remove() { if (selected < 0) return; word.splice(selected, 1); selected = Math.min(selected, word.length - 1); change('Deleted the selected crossing.'); }
    function act(k) {
      selected = k;
      if (mode === 'delete') remove();
      else if (mode === 'flip') flip();
      else { where.value = 'after'; render(n, word); }
    }
    function insert(g) {
      if (word.length >= (opts.maxCrossings || 400)) { status.textContent = 'Maximum crossing count reached. Delete a crossing to add another.'; return; }
      let at = word.length;
      if (where.value === 'start') at = 0;
      if (selected >= 0 && where.value === 'before') at = selected;
      if (selected >= 0 && where.value === 'after') at = selected + 1;
      word.splice(at, 0, g); selected = at;
      change('Added ' + genText(g) + ' at crossing ' + (at + 1) + '.');
      scroller.scrollLeft = Math.max(0, PAD + at * COL - (scroller.clientWidth || 260) / 2);
    }
    function render(nn, ww) {
      const externalChange = n !== nn || word.length !== ww.length || word.some((g, i) => g !== ww[i]);
      if (externalChange) selected = -1;
      n = nn; word = ww.slice();
      if (selected >= word.length) selected = -1;
      count.textContent = n + (n === 1 ? ' strand' : ' strands');
      minusB.disabled = n <= 1; plusB.disabled = n >= (opts.maxStrands || 10);
      undoB.disabled = !opts.history?.().canUndo; redoB.disabled = !opts.history?.().canRedo;
      modes.forEach(([key, b]) => b.setAttribute('aria-pressed', String(key === mode)));
      const D = diagram(n, word);
      svg.setAttribute('viewBox', '0 0 ' + D.width + ' ' + D.height);
      svg.setAttribute('width', String(D.width)); svg.setAttribute('height', String(D.height));
      svg.textContent = '';
      for (let r = 0; r < n; r++) {
        const label = sv('text', { x: 7, y: D.rowY(r) + 4, class: 'be-row-label' }, svg); label.textContent = r + 1;
      }
      const line = (s, w, color) => sv('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, style: 'stroke:' + color, 'stroke-width': w, 'stroke-linecap': 'round' }, svg);
      for (const s of D.segs) if (s.role !== 'over') line(s, 5, opts.color(s.comp));
      for (const s of D.segs) if (s.role === 'over') { line(s, 13, opts.paper()); line(s, 5, opts.color(s.comp)); }
      const hits = [];
      D.cols.forEach(c => {
        const hit = sv('rect', { x: c.x - 23, y: c.y - 23, width: 46, height: 46, rx: 10, class: 'be-hit', 'data-crossing': c.k, tabindex: '0', role: 'button', 'aria-pressed': String(selected === c.k),
          'aria-label': 'Crossing ' + (c.k + 1) + ': ' + genText(c.gen) + '. Activate to ' + mode + '.' }, svg);
        hits.push(hit); hit.addEventListener('click', () => act(c.k));
        hit.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(c.k); svg.querySelector?.('[data-crossing="' + Math.max(0, selected) + '"]')?.focus(); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); hits[Math.max(0, Math.min(hits.length - 1, c.k + (e.key === 'ArrowLeft' ? -1 : 1)))].focus(); }
          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); selected = c.k; remove(); svg.querySelector?.('[data-crossing="' + Math.max(0, selected) + '"]')?.focus(); }
        });
      });
      selectedText.textContent = selected >= 0 ? 'Crossing ' + (selected + 1) + ' · ' + genText(word[selected]) : word.length ? 'Select a crossing to edit it' : 'Add a crossing to start your braid';
      flipOne.disabled = deleteOne.disabled = selected < 0;
      add.textContent = '';
      for (let i = 1; i < n; i++) {
        const pair = el('div', { class: 'be-pair' }, add), label = el('span', { class: 'be-pair-label' }, pair); label.textContent = 'Strands ' + i + '–' + (i + 1);
        for (const sgn of [1, -1]) button(genText(sgn * i), pair, () => insert(sgn * i), { class: 'be-gen', 'data-sign': sgn, 'aria-label': 'Add ' + genText(sgn * i) });
      }
      lastB.disabled = clearB.disabled = mirrorB.disabled = !word.length;
    }
    return { render, setMode, get word() { return word.slice(); }, get n() { return n; } };
  }

  const api = { diagram, componentOf, mount, genText, COL, ROW, PAD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BraidEditor = api;
})(typeof window !== 'undefined' ? window : globalThis);
