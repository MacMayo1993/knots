/* Small, valid constructions for the exploration menus. No DOM dependencies. */
(function (root) {
  'use strict';
  const LEVELS = {
    simple: { strands: [2, 3], crossings: [3, 7] },
    varied: { strands: [3, 5], crossings: [8, 12] },
    intricate: { strands: [4, 6], crossings: [13, 18] }
  };
  const pick = (values, rng) => values[Math.floor(rng() * values.length)];
  const integer = (range, rng) => range[0] + Math.floor(rng() * (range[1] - range[0] + 1));
  const gcd = (a, b) => b ? gcd(b, a % b) : a;

  function turns(shape) {
    const n = shape.colors.length;
    // Both the cross-section AND its painted boundaries must match at the seam.
    // A round section has arbitrary geometric symmetry, but only n paint slots.
    const divisor = shape.open ? 2 : shape.sym ? gcd(shape.sym, n) : n;
    const crossingsPerStep = shape.open ? n * (n - 1) / 2 : n / divisor * (n - 1);
    const limit = Math.min(2 * divisor, Math.floor(48 / crossingsPerStep));
    return Array.from({ length: 2 * limit + 1 }, (_, i) => (i - limit) / divisor);
  }
  function toroid(shapes, current, twistOnly = false, rng = Math.random) {
    const shape = twistOnly ? current.shape : pick(Object.keys(shapes).filter(s => s !== current.shape), rng);
    const choices = turns(shapes[shape]).filter(t => !twistOnly || Math.abs(t - current.turn) > 1e-9);
    return { shape, turn: pick(choices, rng) };
  }
  function braid(level = 'varied', current = null, rng = Math.random) {
    const spec = LEVELS[level] || LEVELS.varied;
    const n = integer(spec.strands, rng), count = integer(spec.crossings, rng), word = [];
    // Use every adjacent strand pair at least once. Shuffle that first pass so
    // the starting pattern is not always a staircase, then add random crossings.
    const pairs = Array.from({ length: n - 1 }, (_, i) => i + 1);
    while (pairs.length) {
      const i = Math.floor(rng() * pairs.length);
      word.push(pairs.splice(i, 1)[0] * (rng() < .5 ? -1 : 1));
    }
    const generators = Array.from({ length: 2 * (n - 1) }, (_, i) => i < n - 1 ? i + 1 : -(i - n + 2));
    while (word.length < count) word.push(pick(generators.filter(g => g !== -word[word.length - 1]), rng));
    // A repeat click changes the word even with a deterministic/repeating RNG.
    if (current && current.n === n && current.word.length === count && word.every((g, i) => g === current.word[i]))
      return { n, word: word.map(g => -g) };
    return { n, word };
  }
  const api = { LEVELS, turns, toroid, braid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ToroidRandomizer = api;
})(typeof window !== 'undefined' ? window : globalThis);
