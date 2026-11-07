/* Braid workspace history and saved display preferences. No DOM dependencies. */
(function (root) {
  'use strict';
  const KEY = 'twisted-toroids-braid-style';
  function normalize(value) {
    const v = value && typeof value === 'object' ? value : {};
    return {
      width: Number.isFinite(v.width) ? Math.max(0.5, Math.min(1.4, v.width)) : 1,
      colors: Array.from({ length: 10 }, (_, i) => /^#[\da-f]{6}$/i.test(v.colors?.[i]) ? v.colors[i] : null)
    };
  }
  function load(storage) { try { return normalize(JSON.parse(storage.getItem(KEY))); } catch (_) { return normalize(); } }
  function save(storage, value) { try { storage.setItem(KEY, JSON.stringify(normalize(value))); } catch (_) {} }
  function history(limit = 80) {
    let entries = [], cursor = -1;
    const copy = b => ({ n: b.n, word: b.word.slice() });
    const same = (a, b) => a && a.n === b.n && a.word.length === b.word.length && a.word.every((g, i) => g === b.word[i]);
    return {
      record(b) {
        if (same(entries[cursor], b)) return;
        entries = entries.slice(0, cursor + 1); entries.push(copy(b));
        if (entries.length > limit) entries.shift();
        cursor = entries.length - 1;
      },
      undo() { return cursor > 0 ? copy(entries[--cursor]) : null; },
      redo() { return cursor < entries.length - 1 ? copy(entries[++cursor]) : null; },
      get canUndo() { return cursor > 0; },
      get canRedo() { return cursor >= 0 && cursor < entries.length - 1; }
    };
  }
  const api = { KEY, normalize, load, save, history };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BraidControls = api;
})(typeof window !== 'undefined' ? window : globalThis);
