# Twisted Toroids

An interactive model by Mac Mayo. A painted torus is cut through the tube, one end is turned, and the ends are glued back together. The model shows that the surface keeps its inside and outside, while the paint joins into stripes that need extra laps to come home.

## Open it

Open the GitHub Pages site, or serve this folder locally and open the page:

```
python3 -m http.server 8000      # then visit http://localhost:8000/
```

The page draws with [Three.js](https://threejs.org) (WebGL 2), loaded as JavaScript modules. Browsers won't load modules from a double-clicked file, which is why it needs a server. There is no install and no build step. Three.js r186.1 is copied into `vendor/three/`, unmodified, so the page makes no requests to other sites. The only exception is the optional Google Fonts link; without a connection the page falls back to system fonts.

## Playing it as a game

The page plays like a mobile game, while every lab control and readout stays where it was.

- **Title screen:** the first visit in a browser session opens on a title screen with the model spinning behind it. **Play** (or **Continue**) starts. On a phone it also enters full screen, hiding Chrome's address bar and Android's navigation bar. **Quests** opens the quest board and **Braid lab** switches to braid mode. Opening a shared link (`#shape=…`, `#braid=…`) skips the title.
- **Player bar:** your level, with an experience ring and bar, and your rank (Novice Knotter, Apprentice, Ribbon Cutter, Knot Weaver, Topologist, Grandmaster). Next to it are the world you are in (Torus Forge, Braid Lab, Cut Explorer or Klein Bottle), your stars and the menu. Tap the level to open the trophy room and the stars to open the quests.
- **Quests:** the 12 construction challenges, shown as cards grouped by world. Choose one and press **Start quest**. While a quest is active, a tracker over the model has **Check** and a hint button, so you don't need the sheet. A quest earns one star for solving it, one more if you used no hint and one more if no check missed. Your best result is kept. Checking the same solution again repeats its result without new experience.
- **Experience:** you earn it from badges, new knots and quest stars. Reaching level L + 1 from level L takes 100 + 50 (L − 1) experience.
- **Badges:** there are 22, for things like your first cut, a Möbius band, a trefoil, a knot and its mirror image, a finished Seifert surface, pulling a rope or opening the Klein bottle. Each one shows as a toast with its experience.
- **Knot collection:** any construction that matches exactly one knot or link in the table is collected, whether it comes from cutting a twisted torus or from drawing a braid. Picking a knot from the table's list doesn't count. Making the mirror image of a knot you already have earns a bonus. The unknot, unlinks and knot sums count as bonus finds outside the 296.
- **Menu:** resume, quests, trophies, style, how it works, full screen, sound effects and vibration switches, the title screen, and *Reset progress* (tap twice).
- **Feedback:** buttons click and, on Android phones such as the Pixel, give a short vibration. Badges, discoveries, quest clears and level-ups have their own sounds and vibration patterns, and quest clears and level-ups throw confetti. The sounds are synthesized with Web Audio, so there are no audio files. Reduced-motion settings turn off the confetti and animations.

Progress, stars, badges, the collection and the sound and vibration settings are saved on the device (`twisted-toroids-game` in local storage). The rules are in `game.js` and tested by `test/game.test.cjs`.

## On a phone

The layout is tuned for Pixel phones, from 360 px wide (Pixel 9 and 10) through 412 px (Pixel 6, 7 and 8) to 448 px (Pro XL). Safe-area insets keep it clear of the camera cut-out and the gesture bar. The model fills the screen. On top of it:

- **Top:** the player bar, then the active quest and the readout. On screens up to 412 px wide the bar drops the rank name, and the ring around the level number shows your experience.
- **Bottom, in thumb reach:** in torus mode, the control deck. It has the shape picker, the random-toroid die, twist −/+ with the current twist, a big **Cut**/**Glue** button, *Make into braid*, **Build from sheet** and **Grow from shape**. In braid mode, the views toolbar sits at the top as before.
- **Dock:** the sheet's handle is a row of tabs: **Play**, **Quests**, **Explore**, **Style** and **Data**. Each tab opens the sheet at that page only. Tapping the open tab lowers the sheet again, and the arrow keys move between tabs. Play and Data are disabled while the cut explorer is open, because their controls don't apply there. Anything that opens a control in the sheet, such as *Edit braid* or drawing on the flat map, switches to its page first.

The sheet still has four sizes: **Peek** (only the dock), **Half**, **Full** and **Hidden** (a *Controls* button brings it back). You can drag its handle, tap a tab or use the ⌃ and – buttons. It remembers its size and page. The deck rides on top of the sheet and hides when the sheet is half or fully open.

The camera keeps the model centered in the space between the top items and the deck or sheet. Until you zoom yourself, it pulls back so the whole model fits. On its side, the phone shows the readout and quick controls as a column down the left, the model to its right and the sheet on the right edge.

On Android, *Install app* or *Add to Home screen* installs it full screen, with no browser interface. The address bar and status bar take the game's colors. A long press on the home-screen icon offers shortcuts to **Quests** and **Braid lab**. iPhone Safari can't enter full screen, but *Add to Home Screen* opens the page full screen too.

## Controls

- **Appearance → Palettes & surface style:** choose Classic, Aurora, Sunset, Lagoon, Candy, or Bold. Preview swatches show all eight paint slots. Palettes apply to tubes, braid components, the reference cut explorer, and the linked flat map. Selecting a palette replaces custom paint; **Reset to palette colors** clears edits back to the selected palette. With customized palettes, traveler labels use piece numbers rather than inaccurate color names.
- **Background:** System follows the device, or choose Light / Dark explicitly. A subtle static stage gradient uses the paint colors. Theme color metadata follows the selected background.
- **Surface finish:** Matte, Satin (default), or Gloss changes the existing material's roughness/metalness. It adds no geometry, postprocessing, or animation. Palette and finish changes preserve cut geometry and component selection.

Appearance, paint edits, and the phone sheet size are saved on the device when storage is available. Existing saved paint and sheet preferences are read from the former keys. A blocked or malformed storage value falls back to defaults. Palettes are visual options, not a guarantee of color-vision accessibility; piece numbers and the existing solid/dashed selection routes remain available.

- **Model:** *Twisted torus* (everything below) or *Any braid*.
- **Cut → Make into braid:** after Cut along the color lines finishes, use Make into braid beside the cut controls (also available in the collapsed/hidden phone toolbar). It loads the exact closed braid of the cut pieces’ centerlines, preserving their knot/link types and linking matrix. Each connected component takes the color of its lowest-numbered painted section, even when that piece spans several colors. The braid uses its own flat ribbons: original widths, framing and Möbius nonorientability are not reproduced. Back to cut toroid restores the completed cut, original surface geometry, twist, and connected-piece color toggle; the Twisted torus mode button also returns there. Editing the braid changes its source notice so it no longer claims equivalence to the saved cut. The shortcut waits for construction/twist/cut animations and rejects nonclosing seams or braids beyond the editor's 400-crossing/10-strand limits. This saved return point lasts for the current session.
- **Any braid:** type a braid word, or build it in the diagram editor, and the page draws its closure as flat ribbons running around the loop, one color per component. Words can be written as `s1 S2` (a capital letter means the inverse), `σ1 σ2⁻¹`, `1 -2`, with `(…)^k` for powers. Strands default to one more than the largest generator; set the count higher to add free strands. Limits are 10 strands and 400 crossings. Example buttons load the trefoil, figure-eight, 5₂, 6₃, 8₁₈, Hopf link, Whitehead link and Borromean rings. *Start from the last torus construction* loads the braid of the current twisted torus so you can edit it. *Draw a knot or link from the table* draws any of the 249 prime knots up to 10 crossings or 47 prime links up to 8 crossings, from SnapPy's braid word for it.
- **Braid studio → Build & edit:** strands run left to right and colors identify components of the closure. Select a crossing before flipping or deleting it, or choose the direct *Tap flips* / *Tap deletes* tools. Insert a generator at the start, end, or before/after the selection. Strand −/+ supports 1–10 strands. Mirror reverses every crossing sign; Clear removes all crossings. Undo/redo covers diagram edits, typed words, strand changes, examples and table choices (up to 80 snapshots per session). Ctrl/⌘ Z and Ctrl/⌘ Shift Z work outside text inputs. Crossings have 46px targets; arrow keys move keyboard focus, Enter/Space activates the current tool, and Delete removes a crossing. A positive crossing is right-handed, so σ₁σ₁σ₁ is the right-handed trefoil.
- **Braid studio → Customize the model:** set ribbon width to 50–140% and choose a color independently for each component. Colors match in the diagram, ribbons, relaxed rope and Seifert boundary curves. Trace switches to ribbons and highlights that component. Preferences persist on the device; Reset braid style restores 100% width and colors from the current palette. Component numbers follow cycles of the braid permutation and can change after an edit. Width changes the displayed ribbon edges, leaving centerlines and all braid invariants unchanged. These display preferences are separate from the mathematical undo history and shared construction links. Palettes & finish opens the existing global appearance controls.
- **Pull:** grab a local section or a whole closed component with a mouse or one finger. The component picker can restrict the grab to one loop. Dragging tightens the surrounding rope; release holds the shape. Tighten/Pause controls continued relaxation. A white marker identifies the grabbed vertex, and a guide shows the pointer target when the rope resists. Pull starts from the rope: the shape Rope or an earlier pull left, held still, or the first time a new rope that tightens from where the ribbons were. Undo pull restores the preceding geometry (up to 16 gestures); Reset returns to the rope's settled starting shape (or, if it has not settled yet, tightens again from the braid). Escape or a cancelled touch restores the interrupted gesture. Choose Rope to rotate/zoom, then return to Pull. Changes are geometric: the braid word and link type remain unchanged, and linked loops cannot be pulled through one another. The pull adds forces before the same collision-limited integration step as relaxation. Extremely close approaches stop before floating-point roundoff can invalidate that bound; Undo or Reset restores room to try another direction. The display transform and camera stay fixed while dragging. Pull shapes are session-only; STL/PNG export captures the shape, while construction links/JSON retain the original braid description.
- **Views:** four buttons beside the model switch between **Ribbons**, **Rope** (the closed braid pulls tight like rope while its strands push each other apart, and settles into a smooth knot drawn as tubes; see *Relaxing a knot*), **Surface** (the Seifert surface, built step by step; see *Seifert surfaces*) and **Pull**. The rope belongs to the braid, not the view: Ribbons and Surface hide it but keep its shape, so Rope and Pull carry on where they left off; editing the braid starts a new rope. On desktop the buttons form a rail down the left side of the model, which is fitted to the space beside it; on a phone they are one row above the model, joined with the readout, and ⋯ opens Edit, Customize, Undo/Redo and the camera reset. *About the four views* in the panel explains each one.

- **Tube cross-section:** round, oval, egg, triangle, square, pentagon, hexagon, heptagon, octagon, star, cross, rectangle, diamond, heart, 3-, 4- or 6-point star, gear, or a flat strip with 2 or 3 lanes (a true Möbius band at odd half turns).
- **Turn the cut end by:** presets from no twist to 4 full turns.
- **Step buttons:** add or subtract the smallest turn that fits the current shape (1/n of a turn for an n-sided shape, star or cross; ½ for the oval; ¼ for round; ½ for the rectangle and diamond; a whole turn for the egg and heart, which have no turning symmetry).
- **Build from a flat sheet:** plays the construction: a painted sheet rolls into a tube, then the tube bends into the ring while one end turns by the chosen twist. The slider scrubs through it by hand (sheet, tube, torus).
- **Grow from the shape:** starts with just the cross-section, which sweeps once around the loop, turning by the chosen twist, and leaves the tube behind it.
- **Cut along the color lines:** slices along every color boundary and pulls the pieces apart while preserving the original paint. One connected strip can contain several original colors. The readout predicts how many strips you get, how many times each goes around, whether it is knotted (a strip going around q times while turning p times is a (q, p) torus knot), and whether the strips are linked.
- **Color by connected piece:** after cutting, optionally give each connected strip the color of its first original section. A legend lists the original sections belonging to each strip. Uncheck it to restore the original paint; gluing the model back also restores the paint. Custom paint colors and strip highlighting work in both views.
- **Exact description:** the braid whose closure is the set of strips you get by cutting (or the braid you typed), each strip's or component's laps, framing and knot data, the linking matrix, the Alexander and Jones polynomials of the whole link, its name in the knot table when it is there, and (for a braid) its Seifert surface's genus. You can copy the braid word, copy a link that reopens this construction (`index.html#shape=tri&turn=2/3` or `index.html#braid=1,-2,1,-2&strands=3`), download the experiment as JSON, or load a saved one.
- **Save picture (PNG)** saves the model as it is on screen. **Download for 3D printing (STL)** saves what is on screen as a printable solid (see *3D printing*).
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

## Naming knots: the Jones polynomial and the knot table

`knotmath.js` computes the Jones polynomial of any closed braid from the Kauffman bracket in the Temperley–Lieb algebra: each crossing σᵢ is `A·(straight through) + A⁻¹·(cup-cap)`, a state is a planar matching of the braid's endpoints, and closing the braid counts loops, each worth `δ = −A² − A⁻²`. Then `V(t) = (−A³)^(−writhe)·⟨closure⟩` at `A = t^(−1/4)`. Links with an even number of components have half-integer powers. The work grows with the number of strands, so a braid beyond a fixed budget reports *too large to compute here* instead of freezing the page (for example 8 strands with 112 crossings); results are cached.

A mirror image swaps `t` and `1/t`, so unlike the Alexander polynomial the Jones polynomial tells most knots from their mirror images: the right-handed trefoil σ₁³ has `t + t³ − t⁴`, the left-handed one `t⁻¹ + t⁻³ − t⁻⁴`.

`knot-table.js` is SnapPy's copy of the Rolfsen tables: 249 prime knots up to 10 crossings (10₁₆₁ and 10₁₆₂, the Perko pair, are one knot and listed once) and 47 prime links up to 8 crossings, each with a braid word and its Jones and Alexander polynomials. `verify/make_knot_table.py` regenerates it: SnapPy supplies the braid words and decides amphichirality from the symmetry group of each complement, and `knotmath.js` computes the polynomials, so the table and the page can't disagree.

A knot is matched by its exact Jones polynomial (or its mirror) and its Alexander polynomial; sums of two prime knots with ten crossings or fewer in all are matched too (granny and square knots). A link's Jones polynomial depends on the directions of its components, so a link is matched against every choice: reversing a set S of components multiplies `V` by `t^(−3·lk(S, rest))`. The readout says:

- *right-* or *left-handed* for torus knots (3₁, 5₁, 7₁, 9₁, 8₁₉, 10₁₂₄);
- *mirror image of* for other chiral knots, relative to the diagram in SnapPy's table;
- nothing extra for the 20 amphichiral knots (4₁, 6₃, 8₃, …), which are their own mirror images;
- *or its mirror image* for 9₄₂, 10₄₈, 10₇₁, 10₉₁, 10₁₀₄ and 10₁₂₅, chiral knots whose Jones polynomial is symmetric anyway.

A match means equal polynomials. Larger knots can share them (for example 10₁₃₂ shares both with 5₁, so σ₁⁵ lists both), so the page says *matches*, and lists every candidate when there is more than one.

Checks: `node test/jones.test.cjs` compares published values (trefoils, figure-eight, 5₁, 5₂, Hopf, Whitehead, Borromean), checks on random braids that Markov moves (conjugation, stabilization, braid relations) leave `V` unchanged, that `V(1) = (−2)^(components−1)`, that `|V(−1)|` equals the determinant `|Δ(−1)|` from the separate Burau code, and that mirroring gives `V(1/t)`, then recomputes every table entry and names it and its mirror. `python verify/verify.py --named 150` draws random braids until 150 have a table name and checks each against SnapPy's geometry: the complement of the closure must be isometric to the named knot's complement. For a knot that decides the knot up to mirror image (Gordon–Luecke). For a link it is a necessary condition, since different links can share a complement: 7²₈ and the Whitehead link do, and the page tells them apart by their Jones polynomials.

## Seifert surfaces

**Surface** (braid mode) draws the surface from Seifert's algorithm on the closed braid. Smoothing each crossing the oriented way leaves one circle per strand; each bounds a disk, the disks are stacked, and each crossing becomes a band with a half twist joining two neighbouring disks. The surface is orientable, so its two sides get two colors; its edge is the braid closure, drawn in the components' colors. With `n` strands and `c` crossings its Euler characteristic is `n − c` and the sum of the genera of its `k` connected surface pieces is `(2k − n + c − μ)/2`, where `μ` counts link components (boundary loops). For a connected surface, `k = 1`. If every generator appears with one sign only (a homogeneous braid), no surface with this edge has smaller genus (Stallings; Cromwell), so this is the knot's genus; otherwise the readout says *at most*. Neighbouring strands that never cross leave the surface in pieces (a split link).

`node test/seifert.test.cjs` walks the triangle mesh itself to count pieces, the Euler characteristic and boundary loops and to check orientability, and compares the Gauss linking integrals of the boundary curves with the braid's linking matrix (which also fixes the bands' twist direction). `verify.py` checks total surface genus and piece count for every exported Seifert record, and checks the genus of homogeneous knots against knot Floer homology. JSON exports include both `seifert.genus` (the sum of the pieces’ genera) and `seifert.pieces`. Three unlinked disks have total genus zero, not a negative genus.

## Relaxing a knot

`relax.js` treats each component as a closed polygon, sampled with slot boundaries aligned: at least eight intervals per crossing in each slot where a strand crosses, and elsewhere only enough to follow its circular lane (at least 48 points per lap; a chord of a 7.5° step strays under 0.005 from the lane, far less than the lane spacing). The old fixed sampling could erase crossings in long braid words. A request requiring more than 8,192 points is declined instead of being downsampled. Crossings on separate strand pairs share a slot (see *Drawing long braids*), so long braids need fewer, wider slots. The neighbour searches use numeric spatial hashes rebuilt in place each step; together these make a step 2–7× faster (the 20-crossing braid from a cut hexagon went from 5.7 to 1.3 ms per step). The displayed tube follows this polygon exactly, drawn into reused buffers with rotation-minimizing frames (`braid-studio.js`); no interpolating spline is allowed to change the centerline. Work is yielded between steps (12 ms per frame), and the rope stops when it has settled: its length shrinks by less than 0.05% over 50 steps (the trefoil settles after about 1,750 steps, the Borromean rings after 1,300), with 4,000 steps as a cap. Each step pulls every vertex toward the midpoint of its neighbours (the rope tightens) and pushes apart vertices closer than the rope's thickness that are not near each other along the rope. The rule that keeps the knot: no vertex moves as much as half the smallest distance between two segments that share no vertex. A point of a segment moves no more than its endpoints do, so two segments that start apart stay apart, and no strand can pass through another. `node test/editor-relax.test.cjs` checks that rule on every step and compares linking numbers before and after with the Gauss integral. An exact polygonal Gauss integral also checks dense two-strand braids, including σ₁¹⁴⁴ (linking number 72) and σ₁⁴⁰⁰ (linking number 200).

## Drawing long braids

Each crossing is drawn in the earliest angular slot after every earlier crossing that shares one of its strand positions (`braidColumns()` in `knotmath.js`, `columns()` in `seifert.js`). Crossings in one slot use disjoint pairs of neighbouring positions, so they commute, and drawing them side by side is an isotopy of the closed braid: the ribbons, rope and Seifert bands show the same link with fewer, wider slots. The 20-crossing braid from a cut hexagon needs 11 slots. Crossings that share a strand keep their order. The diagram editor still draws one column per letter of the word, so the picture reads like the word. `node test/studio.test.cjs` checks that each slot uses disjoint strand pairs, that order is kept, and that the drawn curves keep every linking number.

## 3D printing

*Download for 3D printing (STL)* saves what is on screen: the twisted torus (cut or not), braid ribbons, the Seifert surface, the relaxed knot's tubes, or a torus cut-explorer surface. STL downloads are unavailable for all Klein-bottle views, whose distinct sheets can intersect in 3D; PNG export remains available. Surfaces are thickened to a 1.2 mm wall, and the model is scaled to about 100 mm across (STL has no units; slicers read millimetres). An uncut tube becomes a hollow shell. One-sided pieces such as a Möbius band are slit along the edges where the two faces would swap, so each face is consistent. These slit models are a printing approximation, not a topology-preserving thickening of the one-sided surface. Thickening rejects meshes with nonmanifold edges, including a Klein bottle whose intersecting sheets have been welded together. The supported example exports are checked for closed edges in `test/seifert.test.cjs`, `test/app-smoke.cjs` and `test/browser.test.cjs`; edge counts alone do not certify absence of geometric self-intersections.

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

**Try different cuts** opens an independent surface: a round torus or a Klein bottle. It retains the current painted construction for the Return button, including its shape, twist, paint, and cut setting. Choose an uncut reference, a meridian, a longitude, or a rectangular contractible loop. The cut meshes have duplicated boundary vertices and no end caps; their boundaries are highlighted from the actual triangle edges. Gaps and the upward translation of the disk are display deformations. The reference surface is a surface, not a solid torus.

| Cut | Connected pieces | Boundary loops | Euler characteristic |
| --- | --- | --- | --- |
| None | One torus | 0 | 0 |
| Meridian: around the tube | One annulus | 2 | 0 |
| Longitude: around the central hole | One annulus | 2 | 0 |
| Contractible patch loop | Disk + once-punctured torus | 1 on each | +1 and −1 |

Every piece is orientable.

The other cuts use the general cutting engine in `surfaces.js`, which cuts the torus or Klein bottle grid along any closed path of grid edges and names the pieces from the mesh itself (pieces, Euler characteristic, boundary loops, one- or two-sided):

- **Along an (a, b) curve:** a curve going `a` times around the hole and `b` times around the tube. It leaves one annulus; when `a` and `b` share a factor `g`, the cut is `g` parallel copies and leaves `g` annuli. For coprime `a, b ≥ 2` the curve itself is the torus knot `T(a, b)`.
- **Draw your own loops on the map:** drag a finger or the mouse across the flat map to sketch a loop, or tap points; each step takes the shortest way across the map, wrapping over its edges (and turning over across the Klein bottle's flipped edge). A loop closes and cuts itself when you finish near where you started, measured on the surface, so ending near the start across an edge counts and one swipe across the whole map is a loop around the hole. Tapping the first point also closes it, and *Close loop and cut* closes any draft. Draw as many loops as you like. The readout gives each loop's class, how many times it goes around the hole and the tube. On the map, arrow keys move a cursor and Enter adds a point. The drawing tools (Close, Undo, Clear) sit right under the map. While drawing, a drag on the map draws instead of scrolling the phone sheet; swipe outside the map to scroll. On a phone, the half-open sheet grows just enough to show the map and its tools together, the readout above the model shows the drawing status, and the sheet scrolls the map into view after each cut. (The phone sheet also keeps room at the end of its content for the part below the screen, so every control can be scrolled into the visible part.) `test/browser.test.cjs` draws loops with real touch input on two phone sizes and with the mouse on desktop.
- **Klein bottle:** the "figure-eight" bottle, a figure-eight cross-section carried around a circle while it turns half a turn. A half turn maps the figure-eight onto itself traversed the other way, so the left and right edges of its map are glued with a flip (the map's arrows point opposite ways) and the surface is one-sided. In 3D it must pass through itself; the dashed ring is where it does. Red and blue are its two Möbius bands.

| Cut | Result |
| --- | --- |
| Klein bottle, uncut | One Klein bottle, one-sided, χ = 0 |
| Around the tube | One annulus: undoing the flip makes it two-sided |
| Between its two Möbius bands | Two Möbius bands |
| Along the center line of one Möbius band | One Möbius band |
| Torus: a meridian and a longitude together | One disk (the torus's square) |
| Torus: a small loop | A disk and a torus with one hole |

`node test/surfaces.test.cjs` checks the engine against `explore.js`'s preset table, (a, b) curves up to 4 each way, these Klein bottle cuts, the seams of both 3D surfaces, drawn loop classes, and small loops drawn anywhere on either map. Original construction readouts are hidden while the reference is displayed. On phones the quick bar becomes a Return button; choosing a cut from the full sheet lowers it to half so the model is visible.

**Open the linked flat map** shows the current closed tube's painted parameter domain. With horizontal coordinate `u = theta / (2π)` and vertical coordinate `v = phi / (2π) + 1/(2n)`, painted piece `p` occupies row `[p/n, (p+1)/n]`. The gluing is `(1,v) ~ (0,v + turn mod 1)` and `(u,0) ~ (u,1)`. The latter gluing is removed when the paint boundaries are cut. The reference cut explorer instead uses ordinary, untwisted torus coordinates and shows only its remaining edge identifications. This map is a parameter domain, not an isometric flattening.

Tap the map to highlight a component and locate a point in 3D, or tap the 3D surface to locate its nearest triangle vertex on the map. Points retain the clicked side of cut edges. Arrow keys move the map point; Escape or Clear map point clears it. Vertical swipes scroll the mobile sheet. The map is unavailable for braids, open flat strips, or unfinished build/twist animations. For a proposed gluing whose ends do not fit, the map explicitly labels that limitation. It redraws only when relevant state changes and its disclosure is open.

**Construction challenges** has twelve tasks in three kinds:

- *Cut a twisted torus:* three strips; two linked trefoils; the mirror trefoil; a Hopf link; a cinquefoil; four strips. Solutions must be closed tubes with finished cuts. Feedback reports `gcd(n, n × turn)`, component knot types, and the linking number when there are two components.
- *Draw a braid:* the figure-eight knot from an empty braid; a knot that is its own mirror image; a knot of genus two; three loops no two of which are linked but which don't come apart. These use the Jones polynomial and the table, so "comes apart" means "has the Jones polynomial of an unlink".
- *Cut explorer:* cut the torus into one disk; cut the Klein bottle into two Möbius bands.

Start loads a starting construction (or opens braid mode or the cut explorer), Check evaluates it, and Hint explains the idea. Solved challenges are counted for the current session. They are not a general-purpose knot-equivalence test. Starting a challenge replaces the current construction, as the button indicates; merely opening the disclosure does not.

Additional checks (from this directory):

```sh
node test/explore.test.cjs
node test/jones.test.cjs
node test/seifert.test.cjs
node test/surfaces.test.cjs
node test/editor-relax.test.cjs
node test/braid-controls.test.cjs
node test/pull.test.cjs
node test/studio.test.cjs
node test/game.test.cjs
node test/app-smoke.cjs
node test/app-smoke.cjs --phone
node test/app-smoke.cjs --phone --landscape
node test/browser.test.cjs      # needs Playwright: npm install playwright && npx playwright install chromium
```

`test/browser.test.cjs` runs the page in Chromium with software WebGL. It covers what the DOM stand-ins can't: the desktop model staying in view while the panel scrolls, WebGL actually drawing (torus, Seifert surface, relaxed knot, Klein bottle, phone), the phone bottom sheet, knot names in the readout, and STL downloads that are closed solids. It also checks the game layer on emulated Pixel 10, Pixel 8 and Pixel 10 Pro XL screens: the title screen; the player bar, readout, control deck and dock in order without overlap; thumb-sized controls; one page per dock tab; a quest played through to its stars; the menu, trophy room and saved progress; and the landscape column. Finally it checks for console errors.

Every pull request runs all of these, and the SnapPy checks (`verify.py` on the examples, `--sweep --max-turns 1`, `--random 80`, `--named 150`), in GitHub Actions: `.github/workflows/twisted-toroids.yml`.

The topology test independently traverses the generated indexed triangle meshes to count connected components, boundary loops and Euler characteristics, and checks consistent orientation. It also tests map seam identifications and positive/negative challenge cases. The integration harness executes the application's actual script with DOM and renderer stand-ins, exercising cut restoration, paint, picking, maps, challenges, and desktop/phone sheet state. It does **not** test CSS layout or real WebGL rendering; those need a WebGL 2 browser. The existing geometry suite remains the independent check of the knot calculations.

## Code layout

- `vendor/three/`: Three.js r186.1 (MIT), with OrbitControls and the fat-line addons.
- `knotmath.js`: braid words, reading a braid (components, linking matrix, writhe), `describe()` for a torus construction, `parseBraid()`, `describeBraid()`, the Burau `alexander()` and `braidLayout()`, the geometry the page draws for a braid. Works as a browser script (`window.KnotMath`) and as a Node module.
- `explore.js`: cut meshes, flat-map coordinates, and challenge definitions/checks. Browser global `TorusExplore` or a Node module; no renderer dependencies.
- `knot-table.js`: the knot and link table, generated by `verify/make_knot_table.py`. `knotmath.js` also holds the Kauffman bracket, Jones polynomial and `identify()`.
- `meshkit.js`: triangle-mesh topology (pieces, Euler characteristic, boundary loops, orientability), cutting along edges, thickening and STL.
- `seifert.js`: the Seifert surface of a closed braid.
- `surfaces.js`: the cut explorer's torus and Klein bottle, cutting along any grid path, drawn loops and their classes.
- `braid-editor.js`: the braid diagram (pure geometry in `diagram()`, SVG and taps in `mount()`).
- `relax.js`: relaxing a closed braid into a smooth knot without strands passing through each other.
- `braid-studio.js`: pure helpers behind the braid views: the rope tube mesh, Pull's framing, toolbar placement (rail or row) and the space it reserves, view names. `braid-workspace.css` styles the studio.
- `appearance.js`: preset palettes, finishes, validation and persistence of appearance settings, and pre-paint application of the saved theme.
- `cut-animation.js`: the periodic spatial opening profile, moving cut-front coordinates, and reversible timing used by the surface and flat map.
- `game.js`: the game's rules as pure functions: experience and levels, ranks, the 22 badges, quest stars, the knot collection, and saving. Browser global `ToroidGame` or a Node module.
- `game-ui.js`: draws the game: the player bar, quest tracker and board, toasts (a top-layer popover, so they show over dialogs), the quest-clear, menu, trophy and title dialogs, confetti, synthesized sound effects and vibration. `game.css` is the game skin (light "candy" and dark "arcade" themes, raised buttons) and the phone layout: bar, deck, dock and landscape column.
- `test/explore.test.cjs`, `test/app-smoke.cjs`: topology/coordinate tests and application integration checks described above. `test/jones.test.cjs`, `test/seifert.test.cjs`, `test/surfaces.test.cjs`, `test/editor-relax.test.cjs` and `test/browser.test.cjs` check the newer modules and the page in a real browser.
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
  - The phone layout section runs the bottom sheet (`setSheet()`, dragging, the quick bar's `syncQuick()`), the dock's pages (`setTab()`, `openTab()`, `showTabFor()`) and `updateViewShift()`, which keeps the model centered and fitted between the top items and the deck or sheet.
  - `logOp()` records every operation and passes it to the game, and `gameEmit()`/`discover()` report finished builds, cuts, Seifert surfaces, pulls and knots identified in the table. `initGame()` starts `game-ui.js` with hooks into the quest controls and the dock.
- `manifest.webmanifest` and `icons/`: the home-screen app (the icons are renders of the cut hexagon: two linked trefoil strips).
  - `frame()` is the animation loop.

## App name and compatibility

The app is **Twisted Toroids**, served from `twisted-toroids/`. Titles, mobile headers, installation metadata, documentation, and new experiment downloads use this name. New exports use `twisted-toroids/experiment`; previous experiment files still load because the importer reads their construction fields.

The former `half-twisted-torus/index.html` is a small redirect that preserves query strings and construction hashes. Its manifest remains available with the new name and launch URL. Both manifests retain the original installation ID and use repository scope so existing home-screen installations can follow the move. Browsers may update an installed app's displayed name on their own schedule.

Run `node test/appearance.test.cjs` for preference validation, legacy paint migration, and rename/redirect consistency checks. The app integration harness also exercises every preset, background, and finish through the actual handlers, checks cut/selection preservation, and checks saving/reloading. As documented above, the harness is not a real WebGL or CSS visual test.


The menus include **Random toroid** (a different shape with a compatible twist), **Shuffle twist** (keep the shape), and **Random braid** with Simple (2–3 strands, 3–7 crossings), Varied (3–5 strands, 8–12 crossings), and Intricate (4–6 strands, 13–18 crossings) options. A dice button beside the phone shape selector runs Random toroid without opening the sheet. Toroid draws match both the cross-section and paint at the seam, use at most two turns either way and 48 braid crossings, and start uncut. Braid draws use every adjacent strand pair and avoid consecutive inverse crossings; they can still represent knots, links, or unknots, and are exploratory samples rather than uniform samples of knot types. Braid Undo/Redo includes random draws. **Random palette** selects another palette and clears custom paint/component overrides while retaining the background, finish, ribbon width, and construction.

**Surface** now constructs the Seifert surface in real time: first every crossing is smoothed, so the knot fades while one Seifert circle per strand draws itself; then each disk fills its circle; then the signed half-twisted bands attach in braid-word order; finally the knot/link boundary is traced in component colors. Disks are shaded by height so the stack reads in depth. The disk or band being built is lit, and while a band attaches, the disks above it turn see-through so it stays visible. The on-screen Surface controls include Pause/Play, Replay, Finish, and a scrub slider; on a phone the readout above them names the stage. Scrubbing pauses the build; Play continues from that stage. Palette/finish changes preserve progress; editing the braid restarts its construction and leaving Surface cancels it. Reduced-motion mode opens the completed surface, with Replay available on request. The animation reveals prefixes of the existing, consistently oriented triangle mesh, without deforming its vertices or changing topology calculations. Numerical invariants and STL exports always describe the completed surface; picture exports capture the current stage.
