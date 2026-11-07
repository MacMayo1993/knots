# Half-Twisted Torus

An interactive model by Mac Mayo. A painted torus is cut through the tube, one end is turned, and the ends are glued back together. The model shows that the surface keeps its inside and outside, while the paint joins into stripes that need extra laps to come home.

## Open it

Double-click `index.html`. It opens in any modern browser and runs offline. There is no install, no build step, no 3D library and no WebGL. The page loads one helper script, `knotmath.js`, from the same folder. It draws with the browser's 2D canvas. The Google Fonts link is optional; without a connection the page falls back to system fonts.

## Controls

- **Tube cross-section:** round, oval, egg, triangle, square, pentagon, hexagon, heptagon, octagon, star, cross, rectangle, diamond, heart, 3-, 4- or 6-point star, gear, or a flat strip with 2 or 3 lanes (a true Möbius band at odd half turns).
- **Turn the cut end by:** presets from no twist to 4 full turns.
- **Step buttons:** add or subtract the smallest turn that fits the current shape (1/n of a turn for an n-sided shape, star or cross; ½ for the oval; ¼ for round; ½ for the rectangle and diamond; a whole turn for the egg and heart, which have no turning symmetry).
- **Build from a flat sheet:** plays the construction: a painted sheet rolls into a tube, then the tube bends into the ring while one end turns by the chosen twist. The slider scrubs through it by hand (sheet, tube, torus).
- **Grow from the shape:** starts with just the cross-section, which sweeps once around the loop, turning by the chosen twist, and leaves the tube behind it.
- **Cut along the color lines:** slices along every color boundary and pulls the pieces apart, coloring each resulting strip in one color. The readout predicts how many strips you get, how many times each goes around, whether it is knotted (a strip going around q times while turning p times is a (q, p) torus knot), and whether the strips are linked.
- **Exact description:** the braid whose closure is the set of strips you get by cutting, each strip's laps, turns, knot type and framing, and the linking matrix. You can copy the braid word, copy a link that reopens this construction (`index.html#shape=tri&turn=2/3`), download the experiment as JSON, or load a saved one.
- **Paint colors:** one color picker per painted half or face of the current shape. Your choices are remembered in your browser; **Reset colors** restores the defaults.
- **Pause / Send a traveler:** a dot rides one stripe until it gets home.
- **Show the cut:** the dashed ring where the tube was sliced.
- Drag or use the arrow keys to rotate; scroll to zoom.

## What the readouts mean

- **Sides of the surface:** always 2. Turning the tube never swaps inside and outside.
- **Cut ends fit back together:** an n-sided end only fits at 1/n-turn steps.
- **Painted pieces:** with n pieces shifted s places at the cut, the paint forms gcd(s, n) stripes.
- **Laps for a line to come home:** a twist of p/q of a turn needs q laps.
- **Turns around the tube per trip home:** the stripe's linking number with the tube's core circle, a whole number no motion in space can change.

## Exact descriptions and checking them

Each construction carries a set of points on the cross-section once around the core while the cross-section turns. Read as a braid, that gives:

- **Closed cross-sections** with `n` painted pieces and a twist of `s/n` of a turn: `δ^s`, where `δ = σ1 σ2 … σ(n-1)`. Its closure is the torus link `T(n, s)`.
- **Flat strips** with `n` lanes and `h` half turns: `Δ^h`, where `Δ` is the half twist.

Generator `+i` is a positive crossing of strands `i` and `i+1`, which is the convention SnapPy and Spherogram use for `braid_closure`. A positive twist in the model gives positive generators. `knotmath.js` reads the strips, the linking matrix and each strip's framing off the braid word itself. It does not use the model's readout formulas, so the two act as checks on each other. The framing comes from a second "ribbon" braid that also carries one edge of every strip. A strip's framing is the linking number of its center line with that edge.

A downloaded experiment records the construction, every operation since the page opened, both braid words, the strips and the linking matrix.

Two independent checks:

- `node test/geometry.test.mjs` samples the model's actual curves for every shape and for twists of up to 2 turns each way. It compares Gauss-integral linking numbers with the braid-derived linking matrices and framings. This also confirms the sign convention.
- `python verify/verify.py <experiment.json …>` (after `pip install snappy`) rebuilds the braid from the construction alone. It then uses Spherogram to count the strips and compute the linking numbers and framings, and it checks each strip's genus against the claimed torus knot using knot Floer homology. Run `python verify/verify.py --sweep` to check every preset shape with twists of up to 2 turns each way. That takes a few minutes; add `--max-turns 1` for a run of about 10 seconds. `verify/examples/` holds experiments exported from the page.

## Code layout

- `knotmath.js`: braid words, reading a braid (components, linking matrix, writhe), and `describe()` for a construction. Works as a browser script (`window.KnotMath`) and as a Node module.
- `test/geometry.test.mjs`, `verify/verify.py`: the checks above.

Everything else is inside `index.html`:

- `<style>`: design tokens for light and dark themes, then layout.
- `<script>`:
  - `SHAPES` and `section()` define each cross-section and its paint.
  - `buildMesh()` and `updatePositions()` build the twisted tube. For the build animation, `updatePositions()` unrolls the cross-section using an arc-length table (`arc`), rolls it by scaling its turning angle, then bends the straight tube into the ring along a circular arc while turning the far end.
  - `analysis()`, `updateReadouts()` and `updateHud()` compute and show the counts.
  - `updateExact()`, `experiment()` and `applyConstruction()` handle the exact description, the export, links and loading.
  - `render()` is a painter's-algorithm renderer: it sorts the tube's quads, the trail and the traveler by depth and draws them back to front.
  - `frame()` is the animation loop.
