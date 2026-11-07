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
    const { title, ...contextOptions } = opts;
    const ctx = await browser.newContext(Object.assign({ acceptDownloads: true }, contextOptions));
    // the title screen shows once per visit; most checks start past it, as a returning player
    if (!title) await ctx.addInitScript(() => { try { sessionStorage.setItem('twisted-toroids-title-seen', '1'); } catch (_) {} });
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
    // on a phone, editing sits behind ⋯ so the toolbar is a single row
    ok(await page.locator('#braidEdit').isHidden(), 'phone toolbar is one row until ⋯ opens');
    await page.click('#braidMore');
    ok(await page.getAttribute('#braidMore','aria-expanded') === 'true', '⋯ opens the actions row');
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

  // A completed cut can become its closed braid directly, then return to the cut.
  for (const phone of [false, true]) {
    page=await open('#shape=hex&turn=1/3',phone?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:undefined);
    if(phone) await page.click('#sheetHide');
    const originalMath=await page.evaluate(()=>['x-jones','x-alex','x-matrix'].map(id=>document.getElementById(id).textContent));
    const convert=phone?'#q-braid':'#cutToBraid';
    ok(await page.locator('#cutToBraid').isDisabled(),'uncut conversion is disabled');
    await page.click(phone?'#q-cut':'#cutBtn');
    ok(await page.locator(convert).isDisabled(),'conversion waits for cutting animation');
    await page.waitForFunction(()=>!document.getElementById('cutToBraid').disabled,null,{timeout:15000});
    await screenshot(page,phone?'cut-to-braid-phone':'cut-to-braid-desktop');
    await page.click(convert);
    await page.waitForFunction(()=>document.getElementById('panel').dataset.mode==='braid');
    ok(await page.getAttribute('#braidViewRibbon','aria-pressed')==='true','conversion opens the braid view');
    ok(await page.textContent('#braidStats')==='6 strands · 10 crossings · 2 components','cut pieces become braid components');
    const braidMath=await page.evaluate(()=>['x-jones','x-alex','x-matrix'].map(id=>document.getElementById(id).textContent));
    ok(JSON.stringify(originalMath)===JSON.stringify(braidMath),'conversion preserves Jones, Alexander and linking matrix');
    ok(await page.locator('#braidReturnCut').isVisible(),'direct return control stays on screen');
    await screenshot(page,phone?'converted-braid-phone':'converted-braid-desktop');
    await page.click('#braidViewPull');
    await page.click('#braidReturnCut');
    await page.waitForFunction(()=>document.getElementById('panel').dataset.mode==='torus');
    ok(await page.textContent('#q-cut')==='Glue','return restores the completed cut');
    ok(await page.locator('#braidToolbar').isHidden(),'return closes braid controls');
    ok(await page.inputValue('#q-shape')==='hex','return restores the toroid shape');
    ok(await page.locator('#cutToBraid').isEnabled(),'restored cut can convert again');
    await page.context().close();
  }

  // Random menus work on desktop and on a narrow phone, including conversion and undo.
  for (const phone of [false, true]) {
    page=await open('#shape=hex&turn=1/3',phone?{viewport:{width:320,height:740},isMobile:true,hasTouch:true}:undefined);
    if(phone) await page.click('#sheetHide');
    await page.click(phone?'#q-random-toroid':'#randomToroid');
    await page.waitForFunction(()=>!document.getElementById('q-cut').disabled,null,{timeout:15000});
    ok(await page.inputValue('#q-shape')!=='hex','random toroid changes the shape and closes its seam');
    if(!phone) {
      const shape=await page.inputValue('#q-shape'),turn=await page.textContent('#q-twist');
      await page.click('#randomTwist');
      await page.waitForFunction(()=>!document.getElementById('q-cut').disabled,null,{timeout:15000});
      ok(await page.inputValue('#q-shape')===shape && await page.textContent('#q-twist')!==turn,'shuffle twist retains shape and changes turn');
    }
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'random toroid controls do not overflow');
    await screenshot(page,phone?'random-toroid-phone':'random-toroid-desktop');
    await page.click(phone?'#q-cut':'#cutBtn');
    await page.waitForFunction(()=>!document.getElementById('cutToBraid').disabled,null,{timeout:15000});
    await page.click(phone?'#q-braid':'#cutToBraid');
    if(phone) { await page.click('#braidMore'); await page.click('#braidEdit'); }
    const before={word:await page.inputValue('#braidInput'),n:await page.inputValue('#braidStrands')};
    await page.selectOption('#randomBraidLevel','simple');
    await page.click('#randomBraid');
    const after={word:await page.inputValue('#braidInput'),n:await page.inputValue('#braidStrands')};
    ok(JSON.stringify(after)!==JSON.stringify(before) && [2,3].includes(Number(after.n)),'simple random braid creates a valid new word');
    ok((await page.textContent('#braidOriginNote')).includes('Braid edited'),'random braid stops claiming original knot equivalence');
    await screenshot(page,phone?'random-braid-phone':'random-braid-desktop');
    await page.locator('#braidEditor').getByRole('button',{name:'Undo braid edit',exact:true}).click();
    ok(await page.inputValue('#braidInput')===before.word && await page.inputValue('#braidStrands')===before.n,'undo restores pre-random braid');
    await page.locator('#braidEditor').getByRole('button',{name:'Redo braid edit',exact:true}).click();
    ok(await page.inputValue('#braidInput')===after.word,'redo restores random braid');
    if(phone) await page.click('#tab-style');
    await page.locator('#appearanceDetails > summary').click();
    const palette=await page.getAttribute('.palette-choice[aria-pressed="true"]','id');
    await page.click('#randomPalette');
    ok(await page.getAttribute('.palette-choice[aria-pressed="true"]','id')!==palette,'random palette selects another palette');
    ok(await page.inputValue('#braidInput')===after.word,'random palette preserves the braid');
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'random braid menu fits the viewport');
    await page.context().close();
  }

  // Surface construction is visible and controllable with the phone sheet hidden.
  for (const phone of [false, true]) {
    page=await open('#braid=1,1,1&strands=2',phone?{viewport:{width:320,height:740},isMobile:true,hasTouch:true}:undefined);
    if(phone) await page.click('#sheetHide');
    const invariant=await page.textContent('#x-seifert');
    await page.click('#braidViewSurface');
    await page.locator('#seifQuick').waitFor({state:'visible'});
    ok(Number(await page.inputValue('#seifQuickProgress'))<1000,'Surface starts a visible construction');
    await page.click('#seifQuickPlay');
    const paused=await page.inputValue('#seifQuickProgress');await page.waitForTimeout(180);
    ok(await page.inputValue('#seifQuickProgress')===paused,'Pause holds construction progress');
    const seek=value=>page.evaluate(value=>{
      const slider=document.getElementById('seifQuickProgress');
      slider.value=String(value);slider.dispatchEvent(new Event('input',{bubbles:true}));
    },value);
    await seek(60);
    ok((await page.textContent('#seifQuickStatus')).includes('Seifert circles'),'construction starts by smoothing crossings into circles');
    await seek(350);
    ok((await page.textContent('#seifQuickStatus')).includes('Disk 2 of 2'),'scrubbing reaches the disk phase');
    ok(await drawn(page)>.02,'partially built disks draw');
    await screenshot(page,phone?'seifert-disks-phone':'seifert-disks-desktop');
    await seek(600);
    ok((await page.textContent('#seifQuickStatus')).includes('Band 2 of 3'),'scrubbing reaches a signed band');
    await screenshot(page,phone?'seifert-bands-phone':'seifert-bands-desktop');
    await page.evaluate(()=>document.getElementById('palette-sunset').click());
    ok(await page.inputValue('#seifQuickProgress')==='600','palette change preserves paused progress');
    const downloadSTL=async()=>{
      const [dl]=await Promise.all([page.waitForEvent('download'),page.evaluate(()=>document.getElementById('x-stl').click())]);
      return fs.readFileSync(await dl.path());
    };
    const during=await downloadSTL();
    await seek(900);ok((await page.textContent('#seifQuickStatus')).includes('boundary'),'final phase traces the boundary');
    await page.click('#seifQuickFinish');
    ok(await page.inputValue('#seifQuickProgress')==='1000','Finish completes the surface');
    ok(await page.textContent('#x-seifert')===invariant,'construction preserves the final invariants');
    ok(during.equals(await downloadSTL()),'STL is the identical complete surface during and after construction');
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'surface controls fit the viewport');
    await screenshot(page,phone?'seifert-built-phone':'seifert-built-desktop');
    await page.click('#seifQuickReplay');
    await page.waitForFunction(()=>Number(document.getElementById('seifQuickProgress').value)>0);
    ok(Number(await page.inputValue('#seifQuickProgress'))<1000,'Replay restarts the timed construction');
    await page.click('#braidViewRibbon');ok(await page.locator('#seifQuick').isHidden(),'leaving Surface hides its playback controls');
    await page.context().close();
  }
  page=await open('#braid=1,1,1&strands=2',{viewport:{width:1400,height:900},reducedMotion:'reduce'});
  await page.click('#braidViewSurface');
  await page.waitForFunction(()=>document.getElementById('seifQuickStatus').textContent.startsWith('Built'));
  ok(await page.inputValue('#seifQuickProgress')==='1000','reduced motion skips automatic construction');
  await page.click('#seifQuickReplay');
  ok(Number(await page.inputValue('#seifQuickProgress'))<1000,'reduced motion allows an explicitly requested replay');
  await page.context().close();

  // Actual mouse and touch drags reshape the rope while the mathematical word stays fixed.
  const ropePoint = (page, blue = false) => page.evaluate(blue => new Promise(resolve => requestAnimationFrame(() => {
    const c=document.getElementById('c'), o=document.createElement('canvas'), rc=c.getBoundingClientRect();
    o.width=c.width;o.height=c.height;const g=o.getContext('2d');g.drawImage(c,0,0);const a=g.getImageData(0,0,o.width,o.height).data;
    // search the model's free area: right of the desktop rail, or below the phone row
    const bar=document.getElementById('braidToolbar'), br=bar.getBoundingClientRect(), rail=bar.dataset.place==='rail';
    const top=rail?10:Math.ceil((br.bottom-rc.top+12)*o.height/rc.height), left=rail?Math.ceil((br.right-rc.left+12)*o.width/rc.width):10;
    for(let x=o.width-10;x>=left;x-=2)for(let y=top;y<o.height-15;y+=2){
      const i=4*(y*o.width+x),r=a[i],b=a[i+2];
      if(a[i+3]>200 && (blue?b>r*1.4&&b>60:r>b*1.4&&r>60)) return resolve({x:rc.left+x*rc.width/o.width,y:rc.top+y*rc.height/o.height});
    }
    resolve(null);
  })), blue);
  async function ropeSTL(page) {
    const [dl]=await Promise.all([page.waitForEvent('download'),page.evaluate(()=>document.getElementById('x-stl').click())]);
    return fs.readFileSync(await dl.path());
  }
  async function stableFrame(page) { await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))); }
  for(const touch of [false,true]) {
    page=await open('#braid=1,1&strands=2',touch?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:undefined);
    await page.click('#braidViewPull');
    await page.waitForFunction(()=>document.getElementById('pullTighten').textContent==='Tighten');
    await page.waitForTimeout(350); // let sheet/camera framing settle before grabbing
    ok(await page.getAttribute('#braidViewPull','aria-pressed')==='true','Pull tool activates');
    const original=await ropeSTL(page), word=await page.inputValue('#braidInput');
    await page.selectOption('#pullScope', touch?'component':'section');
    await page.selectOption('#pullComponent',touch?'1':'0');
    const point=await ropePoint(page,touch);ok(point,'a visible selectable rope pixel');
    const to={x:Math.min((touch?390:1400)-20,point.x+25),y:Math.max(240,point.y-65)};
    let cdp;
    if(touch) {
      cdp=await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
    } else { await page.mouse.move(point.x,point.y);await page.mouse.down(); }
    await page.waitForFunction(()=>document.getElementById('pullStatus').textContent.startsWith('Pulling component'));
    for(let i=1;i<=12;i++) {
      const at={x:point.x+(to.x-point.x)*i/12,y:point.y+(to.y-point.y)*i/12};
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...at,id:1}]});
      else await page.mouse.move(at.x,at.y);
      await page.waitForTimeout(20);
    }
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
    await stableFrame(page);
    ok(!original.equals(await ropeSTL(page)),(touch?'touch whole-component':'mouse section')+' drag changes actual exported geometry');
    ok(await page.inputValue('#braidInput')===word,'pull does not rewrite the braid word');
    await screenshot(page,touch?'braid-pull-phone':'braid-pull-desktop');
    await page.click('#pullUndo');await stableFrame(page);
    ok(original.equals(await ropeSTL(page)),'Undo pull restores exact geometry');
    // Cancellation also restores geometry, including native touch cancellation.
    const q=await ropePoint(page,touch);
    if(touch) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...q,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:q.x-25,y:q.y-20,id:2}]});
      await page.waitForTimeout(80);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    } else {
      await page.mouse.move(q.x,q.y);await page.mouse.down();await page.mouse.move(q.x-25,q.y-20,{steps:4});
      await page.keyboard.press('Escape');await page.mouse.up();
    }
    await stableFrame(page);
    ok(original.equals(await ropeSTL(page)),'cancelled pull restores exact geometry');
    await page.click('#pullTighten');await page.waitForTimeout(200);await page.click('#pullTighten');await stableFrame(page);
    ok(!original.equals(await ropeSTL(page)),'Tighten and Pause shape the rope');
    await page.click('#pullReset');await stableFrame(page);
    ok(original.equals(await ropeSTL(page)),'Reset returns to original braid shape');
    await page.click('#braidViewRibbon');
    ok(await page.locator('#braidPullOptions').isHidden(),'leaving Pull clears its controls');
    await page.context().close();
  }

  // Drawing your own cut: with a finger on phones (the map and its tools on screen together,
  // drags draw instead of scrolling the sheet) and with the mouse on desktop.
  for (const [label, opts] of [['phone', devices['iPhone 13']], ['small phone', devices['iPhone SE']], ['desktop', undefined]]) {
    page = await open('', opts);
    const phone = !!opts;
    // on a phone the Explore tab of the dock opens the sheet at its page
    if (phone) { await page.tap('#tab-explore'); await page.waitForTimeout(400); await page.tap('#cutLabDetails > summary'); }
    else await page.click('#cutLabDetails > summary');
    await page.selectOption('#labCut', 'draw');
    await page.locator('#labShow').scrollIntoViewIfNeeded();
    if (phone) await page.tap('#labShow'); else await page.click('#labShow');
    await page.waitForTimeout(700);
    if (!phone) await page.locator('#flatMap').scrollIntoViewIfNeeded();
    const seen = await page.evaluate(() => ['flatMap', 'labClose', 'labUndo', 'labClear'].every(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height > 0; }));
    ok(seen, label + ': the map and its Close/Undo/Clear are on screen together');
    const box = await page.locator('#flatMap').boundingBox();
    const at = (u, v) => ({ x: box.x + (36 + 568 * u) * box.width / 640, y: box.y + (28 + 212 * (1 - v)) * box.height / 280 });
    const circle = Array.from({ length: 25 }, (_, i) => [0.5 + 0.13 * Math.cos(2 * Math.PI * i / 24), 0.5 + 0.3 * Math.sin(2 * Math.PI * i / 24)]);
    let cdp = null;
    const drag = async pts => {
      if (phone) {
        cdp = cdp || await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at(...pts[0]), id: 1 }] });
        for (const q of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...at(...q), id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(at(...pts[0]).x, at(...pts[0]).y); await page.mouse.down();
        for (const q of pts.slice(1)) await page.mouse.move(at(...q).x, at(...q).y);
        await page.mouse.up();
      }
      await page.waitForTimeout(400);
    };
    const before = await page.evaluate(() => document.getElementById('sheetBody').scrollTop);
    if (phone) {
      // half a drag, then check the sheet has not scrolled under the finger
      cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at(0.3, 0.8), id: 1 }] });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...at(0.3, 0.8 - 0.1 * i), id: 1 }] });
      ok(await page.evaluate(() => document.getElementById('sheetBody').scrollTop) === before, label + ': a drag on the map draws instead of scrolling the sheet');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await page.click('#labClear');
    }
    // Pressing the map moves keyboard focus to it, even though the draw gesture cancels the
    // browser's default focusing: arrow keys and Enter then reach the map, not the button
    // used before (Show this cut), and focusing does not scroll the page or the sheet.
    {
      const before = await page.evaluate(() => [scrollY, document.getElementById('sheetBody').scrollTop]);
      const q = at(0.3, 0.5);
      if (phone) await page.touchscreen.tap(q.x, q.y); else await page.mouse.click(q.x, q.y);
      await page.waitForTimeout(150);
      ok(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'flatMap', label + ': pressing the map focuses it');
      ok(JSON.stringify(await page.evaluate(() => [scrollY, document.getElementById('sheetBody').scrollTop])) === JSON.stringify(before), label + ': focusing the map does not scroll');
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
      ok(/2 points/.test(await page.textContent('#labDrawStatus')), label + ': arrow keys and Enter then add a point on the map');
      ok(await page.evaluate(() => document.activeElement.id) === 'flatMap', label + ': and focus stays on the map');
      await page.click('#labClear'); await page.waitForTimeout(200);
      Object.assign(box, await page.locator('#flatMap').boundingBox());
    }
    await drag(circle);
    ok(/disk/.test(await page.textContent('#labResult')), label + ': a drawn circle closes itself and cuts off a disk');
    await page.click('#labClear'); await page.waitForTimeout(300);
    Object.assign(box, await page.locator('#flatMap').boundingBox());
    await drag(Array.from({ length: 21 }, (_, i) => [0.02 + 0.96 * i / 20, 0.3]));
    ok(/an annulus/.test(await page.textContent('#labResult')), label + ': a swipe across the map closes through the edge (an annulus)');
    await page.context().close();
  }

  // ---------- the game layer on Pixel phones ----------
  // Layout on narrow (Pixel 10, 360 px), regular (Pixel 8, 412 px) and wide (Pixel 10 Pro
  // XL, 448 px) screens: title screen, player bar, the control deck in thumb reach above
  // the tabbed dock, nothing overlapping or off screen. Then, on the Pixel 8, a quest
  // played start to finish through the game controls, the menu, trophies and saving.
  const rect = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; }, sel);
  for (const name of ['Pixel 10', 'Pixel 8', 'Pixel 10 Pro XL']) {
    const label = name, tag = name.toLowerCase().replace(/\s+/g, '');
    page = await open('', Object.assign({}, devices[name], { title: true }));
    ok(await page.locator('#titleScreen').evaluate(d => d.open), label + ': the title screen opens on a first visit');
    const play = await rect(page, '#tsPlay'), vh = await page.evaluate(() => innerHeight), vw = await page.evaluate(() => innerWidth);
    ok(play.top >= 0 && play.bottom <= vh && play.width >= 200 && play.height >= 56, label + ': Play is a big button on screen: ' + JSON.stringify(play));
    await screenshot(page, 'game-title-' + tag);
    await page.tap('#tsPlay');
    await page.waitForFunction(() => !document.getElementById('titleScreen').open);
    ok(await page.evaluate(() => sessionStorage.getItem('twisted-toroids-title-seen')) === '1', label + ': the title is not shown again this visit');
    await page.waitForTimeout(500);
    const bar = await rect(page, '#gameBar'), hudBox = await rect(page, '#hud'), deck = await rect(page, '#mobileTools'), head = await rect(page, '#sheetHead');
    ok(await page.evaluate(() => document.getElementById('gameBar').parentElement.id) === 'stage', label + ': the player bar sits over the model');
    ok(bar.top >= 0 && bar.left >= 0 && bar.right <= vw && bar.height >= 44, label + ': player bar on screen: ' + JSON.stringify(bar));
    ok(hudBox.top >= bar.bottom, label + ': the readout is below the bar');
    ok(deck.bottom <= head.top + 1 && deck.top > hudBox.bottom + 100, label + ': the control deck sits above the dock, well below the readout: ' + JSON.stringify({ deck, head }));
    ok(head.bottom <= vh + 1, label + ': the dock is on screen');
    const targets = await page.evaluate(() => [...document.querySelectorAll('#gameBar button, #mobileTools button, #mobileTools select, #dock button')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [e.id || e.className, Math.round(r.width), Math.round(r.height)]; }));
    ok(targets.every(([, w, h]) => w >= 44 && h >= 42), label + ': game controls are thumb-sized: ' + JSON.stringify(targets.filter(([, w, h]) => w < 44 || h < 42)));
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': nothing runs off the side');
    ok(await drawn(page) > 0.08, label + ': the model draws between the bar and the deck');
    await screenshot(page, 'game-play-' + tag);
    // dock tabs: one page at a time
    await page.tap('#tab-quests'); await page.waitForTimeout(450);
    ok(await page.getAttribute('#tab-quests', 'aria-selected') === 'true', label + ': the Quests tab is selected');
    ok(await page.locator('.quest-card').count() === 12 && await page.locator('.quest-card').first().isVisible(), label + ': the quest board shows 12 quests');
    ok(await page.locator('#modeSeg').isHidden() && await page.locator('#appearanceDetails').isHidden(), label + ': other pages are hidden');
    await screenshot(page, 'game-quests-' + tag);
    await page.tap('#tab-style'); await page.waitForTimeout(300);
    ok(await page.locator('#appearanceDetails').isVisible() && await page.locator('.quest-card').first().isHidden(), label + ': the Style tab shows its page');
    await page.tap('#tab-style'); await page.waitForTimeout(400);
    ok(await page.evaluate(() => document.getElementById('panel').dataset.sheet) === 'peek', label + ': tapping the open tab lowers the sheet');
    if (name !== 'Pixel 8') { await page.context().close(); continue; }
    // The tabs fill the handle, so a drag that starts on one moves the sheet and is not a tap.
    {
      const tb = await rect(page, '#tab-play'), x = tb.left + tb.width / 2, y = tb.top + tb.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let k = 1; k <= 8; k++) { await page.mouse.move(x, y - 40 * k); await page.waitForTimeout(16); }
      await page.mouse.up(); await page.waitForTimeout(450);
      ok(await page.evaluate(() => document.getElementById('panel').dataset.sheet) !== 'peek', 'dragging up from a tab raises the sheet');
      ok(await page.getAttribute('#tab-style', 'aria-selected') === 'true', 'and the drag does not switch tabs');
      await page.tap('#sheetSize'); await page.waitForTimeout(300);
      if (await page.evaluate(() => document.getElementById('panel').dataset.sheet) !== 'peek') { await page.tap('#sheetSize'); await page.waitForTimeout(400); }
    }

    // A whole quest on the Pixel 8: choose, start, a missed check, solve, clear.
    await page.tap('#tab-quests'); await page.waitForTimeout(400);
    await page.tap('.quest-card[data-quest="hopf"]'); await page.waitForTimeout(300);
    ok(/Make a Hopf link/.test(await page.textContent('#questDetailTitle')), 'choosing a card shows that quest');
    await page.tap('#challengeStart'); await page.waitForTimeout(600);
    ok(await page.locator('#questTracker').isVisible() && /Hopf/.test(await page.textContent('#qtTitle')), 'the active quest is tracked over the model');
    ok(await page.evaluate(() => document.getElementById('panel').dataset.sheet) === 'peek', 'starting a quest lowers the sheet');
    await page.tap('#qtOpen'); await page.waitForTimeout(450);
    ok(await page.getAttribute('#tab-quests', 'aria-selected') === 'true' && await page.locator('#challengeGoal').isVisible() && /unknotted ribbons/.test(await page.textContent('#challengeGoal')), 'tapping the tracker shows the quest goal');
    await page.tap('#tab-quests'); await page.waitForTimeout(450);
    await page.waitForFunction(() => !document.getElementById('q-cut').disabled, null, { timeout: 15000 });
    await page.tap('#qtCheck');
    await page.locator('.toast-nope').waitFor();
    ok(/not yet/i.test(await page.textContent('.toast-nope')), 'a wrong answer says not yet');
    // a round tube steps by quarter turns; the paint only lines up again at whole turns
    for (let k = 0; k < 4; k++) { await page.tap('#q-plus'); await page.waitForTimeout(100); await page.waitForFunction(() => !/Turning the cut end/.test(document.getElementById('hud').textContent), null, { timeout: 15000 }); }
    await page.waitForFunction(() => !document.getElementById('q-cut').disabled, null, { timeout: 15000 });
    ok(/1 full turn|Full turn/i.test(await page.textContent('#q-twist')), 'four quarter steps make a full turn: ' + await page.textContent('#q-twist'));
    await page.tap('#q-cut');
    await page.waitForFunction(() => !document.getElementById('cutToBraid').disabled, null, { timeout: 15000 });
    await page.tap('#qtCheck');
    await page.waitForFunction(() => document.getElementById('questClear').open);
    ok(await page.locator('#questClear .qc-big-stars i.on').count() === 2, 'one miss: two stars');
    await page.waitForTimeout(900);
    await screenshot(page, 'game-clear-pixel8');
    await page.tap('#qcStay');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('twisted-toroids-game')));
    ok(saved.quests.hopf.stars === 2 && saved.knots['2^2_1'] && saved.ach.cut && saved.ach.link && saved.ach.quest1, 'progress is saved: ' + JSON.stringify({ q: saved.quests, k: Object.keys(saved.knots), a: Object.keys(saved.ach) }));
    ok(await page.locator('#questTracker').isHidden(), 'a cleared quest leaves the tracker');
    ok((await page.textContent('#gbStarCount')).startsWith('2/'), 'the bar counts the stars');
    // menu and trophy room
    await page.tap('#gbMenu');
    await page.waitForFunction(() => document.getElementById('gameMenu').open);
    const sound = await page.getAttribute('#gmSound', 'aria-checked');
    await page.tap('#gmSound');
    ok(await page.getAttribute('#gmSound', 'aria-checked') !== sound, 'the sound switch toggles');
    await screenshot(page, 'game-menu-pixel8');
    await page.tap('#gmTrophies');
    await page.waitForFunction(() => document.getElementById('trophyRoom').open);
    ok(await page.locator('.tr-badge').count() === 22 && await page.locator('.tr-badge.got').count() >= 4, 'the trophy room lists badges, some earned');
    await page.tap('#trTabKnots');
    ok(/Hopf link/.test(await page.textContent('.tr-knots')), 'the Hopf link joined the knot collection');
    await screenshot(page, 'game-trophies-pixel8');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('trophyRoom').open);
    // a reload keeps the level and stars; the sound setting too
    const level = await page.textContent('#gbLevelNum');
    await page.reload(); await page.waitForFunction(() => !/Drawing the model/.test(document.getElementById('hud').textContent));
    ok(await page.textContent('#gbLevelNum') === level && (await page.textContent('#gbStarCount')).startsWith('2/'), 'level and stars survive a reload');
    ok(await page.locator('#titleScreen').evaluate(d => !d.open), 'no title screen again in the same visit');
    await page.context().close();
  }
  // On its side: the controls are a column on the left and the model fills the rest.
  page = await open('', Object.assign({}, devices['Pixel 8 landscape']));
  await page.waitForTimeout(500);
  {
    const col = await rect(page, '#mobileTools'), vw = await page.evaluate(() => innerWidth), vh = await page.evaluate(() => innerHeight);
    ok(col.left >= 0 && col.right < vw * 0.4 && col.bottom <= vh, 'landscape: the controls are a column on the left: ' + JSON.stringify(col));
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'landscape: nothing runs off the side');
    ok(await drawn(page) > 0.05, 'landscape: the model draws');
    await screenshot(page, 'game-landscape-pixel8');
  }
  await page.context().close();
  // Wide screens: the player bar is in the page header, the quest board in the panel.
  page = await open();
  ok(await page.evaluate(() => document.getElementById('gameBar').parentElement.id) === 'headBar' && await page.locator('#gameBar').isVisible(), 'desktop: the player bar is in the header');
  ok(await page.locator('.quest-card').count() === 12 && await page.locator('.quest-card').first().isVisible(), 'desktop: the quest board is in the panel');
  ok(await page.locator('#dock').isHidden(), 'desktop: no phone dock');
  await page.context().close();

  ok(errors.length === 0, 'no console or page errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log('PASS: ' + checks + ' browser checks — sticky desktop model, WebGL drawing (torus, Seifert surface, relaxed knot, Klein bottle, phone), knot names, editor, closed STL downloads, PNG, phone bottom sheet, game layer on Pixel 10/8/10 Pro XL (title, bar, deck, dock tabs, a full quest, menu, trophies, saving, landscape), no console errors.');
})().catch(err => { console.error(err); server.close(); process.exit(1); });
