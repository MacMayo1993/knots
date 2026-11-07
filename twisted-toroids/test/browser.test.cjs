// Real-browser checks with Playwright and Chromium (software WebGL): the things the
// DOM stand-ins in app-smoke.cjs cannot see. CSS layout (the desktop model stays in
// view while the panel scrolls; the phone bottom sheet), WebGL actually drawing,
// the HUD naming knots, the Seifert, relaxed and Klein bottle views drawing, and
// STL downloads that are closed solids.
//
// Run: node test/browser.test.cjs     (skips if Playwright is not installed)
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let chromium, devices;
try { ({ chromium, devices } = require('playwright')); } catch (_) { console.log('SKIP: Playwright is not installed (npm install playwright, then npx playwright install chromium).'); process.exit(0); }
const MK = require('../meshkit.js');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  let checks = 0;
  const ok = (c, m) => { checks++; assert(c, m); };
  async function open(hash = '', opts = { viewport: { width: 1400, height: 900 } }) {
    const ctx = await browser.newContext(Object.assign({ acceptDownloads: true }, opts));
    const page = await ctx.newPage();
    // the page loads web fonts from Google; offline that fails harmlessly, so it is not an error here
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && !/ERR_(NAME|INTERNET|CONNECTION)/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    // answer the optional web-font request locally with an empty stylesheet (no network needed)
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.goto(base + hash, { waitUntil: 'load' });
    await page.waitForFunction(() => !/Drawing the model/.test(document.getElementById('hud').textContent));
    return page;
  }
  // count drawn (non-transparent) pixels in the WebGL canvas, read right after the page's own frame
  const drawn = page => page.evaluate(() => new Promise(res => requestAnimationFrame(() => {
    const c = document.getElementById('c'), o = document.createElement('canvas');
    o.width = 160; o.height = Math.round(160 * c.height / c.width);
    const g = o.getContext('2d'); g.drawImage(c, 0, 0, o.width, o.height);
    const d = g.getImageData(0, 0, o.width, o.height).data;
    // Braid framing reserves the area above the model for the toolbar. Measure
    // model coverage in the available viewport, rather than including that UI area.
    const bar = document.getElementById('braidToolbar'), rect = c.getBoundingClientRect();
    const top = bar.hidden ? 0 : Math.ceil(o.height * (bar.getBoundingClientRect().bottom - rect.top) / rect.height);
    let n = 0; for (let i = Math.max(0, top) * o.width * 4 + 3; i < d.length; i += 4) if (d[i] > 0) n++;
    res(n / (o.width * Math.max(1, o.height - top)));
  })));
  const hud = page => page.textContent('#hud');
  const screenshot = async (page, name) => {
    if (!process.env.CI && !process.env.BRAID_SCREENSHOTS) return;
    const dir = path.join(ROOT, 'test-output'); fs.mkdirSync(dir, {recursive:true});
    await page.screenshot({path:path.join(dir, name+'.png')});
  };

  // desktop: the model draws, and stays in view while the panel scrolls
  let page = await open('#shape=hex&turn=1/3');
  ok(await drawn(page) > 0.15, 'the torus covers part of the canvas');
  const sticky = await page.evaluate(async () => {
    const s = document.getElementById('stage'), pos = getComputedStyle(s).position;
    window.scrollTo(0, 900); await new Promise(r => setTimeout(r, 100));
    return { pos, top: s.getBoundingClientRect().top };
  });
  ok(sticky.pos === 'sticky' && Math.abs(sticky.top - 16) < 2, 'desktop model stays in view: ' + JSON.stringify(sticky));
  // STL download of the cut hexagon: a closed solid
  await page.evaluate(() => document.getElementById('cutBtn').click());
  await page.waitForFunction(() => /Cut along the color lines ·/.test(document.getElementById('hud').textContent), null, { timeout: 15000 });
  async function stlClosed(p) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => document.getElementById('x-stl').click())]);
    const buf = fs.readFileSync(await dl.path()), n = buf.readUInt32LE(80), P = [], I = [];
    for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) { const o = 84 + 50 * t + 12 + 12 * k; P.push(buf.readFloatLE(o), buf.readFloatLE(o + 4), buf.readFloatLE(o + 8)); I.push(3 * t + k); }
    const W = MK.weld(P, I, 1e-3);
    return n > 0 && [...MK.edgeFaces(W.indices).values()].every(l => l.length === 2);
  }
  ok(await stlClosed(page), 'cut torus STL is a closed solid');
  const [png] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.getElementById('x-png').click())]);
  ok(fs.readFileSync(await png.path()).slice(1, 4).toString() === 'PNG', 'picture is a PNG');
  await page.context().close();

  // braids: named in the HUD; Seifert surface and relaxed knot draw
  page = await open('#braid=1,1,1&strands=2');
  ok(/right-handed trefoil/.test(await hud(page)), 'trefoil is named: ' + await hud(page));
  ok(/t⁴/.test(await page.textContent('#x-jones')), 'Jones polynomial shown');
  await screenshot(page, 'braid-desktop');
  await page.click('#braidViewSurface');
  ok(await page.getAttribute('#braidViewSurface','aria-pressed') === 'true', 'surface view is selected');
  await page.waitForFunction(() => /Seifert surface · genus 1/.test(document.getElementById('hud').textContent));
  await screenshot(page, 'braid-surface');
  const surfaceCoverage = await drawn(page);
  ok(surfaceCoverage > 0.1, 'Seifert surface draws in the available viewport: '+surfaceCoverage);
  ok(await stlClosed(page), 'Seifert surface STL is a closed solid');
  await page.click('#braidViewRope');
  ok(await page.getAttribute('#braidViewRope','aria-pressed') === 'true', 'rope view is selected');
  await page.waitForFunction(() => /Relaxed/.test(document.getElementById('hud').textContent), null, { timeout: 30000 });
  const ropeCoverage = await drawn(page);
  ok(ropeCoverage > 0.05, 'relaxed knot draws in the available viewport: '+ropeCoverage);
  await page.click('#braidViewRibbon');
  ok(await page.getAttribute('#braidViewRibbon', 'aria-pressed') === 'true', 'ribbon view is selected');
  await page.locator('#braidEditor rect.be-hit').nth(1).click();
  ok(await page.inputValue('#braidInput') === 's1 s1 s1', 'selecting a crossing does not change it');
  await page.getByRole('button', { name: 'Flip selected crossing', exact: true }).click();
  ok(await page.inputValue('#braidInput') === 's1 S1 s1', 'selected crossing flips');
  await page.click('#braidUndo');
  ok(await page.inputValue('#braidInput') === 's1 s1 s1', 'on-canvas undo restores the trefoil');
  await page.click('#braidRedo');
  ok(await page.inputValue('#braidInput') === 's1 S1 s1', 'on-canvas redo restores the edit');
  await page.click('#braidUndo');
  await page.click('#braidCustomize');
  await page.locator('#braidCustomizeDetails[open]').waitFor();
  const invariant = await page.textContent('#x-jones');
  await page.evaluate(() => { const w=document.getElementById('braidWidth'); w.value='140'; w.dispatchEvent(new Event('input',{bubbles:true})); const c=document.querySelector('#braidComponentColors input'); c.value='#12abef'; c.dispatchEvent(new Event('input',{bubbles:true})); });
  ok(await page.textContent('#braidWidthValue') === '140%', 'width feedback updates');
  ok(await page.textContent('#x-jones') === invariant, 'styling preserves the Jones polynomial');
  ok(await page.$eval('#braidEditor line', e => e.style.stroke) === 'rgb(18, 171, 239)', 'custom color reaches the diagram');
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(() => document.getElementById('braidStats').textContent.includes('3 crossings'));
  ok(await page.inputValue('#braidWidth') === '140', 'width persists after reload');
  ok(await page.locator('#braidComponentColors input').first().inputValue() === '#12abef', 'component color persists after reload');
  // the diagram editor drew a crossing per generator
  ok(await page.$$eval('#braidEditor rect.be-hit', r => r.length) === 3, 'editor shows three crossings');
  await page.context().close();

  // the Klein bottle in the cut explorer
  page = await open();
  await page.evaluate(() => { document.querySelector('#labSurfaceSeg [data-surface=klein]').click(); const s = document.getElementById('labCut'); s.value = 'k-between'; s.dispatchEvent(new Event('change')); document.getElementById('labShow').click(); });
  await page.waitForFunction(() => /2 Möbius bands/.test(document.getElementById('hud').textContent));
  ok(await drawn(page) > 0.1, 'Klein bottle pieces draw');
  let kleinDownloads = 0;
  page.on('download', () => kleinDownloads++);
  for (const kind of ['k-between', 'k-closed']) {
    await page.evaluate(kind => { const s = document.getElementById('labCut'); s.value = kind; s.dispatchEvent(new Event('change')); document.getElementById('x-stl').click(); }, kind);
    ok(/STL export is unavailable for Klein-bottle/.test(await page.textContent('#x-status')), kind + ' explains the STL restriction');
  }
  ok(kleinDownloads === 0, 'Klein-bottle views do not download an invalid STL');
  await page.context().close();

  // phone: full-screen model, bottom sheet, quick tools
  page = await open('', Object.assign({}, devices['iPhone 13']));
  const phone = await page.evaluate(() => ({
    stage: getComputedStyle(document.getElementById('stage')).position,
    panel: getComputedStyle(document.getElementById('panel')).position,
    tools: !document.getElementById('mobileTools').hidden,
    sheetTop: document.getElementById('panel').getBoundingClientRect().top, vh: innerHeight
  }));
  ok(phone.stage === 'fixed' && phone.panel === 'fixed' && phone.tools && phone.sheetTop > phone.vh * 0.6, 'phone layout: ' + JSON.stringify(phone));
  ok(await drawn(page) > 0.1, 'phone draws the torus');
  await page.context().close();

  // Braid controls remain useful with the phone sheet hidden, including narrow screens.
  for (const viewport of [{width:390,height:844},{width:320,height:740},{width:844,height:390}]) {
    page = await open('#braid=1,-2,1,-2&strands=3', {viewport, isMobile:true, hasTouch:true, deviceScaleFactor:1});
    await page.click('#sheetHide');
    await page.locator('#braidToolbar').waitFor({state:'visible'});
    const layout = await page.evaluate(() => {
      const bar = document.getElementById('braidToolbar').getBoundingClientRect();
      return {left:bar.left,right:bar.right,width:innerWidth,overflow:document.documentElement.scrollWidth > innerWidth,
        taps:[...document.querySelectorAll('#braidToolbar button')].filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height];})};
    });
    ok(layout.left >= 0 && layout.right <= layout.width && !layout.overflow, 'braid toolbar fits viewport: '+JSON.stringify(layout));
    ok(layout.taps.every(([w,h])=>w>=44 && h>=44), 'toolbar touch targets are at least 44px');
    await screenshot(page, 'braid-phone-'+viewport.width);
    await page.click('#braidEdit');
    await page.locator('#braidEditor rect.be-hit').first().click();
    await screenshot(page, 'braid-editor-'+viewport.width);
    await page.getByRole('button',{name:'Flip selected crossing',exact:true}).click();
    ok(await page.inputValue('#braidInput') === 'S1 S2 s1 S2', 'phone crossing edit works');
    await page.locator('#braidEditor').getByRole('button',{name:'Undo braid edit',exact:true}).click();
    ok(await page.inputValue('#braidInput') === 's1 S2 s1 S2', 'phone undo restores the braid');
    await page.click('#sheetHide');
    await page.click('#braidViewSurface');
    ok(await page.getAttribute('#braidViewSurface','aria-pressed') === 'true', 'surface switch works with sheet hidden');
    await page.context().close();
  }

  ok(errors.length === 0, 'no console or page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log('PASS: ' + checks + ' browser checks — sticky desktop model, WebGL drawing (torus, Seifert surface, relaxed knot, Klein bottle, phone), knot names, editor, closed STL downloads, PNG, phone bottom sheet, no console errors.');
})().catch(err => { console.error(err); server.close(); process.exit(1); });
