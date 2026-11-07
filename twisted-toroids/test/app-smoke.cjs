// Integration harness: real application script with DOM and renderer stand-ins.
// This checks event/state/geometry wiring; it is not browser or WebGL visual QA.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
process.chdir(require('node:path').join(__dirname,'..'));
const html = fs.readFileSync('index.html', 'utf8');
const moduleCode = /<script type="module">([\s\S]*?)<\/script>/.exec(html)[1];
const source = moduleCode.replace(/^import .*;\n/gm, '');
new vm.Script(source);
const nodes = new Map(), buttons = [], timers = [];
function el(tag='div') {
 return {tag,children:[],dataset:{},attrs:{},handlers:{},checked:false,disabled:false,hidden:false,value:'',open:false,offsetHeight:128,
  get firstElementChild(){return this.children[0]||{style:{}};},classList:{add(){},remove(){},contains(){return false;}},
  style:{setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}},
  set textContent(v){this.text=v;this.children=[];},get textContent(){return (this.text||'')+this.children.map(c=>c.textContent).join('');},
  setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},addEventListener(k,f){(this.handlers[k]??=[]).push(f);},
  appendChild(c){this.children.push(c);c.parentElement=this;return c;},append(...cs){cs.forEach(c=>this.appendChild(c));},after(c){c.parentElement=this.parentElement;},focus(){},
  dispatch(k,extra={}){for(const f of this.handlers[k]||[])f({target:this,preventDefault(){},...extra});},click(){if(!this.disabled)this.dispatch('click');},
  getContext(){return new Proxy({}, {get(t,p){return t[p]||(()=>{});},set(t,p,v){t[p]=v;return true;}});},getBoundingClientRect(){return {width:600,height:550,left:0,top:0};}};
}
const get=id=>{if(!nodes.has(id))nodes.set(id,el());return nodes.get(id);};
for(const m of html.matchAll(/<(button|input)\b([^>]*)>/g)){
 const a=m[2],id=/\bid="([^"]+)"/.exec(a)?.[1],n=id?get(id):el(m[1]);
 for(const d of a.matchAll(/data-([\w-]+)="([^"]*)"/g))n.dataset[d[1]]=d[2];
 n.checked=/\schecked(?:\s|$)/.test(a);n.disabled=/\sdisabled(?:\s|$)/.test(a);n.value=/\bvalue="([^"]*)"/.exec(a)?.[1]||'';
 if(m[1]==='button')buttons.push(n);
}
const root=el(),palette={'--red':'#cc3333','--ochre':'#aa8833','--blue':'#3355cc','--green':'#338844','--violet':'#8844bb','--teal':'#338899','--rose':'#bb4488','--lime':'#889933'};
const linear=x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;
class Color{
 constructor(x=0xffffff){this.set(x);}
 set(x){if(typeof x==='string')x=parseInt(x.replace('#',''),16);return this.setRGB((x>>16&255)/255,(x>>8&255)/255,(x&255)/255,'srgb');}
 setRGB(r,g,b,space){[this.r,this.g,this.b]=space==='srgb'?[r,g,b].map(linear):[r,g,b];return this;}
 copy(c){Object.assign(this,{r:c.r,g:c.g,b:c.b});return this;}
 lerp(c,t){this.r+=(c.r-this.r)*t;this.g+=(c.g-this.g)*t;this.b+=(c.b-this.b)*t;return this;}
}
class Vector{set(x,y,z){Object.assign(this,{x,y,z});return this;}setFromSpherical(){return this.set(2,3,5);}copy(v){Object.assign(this,v);return this;}clone(){return new Vector().copy(this);}sub(){return this;}add(){return this;}length(){return 6.2;}distanceTo(){return 6.2;}setLength(){return this;}}
class Geometry{
 constructor(){this.attributes={};}
 setAttribute(k,v){this.attributes[k]=v;return this;}
 setIndex(v){this.index=v;return this;}
 setPositions(a){this.positions=Array.from(a);return this;}
 setColors(a){this.colors=a;return this;}
 dispose(){}computeVertexNormals(){}computeBoundingSphere(){}
}
class Attribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.version=0;}set needsUpdate(v){if(v)this.version++;}}
class FloatAttribute extends Attribute{constructor(a,n){super(new Float32Array(a),n);}}
class Material{constructor(opts={}){Object.assign(this,opts);this.color=new Color(opts.color);this.resolution=new Vector();}}
class Object3D{constructor(geometry=new Geometry(),material=new Material()){this.geometry=geometry;this.material=material;this.position=new Vector();this.children=[];this.fov=40;this.visible=true;}add(...o){this.children.push(...o);}computeLineDistances(){}updateProjectionMatrix(){}clearViewOffset(){}setViewOffset(){}}
class Renderer{setClearColor(){}setPixelRatio(){}setSize(){}render(){}}
class OrbitControls{constructor(){this.target=new Vector();}addEventListener(){}update(){}}
class Raycaster{setFromCamera(){}intersectObject(){return Raycaster.hit ? [Raycaster.hit] : [];}}
const THREE={MathUtils:{degToRad:x=>x*Math.PI/180},Color,Vector2:Vector,Vector3:Vector,Spherical:class{},Scene:Object3D,PerspectiveCamera:Object3D,HemisphereLight:Object3D,DirectionalLight:Object3D,Mesh:Object3D,BufferGeometry:Geometry,BufferAttribute:Attribute,Float32BufferAttribute:FloatAttribute,MeshStandardMaterial:Material,MeshBasicMaterial:Material,SphereGeometry:Geometry,WebGLRenderer:Renderer,Raycaster,SRGBColorSpace:'srgb'};
const phone=process.argv.includes('--phone'),side=process.argv.includes('--landscape');
const win={innerHeight:phone?844:900,innerWidth:phone?390:1200,ToroidAppearance:require(process.cwd()+'/appearance.js'),TorusExplore:require(process.cwd()+'/explore.js'),KnotMath:require(process.cwd()+'/knotmath.js'),addEventListener(){},matchMedia(q){return {matches:q.includes('reduced-motion')||(phone&&q.includes('max-width'))||(side&&q.includes('orientation: landscape')),addEventListener(){}};}};
const sandbox={KnotMath:win.KnotMath,THREE,OrbitControls,Line2:Object3D,LineSegments2:Object3D,LineMaterial:Material,LineGeometry:Geometry,LineSegmentsGeometry:Geometry,window:win,document:{documentElement:root,body:el(),getElementById:get,createElement:el,querySelectorAll(s){const key={'#shapeSeg button':'shape','#twistSeg button':'k','#modeSeg button':'mode','#braidExamples button':'word'}[s];return buttons.filter(b=>key in b.dataset);}},getComputedStyle(){return {getPropertyValue(k){return root.style[k]||palette[k]||'#888888';}};},MutationObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}},location:{hash:'',href:'https://example.test/'},history:{replaceState(){}},performance:{now(){return 0;}},requestAnimationFrame(){},setTimeout(f){timers.push(f);},URLSearchParams,console};
vm.createContext(sandbox);
const savedPreferences=new Map();
sandbox.localStorage={getItem:k=>savedPreferences.get(k)??null,setItem:(k,v)=>savedPreferences.set(k,v)};
sandbox.document.querySelector=s=>get(s);
sandbox.document.addEventListener=()=>{};
get('.lab').parentElement=el(); get('.notes').parentElement=get('.lab').parentElement;
vm.runInContext(source.replace('setTimeout(start, 30);','window.probe={state,appearance,experiment,render,syncSurface,surface,cutInfo,showBraid,twistTo,updatePositions,select,clearSelection,selCore,selEdge,retint,frame,setLabCut,labSurface,labBoundary,mapMarker,chooseMapPoint,syncExplore,setSheet,getSheet:()=>sheet,getMapPick:()=>mapPick,getSelection:()=>sel,getVertexPieces:()=>vPiece,getPalette:()=>pal}; setTimeout(start,30);'),sandbox);
timers.shift()();assert(!get('hud').textContent.includes('failed'));
const p=win.probe,toggle=get('cutColors'),legend=get('cutColorLegend');get('seam').checked=false;
const rgb=c=>[c.r,c.g,c.b];
function rows(){p.syncSurface();const a=p.surface.geometry.attributes.color.array,v=p.getVertexPieces(),out=[];for(let i=0;i<v.length;i++)if(!out[v[i]])out[v[i]]=Array.from(a.slice(3*i,3*i+3));return out;}
function expected(ci,dim=false){const a=p.getPalette().c[ci],c=new Color().setRGB(...a.map(x=>x/255),'srgb');if(dim)c.lerp(new Color(p.getPalette().stage),0.72);return rgb(c);}
function match(actual,want){assert.equal(actual.length,want.length);actual.forEach((a,i)=>assert(Math.abs(a-want[i])<1e-6,JSON.stringify({actual,want})));}
function paint(indices,selected=null){const data=rows();assert.equal(data.length,indices.length);data.forEach((r,i)=>match(r,expected(indices[i],selected!==null&&!selected.includes(i))));}
function checkbox(v){toggle.checked=v;toggle.dispatch('change');}
assert.equal(toggle.checked,false);assert.equal(toggle.disabled,true);
get('shape-hept').click();p.twistTo(3/7);paint([0,1,2,3,4,5,6]);
get('cutBtn').click();paint([0,1,2,3,4,5,6]);assert.equal(toggle.disabled,false);assert.equal(legend.hidden,true);
checkbox(true);paint([0,0,0,0,0,0,0]);assert.equal(legend.children.length,1);assert(legend.textContent.includes('1, 2, 3, 4, 5, 6, 7'));
checkbox(false);paint([0,1,2,3,4,5,6]);assert.equal(legend.hidden,true);
get('shape-hex').click();p.twistTo(2/3);get('cutBtn').click();paint([0,1,2,3,4,5]);
get('x-stripes').children[0].click();assert.equal(p.getSelection(),0);
paint([0,1,2,3,4,5],[0,2,4]);assert.equal(p.selCore.visible,true);assert.equal(p.selEdge.visible,true);
const coreBefore=JSON.stringify(p.selCore.geometry.positions),edgeBefore=JSON.stringify(p.selEdge.geometry.positions);
checkbox(true);paint([0,1,0,1,0,1],[0,2,4]);assert.equal(p.getSelection(),0);assert.equal(legend.children.length,2);
assert.equal(JSON.stringify(p.selCore.geometry.positions),coreBefore);assert.equal(JSON.stringify(p.selEdge.geometry.positions),edgeBefore);
assert(legend.textContent.includes('1, 3, 5'));assert(legend.textContent.includes('2, 4, 6'));
checkbox(false);paint([0,1,2,3,4,5],[0,2,4]);
get('c').dispatch('keydown',{key:'Escape'});paint([0,1,2,3,4,5]);assert.equal(p.getSelection(),null);
checkbox(true);const input=get('paints').children[0].children[0];input.value='#123456';input.dispatch('input');paint([0,1,0,1,0,1]);assert.equal(root.style['--red'],'#123456');assert.equal(legend.children[0].children[0].children[0].style.background,'var(--red)');
p.retint();paint([0,1,0,1,0,1]);
get('cutBtn').click();paint([0,1,2,3,4,5]);assert.equal(legend.hidden,true);assert.equal(toggle.disabled,true);
p.twistTo(0.25);assert.equal(get('cutBtn').disabled,true);assert.equal(toggle.disabled,true);
p.showBraid({n:3,word:[1,-2,1,-2,1,-2]});paint([0,2,1]);assert.equal(toggle.disabled,true);assert.equal(legend.hidden,true);
get('x-stripes').children[1].click();paint([0,2,1],[1]);
p.showBraid(null);get('shape-band3').click();p.twistTo(0.5);get('cutBtn').click();paint([0,1,0]);assert.equal(legend.children.length,2);
checkbox(false);paint([0,1,2]);
get('shape-hept').click();p.twistTo(3/7);get('cutBtn').click();p.state.cut=0.5;p.updatePositions();paint([0,1,2,3,4,5,6]);checkbox(true);paint([0,0,0,0,0,0,0]);checkbox(false);paint([0,1,2,3,4,5,6]);
const version=p.surface.geometry.attributes.color.version;rows();assert.equal(p.surface.geometry.attributes.color.version,version);
p.render(false,0,[0,0,0]);assert(!get('hud').textContent.includes('failed'));
console.log('PASS: Three.js-path startup and vertex colors; single/multiple ribbons; recolor/cache; highlighted strip dimming and unchanged centerline/edge routes; Escape; custom paint/retint; glue; invalid cuts; braid selection; flat bands; mid-cut animation.');
get('mapDetails').open=true;
get('shape-hex').click();p.twistTo(2/3);get('cutBtn').click();p.render(false,0,[0,0,0]);
p.chooseMapPoint(.4,.1);p.syncExplore();assert.equal(p.getSelection(),0);assert.equal(p.mapMarker.visible,true);
const pickPos=p.surface.geometry.attributes.position.array;
Raycaster.hit={face:{a:0,b:1,c:2},point:{x:pickPos[0],y:pickPos[1],z:pickPos[2]}};
get('c').dispatch('pointerdown',{clientX:100,clientY:100});get('c').dispatch('pointerup',{clientX:100,clientY:100});p.syncExplore();
assert.equal(p.getMapPick().piece,0);assert(Math.abs(p.getMapPick().v)<1e-7);assert.equal(p.mapMarker.visible,true);
assert(Math.hypot(p.mapMarker.position.x-pickPos[0],p.mapMarker.position.y-pickPos[1],p.mapMarker.position.z-pickPos[2])<.03,'map marker stays on the clicked side of the cut');
Raycaster.hit=null;p.chooseMapPoint(.4,.1);p.syncExplore();
assert(get('mapNote').textContent.includes('right edge'));
assert(get('mapNote').textContent.includes('Paint boundaries are now cut'));
get('flatMap').dispatch('keydown',{key:'ArrowUp'});assert(p.getMapPick().v>.1);
get('flatMap').dispatch('keydown',{key:'Escape'});p.syncExplore();assert.equal(p.mapMarker.visible,false);
const saved=JSON.stringify(p.state),savedColors=rows();
for(const kind of ['closed','meridian','longitude','patch']) {
 p.setLabCut(kind);p.render(false,0,[0,0,0]);
 assert.equal(p.labSurface.visible,true);assert.equal(p.surface.visible,false);
 assert.equal(p.labBoundary.visible,kind!=='closed');
 assert.equal(get('labPieces').textContent,kind==='patch'?'2':'1');
 p.chooseMapPoint(.5,.25);p.syncExplore();assert.equal(p.mapMarker.visible,true);
 assert.equal(get('panel').dataset.exploring,'true');
}
p.setLabCut(null);p.render(false,0,[0,0,0]);assert.equal(p.labSurface.visible,false);assert.equal(p.labBoundary.visible,false);assert.equal(p.surface.visible,true);
// Selection can stop the idle rotation, but the user's shape/twist/cut/paint remain intact.
const restored=JSON.parse(JSON.stringify(p.state)),before=JSON.parse(saved);delete restored.userMoved;delete before.userMoved;
assert.deepEqual(restored,before);assert.deepEqual(rows(),savedColors);
get('challengePick').value='three';get('challengeStart').click();assert.equal(p.state.shape,'hex');assert.equal(p.state.k,0);
p.twistTo(.5);get('cutBtn').click();get('challengeCheck').click();assert(get('challengeFeedback').textContent.startsWith('Solved!'),JSON.stringify({message:get('challengeFeedback').textContent,state:p.state}));
get('challengePick').value='trefoils';get('challengeStart').click();p.twistTo(2/3);get('cutBtn').click();get('challengeCheck').click();assert(get('challengeFeedback').textContent.includes('Linking number: 6'));
get('challengePick').value='mirror';get('challengeStart').click();get('cutBtn').click();get('challengeCheck').click();assert(get('challengeFeedback').textContent.startsWith('Not yet.'));
p.twistTo(-2/3);get('cutBtn').click();get('challengeCheck').click();assert(get('challengeFeedback').textContent.startsWith('Solved!'),JSON.stringify({message:get('challengeFeedback').textContent,state:p.state,disabled:get('cutBtn').disabled}));assert.equal(get('challengeProgress').textContent,'3 of 3 solved this session.');
p.showBraid({n:2,word:[1,1,1]});p.render(false,0,[0,0,0]);assert.equal(p.mapMarker.visible,false);assert(get('mapNote').textContent.includes('braid / flat-strip'));
if(phone){for(const s of ['peek','half','full','hidden']){p.setSheet(s);p.render(false,0,[0,0,0]);assert.equal(p.getSheet(),s);assert.equal(get('sheetShow').hidden,s!=='hidden');}p.setSheet('full');p.setLabCut('patch');assert.equal(p.getSheet(),'half');get('q-return').click();assert.equal(get('panel').dataset.exploring,'false');}
console.log('PASS: cut explorer restoration, linked map selection/keyboard, challenges, mode switches, and '+(phone?(side?'landscape':'portrait')+' phone sheet':'desktop')+' wiring.');
p.setLabCut(null);p.showBraid(null);get('shape-hex').click();p.twistTo(2/3);get('cutBtn').click();p.select(0);p.render(false,0,[0,0,0]);
const geometry=p.surface.geometry,positions=Array.from(geometry.attributes.position.array),routes=JSON.stringify(p.selCore.geometry.positions);
for(const preset of win.ToroidAppearance.PALETTES){
 get('palette-'+preset.id).click();p.render(false,0,[0,0,0]);
 assert.equal(p.appearance.palette,preset.id);assert.equal(get('palette-'+preset.id).attrs['aria-pressed'],'true');
 assert.equal(p.surface.geometry,geometry);assert.deepEqual(Array.from(geometry.attributes.position.array),positions);
 assert.equal(p.getSelection(),0);assert.equal(p.state.cutTarget,1);assert.equal(JSON.stringify(p.selCore.geometry.positions),routes);
 assert.equal(win.ToroidAppearance.load(sandbox.localStorage).palette,preset.id);
 if(preset.id!=='classic')assert.equal(root.style['--red'],preset.colors[0]);
 paint([0,1,2,3,4,5],[0,2,4]);
}
get('palette-aurora').click();const custom=get('paints').children[0].children[0];custom.value='#112233';custom.dispatch('input');assert.equal(root.style['--red'],'#112233');assert(get('appearanceStatus').textContent.includes('custom paint'));
get('resetPaint').click();assert.equal(root.style['--red'],win.ToroidAppearance.PALETTES.find(x=>x.id==='aurora').colors[0]);
for(const mode of ['dark','light','system']){get('look-'+mode).click();p.render(false,0,[0,0,0]);assert.equal(root.attrs['data-theme'],mode==='system'?undefined:mode);assert.equal(win.ToroidAppearance.load(sandbox.localStorage).mode,mode);}
for(const finish of ['matte','gloss','satin']){get('finish-'+finish).click();assert.equal(p.surface.material.roughness,win.ToroidAppearance.FINISHES[finish].roughness);assert.equal(p.surface.material.metalness,win.ToroidAppearance.FINISHES[finish].metalness);}
p.setLabCut('patch');get('palette-sunset').click();p.render(false,0,[0,0,0]);const beforeTheme=Array.from(p.labSurface.geometry.attributes.color.array);get('palette-candy').click();p.render(false,0,[0,0,0]);assert.notDeepEqual(Array.from(p.labSurface.geometry.attributes.color.array),beforeTheme);p.setLabCut(null);
p.showBraid({n:3,word:[1,-2,1,-2,1,-2]});get('palette-lagoon').click();paint([0,2,1]);assert.equal(p.experiment().format,'twisted-toroids/experiment');
assert.equal(win.ToroidAppearance.load(sandbox.localStorage).palette,'lagoon');
console.log('PASS: all palettes/backgrounds/finishes, persistence, custom reset, selection and cut preservation, lab/braid colors, and renamed exports.');
