"""Check experiments exported from the twisted-torus model with SnapPy / Spherogram.

Two kinds of experiment are checked: twisted-torus constructions, and arbitrary
braids entered in the page's "Any braid" mode. For a braid this script checks
the strand count, linking matrix, blackboard framings (from the ribbon braid),
and each knotted component's Alexander polynomial against the Euler
characteristic of its knot Floer homology, then names the link with SnapPy's
census lookup where it can.

The model exports each construction as a braid word whose closure is the set of
stripes left after cutting along the color lines, plus a "ribbon braid" that also
carries one edge of every stripe (so a stripe's framing is the linking number of
its core with that edge). This script recomputes, independently of the model:

  * the braid word, from the construction alone
  * the number of stripes (link components)
  * the linking number of every pair of stripes
  * each stripe's Seifert genus (knot Floer homology), against the torus knot claimed
  * each stripe's framing, from the ribbon braid

Sub-links are taken by deleting strands from the braid, so every number comes
from Spherogram's own computation on a closed braid.

Usage:
  pip install snappy
  python verify.py experiment.json [more.json ...]
  python verify.py --sweep        # every shape preset, twists -2..2 turns (a few minutes)
  python verify.py --sweep --max-turns 1
  python verify.py --random 40      # random braids, claims from knotmath.js (needs node)
"""
import argparse
import itertools
import json
import os
import random
import subprocess
import sys
import warnings
from fractions import Fraction

warnings.filterwarnings('ignore')
import snappy  # noqa: F401  (registers SnapPy with Spherogram)
import spherogram

CONVENTION = 'braid_closure; +i is a positive crossing of strands i, i+1'


# ---------- braids from the construction ----------
def delta(n):
    return list(range(1, n))


def half_twist(n):
    return [i for j in range(1, n) for i in range(j, 0, -1)]


def power(word, e):
    base = word if e >= 0 else [-g for g in reversed(word)]
    return base * abs(e)


def braid_word(kind, n, steps):
    if n < 2:
        return []
    return power(delta(n) if kind == 'ring' else half_twist(n), steps)


def permutation(n, word):
    at = list(range(n))
    for g in word:
        i = abs(g) - 1
        at[i], at[i + 1] = at[i + 1], at[i]
    perm = [0] * n
    for pos, strand in enumerate(at):
        perm[strand] = pos
    return perm


def cycles(perm):
    seen, out = set(), []
    for i in range(len(perm)):
        if i in seen:
            continue
        c, j = [], i
        while j not in seen:
            seen.add(j)
            c.append(j)
            j = perm[j]
        out.append(c)
    return out


def keep_strands(n, word, keep):
    """The sub-braid on the strands that start at positions in `keep`."""
    keep = set(keep)
    at = list(range(n))
    out = []
    for g in word:
        i = abs(g) - 1
        a, b = at[i], at[i + 1]
        if a in keep and b in keep:
            out.append((1 if g > 0 else -1) * (1 + sum(1 for p in range(i) if at[p] in keep)))
        at[i], at[i + 1] = b, a
    return len(keep), out


# ---------- invariants via Spherogram ----------
def closure(word, strands):
    """Spherogram link for the closure of `word` on `strands` strands."""
    # Spherogram drops strands that take part in no crossing, so start with the
    # identity s1 s1^-1 s2 s2^-1 ... which touches every strand.
    pad = [g for i in range(1, strands) for g in (i, -i)]
    return spherogram.Link(braid_closure=pad + list(word))


def components(word, strands):
    if strands == 1:
        return 1
    return len(closure(word, strands).link_components)


def lk(n, word, A, B):
    m, w = keep_strands(n, word, list(A) + list(B))
    if not w:
        return 0
    return closure(w, m).linking_matrix()[0][1]


def genus(n, word, comp):
    m, w = keep_strands(n, word, comp)
    if m < 2 or not w:
        return 0
    K = closure(w, m)
    K.simplify('global')
    if not K.crossings:
        return 0
    return K.knot_floer_homology()['seifert_genus']


def alexander_hfk(n, word, comp):
    """Alexander polynomial of one component, from knot Floer homology (lowest degree first)."""
    m, w = keep_strands(n, word, comp)
    if m < 2 or not w:
        return [1]
    K = closure(w, m)
    K.simplify('global')
    if not K.crossings:
        return [1]
    ranks = K.knot_floer_homology()['ranks']
    coeffs = {}
    for (a, mas), r in ranks.items():
        coeffs[a] = coeffs.get(a, 0) + (-1) ** (mas % 2) * r
    lo, hi = min(coeffs), max(coeffs)
    c = [coeffs.get(e, 0) for e in range(lo, hi + 1)]
    while c and c[-1] == 0:
        c.pop()
    while c and c[0] == 0:
        c.pop(0)
    if c and c[-1] < 0:
        c = [-x for x in c]
    return c


def blackboard_ribbon(word):
    out = []
    for g in word:
        i, s = abs(g), (1 if g > 0 else -1)
        out += [s * 2 * i, s * (2 * i - 1), s * (2 * i + 1), s * 2 * i]
    return out


def identify(word, strands):
    try:
        names = closure(word, strands).exterior().identify()
    except Exception:
        return None
    # prefer the Rolfsen / link-table style names
    for nm in names:
        t = str(nm).split('(')[0]
        if '_' in t and not t.startswith(('m', 's', 'v', 't', 'o', 'K')):
            return t
    return str(names[0]).split('(')[0] if names else None


def check_braid(exp):
    c = exp['construction']
    n, word = c['strands'], c['word']
    problems = []
    if word != exp['braid']['word'] or n != exp['braid']['strands']:
        problems.append('braid word differs from the construction')
    if any(abs(g) < 1 or abs(g) >= n for g in word):
        problems.append('generator out of range for %d strands' % n)
        return problems, None
    if blackboard_ribbon(word) != exp['ribbonBraid']['word']:
        problems.append('ribbon braid differs from the blackboard double of the word')

    comps = cycles(permutation(n, word))
    claimed = exp['components']
    got = components(word, n)
    if got != len(claimed) or len(comps) != len(claimed):
        problems.append('components: Spherogram %d, model %d' % (got, len(claimed)))
    by_strands = {tuple(sorted(cm['braidStrands'])): cm for cm in claimed}
    order = [by_strands.get(tuple(sorted(cc))) for cc in comps]
    if None in order:
        problems.append('component strands do not match the braid permutation')
        return problems, None
    idx = [claimed.index(cm) for cm in order]
    M = exp['linkingMatrix']
    for a, b in itertools.combinations(range(len(comps)), 2):
        v = lk(n, word, comps[a], comps[b])
        if v != M[idx[a]][idx[b]]:
            problems.append('lk(%d, %d): Spherogram %s, model %s' % (idx[a], idx[b], v, M[idx[a]][idx[b]]))
    rword = blackboard_ribbon(word)
    rcomp = {p: tuple(cc) for cc in cycles(permutation(2 * n, rword)) for p in cc}
    for cc, cm in zip(comps, order):
        f = lk(2 * n, rword, rcomp[2 * cc[0]], rcomp[2 * cc[0] + 1])
        if f != cm['framing']:
            problems.append('component %s framing: Spherogram %s, model %s' % (cc, f, cm['framing']))
        a = alexander_hfk(n, word, cc)
        if a != cm['alexander']:
            problems.append('component %s Alexander: knot Floer %s, model %s' % (cc, a, cm['alexander']))
    if len(comps) == 1 and exp.get('alexander') is not None and exp['alexander'] != order[0]['alexander']:
        problems.append('whole-link Alexander differs from the knot\'s')
    name = identify(word, n)
    return problems, name


def torus_genus(q, p):
    q, p = abs(q), abs(p)
    return 0 if q < 2 or p < 2 else (q - 1) * (p - 1) // 2


# ---------- checking one experiment ----------
def check(exp):
    c = exp['construction']
    kind, n, steps = c['kind'], c['pieces'], c['steps']
    problems = []

    word = braid_word(kind, n, steps)
    if word != exp['braid']['word']:
        problems.append('braid word differs from the construction')
    rn = 2 * n if kind == 'ring' else 2 * n + 1
    rword = braid_word(kind, rn, 2 * steps if kind == 'ring' else steps)
    if rword != exp['ribbonBraid']['word']:
        problems.append('ribbon braid word differs from the construction')

    comps = cycles(permutation(n, word))
    claimed = exp['components']
    if components(word, n) != len(claimed) or len(comps) != len(claimed):
        problems.append('stripe count: Spherogram %d, model %d' % (components(word, n), len(claimed)))

    by_strands = {tuple(sorted(cm['braidStrands'])): cm for cm in claimed}
    order = [by_strands.get(tuple(sorted(cc))) for cc in comps]
    if None in order:
        problems.append('stripe strands do not match the braid permutation')
        return problems

    # linking matrix
    M = exp['linkingMatrix']
    idx = [claimed.index(cm) for cm in order]
    for a, b in itertools.combinations(range(len(comps)), 2):
        got = lk(n, word, comps[a], comps[b])
        want = M[idx[a]][idx[b]]
        if got != want:
            problems.append('lk(stripe %d, stripe %d): Spherogram %s, model %s' % (idx[a], idx[b], got, want))

    # each stripe: genus and framing
    rcomps = cycles(permutation(rn, rword))
    comp_of = {p: tuple(cc) for cc in rcomps for p in cc}
    cores, edges = exp['ribbonBraid']['cores'], exp['ribbonBraid']['edges']
    for cc, cm in zip(comps, order):
        if 'alexander' in cm and alexander_hfk(n, word, cc) != cm['alexander']:
            problems.append('stripe %s Alexander: knot Floer %s, model %s' % (cm['pieces'], alexander_hfk(n, word, cc), cm['alexander']))
        g = genus(n, word, cc)
        if g != torus_genus(cm['laps'], cm['turns']):
            problems.append('stripe %s genus: Spherogram %d, T(%d,%d) has %d' % (cm['pieces'], g, cm['laps'], cm['turns'], torus_genus(cm['laps'], cm['turns'])))
        lane = cm['pieces'][0]
        core, edge = comp_of[cores[lane]], comp_of[edges[lane]]
        if len(edge) != len(core):
            if cm['framing'] is not None:
                problems.append('stripe %s is one-sided but has a framing' % cm['pieces'])
            continue
        f = lk(rn, rword, core, edge)
        if f != cm['framing']:
            problems.append('stripe %s framing: Spherogram %s, model %s' % (cm['pieces'], f, cm['framing']))
    return problems


# ---------- a sweep without the browser ----------
SHAPES = {  # name: (kind, pieces, symmetry); mirrors SHAPES in index.html
    'circle': ('ring', 2, 0), 'oval': ('ring', 2, 2), 'egg': ('ring', 2, 1), 'tri': ('ring', 3, 3),
    'square': ('ring', 4, 4), 'pent': ('ring', 5, 5), 'hex': ('ring', 6, 6), 'hept': ('ring', 7, 7),
    'oct': ('ring', 8, 8), 'gear': ('ring', 8, 8), 'band2': ('line', 2, 2), 'band3': ('line', 3, 2),
}


def sweep(max_turns=2):
    """Every preset shape and twist from -max_turns to max_turns turns, checked against closed-form torus link facts."""
    bad = 0
    total = 0
    for name, (kind, n, sym) in SHAPES.items():
        unit = Fraction(1, sym) if sym else Fraction(1, 4)
        for j in range(-int(max_turns / unit), int(max_turns / unit) + 1):
            turn = j * unit
            x = turn * (n if kind == 'ring' else 2)
            if x.denominator != 1:
                continue
            steps = int(x)
            word = braid_word(kind, n, steps)
            comps = cycles(permutation(n, word))
            total += 1
            problems = []
            if components(word, n) != len(comps):
                problems.append('component count')
            for cc in comps:
                laps = len(cc)
                centre = kind == 'line' and n % 2 == 1 and cc[0] == (n - 1) // 2
                turns = 0 if centre else steps * laps // (n if kind == 'ring' else 2)
                if genus(n, word, cc) != torus_genus(laps, turns):
                    problems.append('genus of %s' % cc)
            for A, B in itertools.combinations(comps, 2):
                # parallel (q, p) curves on one torus link q*p times; in a line, an inner
                # stripe links an outer one (outer turns) x (inner laps) times
                la, lb = len(A), len(B)
                if kind == 'ring':
                    want = la * (steps * la // n)
                else:
                    ra = abs(min(A) - (n - 1) / 2)
                    rb = abs(min(B) - (n - 1) / 2)
                    ta, tb = steps * la // 2, steps * lb // 2
                    want = la * ta if ra == rb else (ta * lb if ra > rb else tb * la)
                if lk(n, word, A, B) != want:
                    problems.append('lk %s %s' % (A, B))
            status = 'ok' if not problems else 'FAIL ' + '; '.join(problems)
            if problems:
                bad += 1
            print('%-7s turn %-5s braid on %d strands, %d stripes: %s' % (name, turn, n, len(comps), status))
    print('%d constructions, %d failures' % (total, bad))
    return bad


HERE = os.path.dirname(os.path.abspath(__file__))


def knotmath_claims(cases):
    """Ask knotmath.js (via node) to describe each braid, shaped like an exported experiment."""
    js = (
        "const K=require(%s);const cases=JSON.parse(require('fs').readFileSync(0,'utf8'));"
        "console.log(JSON.stringify(cases.map(([n,w])=>{const d=K.describeBraid(n,w);return {"
        "construction:{type:'braid',strands:n,word:w},braid:d.braid,ribbonBraid:d.ribbonBraid,"
        "components:d.components.map(c=>({braidStrands:c.braidStrands,laps:c.laps,framing:c.framing,alexander:c.alexander})),"
        "linkingMatrix:d.linking,alexander:d.alexander};})));"
    ) % json.dumps(os.path.join(HERE, '..', 'knotmath.js'))
    out = subprocess.run(['node', '-e', js], input=json.dumps(cases), capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def random_braids(count, seed=1):
    rng = random.Random(seed)
    cases = []
    for _ in range(count):
        n = rng.randint(2, 5)
        w = [rng.choice([-1, 1]) * rng.randint(1, n - 1) for _ in range(rng.randint(1, 12))]
        cases.append([n, w])
    bad = 0
    for exp in knotmath_claims(cases):
        problems, name = check_braid(exp)
        c = exp['construction']
        status = 'ok' if not problems else 'FAIL ' + '; '.join(problems)
        bad += bool(problems)
        print('%d strands %-40s %-8s %s' % (c['strands'], str(c['word']), name or '', status))
    print('%d random braids, %d failures' % (count, bad))
    return bad


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('files', nargs='*', help='experiment JSON files exported from the model')
    ap.add_argument('--sweep', action='store_true', help='check every preset construction')
    ap.add_argument('--random', type=int, default=0, metavar='N', help='check N random braids against knotmath.js (needs node)')
    ap.add_argument('--max-turns', type=Fraction, default=Fraction(2), help='sweep twists up to this many turns each way (default 2; 1 is much faster)')
    args = ap.parse_args()
    if not args.files and not args.sweep and not args.random:
        ap.print_help()
        return 2
    failures = sweep(args.max_turns) if args.sweep else 0
    if args.random:
        failures += random_braids(args.random)
    for path in args.files:
        with open(path) as f:
            exp = json.load(f)
        c = exp['construction']
        if c.get('type') == 'braid':
            problems, name = check_braid(exp)
            head = '%s: braid %s on %d strands' % (path, c['word'], c['strands'])
            k = len(exp['components'])
            summary = '%d component%s%s' % (k, '' if k == 1 else 's', ', SnapPy names it ' + name if name else '')
        else:
            problems = check(exp)
            head = '%s: %s, turn %s' % (path, c['shape'], c['turn'])
            k = len(exp['components'])
            summary = '%d stripe%s, braid on %d strands' % (k, '' if k == 1 else 's', exp['braid']['strands'])
        if problems:
            failures += 1
            print(head + ': FAIL')
            for p in problems:
                print('  - ' + p)
        else:
            print(head + ': ok (' + summary + ')')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
