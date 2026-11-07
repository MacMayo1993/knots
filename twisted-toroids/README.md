# Twisted Toroids

An interactive model by Mac Mayo. A painted torus is cut through the tube, one end is turned, and the ends are glued back together. The model shows that the surface keeps its inside and outside, while the paint joins into stripes that need extra laps to come home.

## Open it

Open the GitHub Pages site, or serve this folder locally and open the page:

```
python3 -m http.server 8000      # then visit http://localhost:8000/
```

The page draws with [Three.js](https://threejs.org) (WebGL 2), loaded as JavaScript modules. Browsers won't load modules from a double-clicked file, which is why it needs a server. There is no install and no build step. Three.js r186.1 is copied into `vendor/three/`, unmodified, so the page makes no requests to other sites. The only exception is the optional Google Fonts link; without a connection the page falls back to system fonts.

## On a phone

On a phone the model fills the screen and the controls live in a bottom sheet. You can drag the sheet's handle, tap it, or use its buttons to switch between four sizes:

- **Peek:** the sheet shrinks to its handle and title. In torus mode, a separate toolbar above the model shows the shape dropdown, twist −/+, current twist, Cut/Glue, **Build from sheet**, and **Grow from shape**. In braid mode the sheet keeps its braid word and Edit shortcut.
- **Half:** the model stays visible above the controls.
- **Full:** for reading the exact description and the notes, which move into the sheet on a phone.
- **Hidden:** a small *Controls* button reopens the sheet, while the top toolbar remains available in torus mode.

The top toolbar uses the same handlers as the full controls, including the shape-dependent twist step and the rules for valid cuts. Its dropdown contains all 20 cross-sections. Choosing a shape, changing the twist, cutting, or replaying either construction does not reopen the sheet. Build from sheet rolls and bends the painted sheet into the current toroid; Grow from shape sweeps the current cross-section around the loop. Either construction resets a cut and stops the other construction animation. The toolbar hides in Half/Full views and in braid/cut-explorer modes. The full-panel controls remain available there.

The model slides up, or left when the phone is on its side, so it stays centered in the space the sheet leaves free. With the top toolbar visible, its height and the readout are also reserved above the model. Until you zoom yourself, the camera pulls back so the whole torus fits. The sheet remembers its size on your device.

The full-screen button hides the browser bars where the browser allows it. iPhone Safari doesn't, but you can use *Add to Home Screen* there: the page includes a web app manifest and icons, so it opens full screen with no browser interface. On Android, *Install app* or *Add to Home screen* does the same.

## Controls

- **Appearance → Palettes & surface style:** choose Classic, Aurora, Sunset, Lagoon, Candy, or Bold. Preview swatches show all eight paint slots. Palettes apply to tubes, braid components, the reference cut explorer, and the linked flat map. Selecting a palette replaces custom paint; **Reset to palette colors** clears edits back to the selected palette. With customized palettes, traveler labels use piece numbers rather than inaccurate color names.
- **Background:** System follows the device, or choose Light / Dark explicitly. A subtle static stage gradient uses the paint colors. Theme color metadata follows the selected background.
- **Surface finish:** Matte, Satin (default), or Gloss changes the existing material's roughness/metalness. It adds no geometry, postprocessing, or animation. Palette and finish changes preserve cut geometry and component selection.

Appearance, paint edits, and the phone sheet size are saved on the device when storage is available. Existing saved paint and sheet preferences are read from the former keys. A blocked or malformed storage value falls back to defaults. Palettes are visual options, not a guarantee of color-vision accessibility; piece numbers and the existing solid/dashed selection routes remain available.

- **Model:** *Twisted torus* (everything below) or *Any braid*.
- **Any braid:** type a braid word and the page draws its closure as flat ribbons running around the loop, one color per component. Words can be written as `s1 S2` (a capital letter means the inverse), `σ1 σ2⁻¹`, `1 -2`, with `(…)^k` for powers. Strands default to one more than the largest generator; set the count higher to add free strands. Limits are 10 strands and 400 crossings. Example buttons load the trefoil, figure-eight, 5₂, 6₃, 8₁₈, Hopf link, Whitehead link and Borromean rings. *Start from the last torus construction* loads the braid of the current twisted torus so you can edit it.

- **Tube cross-section:** round, oval, egg, triangle, square, pentagon, hexagon, heptagon, octagon, star, cross, rectangle, diamond, heart, 3-, 4- or 6-point star, gear, or a flat strip with 2 or 3 lanes (a true Möbius band at odd half turns).
- **Turn the cut end by:** presets from no twist to 4 full turns.
- **Step buttons:** add or subtract the smallest turn that fits the current shape (1/n of a turn for an n-sided shape, star or cross; ½ for the oval; ¼ for round; ½ for the rectangle and diamond; a whole turn for the egg and heart, which have no turning symmetry).
- **Build from a flat sheet:** plays the construction: a painted sheet rolls into a tube, then the tube bends into the ring while one end turns by the chosen twist. The slider scrubs through it by hand (sheet, tube, torus).
- **Grow from the shape:** starts with just the cross-section, which sweeps once around the loop, turning by the chosen twist, and leaves the tube behind it.
- **Cut along the color lines:** slices along every color boundary and pulls the pieces apart while preserving the original paint. One connected strip can contain several original colors. The readout predicts how many strips you get, how many times each goes around, whether it is knotted (a strip going around q times while turning p times is a (q, p) torus knot), and whether the strips are linked.
- **Color by connected piece:** after cutting, optionally give each connected strip the color of its first original section. A legend lists the original sections belonging to each strip. Uncheck it to restore the original paint; gluing the model back also restores the paint. Custom paint colors and strip highlighting work in both views.
- **Exact description:** the braid whose closure is the set of strips you get by cutting (or the braid you typed), each strip's or component's laps, framing and knot data, the linking matrix, and the Alexander polynomial of the whole link. You can copy the braid word, copy a link that reopens this construction (`index.html#shape=tri&turn=2/3` or `index.html#braid=1,-2,1,-2&strands=3`), download the experiment as JSON, or load a saved one.
- **Paint colors:** one color picker per painted half or face of the current shape. Your choices are remembered in your browser; **Reset colors** restores the defaults.
- **Pause / Send a traveler:** a dot rides one stripe until it gets home.
- **Show the cut:** the dashed ring where the tube was sliced.
- Drag or use the arrow keys to rotate; scroll or pinch to zoom.
- **Follow a strip:** tap any strip on the model, or a line in the exact description's strip list. That strip or component keeps its color while the rest fade, and its full route is drawn: the centerline as a solid line and its edge as a dashed one, faintly where they pass behind the surface. The readout at the top says how many laps it takes, which knot it is, and its framing, the number of times the dashed edge winds around the solid centerline. Tap it again, tap empty space, or press Escape to clear.

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

Generator `+i` is a positive crossing of strands `i` and `i+1`, which is the convention SnapPy and Spherogram use for `braid_closure`. A positive twist in the model gives positive generators. `knotmath.js` reads the strips, the linking matrix and each strip's framing off the braid word itself. It does not use the model's readout formulas, so the two act as checks on each other. The framing comes from a second "ribbon" braid that also carries a parallel copy of every strip, pushed a little way across it. A strip's framing is the linking number of its center line with that copy. On a flat strip the copies sit inside each lane, never on the band's center line: that line lies on the axis the band turns about, so it closes after one lap even when the strip around it takes two.

Nontrivial torus knots are chiral: T(2, 3), the right-handed trefoil, and its mirror T(2, −3), the left-handed trefoil, are different knots. The readouts always name the handedness. A positive twist gives a positive braid, which closes to a right-handed torus knot.

**Any braid.** The page draws the closure of the braid you enter: strands sit side by side along the radius, and each generator gets an equal share of the loop, where strands `i` and `i+1` swap places by turning half a turn about their midpoint. The ribbons stay level, so each component's framing is its blackboard framing, which equals its writhe in the braid. This is a different framing from the torus surface framing that the twisted-torus strips use. For example, the trefoil `(σ1 σ2)²` has framing 6 as a strip on the torus and framing 4 as a level ribbon. The Alexander polynomial comes from the reduced Burau representation: `det(I − ρ(β)) / (1 + t + … + t^(n−1))`, computed exactly with whole-number coefficients. It is written as knot tables write it, with a constant lowest term and a positive leading coefficient. For a link with several components it is the one-variable polynomial, and it is 0 for a split link.

A downloaded experiment records the construction, every operation since the page opened, both braid words, the strips and the linking matrix.

Two independent checks:

- `node test/geometry.test.mjs` samples the model's actual curves for every shape and for twists of up to 2 turns each way. It compares Gauss-integral linking numbers with the braid-derived linking matrices and framings, and checks that exactly the Möbius center lanes are reported as one-sided. This also confirms the sign convention. The closed cross-sections are sampled as circles, which are isotopic to the drawn polygons and other shapes, so the test certifies the topology but not every rendered shape or animation frame.
- The geometry test also draws 35 braids the way the page does, five fixed and thirty random, and checks their linking numbers and blackboard framings against the braid word. It also checks the Burau Alexander polynomials of all the torus constructions against the closed formula for torus knots.
- `python verify/verify.py <experiment.json …>` (after `pip install snappy`) rebuilds the braid from the construction alone. It then uses Spherogram to count the strips and compute the linking numbers and framings, and it uses knot Floer homology to check each strip's genus against the claimed torus knot and its handedness with the τ invariant: τ equals the genus for a right-handed torus knot and minus the genus for a left-handed one. For a braid experiment it uses Spherogram to check the component count, linking numbers and blackboard framings. It checks each knotted component's Alexander polynomial against the Euler characteristic of its knot Floer homology, and prints SnapPy's name for the link when it can find one. For a link with several components, the whole-link polynomial is not checked independently, because that needs Sage. `python verify/verify.py --random 400` runs `knotmath.js` (through Node) on random braids and checks every claim the same way. Run `python verify/verify.py --sweep` to check every preset shape with twists of up to 2 turns each way. That takes about 8 minutes; add `--max-turns 1` for a run of about 10 seconds. `verify/examples/` holds experiments exported from the page.

## Explore: cuts, flat maps, and challenges

### Watching a cut

**Cut along the color lines** now runs a 3.6-second progressive cut. Visible tips advance along every paint boundary in both directions from the original gluing seam. Only material behind the tips opens; a short smooth transition lets each newly cut section separate. The opposite side stays joined until the cut arrives. The final ribbon positions are the same as before.

**Glue** reverses the same animation from its current position, including if pressed midway. The HUD reports progress, and the flat map uses moving dots and solid cut segments over the dashed paint boundaries. Selected centerlines and map points follow the same deforming surface. Entering the separate cut explorer pauses the original construction's cut until Return. Reduced-motion users get the finished state immediately.

The opening profile is periodic around the ring: its value at the end of one lap equals its value at the start of the next. This keeps the existing gluing intact while the cuts travel. The animation concerns the color-boundary cuts on the original tube/flat-band construction; the separate reference cut explorer still switches between its preset surfaces.

Animation checks:

```sh
node test/cut-animation.test.cjs
node test/app-smoke.cjs --animate --phone
node test/app-smoke.cjs --animate --phone --landscape
```

These check the actual timed frame loop, mid-cut reversal, untouched regions ahead of the cut, tip visibility and reused geometry, map/HUD updates, mode changes, and the glued seam on all 20 cross-sections at positive, zero, and negative twists. They supplement the reduced-motion integration cases; they do not replace real-device WebGL visual testing.

### Other experiments

The **Explore** fieldset lives near the top of the existing controls, including inside the phone bottom sheet. Its three disclosures keep the controls compact.

**Try different cuts** opens an independent round-torus surface. It retains the current painted construction for the Return button, including its shape, twist, paint, and cut setting. Choose an uncut reference, a meridian, a longitude, or a rectangular contractible loop. The cut meshes have duplicated boundary vertices and no end caps; their boundaries are highlighted from the actual triangle edges. Gaps and the upward translation of the disk are display deformations. The reference surface is a surface, not a solid torus.

| Cut | Connected pieces | Boundary loops | Euler characteristic |
| --- | --- | --- | --- |
| None | One torus | 0 | 0 |
| Meridian: around the tube | One annulus | 2 | 0 |
| Longitude: around the central hole | One annulus | 2 | 0 |
| Contractible patch loop | Disk + once-punctured torus | 1 on each | +1 and −1 |

Every piece is orientable. These preset cuts are on the reference torus; they do not yet implement freehand cutting of arbitrary painted shapes. Original construction readouts are hidden while the reference is displayed. On phones the quick bar becomes a Return button; choosing a cut from the full sheet lowers it to half so the model is visible.

**Open the linked flat map** shows the current closed tube's painted parameter domain. With horizontal coordinate `u = theta / (2π)` and vertical coordinate `v = phi / (2π) + 1/(2n)`, painted piece `p` occupies row `[p/n, (p+1)/n]`. The gluing is `(1,v) ~ (0,v + turn mod 1)` and `(u,0) ~ (u,1)`. The latter gluing is removed when the paint boundaries are cut. The reference cut explorer instead uses ordinary, untwisted torus coordinates and shows only its remaining edge identifications. This map is a parameter domain, not an isometric flattening.

Tap the map to highlight a component and locate a point in 3D, or tap the 3D surface to locate its nearest triangle vertex on the map. Points retain the clicked side of cut edges. Arrow keys move the map point; Escape or Clear map point clears it. Vertical swipes scroll the mobile sheet. The map is unavailable for braids, open flat strips, or unfinished build/twist animations. For a proposed gluing whose ends do not fit, the map explicitly labels that limitation. It redraws only when relevant state changes and its disclosure is open.

**Construction challenges** includes three tasks: make three ribbons; make two linked trefoil ribbons; build the left-handed mirror of the starting right-handed trefoil. Start loads a starting construction, Check evaluates the existing `KnotMath` result, and Hint explains the arithmetic. Solutions must be closed tubes with finished cuts. Feedback reports `gcd(n, n × turn)`, component knot types, and the linking number when there are two components. Solved challenges are counted for the current session. They are not a general-purpose knot-equivalence test. Starting a challenge replaces the current construction, as the button indicates; merely opening the disclosure does not.

Additional checks (from this directory):

```sh
node test/explore.test.cjs
node test/app-smoke.cjs
node test/app-smoke.cjs --phone
node test/app-smoke.cjs --phone --landscape
```

The topology test independently traverses the generated indexed triangle meshes to count connected components, boundary loops and Euler characteristics, and checks consistent orientation. It also tests map seam identifications and positive/negative challenge cases. The integration harness executes the application's actual script with DOM and renderer stand-ins, exercising cut restoration, paint, picking, maps, challenges, and desktop/phone sheet state. It does **not** test CSS layout or real WebGL rendering; those need a WebGL 2 browser. The existing geometry suite remains the independent check of the knot calculations.

## Code layout

- `vendor/three/`: Three.js r186.1 (MIT), with OrbitControls and the fat-line addons.
- `knotmath.js`: braid words, reading a braid (components, linking matrix, writhe), `describe()` for a torus construction, `parseBraid()`, `describeBraid()`, the Burau `alexander()` and `braidLayout()`, the geometry the page draws for a braid. Works as a browser script (`window.KnotMath`) and as a Node module.
- `explore.js`: cut meshes, flat-map coordinates, and challenge definitions/checks. Browser global `TorusExplore` or a Node module; no renderer dependencies.
- `appearance.js`: preset palettes, finishes, validation and persistence of appearance settings, and pre-paint application of the saved theme.
- `cut-animation.js`: the periodic spatial opening profile, moving cut-front coordinates, and reversible timing used by the surface and flat map.
- `test/explore.test.cjs`, `test/app-smoke.cjs`: topology/coordinate tests and application integration checks described above.
- `test/geometry.test.mjs`, `verify/verify.py`: the checks above.

Everything else is inside `index.html`:

- `<style>`: design tokens for light and dark themes, then layout.
- `<script>`:
  - `SHAPES` and `section()` define each cross-section and its paint.
  - `buildMesh()` and `updatePositions()` build the twisted tube. `surfacePoint()` is the finished model's formula for one point, and the highlighted routes use it too, so they sit exactly on the mesh. For the build animation, `updatePositions()` unrolls the cross-section using an arc-length table (`arc`), rolls it by scaling its turning angle, then bends the straight tube into the ring along a circular arc while turning the far end.
  - `analysis()`, `updateReadouts()` and `updateHud()` compute and show the counts.
  - `updateExact()`, `experiment()` and `applyConstruction()` handle the exact description, the export, links and loading.
  - `showBraid()` switches modes, and `buildBraidMesh()` turns `braidLayout()` into ribbons for the renderer.
  - The three.js scene section hands the mesh to WebGL (`syncSurface()` updates positions, normals and per-vertex colors only when they change) and draws the seam, traveler, build edges and selection lines as fat lines. `render()` updates those each frame.
  - `select()`, `torusRoute()` and `braidRoute()` handle following a strip.
  - The phone layout section runs the bottom sheet (`setSheet()`, dragging, the quick bar's `syncQuick()`) and `updateViewShift()`, which keeps the model centered and fitted above the sheet.
- `manifest.webmanifest` and `icons/`: the home-screen app (the icons are renders of the cut hexagon: two linked trefoil strips).
  - `frame()` is the animation loop.

## App name and compatibility

The app is **Twisted Toroids**, served from `twisted-toroids/`. Titles, mobile headers, installation metadata, documentation, and new experiment downloads use this name. New exports use `twisted-toroids/experiment`; previous experiment files still load because the importer reads their construction fields.

The former `half-twisted-torus/index.html` is a small redirect that preserves query strings and construction hashes. Its manifest remains available with the new name and launch URL. Both manifests retain the original installation ID and use repository scope so existing home-screen installations can follow the move. Browsers may update an installed app's displayed name on their own schedule.

Run `node test/appearance.test.cjs` for preference validation, legacy paint migration, and rename/redirect consistency checks. The app integration harness also exercises every preset, background, and finish through the actual handlers, checks cut/selection preservation, and checks saving/reloading. As documented above, the harness is not a real WebGL or CSS visual test.

