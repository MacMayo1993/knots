"""Regenerate knot-table.js from SnapPy's copy of the Rolfsen tables.

    pip install snappy
    python verify/make_knot_table.py          # from the twisted-toroids/ folder

For every prime knot up to 10 crossings and every prime link up to 8 crossings,
SnapPy supplies a braid word whose closure is that knot or link, and decides
whether a hyperbolic knot is amphichiral (its own mirror image) from the symmetry
group of its complement. The Jones and Alexander polynomials stored in the table
are then computed from those braid words by knotmath.js, the same code the page
uses; test/jones.test.cjs recomputes every one of them and checks them against
published values, so a stored value can't silently drift from the code.

The orientation and handedness of each entry are those of SnapPy's diagram. For a
chiral knot the page says "mirror image" when the braid drawn is the mirror of
that diagram, except for torus knots, which it calls right- or left-handed.
"""
import json
import os
import re
import subprocess
import sys
import warnings

warnings.filterwarnings('ignore')
import snappy  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ALIASES = {
    '3_1': 'trefoil', '4_1': 'figure-eight knot', '5_1': 'cinquefoil', '5_2': 'three-twist knot',
    '6_1': 'stevedore knot', '6_2': 'Miller Institute knot', '7_1': 'septafoil', '7_4': "endless knot",
    '8_19': 'T(3,4) torus knot', '9_1': 'T(2,9) torus knot', '10_124': 'T(3,5) torus knot',
    '2^2_1': 'Hopf link', '4^2_1': 'Solomon link', '5^2_1': 'Whitehead link', '6^2_1': 'T(2,6) torus link',
    '6^3_2': 'Borromean rings', '6^3_1': 'three-chain link', '6^3_3': 'T(3,3) torus link',
    '7^2_1': None, '8^2_1': 'T(2,8) torus link',
}
TORUS = {'3_1': (2, 3), '5_1': (2, 5), '7_1': (2, 7), '9_1': (2, 9), '8_19': (3, 4), '10_124': (3, 5)}
DUPLICATES = {'10_162': '10_161'}   # the Perko pair: one knot listed twice


def crossings(name):
    return int(re.match(r'\d+', name).group())


def main():
    rows = []
    for M in snappy.LinkExteriors:
        name = M.name()
        knot = re.fullmatch(r'\d+_\d+', name) is not None
        if knot and crossings(name) > 10:
            continue
        if not knot and crossings(name) > 8:
            continue
        if name in DUPLICATES:
            continue
        L = snappy.Link(name)
        word = L.braid_word()
        n = max(abs(g) for g in word) + 1
        amph = None
        if name in TORUS:
            amph = False
        else:
            try:
                amph = bool(snappy.Manifold(name).symmetry_group().is_amphicheiral())
            except Exception:
                amph = None
        rows.append({
            'name': name, 'kind': 'knot' if knot else 'link', 'crossings': crossings(name),
            'components': len(L.link_components), 'n': n, 'word': word,
            'alias': ALIASES.get(name), 'amphichiral': amph,
            'torus': list(TORUS[name]) if name in TORUS else None,
            'same': [k for k, v in DUPLICATES.items() if v == name],
        })
        print(name, end=' ', flush=True)
    print()
    script = os.path.join(HERE, 'knot_table_polys.cjs')
    out = subprocess.run(['node', script], input=json.dumps(rows), capture_output=True, text=True, check=True)
    with open(os.path.join(ROOT, 'knot-table.js'), 'w') as f:
        f.write(out.stdout)
    print('wrote knot-table.js with', len(rows), 'entries')


if __name__ == '__main__':
    sys.exit(main())
