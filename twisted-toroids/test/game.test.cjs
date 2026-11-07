// Game progress rules: levels, achievements, the knot collection, quest stars, and
// saved state that survives bad input.
//
// Run: node test/game.test.cjs
const assert = require('node:assert/strict');
const G = require('../game.js');
let checks = 0;
const ok = (c, m) => { checks++; assert(c, m); };
const eq = (a, b, m) => { checks++; assert.deepEqual(a, b, m); };

// levels: 100 to reach level 2, then 150, 200, ...
eq([0, 99, 100, 249, 250, 449, 450].map(x => G.levelInfo(x).level), [1, 1, 2, 2, 3, 3, 4], 'level thresholds');
eq(G.levelInfo(120), { level: 2, into: 20, need: 150, rank: 'Novice Knotter', xp: 120 }, 'progress within a level');
ok(G.levelInfo(-5).level === 1 && G.levelInfo(NaN).xp === 0, 'bad experience counts as none');
ok(G.rankFor(3) === 'Apprentice' && G.rankFor(14) === 'Grandmaster' && G.rankFor(99) === 'Grandmaster', 'ranks');
ok(new Set(G.ACHIEVEMENTS.map(a => a.id)).size === G.ACHIEVEMENTS.length, 'achievement ids are unique');
ok(G.ACHIEVEMENTS.every(a => a.icon && a.title && a.text && a.xp > 0), 'every achievement has an icon, title, text and experience');

// achievements unlock once, from operations or events
let s = G.fresh(), r;
r = G.apply(s, { type: 'op', op: 'twist', value: '1/2' }); s = r.state;
eq(r.rewards.map(x => x.kind + ':' + x.id), ['achievement:twist'], 'first twist');
ok(s.xp === 20, 'achievement experience');
r = G.apply(s, { type: 'op', op: 'twist', value: '1' }); eq(r.rewards, [], 'an achievement unlocks only once'); s = r.state;
for (const [op, id] of [['cut', 'cut'], ['random toroid', 'dice'], ['braid', 'braid'], ['cut to braid', 'convert'], ['palette', 'stylist'], ['lab loop', 'cartographer'], ['relax', 'rope']]) {
  r = G.apply(s, { type: 'op', op, value: 'x' }); s = r.state;
  ok(r.rewards.some(x => x.id === id), op + ' unlocks ' + id);
}
r = G.apply(s, { type: 'op', op: 'lab surface', value: 'torus' }); ok(!r.rewards.length, 'the torus is not the Klein bottle');
r = G.apply(s, { type: 'op', op: 'lab surface', value: 'klein' }); ok(r.rewards[0].id === 'klein', 'Klein bottle'); s = r.state;
for (const [type, id] of [['build-done', 'build'], ['grow-done', 'grow'], ['mobius', 'mobius'], ['pull', 'pull'], ['surface-done', 'surface']]) {
  r = G.apply(s, { type }); s = r.state; ok(r.rewards.some(x => x.id === id), type);
}

// the collection: new names, mirror images, specials, links
s = G.fresh();
const tags = rs => rs.filter(x => x.kind !== 'level-up').map(x => x.kind + ':' + (x.name || x.id));
const trefoil = side => ({ type: 'discover', components: 1, matches: [{ name: '3_1', label: side + ' trefoil (3₁)', chirality: side === 'right-handed' ? 'mirror' : 'as listed', crossings: 3 }] });
r = G.apply(s, trefoil('right-handed')); s = r.state;
eq(tags(r.rewards), ['discovery:3_1', 'achievement:trefoil'], 'a new knot and the trefoil badge');
ok(r.rewards[0].xp === 40 && !r.rewards[0].mirror, 'discovery experience grows with crossings');
r = G.apply(s, trefoil('right-handed')); eq(r.rewards, [], 'the same knot again earns nothing'); s = r.state;
r = G.apply(s, trefoil('left-handed')); s = r.state;
eq(tags(r.rewards), ['discovery:3_1', 'achievement:mirror'], 'the mirror image');
ok(r.rewards[0].mirror && r.rewards[0].xp === 15, 'mirror discovery is small');
r = G.apply(s, { type: 'discover', components: 1, matches: [{ name: '3_1', chirality: 'mirror' }, { name: '9_42', chirality: 'mirror' }] });
eq(r.rewards, [], 'an ambiguous match is not a discovery');
r = G.apply(s, { type: 'discover', components: 1, matches: [{ name: 'unknot', label: 'unknot', chirality: 'amphichiral', special: true }] }); s = r.state;
ok(r.rewards[0].special && r.rewards[0].xp === 10, 'the unknot is a special');
r = G.apply(s, { type: 'discover', components: 3, matches: [{ name: 'unlink', label: 'unlink', special: true }] }); s = r.state;
ok(!r.rewards.some(x => x.id === 'link'), 'an unlink is not linked');
r = G.apply(s, { type: 'discover', components: 2, matches: [{ name: '2^2_1', label: 'Hopf link', chirality: 'either', crossings: 2 }] }); s = r.state;
ok(r.rewards.some(x => x.id === 'link'), 'the Hopf link is linked');
for (const name of ['4_1', '5_1', '5_2']) { r = G.apply(s, { type: 'discover', components: 1, matches: [{ name, crossings: 5 }] }); s = r.state; }
ok(r.rewards.some(x => x.id === 'collector'), 'five table entries make a collector (specials do not count)');
eq(G.summary(s, 12, 296).knots, 5, 'collection count leaves out specials');

// quests: three stars without hints or failed checks; best result kept; experience per new star
s = G.fresh();
r = G.apply(s, { type: 'op', op: 'challenge', value: 'hopf' }); s = r.state;
eq(s.attempt, { id: 'hopf', hints: 0, fails: 0, done: false }, 'starting a quest');
r = G.apply(s, { type: 'quest-check', id: 'hopf', pass: true }); s = r.state;
const clear = r.rewards.find(x => x.kind === 'quest-clear');
eq([clear.stars, clear.best, clear.xp, clear.first], [3, 3, 150, true], 'a perfect clear');
ok(r.rewards.some(x => x.id === 'quest1') && s.attempt.done, 'first quest badge; the attempt is scored');
r = G.apply(s, { type: 'quest-hint', id: 'three' }); s = r.state;
r = G.apply(s, { type: 'quest-check', id: 'three', pass: false }); s = r.state;
r = G.apply(s, { type: 'quest-check', id: 'three', pass: true }); s = r.state;
eq(r.rewards.find(x => x.kind === 'quest-clear').stars, 1, 'a hint and a failed check cost a star each');
r = G.apply(s, { type: 'op', op: 'challenge', value: 'three' }); s = r.state;
r = G.apply(s, { type: 'quest-check', id: 'three', pass: false }); s = r.state;
r = G.apply(s, { type: 'quest-check', id: 'three', pass: true }); s = r.state;
const again = r.rewards.find(x => x.kind === 'quest-clear');
eq([again.stars, again.best, again.xp, again.first], [2, 2, 50, false], 'improving a quest pays only the new star');
r = G.apply(s, { type: 'quest-check', id: 'three', pass: true }); s = r.state;
const rep = r.rewards.find(x => x.kind === 'quest-clear');
eq([rep.stars, rep.xp, rep.repeat], [2, 0, true], 'checking the same solution again repeats its result and pays nothing');
r = G.apply(s, { type: 'quest-hint', id: 'three' }); r = G.apply(r.state, { type: 'quest-check', id: 'three', pass: false });
eq(r.state.attempt, s.attempt, 'a scored attempt does not change');
// every quest at three stars
s = G.fresh();
const ids = Array.from({ length: 12 }, (_, i) => 'q' + i);
for (const id of ids) { r = G.apply(s, { type: 'quest-check', id, pass: true }, 12); s = r.state; }
ok(r.rewards.some(x => x.id === 'questall') && r.rewards.some(x => x.id === 'perfect'), 'quest master and perfectionist');
const sum = G.summary(s, 12, 296);
eq([sum.stars, sum.maxStars, sum.cleared], [36, 36, 12], 'summary stars');
ok(sum.level > 1 && sum.achievements === 3, 'summary level and badges');

// level-up rewards come last
s = G.fresh(); s.xp = 95;
r = G.apply(s, { type: 'op', op: 'cut' });
eq(r.rewards.map(x => x.kind), ['achievement', 'level-up'], 'level up after the reward that caused it');
eq(r.rewards[1], { kind: 'level-up', level: 2, rank: 'Novice Knotter' }, 'level-up details');

// saved state: round trip, and junk is cleaned up
const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
ok(G.save(storage, s), 'save');
eq(G.load(storage), G.normalize(s), 'load what was saved');
store.set(G.KEY, '{not json');
eq(G.load(storage), G.fresh(), 'broken saves start fresh');
const junk = G.normalize({ xp: -3, ach: { twist: 1, nope: 1 }, quests: { a: { stars: 9 }, b: { stars: 0 } }, knots: { x: null, y: { label: 7 } }, settings: { sound: false } });
eq([junk.xp, Object.keys(junk.ach), junk.quests, Object.keys(junk.knots), junk.settings], [0, ['twist'], { a: { stars: 3 } }, ['y'], { sound: false, haptics: true }], 'normalize');
ok(G.load({ getItem() { throw new Error('denied'); } }).xp === 0, 'storage that throws');
ok(!G.save({ setItem() { throw new Error('full'); } }, s), 'a failed save reports false');
// apply never changes the state it was given
const frozen = Object.freeze(G.fresh());
G.apply(frozen, { type: 'op', op: 'cut' });
ok(frozen.xp === 0, 'apply is pure');

console.log('PASS: ' + checks + ' checks — levels and ranks, achievements once each, knot collection with mirror images and specials, quest stars and experience, level-up order, saved state.');
