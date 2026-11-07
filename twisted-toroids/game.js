/* Game progress for Twisted Toroids: experience, levels, achievements, quest stars and
   the knot collection. Pure functions over a plain state object, so the rules can be
   tested in Node; game-ui.js draws them. No DOM or renderer dependencies.

   apply(state, event) returns { state, rewards }. Events come from the page:
     { type: 'op', op, value }                 an entry of the page's operation log
     { type: 'build-done' } / { type: 'grow-done' } / { type: 'mobius' } / { type: 'pull' }
     { type: 'surface-done', genus }           a Seifert surface finished building
     { type: 'discover', components, matches } a construction identified in the knot table
     { type: 'quest-start' | 'quest-hint', id } and { type: 'quest-check', id, pass }
   Rewards are what the player should be told about, in order:
     { kind: 'achievement', id, icon, title, text, xp }
     { kind: 'discovery', name, label, xp, mirror, special }
     { kind: 'quest-clear', id, stars, best, xp, first }
     { kind: 'level-up', level, rank } */
(function (root) {
  'use strict';
  const KEY = 'twisted-toroids-game';
  const RANKS = [[1, 'Novice Knotter'], [3, 'Apprentice'], [5, 'Ribbon Cutter'], [7, 'Knot Weaver'], [10, 'Topologist'], [14, 'Grandmaster']];
  const rankFor = level => RANKS.reduce((r, [at, name]) => level >= at ? name : r, RANKS[0][1]);
  // Level L needs 100 + 50 (L − 1) experience to reach level L + 1.
  function levelInfo(xp) {
    let level = 1, need = 100, left = Math.max(0, Math.floor(xp) || 0);
    while (left >= need) { left -= need; level++; need = 100 + 50 * (level - 1); }
    return { level, into: left, need, rank: rankFor(level), xp: Math.max(0, Math.floor(xp) || 0) };
  }
  const ACHIEVEMENTS = [
    { id: 'twist', icon: '🌀', title: 'Twister', text: 'Turn the cut end of a tube.', xp: 20 },
    { id: 'build', icon: '🧱', title: 'Architect', text: 'Watch a torus build from a flat sheet.', xp: 20 },
    { id: 'grow', icon: '🌱', title: 'Sweeper', text: 'Grow a tube from its cross-section.', xp: 20 },
    { id: 'cut', icon: '✂️', title: 'Snip!', text: 'Cut a torus along its color lines.', xp: 30 },
    { id: 'mobius', icon: '♾️', title: 'One-Sided', text: 'Make a Möbius band from a flat strip.', xp: 40 },
    { id: 'dice', icon: '🎲', title: 'Roll the Dice', text: 'Try a random toroid or braid.', xp: 15 },
    { id: 'braid', icon: '🧶', title: 'Weaver', text: 'Draw a closed braid.', xp: 20 },
    { id: 'convert', icon: '🔁', title: 'Shape Shifter', text: 'Turn cut ribbons into a braid.', xp: 30 },
    { id: 'trefoil', icon: '☘️', title: 'Tie the Trefoil', text: 'Make a trefoil knot.', xp: 40 },
    { id: 'mirror', icon: '🪞', title: 'Looking-Glass', text: 'Make a knot and its mirror image.', xp: 60 },
    { id: 'link', icon: '🔗', title: 'Linked Up', text: 'Make loops that cannot come apart.', xp: 40 },
    { id: 'rope', icon: '🪢', title: 'Rope Trick', text: 'Let a braid relax into rope.', xp: 30 },
    { id: 'pull', icon: '💪', title: 'Tug of War', text: 'Pull a rope into a new shape.', xp: 30 },
    { id: 'surface', icon: '🫧', title: 'Surface Tension', text: 'Finish building a Seifert surface.', xp: 50 },
    { id: 'klein', icon: '🍾', title: 'Bottle Episode', text: 'Open the Klein bottle.', xp: 40 },
    { id: 'cartographer', icon: '🗺️', title: 'Cartographer', text: 'Cut along a loop you drew.', xp: 40 },
    { id: 'stylist', icon: '🎨', title: 'Fresh Paint', text: 'Choose a new palette.', xp: 15 },
    { id: 'collector', icon: '📚', title: 'Collector', text: 'Discover 5 knots or links from the table.', xp: 80 },
    { id: 'curator', icon: '🏛️', title: 'Curator', text: 'Discover 15 knots or links from the table.', xp: 150 },
    { id: 'quest1', icon: '🎯', title: 'First Quest', text: 'Clear any quest.', xp: 30 },
    { id: 'questall', icon: '🏆', title: 'Quest Master', text: 'Clear every quest.', xp: 300 },
    { id: 'perfect', icon: '🌟', title: 'Perfectionist', text: 'Earn three stars on every quest.', xp: 500 }
  ];
  const BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
  const STAR_XP = 50;
  // Operation-log entries that unlock an achievement by themselves.
  const OP_ACHIEVEMENTS = { twist: 'twist', cut: 'cut', 'random toroid': 'dice', 'random braid': 'dice', braid: 'braid', 'edit diagram': 'braid', table: 'braid', 'cut to braid': 'convert', palette: 'stylist', 'lab loop': 'cartographer', relax: 'rope' };

  function fresh() {
    return { v: 1, xp: 0, ach: {}, knots: {}, quests: {}, attempt: null, settings: { sound: true, haptics: true } };
  }
  function normalize(s) {
    const out = fresh();
    if (!s || typeof s !== 'object') return out;
    out.xp = Number.isFinite(s.xp) && s.xp > 0 ? Math.floor(s.xp) : 0;
    if (s.ach && typeof s.ach === 'object') for (const [k, v] of Object.entries(s.ach)) if (BY_ID.has(k)) out.ach[k] = Number(v) || 1;
    if (s.knots && typeof s.knots === 'object') for (const [k, v] of Object.entries(s.knots)) {
      if (!v || typeof v !== 'object') continue;
      out.knots[k] = { label: String(v.label || k), seen: Array.isArray(v.seen) ? v.seen.map(String).slice(0, 4) : [], special: !!v.special, crossings: Number(v.crossings) || 0, components: Number(v.components) || 1 };
    }
    if (s.quests && typeof s.quests === 'object') for (const [k, v] of Object.entries(s.quests)) {
      const stars = Math.max(0, Math.min(3, Math.floor(v && v.stars) || 0));
      if (stars) out.quests[k] = { stars };
    }
    if (s.attempt && typeof s.attempt === 'object' && typeof s.attempt.id === 'string') out.attempt = { id: s.attempt.id, hints: Math.max(0, s.attempt.hints | 0), fails: Math.max(0, s.attempt.fails | 0), done: !!s.attempt.done };
    if (s.settings && typeof s.settings === 'object') { out.settings.sound = s.settings.sound !== false; out.settings.haptics = s.settings.haptics !== false; }
    return out;
  }
  function load(storage) {
    try { return normalize(JSON.parse(storage.getItem(KEY))); } catch (_) { return fresh(); }
  }
  function save(storage, state) {
    try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  const clone = s => JSON.parse(JSON.stringify(s));
  const tableCount = s => Object.values(s.knots).filter(k => !k.special).length;
  const totalStars = s => Object.values(s.quests).reduce((t, q) => t + q.stars, 0);
  const cleared = s => Object.keys(s.quests).length;

  // questCount: how many quests exist (for Quest Master and Perfectionist).
  function apply(state, event, questCount = 12) {
    const s = clone(normalize(state)), rewards = [], before = levelInfo(s.xp).level;
    const unlock = id => {
      const a = BY_ID.get(id);
      if (!a || s.ach[id]) return;
      s.ach[id] = 1; s.xp += a.xp;
      rewards.push({ kind: 'achievement', id, icon: a.icon, title: a.title, text: a.text, xp: a.xp });
    };
    const e = event || {};
    if (e.type === 'op') {
      if (OP_ACHIEVEMENTS[e.op]) unlock(OP_ACHIEVEMENTS[e.op]);
      if (e.op === 'lab surface' && e.value === 'klein') unlock('klein');
      if (e.op === 'challenge' && typeof e.value === 'string') s.attempt = { id: e.value, hints: 0, fails: 0, done: false };
    }
    if (e.type === 'build-done') unlock('build');
    if (e.type === 'grow-done') unlock('grow');
    if (e.type === 'mobius') unlock('mobius');
    if (e.type === 'pull') unlock('pull');
    if (e.type === 'surface-done') unlock('surface');
    if (e.type === 'lab' && e.surface === 'klein') unlock('klein');
    if (e.type === 'discover' && Array.isArray(e.matches) && e.matches.length === 1) {
      const m = e.matches[0], name = String(m.name), special = !!m.special;
      const known = s.knots[name], side = m.chirality === 'mirror' || m.chirality === 'as listed' ? m.chirality : '';
      if (!known) {
        const xp = special ? 10 : 25 + 5 * Math.max(0, Number(m.crossings) || 0);
        s.knots[name] = { label: String(m.label || name), seen: side ? [side] : [], special, crossings: Number(m.crossings) || 0, components: Number(e.components) || 1 };
        s.xp += xp;
        rewards.push({ kind: 'discovery', name, label: String(m.label || name), xp, mirror: false, special });
      } else if (side && !known.seen.includes(side)) {
        known.seen.push(side);
        if (known.seen.length >= 2) {
          s.xp += 15;
          rewards.push({ kind: 'discovery', name, label: String(m.label || name), xp: 15, mirror: true, special });
          unlock('mirror');
        }
      }
      if (/^3_1$/.test(name)) unlock('trefoil');
      if ((Number(e.components) || 1) >= 2 && name !== 'unlink') unlock('link');
      const n = tableCount(s);
      if (n >= 5) unlock('collector');
      if (n >= 15) unlock('curator');
    }
    if (e.type === 'quest-hint' && typeof e.id === 'string') {
      if (!s.attempt || s.attempt.id !== e.id) s.attempt = { id: e.id, hints: 0, fails: 0, done: false };
      if (!s.attempt.done) s.attempt.hints++;
    }
    if (e.type === 'quest-check' && typeof e.id === 'string') {
      if (!s.attempt || s.attempt.id !== e.id) s.attempt = { id: e.id, hints: 0, fails: 0, done: false };
      const a = s.attempt;
      if (!e.pass) { if (!a.done) a.fails++; }
      else {
        // An attempt is scored once; checking the same solution again repeats its stars.
        // Start the quest again (or pick another) for a new attempt.
        const stars = 1 + (a.hints ? 0 : 1) + (a.fails ? 0 : 1);
        const old = s.quests[e.id] ? s.quests[e.id].stars : 0, first = !old;
        const best = Math.max(old, stars), xp = a.done ? 0 : STAR_XP * (best - old);
        s.quests[e.id] = { stars: best };
        s.xp += xp;
        a.done = true;
        rewards.push({ kind: 'quest-clear', id: e.id, stars, best, xp, first, repeat: !xp && !first && stars <= old });
        unlock('quest1');
        if (cleared(s) >= questCount) unlock('questall');
        if (totalStars(s) >= 3 * questCount) unlock('perfect');
      }
    }
    const after = levelInfo(s.xp);
    if (after.level > before) rewards.push({ kind: 'level-up', level: after.level, rank: after.rank });
    return { state: s, rewards };
  }
  function summary(state, questCount = 12, tableSize = 0) {
    const s = normalize(state), L = levelInfo(s.xp);
    return Object.assign(L, { stars: totalStars(s), maxStars: 3 * questCount, cleared: cleared(s), quests: questCount,
      knots: tableCount(s), tableSize, achievements: Object.keys(s.ach).length, achievementTotal: ACHIEVEMENTS.length });
  }
  const api = { KEY, RANKS, ACHIEVEMENTS, STAR_XP, levelInfo, rankFor, fresh, normalize, load, save, apply, summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ToroidGame = api;
})(typeof window !== 'undefined' ? window : globalThis);
