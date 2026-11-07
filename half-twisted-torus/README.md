# Half-Twisted Torus

An interactive model by Mac Mayo. A painted torus is cut through the tube, one end is turned, and the ends are glued back together. The model shows that the surface keeps its inside and outside, while the paint joins into stripes that need extra laps to come home.

## Open it

Double-click `index.html`. It opens in any modern browser and runs offline. Everything is in that one file: no install, no build step, no 3D library and no WebGL. It draws with the browser's 2D canvas. The Google Fonts link is optional; without a connection the page falls back to system fonts.

## Controls

- **Tube cross-section:** round, oval, egg, triangle, square, pentagon, hexagon, heptagon, octagon, star, cross, rectangle, diamond, heart, 3-, 4- or 6-point star, gear, or a flat strip with 2 or 3 lanes (a true Möbius band at odd half turns).
- **Turn the cut end by:** presets from no twist to 4 full turns.
- **Step buttons:** add or subtract the smallest turn that fits the current shape (1/n of a turn for an n-sided shape, star or cross; ½ for the oval; ¼ for round; ½ for the rectangle and diamond; a whole turn for the egg and heart, which have no turning symmetry).
- **Build from a flat sheet:** plays the construction: a painted sheet rolls into a tube, then the tube bends into the ring while one end turns by the chosen twist. The slider scrubs through it by hand (sheet, tube, torus).
- **Grow from the shape:** starts with just the cross-section, which sweeps once around the loop, turning by the chosen twist, and leaves the tube behind it.
- **Cut along the color lines:** slices along every color boundary and pulls the pieces apart, coloring each resulting strip in one color. The readout predicts how many strips you get, how many times each goes around, whether it is knotted (a strip going around q times while turning p times is a (q, p) torus knot), and whether the strips are linked.
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

## Code layout

All code is inside `index.html`:

- `<style>`: design tokens for light and dark themes, then layout.
- `<script>`:
  - `SHAPES` and `section()` define each cross-section and its paint.
  - `buildMesh()` and `updatePositions()` build the twisted tube. For the build animation, `updatePositions()` unrolls the cross-section using an arc-length table (`arc`), rolls it by scaling its turning angle, then bends the straight tube into the ring along a circular arc while turning the far end.
  - `analysis()`, `updateReadouts()` and `updateHud()` compute and show the counts.
  - `render()` is a painter's-algorithm renderer: it sorts the tube's quads, the trail and the traveler by depth and draws them back to front.
  - `frame()` is the animation loop.
