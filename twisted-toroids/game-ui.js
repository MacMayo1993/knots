/* The game layer drawn over Twisted Toroids: the player bar (level, experience, stars,
   menu), the active-quest tracker, the quest board, toasts for achievements and new
   knots, the quest-clear screen, the title screen, the menu, the trophy room, sound
   effects (synthesized with Web Audio, no files) and vibration on phones that have it.

   ToroidGameUI.init(options) returns { emit, stage, select, showTitle, state }.
   options: { G (game.js), storage, quests: [{ id, kind, title, goal }], tableSize,
              showTitle, hooks: { openTab(name), select(id), start(id), check(), hint(),
              braidLab(), play() } }
   The rules live in game.js; this file only draws them and plays the feedback. */
(function (root) {
  'use strict';
  const doc = root.document;
  const WORLDS = { torus: ['🍩', 'Torus Forge'], braid: ['🧶', 'Braid Lab'], lab: ['🗺️', 'Cut Explorer'] };
  const STAGES = { torus: ['World 1', 'Torus Forge'], braid: ['World 2', 'Braid Lab'], explore: ['World 3', 'Cut Explorer'], klein: ['World 3', 'Klein Bottle'] };
  const TITLE_KEY = 'twisted-toroids-title-seen';
  const svg = (d, size = 22) => '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const ICON = {
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    star: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>',
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18),
    bulb: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z"/>', 18),
    play: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>',
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 20)
  };
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const coarse = () => !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);

  function init(opts) {
    const G = opts.G, storage = opts.storage, quests = opts.quests || [], hooks = opts.hooks || {};
    const Q = quests.length, tableSize = opts.tableSize || 0;
    let state = G.load(storage);
    const save = () => G.save(storage, state);

    // ---------- sound: tiny synthesized cues ----------
    let ctx = null;
    function audio() {
      if (!state.settings.sound) return null;
      try {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return null;
        ctx = ctx || new AC();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
      } catch (_) { return null; }
    }
    function tone(freq, dur, o = {}) {
      const a = audio(); if (!a) return;
      const t = a.currentTime + (o.at || 0), osc = a.createOscillator(), g = a.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + o.slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.gain || 0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(a.destination);
      osc.start(t); osc.stop(t + dur + 0.02);
    }
    const SFX = {
      tap: () => tone(740, 0.045, { type: 'triangle', gain: 0.025 }),
      open: () => { tone(520, 0.07, { type: 'triangle', gain: 0.03 }); tone(780, 0.08, { type: 'triangle', gain: 0.03, at: 0.05 }); },
      badge: () => [659, 880, 1175].forEach((f, i) => tone(f, 0.16, { type: 'triangle', gain: 0.05, at: i * 0.08 })),
      discover: () => [988, 1319, 1568, 1976].forEach((f, i) => tone(f, 0.12, { type: 'sine', gain: 0.045, at: i * 0.055 })),
      clear: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'square', gain: 0.03, at: i * 0.1 })); tone(1047, 0.5, { type: 'triangle', gain: 0.05, at: 0.42 }); },
      level: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { type: 'square', gain: 0.03, at: i * 0.09 })),
      nope: () => { tone(220, 0.14, { type: 'sawtooth', gain: 0.025, slide: -70 }); tone(165, 0.18, { type: 'sawtooth', gain: 0.025, at: 0.12, slide: -50 }); }
    };
    // ---------- vibration (Android phones such as the Pixel; others ignore it) ----------
    const canBuzz = !!(root.navigator && typeof root.navigator.vibrate === 'function');
    function buzz(p) { if (canBuzz && state.settings.haptics) try { root.navigator.vibrate(p); } catch (_) {} }
    const HAPTIC = { tap: 7, badge: [18, 40, 28], discover: [12, 30, 12, 30, 24], clear: [30, 50, 30, 50, 90], level: [40, 40, 40, 40, 140], nope: [45, 35, 45] };
    function feedback(kind) { (SFX[kind] || (() => {}))(); buzz(HAPTIC[kind] || 0); }
    // Every button press clicks and taps, like a game's menus.
    doc.addEventListener('pointerdown', e => {
      const t = e.target && e.target.closest && e.target.closest('button, summary, [role="tab"], .quest-card, .be-hit');
      if (!t || t.disabled) return;
      feedback('tap');
    }, { capture: true, passive: true });

    // ---------- player bar ----------
    const bar = doc.getElementById('gameBar');
    if (bar) {
      bar.innerHTML =
        '<button type="button" class="gb-player" id="gbPlayer"><span class="gb-level" id="gbLevel"><span id="gbLevelNum">1</span></span>' +
        '<span class="gb-meta"><span class="gb-rank" id="gbRank"></span><span class="gb-xp" aria-hidden="true"><i id="gbXp"></i></span></span></button>' +
        '<span class="gb-stage" id="gbStage"><span class="gb-kicker" id="gbKicker"></span><span class="gb-title" id="gbTitle"></span></span>' +
        '<button type="button" class="gb-stars" id="gbStars" aria-label="Quests">' + ICON.star + '<span id="gbStarCount">0</span></button>' +
        '<button type="button" class="gb-menu" id="gbMenu" aria-label="Menu" aria-haspopup="dialog">' + ICON.menu + '</button>';
      bar.hidden = false;
      bar.querySelector('#gbPlayer').addEventListener('click', () => openTrophies('badges'));
      bar.querySelector('#gbStars').addEventListener('click', () => { hooks.openTab && hooks.openTab('quests'); });
      bar.querySelector('#gbMenu').addEventListener('click', openMenu);
    }
    let lastXp = -1;
    function renderBar() {
      if (!bar) return;
      const S = G.summary(state, Q, tableSize);
      bar.querySelector('#gbLevelNum').textContent = S.level;
      bar.querySelector('#gbLevel').style.setProperty('--p', String(S.into / S.need));
      bar.querySelector('#gbRank').textContent = S.rank;
      bar.querySelector('#gbXp').style.width = Math.round(100 * S.into / S.need) + '%';
      bar.querySelector('#gbStarCount').textContent = S.stars + '/' + S.maxStars;
      bar.querySelector('#gbStars').setAttribute('aria-label', 'Quests: ' + S.stars + ' of ' + S.maxStars + ' stars');
      bar.querySelector('#gbPlayer').setAttribute('aria-label', 'Level ' + S.level + ', ' + S.rank + ', ' + S.into + ' of ' + S.need + ' experience to the next level. Open trophies.');
      if (lastXp >= 0 && S.xp > lastXp) { bar.classList.remove('gb-gain'); void bar.offsetWidth; bar.classList.add('gb-gain'); }
      lastXp = S.xp;
    }
    let stageKey = '';
    function stage(key) {
      if (!bar || key === stageKey) return;
      stageKey = key;
      const [kicker, title] = STAGES[key] || STAGES.torus;
      bar.querySelector('#gbKicker').textContent = kicker;
      bar.querySelector('#gbTitle').textContent = title;
      bar.dataset.stage = key;
    }

    // ---------- quest tracker: the active quest, with Check and Hint at hand ----------
    const tracker = doc.getElementById('questTracker');
    if (tracker) {
      tracker.innerHTML = '<button type="button" class="qt-open" id="qtOpen" aria-label="Show the quest"><span class="qt-icon" aria-hidden="true">🎯</span><span class="qt-text"><span class="qt-kicker">Quest</span><span class="qt-title" id="qtTitle"></span></span></button>' +
        '<button type="button" class="qt-hint" id="qtHint" aria-label="Show a hint (costs a star)">' + ICON.bulb + '</button>' +
        '<button type="button" class="qt-check" id="qtCheck">' + ICON.check + '<span>Check</span></button>';
      tracker.querySelector('#qtOpen').addEventListener('click', () => {
        const a = state.attempt;
        if (a) { select(a.id); if (hooks.select) hooks.select(a.id); }
        if (hooks.openTab) hooks.openTab('quests');
      });
      tracker.querySelector('#qtHint').addEventListener('click', () => hooks.hint && hooks.hint());
      tracker.querySelector('#qtCheck').addEventListener('click', () => hooks.check && hooks.check());
    }
    function renderTracker() {
      if (!tracker) return;
      const a = state.attempt, q = a && !a.done && quests.find(x => x.id === a.id);
      const show = !!q;
      if (tracker.hidden === show) tracker.hidden = !show;
      if (q) { tracker.querySelector('#qtTitle').textContent = q.title; tracker.querySelector('#qtOpen').setAttribute('aria-label', 'Quest: ' + q.title + '. Show its goal'); }
      if (opts.onLayout) opts.onLayout();
    }

    // ---------- quest board ----------
    const board = doc.getElementById('questBoard');
    let selected = quests[0] && quests[0].id;
    function renderBoard() {
      if (!board) return;
      const S = G.summary(state, Q, tableSize);
      board.textContent = '';
      const head = el('div', 'qb-head', '<span class="qb-stars">' + ICON.star + '<b>' + S.stars + '</b> / ' + S.maxStars + '</span><span class="qb-cleared">' + S.cleared + ' of ' + Q + ' cleared</span>');
      board.appendChild(head);
      let n = 0;
      for (const kind of Object.keys(WORLDS)) {
        const list = quests.filter(q => q.kind === kind);
        if (!list.length) continue;
        const sec = el('section', 'qb-world');
        sec.appendChild(el('h3', 'qb-world-title', '<span aria-hidden="true">' + WORLDS[kind][0] + '</span> ' + esc(WORLDS[kind][1])));
        const grid = el('div', 'qb-grid');
        for (const q of list) {
          n++;
          const stars = state.quests[q.id] ? state.quests[q.id].stars : 0;
          const active = state.attempt && !state.attempt.done && state.attempt.id === q.id;
          const card = el('button', 'quest-card');
          card.type = 'button';
          card.dataset.quest = q.id;
          card.dataset.stars = String(stars);
          card.setAttribute('aria-pressed', String(q.id === selected));
          card.setAttribute('aria-label', 'Quest ' + n + ': ' + q.title + '. ' + (stars ? stars + ' of 3 stars' : 'not cleared') + (active ? ', in progress' : ''));
          card.innerHTML = '<span class="qc-num" aria-hidden="true">' + n + '</span><span class="qc-title">' + esc(q.title) + '</span>' +
            '<span class="qc-stars" aria-hidden="true">' + [0, 1, 2].map(i => '<i class="' + (i < stars ? 'on' : '') + '">' + ICON.star + '</i>').join('') + '</span>' +
            (active ? '<span class="qc-badge">Playing</span>' : !stars ? '<span class="qc-badge qc-new">New</span>' : '');
          card.addEventListener('click', () => { select(q.id); hooks.select && hooks.select(q.id); });
          grid.appendChild(card);
        }
        sec.appendChild(grid);
        board.appendChild(sec);
      }
    }
    function select(id) {
      selected = id;
      if (!board) return;
      board.querySelectorAll('.quest-card').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.quest === id)));
    }

    // ---------- toasts ----------
    const toasts = el('div', 'game-toasts');
    toasts.setAttribute('role', 'status'); toasts.setAttribute('aria-live', 'polite');
    // A manual popover sits in the top layer, so a toast shows above an open dialog
    // (a badge earned by clearing a quest appears over the quest-clear screen).
    const layered = typeof toasts.showPopover === 'function';
    if (layered) toasts.setAttribute('popover', 'manual');
    doc.body.appendChild(toasts);
    function raiseToasts() {
      if (!layered) return;
      try { if (toasts.matches(':popover-open')) toasts.hidePopover(); toasts.showPopover(); } catch (_) {}
    }
    const queue = []; let showing = false;
    function toast(t) { queue.push(t); if (!showing) nextToast(); }
    function nextToast() {
      const t = queue.shift();
      if (!t) { showing = false; return; }
      showing = true;
      const node = el('div', 'toast toast-' + t.kind,
        '<span class="toast-icon" aria-hidden="true">' + esc(t.icon || '★') + '</span><span class="toast-text"><span class="toast-kicker">' + esc(t.kicker) + '</span><span class="toast-title">' + esc(t.title) + '</span>' +
        (t.text ? '<span class="toast-sub">' + esc(t.text) + '</span>' : '') + '</span>' + (t.xp ? '<span class="toast-xp">+' + t.xp + ' XP</span>' : ''));
      toasts.appendChild(node);
      raiseToasts();
      if (t.sound) feedback(t.sound);
      const life = t.life || 2600;
      root.setTimeout(() => node.classList.add('toast-out'), life);
      root.setTimeout(() => {
        node.remove();
        if (!queue.length && layered) try { toasts.hidePopover(); } catch (_) {}
        nextToast();
      }, life + (reduced() ? 0 : 260));
    }

    // ---------- confetti ----------
    function confetti(amount = 120) {
      if (reduced()) return;
      const c = el('canvas', 'game-confetti'); c.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(c);
      const W = c.width = root.innerWidth, H = c.height = root.innerHeight, g = c.getContext('2d');
      if (!g) { c.remove(); return; }
      const colors = ['#ffd23f', '#ff5d8f', '#4ce0ff', '#7c5cff', '#3ee08f', '#ff8a3d'];
      const parts = Array.from({ length: amount }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.32, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 13 - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[Math.floor(Math.random() * colors.length)] }));
      const t0 = performance.now();
      (function tick(now) {
        const t = (now - t0) / 1000;
        g.clearRect(0, 0, W, H);
        for (const p of parts) {
          p.vy += 0.42; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
          g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - t / 2.2);
          g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
          g.restore();
        }
        if (t < 2.2) root.requestAnimationFrame(tick); else c.remove();
      })(t0);
    }

    // ---------- dialogs ----------
    function dialog(id, cls) {
      const d = el('dialog', 'game-dialog ' + cls); d.id = id;
      d.addEventListener('click', e => { if (e.target === d && !d.dataset.sticky) d.close(); });   // tap outside the card
      doc.body.appendChild(d);
      return d;
    }
    function open(d) { if (d.open) return; try { d.showModal(); } catch (_) { d.setAttribute('open', ''); } feedback('open'); }

    // quest clear
    const clear = dialog('questClear', 'quest-clear');
    function showClear(r) {
      const q = quests.find(x => x.id === r.id), next = quests.find(x => !(state.quests[x.id] && state.quests[x.id].stars === 3) && x.id !== r.id);
      clear.innerHTML = '<div class="gd-card qc-card"><p class="qc-kicker">' + (r.repeat ? 'Already cleared' : 'Quest clear!') + '</p>' +
        '<div class="qc-big-stars" aria-label="' + r.stars + ' of 3 stars">' + [0, 1, 2].map(i => '<i class="' + (i < r.stars ? 'on' : '') + '" style="--i:' + i + '">' + ICON.star + '</i>').join('') + '</div>' +
        '<h2 class="qc-name">' + esc(q ? q.title : '') + '</h2>' +
        '<p class="qc-why">' + (r.stars === 3 ? 'Perfect: no hints and no misses.' : (r.stars === 2 ? 'One star lost to a hint or a miss.' : 'Solve it again with no hint and no misses for three stars.')) + '</p>' +
        (r.xp ? '<p class="qc-xp">+' + r.xp + ' XP</p>' : '') +
        '<div class="gd-actions">' + (next ? '<button type="button" class="game-btn game-btn-go" id="qcNext">' + ICON.play + '<span>Next quest</span></button>' : '') +
        '<button type="button" class="game-btn game-btn-ghost" id="qcStay">Keep playing</button></div></div>';
      const nb = clear.querySelector('#qcNext');
      if (nb) nb.addEventListener('click', () => { clear.close(); select(next.id); hooks.start && hooks.start(next.id); });
      clear.querySelector('#qcStay').addEventListener('click', () => clear.close());
      open(clear);
      feedback('clear'); confetti(r.stars * 60);
      root.setTimeout(() => (nb || clear.querySelector('#qcStay')).focus(), 30);
    }

    // menu
    const menu = dialog('gameMenu', 'game-menu');
    const fsOK = () => !!(doc.fullscreenEnabled && doc.documentElement.requestFullscreen);
    function goFull() { if (fsOK() && !doc.fullscreenElement) doc.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); }
    let resetArmed = false;
    function renderMenu() {
      const S = G.summary(state, Q, tableSize);
      const sw = (id, label, on, icon) => '<button type="button" class="gm-row gm-switch" id="' + id + '" role="switch" aria-checked="' + on + '"><span class="gm-ico" aria-hidden="true">' + icon + '</span><span>' + label + '</span><i aria-hidden="true"></i></button>';
      menu.innerHTML = '<div class="gd-card gm-card"><div class="gd-top"><h2>Paused</h2><button type="button" class="gd-x" id="gmClose" aria-label="Resume">' + ICON.close + '</button></div>' +
        '<p class="gm-player">Level ' + S.level + ' · ' + esc(S.rank) + ' · ' + S.stars + '/' + S.maxStars + ' stars · ' + S.knots + (S.knots === 1 ? ' knot' : ' knots') + ' found</p>' +
        '<button type="button" class="game-btn game-btn-go gm-resume" id="gmResume">' + ICON.play + '<span>Resume</span></button>' +
        '<div class="gm-grid">' +
        '<button type="button" class="gm-tile" id="gmQuests"><span aria-hidden="true">🎯</span>Quests</button>' +
        '<button type="button" class="gm-tile" id="gmTrophies"><span aria-hidden="true">🏆</span>Trophies</button>' +
        '<button type="button" class="gm-tile" id="gmStyle"><span aria-hidden="true">🎨</span>Style</button>' +
        '<button type="button" class="gm-tile" id="gmLearn"><span aria-hidden="true">📖</span>How it works</button></div>' +
        (fsOK() ? '<button type="button" class="gm-row" id="gmFull"><span class="gm-ico" aria-hidden="true">⛶</span><span>' + (doc.fullscreenElement ? 'Leave full screen' : 'Full screen') + '</span></button>' : '') +
        sw('gmSound', 'Sound effects', state.settings.sound, '🔊') +
        (canBuzz ? sw('gmHaptics', 'Vibration', state.settings.haptics, '📳') : '') +
        '<button type="button" class="gm-row" id="gmTitle"><span class="gm-ico" aria-hidden="true">🏠</span><span>Title screen</span></button>' +
        '<button type="button" class="gm-row gm-danger" id="gmReset"><span class="gm-ico" aria-hidden="true">↺</span><span>' + (resetArmed ? 'Tap again to erase all progress' : 'Reset progress') + '</span></button></div>';
      const on = (id, f) => { const b = menu.querySelector('#' + id); if (b) b.addEventListener('click', f); };
      on('gmClose', () => menu.close()); on('gmResume', () => menu.close());
      on('gmQuests', () => { menu.close(); hooks.openTab && hooks.openTab('quests'); });
      on('gmTrophies', () => { menu.close(); openTrophies('badges'); });
      on('gmStyle', () => { menu.close(); hooks.openTab && hooks.openTab('style'); });
      on('gmLearn', () => { menu.close(); hooks.openTab && hooks.openTab('data'); });
      on('gmFull', () => { if (doc.fullscreenElement) doc.exitFullscreen().catch(() => {}); else goFull(); menu.close(); });
      on('gmSound', () => { state.settings.sound = !state.settings.sound; save(); renderMenu(); if (state.settings.sound) SFX.badge(); });
      on('gmHaptics', () => { state.settings.haptics = !state.settings.haptics; save(); renderMenu(); buzz(HAPTIC.badge); });
      on('gmTitle', () => { menu.close(); showTitle(); });
      on('gmReset', () => {
        if (!resetArmed) { resetArmed = true; renderMenu(); menu.querySelector('#gmReset').focus(); return; }
        const settings = state.settings; state = G.fresh(); state.settings = settings; resetArmed = false; save(); refresh(); renderMenu();
      });
    }
    function openMenu() { resetArmed = false; renderMenu(); open(menu); root.setTimeout(() => { const b = menu.querySelector('#gmResume'); if (b) b.focus(); }, 30); }

    // trophy room: badges and the knot collection
    const trophies = dialog('trophyRoom', 'trophy-room');
    function openTrophies(tab) {
      const S = G.summary(state, Q, tableSize);
      const badges = G.ACHIEVEMENTS.map(a => {
        const got = !!state.ach[a.id];
        return '<li class="tr-badge' + (got ? ' got' : '') + '"><span class="tr-ico" aria-hidden="true">' + (got ? a.icon : '🔒') + '</span><span class="tr-name">' + esc(a.title) + '</span><span class="tr-text">' + esc(a.text) + '</span><span class="tr-xp">' + (got ? 'Unlocked' : '+' + a.xp + ' XP') + '</span></li>';
      }).join('');
      const knots = Object.entries(state.knots).sort((a, b) => (a[1].special - b[1].special) || (a[1].crossings - b[1].crossings) || a[0].localeCompare(b[0]));
      const knotList = knots.length ? knots.map(([name, k]) => '<li class="tr-knot' + (k.special ? ' special' : '') + '"><span class="tr-knot-name">' + esc(k.label) + '</span>' + (k.seen.length >= 2 ? '<span class="tr-mirror" title="Both mirror images found">🪞</span>' : '') + '</li>').join('')
        : '<li class="tr-empty">Cut a twisted torus or draw a braid: every knot and link you make from the table is collected here.</li>';
      trophies.innerHTML = '<div class="gd-card tr-card"><div class="gd-top"><h2>Trophy room</h2><button type="button" class="gd-x" id="trClose" aria-label="Close">' + ICON.close + '</button></div>' +
        '<div class="tr-stats"><span><b>' + S.level + '</b>Level</span><span><b>' + S.achievements + '/' + S.achievementTotal + '</b>Badges</span><span><b>' + S.knots + '/' + tableSize + '</b>Knots</span><span><b>' + S.stars + '/' + S.maxStars + '</b>Stars</span></div>' +
        '<div class="tr-tabs" role="tablist"><button type="button" role="tab" id="trTabBadges" aria-selected="' + (tab === 'badges') + '">Badges</button><button type="button" role="tab" id="trTabKnots" aria-selected="' + (tab === 'knots') + '">Knot collection</button></div>' +
        (tab === 'badges' ? '<ul class="tr-badges">' + badges + '</ul>' : '<p class="tr-note">' + S.knots + ' of ' + tableSize + ' table knots and links found (prime knots to 10 crossings, links to 8). The unknot, unlinks and knot sums are bonus finds.</p><ul class="tr-knots">' + knotList + '</ul>') + '</div>';
      trophies.querySelector('#trClose').addEventListener('click', () => trophies.close());
      trophies.querySelector('#trTabBadges').addEventListener('click', () => openTrophies('badges'));
      trophies.querySelector('#trTabKnots').addEventListener('click', () => openTrophies('knots'));
      if (!trophies.open) open(trophies);
      root.setTimeout(() => trophies.querySelector(tab === 'badges' ? '#trTabBadges' : '#trTabKnots').focus(), 30);
    }

    // title screen
    const title = dialog('titleScreen', 'title-screen');
    title.dataset.sticky = '1';
    function showTitle() {
      const S = G.summary(state, Q, tableSize), started = S.xp > 0;
      title.innerHTML = '<div class="ts-wrap"><div class="ts-logo" aria-hidden="true"><span class="ts-ring"></span></div>' +
        '<h1 class="ts-title"><span>Twisted</span><span>Toroids</span></h1><p class="ts-tag">Twist it · cut it · tie the knot</p>' +
        (started ? '<p class="ts-player"><span class="ts-lv">LV ' + S.level + '</span>' + esc(S.rank) + ' · ' + ICON.star + S.stars + ' · ' + S.knots + (S.knots === 1 ? ' knot' : ' knots') + '</p>' : '') +
        '<div class="ts-actions"><button type="button" class="game-btn game-btn-go ts-play" id="tsPlay">' + ICON.play + '<span>' + (started ? 'Continue' : 'Play') + '</span></button>' +
        '<div class="ts-row"><button type="button" class="game-btn game-btn-alt" id="tsQuests"><span aria-hidden="true">🎯</span><span>Quests</span></button>' +
        '<button type="button" class="game-btn game-btn-alt" id="tsBraid"><span aria-hidden="true">🧶</span><span>Braid lab</span></button></div></div>' +
        '<div class="ts-toggles"><button type="button" class="ts-toggle" id="tsSound" aria-pressed="' + state.settings.sound + '">' + (state.settings.sound ? '🔊' : '🔈') + ' Sound</button>' +
        (canBuzz ? '<button type="button" class="ts-toggle" id="tsHaptics" aria-pressed="' + state.settings.haptics + '">📳 Vibration</button>' : '') + '</div>' +
        (coarse() && fsOK() ? '<p class="ts-foot">Play opens full screen. Hold your phone upright.</p>' : '<p class="ts-foot">Drag to spin the model. Every knot you make joins your collection.</p>') + '</div>';
      const leave = then => { title.close(); try { root.sessionStorage.setItem(TITLE_KEY, '1'); } catch (_) {} if (coarse()) goFull(); if (then) then(); };
      title.querySelector('#tsPlay').addEventListener('click', () => leave(hooks.play));
      title.querySelector('#tsQuests').addEventListener('click', () => leave(() => hooks.openTab && hooks.openTab('quests')));
      title.querySelector('#tsBraid').addEventListener('click', () => leave(hooks.braidLab));
      title.querySelector('#tsSound').addEventListener('click', () => { state.settings.sound = !state.settings.sound; save(); showTitle(); if (state.settings.sound) SFX.badge(); });
      const th = title.querySelector('#tsHaptics');
      if (th) th.addEventListener('click', () => { state.settings.haptics = !state.settings.haptics; save(); showTitle(); buzz(HAPTIC.badge); });
      // Escape (or Android back in a dialog) just starts playing
      title.oncancel = e => { e.preventDefault(); leave(hooks.play); };
      if (!title.open) { try { title.showModal(); } catch (_) { title.setAttribute('open', ''); } }
      root.setTimeout(() => title.querySelector('#tsPlay').focus(), 30);
    }

    // ---------- events ----------
    function emit(event) {
      const r = G.apply(state, event, Q);
      state = r.state; save();
      if (event.type === 'quest-check' && !event.pass) { toast({ kind: 'nope', icon: '🤔', kicker: 'Not yet', title: event.message || 'Keep going', life: 4200, sound: 'nope' }); }
      if (event.type === 'quest-hint') { toast({ kind: 'hint', icon: '💡', kicker: 'Hint · this attempt now earns at most two stars', title: event.hint || '', life: 7000 }); }
      for (const w of r.rewards) {
        if (w.kind === 'achievement') toast({ kind: 'badge', icon: w.icon, kicker: 'Achievement unlocked', title: w.title, text: w.text, xp: w.xp, sound: 'badge' });
        if (w.kind === 'discovery') toast({ kind: 'discover', icon: w.mirror ? '🪞' : w.special ? '✨' : '🧩', kicker: w.mirror ? 'Mirror image found' : w.special ? 'Bonus find' : 'New knot discovered', title: w.label, xp: w.xp, sound: 'discover' });
        if (w.kind === 'level-up') { toast({ kind: 'level', icon: '⬆️', kicker: 'Level up!', title: 'Level ' + w.level + ' · ' + w.rank, sound: 'level', life: 3200 }); confetti(70); }
        if (w.kind === 'quest-clear') showClear(w);
      }
      refresh();
      return r.rewards;
    }
    function refresh() { renderBar(); renderTracker(); renderBoard(); }
    refresh();
    stage('torus');
    if (opts.showTitle) showTitle();
    function note(text, kicker = 'Heads up') { toast({ kind: 'nope', icon: '👉', kicker, title: text, life: 3600 }); }
    return { emit, stage, select, showTitle, refresh, note, get state() { return state; } };
  }
  const api = { init, TITLE_KEY };
  root.ToroidGameUI = api;
})(typeof window !== 'undefined' ? window : globalThis);
