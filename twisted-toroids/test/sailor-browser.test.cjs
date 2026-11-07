// Real browser tests for the no-WebGL book, mobile layouts and playback.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.join(__dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const deploymentPath='/knots/twisted-toroids/';
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 // Serve the same book at localhost / and the documented GitHub Pages path.
 const relative=pathname.startsWith(deploymentPath)?pathname.slice(deploymentPath.length):pathname.slice(1);
 const file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--disable-webgl']});let checks=0;const ok=(c,m)=>{checks++;assert(c,m);},errors=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port+'/sailor.html';await page.goto(url+'#carrick-bend');await page.waitForFunction(()=>document.getElementById('knotName').textContent==='Carrick bend');
  const pixels=()=>page.locator('#ropeCanvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return n/(c.width*c.height);});await page.waitForFunction(()=>document.querySelector('#ropeCanvas').width>300);
  ok(await pixels()>.01,'ropes render without WebGL');ok(await page.locator('#ropeCount').textContent()==='2 ROPES · 4 FREE ENDS','Carrick keeps two ropes');
  await page.locator('#bookmark').click();await page.reload();ok(await page.locator('#bookmark').getAttribute('aria-pressed')==='true','bookmark persists');
  await page.locator('#restart').click();ok(await page.locator('#timeline').inputValue()==='0','restart');
  await page.locator('#play').click();await page.waitForFunction(()=>Number(document.getElementById('timeline').value)>10);await page.locator('#play').click();const paused=await page.locator('#timeline').inputValue();await page.waitForTimeout(180);ok(await page.locator('#timeline').inputValue()===paused,'pause stops playback');
  await page.locator('#timeline').fill('250');ok(await page.locator('#playLabel').textContent()==='Play','scrub pauses');ok((await page.locator('#steps button[aria-current=step]').getAttribute('data-step'))==='3','playing a partial step displays the instruction being performed');await page.locator('#next').click();ok(await page.locator('#timeline').inputValue()==='300','next whole step');await page.locator('#previous').click();ok(await page.locator('#timeline').inputValue()==='200','previous step');
  await page.locator('#torusMode').click();ok(await page.locator('#timeline').inputValue()==='0','rewind starts intact');await page.locator('#timeline').press('End');ok((await page.locator('#viewLabel').textContent()).includes('OPEN TOROIDAL'),'open winding');ok(await pixels()>.01,'torus draws');ok(await page.locator('#spacing').isDisabled(),'spacing disabled during rewind');
  await page.locator('#tieMode').click();await page.locator('#spacing').fill('125');ok(await page.locator('#spacingValue').textContent()==='1.25×','open crossings');
  const snapshot=()=>page.locator('#ropeCanvas').evaluate(c=>c.toDataURL());await page.locator('#resetView').click();await page.waitForTimeout(50);const initial=await snapshot();await page.locator('#ropeCanvas').press('ArrowRight');await page.waitForTimeout(50);ok(await snapshot()!==initial,'keyboard rotates');await page.locator('#ropeCanvas').press('Home');await page.waitForTimeout(50);ok(await snapshot()===initial,'Home resets');
  // A real captured pointer is cancelled before a stale move is delivered.
  const box=await page.locator('#ropeCanvas').boundingBox();await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.locator('#ropeCanvas').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});await page.mouse.move(box.x+200,box.y+150);await page.mouse.up();await page.waitForTimeout(50);ok(await snapshot()===initial,'cancelled pointer cannot orbit');
  await page.locator('#play').click();await page.locator('#card-clove-hitch').click();ok(await page.locator('#playLabel').textContent()==='Watch it tie','selection stops playback');ok(page.url().endsWith('#clove-hitch'),'shareable hash');await page.goBack();ok(await page.locator('#knotName').textContent()==='Carrick bend','back restores knot');await page.locator('.skip').focus();await page.locator('.skip').press('Enter');ok(await page.locator('#knotName').textContent()==='Carrick bend','skip preserves knot');
  for(const width of [320,360,412,768,1280]){await page.setViewportSize({width,height:width===768?500:820});ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow at '+width);ok(await page.locator('.playback').evaluate(el=>{const outer=document.querySelector('.visual-column').getBoundingClientRect();return [...el.querySelectorAll('button,select')].every(b=>{const r=b.getBoundingClientRect();return r.left>=outer.left&&r.right<=outer.right&&r.height>=44;});}),'playback controls fit and remain touchable at '+width);for(const id of ['bowline','figure-eight','clove-hitch','carrick-bend','anchor-hitch']){await page.locator('#card-'+id).click();await page.waitForTimeout(40);ok(await pixels()>.005,id+' draws at '+width);const n=await page.locator('#steps button').count();await page.locator('#steps button').first().click();ok(await page.locator('#progressCount').textContent()==='1 / '+n,id+' steps at '+width);await page.locator('#timeline').press('End');}if(process.env.CI||process.env.BRAID_SCREENSHOTS){fs.mkdirSync(path.join(root,'test-output'),{recursive:true});await page.screenshot({path:path.join(root,'test-output','sailor-'+width+'.png'),fullPage:true});}}
  // Explore and Pause save the current URL. The directory form must restore
  // both query options and braid/toroid hashes just like explicit index.html.
  const origin=new URL(url).origin;
  for(const mount of ['/',deploymentPath]){
    const book=origin+mount+'sailor.html',fallback=origin+mount+'index.html';
    await page.goto(book);
    const constructions=['?go=explore&label=Blue%20loop#shape=hex&turn=1/3','?go=braid#braid=1,-2,1,-2&strands=3'];
    const valid=['','index.html'].flatMap(file=>constructions.map(state=>origin+mount+file+state));
    const invalid=['https://example.com'+mount+'index.html#shape=tri','https://example.com'+mount+'#braid=1,1,1','javascript:alert(1)',origin+'/unrelated/index.html#shape=hex',origin+'/unrelated/#shape=hex','https://['];
    for(const back of [...valid,...invalid]){
      await page.evaluate(back=>sessionStorage.setItem('twisted-toroids-book-return',back),back);
      await page.reload();
      const actual=await page.locator('#backToLab').evaluate(a=>a.href);
      ok(actual===(valid.includes(back)?back:fallback),'return URL at '+mount+': '+back);
    }
  }
  await ctx.close();const blocked=await browser.newContext();await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});Object.defineProperty(window,'sessionStorage',{get(){throw new Error('blocked');}});});const p=await blocked.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'#figure-eight');await p.locator('#bookmark').click();ok(await p.locator('#bookmark').getAttribute('aria-pressed')==='true','works without storage');ok(!errors.length,'page errors: '+errors.join('; '));console.log('Sailor browser: '+checks+' checks passed.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
