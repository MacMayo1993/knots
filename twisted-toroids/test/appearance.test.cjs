const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../appearance.js'),app=path.resolve(__dirname,'..'),repo=path.dirname(app);
const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
assert.deepEqual(A.load(storage),{palette:'classic',mode:'system',finish:'satin'});
for(const value of [null,[],42,'broken',{palette:'__proto__',mode:'neon',finish:'constructor'}])assert.deepEqual(A.normalize(value),{palette:'classic',mode:'system',finish:'satin'});
for(const p of A.PALETTES){
 assert.equal(p.colors.length,8);assert.equal(new Set(p.colors).size,8);p.colors.forEach(c=>assert.match(c,/^#[a-f\d]{6}$/i));
 for(const mode of ['system','light','dark'])for(const finish of Object.keys(A.FINISHES)){
  const value={palette:p.id,mode,finish};assert.equal(A.save(storage,value),true);assert.deepEqual(A.load(storage),value);
 }
}
data.set(A.KEY,'{bad json');assert.equal(A.load(storage).palette,'classic');
const denied={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
assert.equal(A.save(denied,{}),false);assert.equal(A.load(denied).mode,'system');assert.deepEqual(A.loadPaint(denied),Array(8).fill(null));
data.set(A.LEGACY_PAINT_KEY,JSON.stringify(['#123456','bad','#ABCDEF',null]));
assert.deepEqual(A.loadPaint(storage),['#123456',null,'#ABCDEF',null,null,null,null,null]);
data.set(A.PAINT_KEY,JSON.stringify(Array(8).fill(null)));assert.deepEqual(A.loadPaint(storage),Array(8).fill(null));
const root={attrs:{},style:{setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
A.apply(root,{palette:'aurora',mode:'dark',finish:'gloss'},['#123456']);
assert.equal(root.attrs['data-theme'],'dark');assert.equal(root.style['--red'],'#123456');assert.equal(root.style['--scene-a'],'18,52,86');
A.apply(root,{palette:'classic',mode:'system'});assert.equal(root.attrs['data-theme'],undefined);assert.equal(root.style['--red'],undefined);
const page=fs.readFileSync(path.join(app,'index.html'),'utf8');
assert(page.includes('<title>Twisted Toroids</title>'));assert(!page.includes('Half-Twisted Torus'));
assert(page.indexOf('<script src="appearance.js">')<page.indexOf('<style>'),'preferences applied before CSS paints');
const manifests=['twisted-toroids','half-twisted-torus'].map(folder=>{
 const url='https://macmayo1993.github.io/knots/'+folder+'/manifest.webmanifest';
 const m=JSON.parse(fs.readFileSync(path.join(repo,folder,'manifest.webmanifest'),'utf8'));
 assert.equal(m.name,'Twisted Toroids');assert.equal(m.short_name,'Twisted Toroids');
 const start=new URL(m.start_url,url),scope=new URL(m.scope,url);assert(start.href.startsWith(scope.href));
 assert.equal(start.pathname,'/knots/twisted-toroids/index.html');
 for(const icon of m.icons)assert(new URL(icon.src,url).pathname.startsWith('/knots/twisted-toroids/icons/'));
 // Manifest IDs resolve against start_url's origin, not the manifest directory.
 return new URL(m.id,start.origin).href;
});
assert.equal(manifests[0],manifests[1]);assert.equal(manifests[0],'https://macmayo1993.github.io/knots/half-twisted-torus/index.html');
const redirect=fs.readFileSync(path.join(repo,'half-twisted-torus/index.html'),'utf8'),script=/<script>([\s\S]*?)<\/script>/.exec(redirect)[1];
for(const source of ['https://macmayo1993.github.io/knots/half-twisted-torus/#shape=tri&turn=2/3','https://macmayo1993.github.io/knots/half-twisted-torus/index.html?demo=1#braid=1,-2&strands=3']){
 const loc=new URL(source),link={};let target;
 vm.runInNewContext(script,{URL,location:{href:loc.href,search:loc.search,hash:loc.hash,replace:url=>{target=url;}},document:{getElementById:()=>link}});
 assert.equal(new URL(target).search,loc.search);assert.equal(new URL(target).hash,loc.hash);assert.equal(new URL(target).pathname,'/knots/twisted-toroids/');assert.equal(link.href,target);
}
for(const file of fs.readdirSync(path.join(app,'verify/examples'))){const d=JSON.parse(fs.readFileSync(path.join(app,'verify/examples',file),'utf8'));assert.equal(d.format,'twisted-toroids/experiment');assert(d.construction);}
console.log('PASS: all 54 saved appearance combinations, palette validation, corrupt/blocked storage, legacy paint, pre-paint theme setup, app naming, stable install identity, old-link redirects, and 14 renamed examples.');
