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
  getContext(){return new Proxy({}, {get(t,p){return t[p]||(()=>{});},set(t,p,v){t[p]=v;return true;}});},toBlob(cb){cb({size:1});},remove(){},getBoundingClientRect(){return {width:600,height:550,left:0,top:0};}};
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
class Curve{constructor(points){this.points=points;}}
class TubeGeometry extends Geometry{constructor(curve,segments,radius,radial,closed){super();this.curve=curve;this.parameters={segments,radius,radial,closed};const P=[],I=[];curve.points.forEach((p,i)=>{for(let k=0;k<3;k++)P.push(i,k,0);const a=3*i,b=3*((i+1)%curve.points.length);I.push(a,a+1,b,a+1,b+1,b,a+1,a+2,b+1,a+2,b+2,b+1,a+2,a,b+2,a,b,b+2);});this.attributes.position=new Attribute(new Float32Array(P),3);this.index=new Attribute(new Uint32Array(I),1);}}
const THREE={Curve,CatmullRomCurve3:Curve,TubeGeometry,FrontSide:0,BackSide:1,DoubleSide:2,MathUtils:{degToRad:x=>x*Math.PI/180},Color,Vector2:Vector,Vector3:Vector,Spherical:class{},Scene:Object3D,PerspectiveCamera:Object3D,HemisphereLight:Object3D,DirectionalLight:Object3D,Mesh:Object3D,BufferGeometry:Geometry,BufferAttribute:Attribute,Float32BufferAttribute:FloatAttribute,MeshStandardMaterial:Material,MeshBasicMaterial:Material,SphereGeometry:Geometry,WebGLRenderer:Renderer,Raycaster,SRGBColorSpace:'srgb'};
const phone=process.argv.includes('--phone'),side=process.argv.includes('--landscape'),animate=process.argv.includes('--animate');
const win={BraidControls:require(process.cwd()+'/braid-controls.js'),innerHeight:phone?844:900,innerWidth:phone?390:1200,ToroidCutAnimation:require(process.cwd()+'/cut-animation.js'),ToroidAppearance:require(process.cwd()+'/appearance.js'),TorusExplore:require(process.cwd()+'/explore.js'),KnotMath:require(process.cwd()+'/knotmath.js'),MeshKit:require(process.cwd()+'/meshkit.js'),BraidEditor:require(process.cwd()+'/braid-editor.js'),SeifertSurface:require(process.cwd()+'/seifert.js'),SurfaceLab:require(process.cwd()+'/surfaces.js'),KnotRelax:require(process.cwd()+'/relax.js'),addEventListener(){},matchMedia(q){return {matches:(!animate&&q.includes('reduced-motion'))||(phone&&q.includes('max-width'))||(side&&q.includes('orientation: landscape')),addEventListener(){}};}};
const sandbox={KnotMath:win.KnotMath,THREE,OrbitControls,Line2:Object3D,LineSegments2:Object3D,LineMaterial:Material,LineGeometry:Geometry,LineSegmentsGeometry:Geometry,window:win,document:{documentElement:root,body:el(),getElementById:get,createElement:el,querySelectorAll(s){const key={'#shapeSeg button':'shape','#twistSeg button':'k','#modeSeg button':'mode','#braidExamples button':'word'}[s];return buttons.filter(b=>key in b.dataset);}},getComputedStyle(){return {getPropertyValue(k){return root.style[k]||palette[k]||'#888888';}};},MutationObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}},location:{hash:'',href:'https://example.test/'},history:{replaceState(){}},performance:{now(){return 0;}},requestAnimationFrame(){},setTimeout(f){timers.push(f);},URLSearchParams,console,Blob:class{constructor(parts){this.parts=parts;}},URL:{createObjectURL(){return 'blob:x';},revokeObjectURL(){}}};
vm.createContext(sandbox);
const savedPreferences=new Map();
sandbox.localStorage={getItem:k=>savedPreferences.get(k)??null,setItem:(k,v)=>savedPreferences.set(k,v)};
sandbox.document.querySelector=s=>get(s);
sandbox.document.createElementNS=(ns,tag)=>el(tag);
sandbox.document.addEventListener=()=>{};
get('.lab').parentElement=el(); get('.notes').parentElement=get('.lab').parentElement;
get('stageTools').getBoundingClientRect=()=>({width:370,height:202,left:10,top:10,bottom:212});
vm.runInContext(source.replace('setTimeout(start, 30);','window.probe={state,appearance,experiment,render,syncSurface,surface,surfacePoint,cutTips,cutInfo,showBraid,twistTo,updatePositions,select,clearSelection,selCore,selEdge,retint,frame,setLabCut,labSurface,labBoundary,mapMarker,chooseMapPoint,syncExplore,setSheet,syncQuick,getShape:shapeOf,getViewShift:()=>viewShift,getSheet:()=>sheet,getMapPick:()=>mapPick,getSelection:()=>sel,getVertexPieces:()=>vPiece,getPalette:()=>pal,makeSTL,getLabModel:()=>labModel,getRelax:()=>relax,getSeif:()=>seifData,setLabSurface,getLabLoops:()=>labLoops,braidEditor,setRelax,identifyBraid}; setTimeout(start,30);'),sandbox);
timers.shift()();assert(!get('hud').textContent.includes('failed'));
const p=win.probe,toggle=get('cutColors'),legend=get('cutColorLegend');get('seam').checked=false;
if(animate){
 let clock=0;const tick=n=>{for(let i=0;i<n;i++){clock+=50;p.frame(clock);assert(!get('hud').textContent.includes('failed'),get('hud').textContent);}};
 const sample=u=>{const out=[];p.surfacePoint(0,0,u*Math.PI*2,out,0);return out;};
 const near=sample(.05),far=sample(.5),geometry=p.cutTips[0].geometry;
 get('mapDetails').open=true;get('cutBtn').click();assert.equal(p.state.cut,0);tick(20);
 assert(p.state.cut>0&&p.state.cut<.5);assert.notDeepEqual(sample(.05),near);assert.deepEqual(sample(.5),far);
 assert.equal(p.cutTips.filter(t=>t.visible).length,4);assert(get('hud').textContent.includes('Cutting paint boundaries'));assert(get('mapNote').textContent.includes('Cutting'));
 const beforeReverse=sample(.15),progress=p.state.cut;get('cutBtn').click();assert.equal(p.state.cut,progress);assert.deepEqual(sample(.15),beforeReverse);
 tick(1);assert(get('hud').textContent.includes('Gluing paint boundaries'));tick(19);assert.equal(p.state.cut,0);assert.deepEqual(sample(.05),near);assert(p.cutTips.every(t=>!t.visible));
 get('cutBtn').click();tick(72);assert.equal(p.state.cut,1);assert(p.cutTips.every(t=>!t.visible));assert(get('mapNote').textContent.includes('Paint boundaries are now cut'));
 get('cutBtn').click();tick(72);assert.equal(p.state.cut,0);assert.deepEqual(sample(.5),far);assert(p.cutTips.every(t=>t.geometry===geometry));
 get('cutBtn').click();tick(10);const paused=p.state.cut;p.setLabCut('patch');tick(10);assert.equal(p.state.cut,paused);assert(p.cutTips.every(t=>!t.visible));p.setLabCut(null);tick(1);assert(p.state.cut>paused);
 p.showBraid({n:2,word:[1,1,1]});tick(1);assert(p.cutTips.every(t=>!t.visible));p.showBraid(null);
 for(const [shape,count] of [['band2',2],['band3',4],['gear',16]]){
  get('shape-'+shape).click();get('cutBtn').click();tick(20);assert.equal(p.cutTips.filter(t=>t.visible).length,count);
  get('cutBtn').click();tick(72);assert.equal(p.state.cut,0);
 }
 p.state.twisting=true;get('cutBtn').click();assert.equal(p.state.cutTarget,0);p.state.twisting=false;
 console.log('PASS: timed cut and reverse glue, moving tips, local mesh opening, unchanged material ahead, progress readouts/map, pause in explorer, mode cleanup and geometry reuse.');
 // Construction shortcuts share the full controls' animations without opening the sheet.
 get('shape-circle').click();p.setSheet('hidden');get('q-cut').click();tick(10);
 assert(p.state.cut>0);get('q-build').click();
 assert.equal(p.state.building,true);assert.equal(p.state.m,0);assert.equal(p.state.cut,0);assert.equal(p.state.cutTarget,0);
 assert.equal(p.getSheet(),'hidden');tick(40);assert(p.state.m>0&&p.state.m<1);assert(p.cutTips.every(t=>!t.visible));
 tick(140);assert.equal(p.state.m,2);assert.equal(p.state.building,false);
 get('q-cut').click();tick(10);get('q-grow').click();
 assert.equal(p.state.growing,true);assert.equal(p.state.grow,0);assert.equal(p.state.cut,0);assert.equal(p.state.cutTarget,0);
 tick(40);assert(p.state.grow>0&&p.state.grow<1);tick(110);assert.equal(p.state.grow,null);assert.equal(p.state.growing,false);
 assert.equal(p.getSheet(),'hidden');
 p.setSheet('peek');get('q-grow').click();tick(30);get('q-build').click();
 assert.equal(p.state.grow,null);assert.equal(p.state.growing,false);assert.equal(p.state.building,true);
 tick(40);get('q-grow').click();assert.equal(p.state.building,false);assert.equal(p.state.growing,true);assert.equal(p.state.m,2);
 get('shape-band2').click();get('q-build').click();assert.equal(p.state.growing,false);assert.equal(p.state.m,1);
 tick(90);assert.equal(p.state.m,2);assert.equal(p.state.building,false);assert.equal(p.getSheet(),'peek');
 console.log('PASS: quick sheet/shape construction, intermediate and completed animations, cut reset, switching constructions, flat strips, and preserved hidden/peek sheet state.');
 process.exit(0);
}
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
p.twistTo(-2/3);get('cutBtn').click();get('challengeCheck').click();assert(get('challengeFeedback').textContent.startsWith('Solved!'),JSON.stringify({message:get('challengeFeedback').textContent,state:p.state,disabled:get('cutBtn').disabled}));assert.equal(get('challengeProgress').textContent,'3 of '+win.TorusExplore.CHALLENGES.length+' solved this session.');
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
p.showBraid(null);p.setLabCut(null);
assert.equal(get('q-shape').children.length,20);
assert.deepEqual(get('q-shape').children.map(o=>o.value),buttons.filter(b=>'shape' in b.dataset).map(b=>b.dataset.shape));
for(const size of ['hidden','peek','half','full']){
 p.setSheet(size);p.render(false,0,[0,0,0]);
 assert.equal(get('mobileTools').hidden,!phone||!['hidden','peek'].includes(size));
}
p.setSheet('hidden');
get('q-shape').value='hex';get('q-shape').dispatch('change');p.twistTo(0);
get('q-plus').click();assert(Math.abs(p.state.twistTo-1/6)<1e-9);assert.equal(p.getSheet(),'hidden');
assert.equal(get('q-plus').attrs['aria-label'],'Add ⅙ turn');
get('q-minus').click();assert.equal(p.state.twistTo,0);
get('q-cut').click();assert.equal(p.state.cutTarget,1);assert.equal(get('q-cut').textContent,'Glue');assert.equal(p.getSheet(),'hidden');
get('q-cut').click();assert.equal(p.state.cutTarget,0);assert.equal(get('q-cut').textContent,'Cut');
get('shape-hept').click();assert.equal(get('q-shape').value,'hept');
p.twistTo(.25);assert.equal(get('q-cut').disabled,true);get('q-cut').click();assert.equal(p.state.cutTarget,0);
p.twistTo(1/7);p.state.twisting=true;p.syncQuick();assert.equal(get('q-cut').disabled,true);p.state.twisting=false;p.syncQuick();assert.equal(get('q-cut').disabled,false);
p.render(false,0,[0,0,0]);if(phone)assert(p.getViewShift()<0,'camera reserves the space above the model');
p.showBraid({n:2,word:[1,1,1]});assert.equal(get('mobileTools').hidden,true);
p.showBraid(null);assert.equal(get('mobileTools').hidden,!phone);
p.setLabCut('patch');assert.equal(get('mobileTools').hidden,true);p.setLabCut(null);assert.equal(get('mobileTools').hidden,!phone);
assert.equal(p.getSheet(),'hidden');
console.log('PASS: collapsed/hidden top toolbar, all shape options, shared twist/cut actions, invalid/animating cut guards, view offset, and braid/lab visibility.');
// The material remains continuous at the original gluing seam during the cut.
const TAU=2*Math.PI;
for(const button of buttons.filter(b=>'shape' in b.dataset)){
 button.click();const sh=p.getShape(),n=sh.colors.length;
 const step=sh.sym?1/sh.sym:.5;
 for(const turn of [-step,0,step]){
 p.twistTo(turn);const ci=p.cutInfo();assert(ci.ok);
 for(const t of [.04,.3,.65,.96]){
  p.state.cut=t;
  for(let piece=0;piece<n;piece++)for(const f of [-.35,0,.35]){
   const phi=sh.open?-sh.half+(piece+.5+f)*2*sh.half/n:(piece+f)*TAU/n;
   const next=ci.a.sigma(piece),nextPhi=sh.open?(Math.abs(Math.round(2*turn))%2?-phi:phi):phi+turn*TAU;
   const a=[],b=[];p.surfacePoint(piece,phi,TAU,a,0);p.surfacePoint(next,nextPhi,0,b,0);
   assert(Math.hypot(...a.map((x,i)=>x-b[i]))<1e-7,`seam gap: ${button.dataset.shape}, ${t}, ${piece}`);
  }
 }
 }
}
console.log('PASS: progressive cuts preserve the glued seam on all 20 cross-sections, including Möbius bands.');

// ---------- features added with the knot table, Seifert surfaces, the general cut explorer, the editor and relaxation ----------
{
 const MK=win.MeshKit,KM=win.KnotMath,EX=win.TorusExplore;
 let clock=1000;const tick1=()=>{clock+=16;p.frame(clock);};
 const closed=made=>{const W=MK.weld(made.positions,made.indices,1e-6),E=MK.edgeFaces(W.indices);return [...E.values()].every(l=>l.length===2);};
 const walk=(node,pred,out=[])=>{if(pred(node))out.push(node);(node.children||[]).forEach(c=>walk(c,pred,out));return out;};
 p.setLabCut(null);p.showBraid(null);
 // Jones polynomial and table names in the exact description
 p.showBraid({n:2,word:[1,1,1]});
 assert.equal(get('x-jones').textContent,'−t⁴ + t³ + t');assert.match(get('x-name').textContent,/right-handed trefoil/);
 tick1();assert.match(get('hud').textContent,/right-handed trefoil/);
 p.showBraid({n:2,word:[-1,-1,-1]});assert.match(get('x-name').textContent,/left-handed trefoil/);
 const ex=p.experiment();assert.equal(ex.jones.text,'t⁻¹ + t⁻³ − t⁻⁴');assert.deepEqual(ex.tableNames,['3_1']);assert.equal(ex.seifert.genus,1);assert.equal(ex.seifert.homogeneous,true);
 for(const [n,word,genus,pieces] of [[3,[],0,3],[4,[1,1,1],1,3],[4,[1,3,1,3],0,2]]) {
  p.showBraid({n,word});const sf=p.experiment().seifert;
  assert.equal(sf.genus,genus);assert.equal(sf.pieces,pieces);assert.match(sf.note,/sum of the genera/);
 }
 // the table picker draws an entry from its braid word
 get('tablePick').value='6_2';get('tablePick').dispatch('change');assert.match(get('x-name').textContent,/6₂/);
 // the diagram editor: add, flip and delete crossings through its own buttons
 p.showBraid({n:3,word:[]});
 const editorBox=get('braidEditor'),gens=()=>walk(editorBox,n=>n.attrs&&n.attrs.class==='be-gen');
 assert.equal(gens().length,4);
 for(const label of ['σ₁','σ₂⁻¹','σ₁','σ₂⁻¹'])gens().find(b=>b.text===label).click();
 assert.deepEqual(p.state.braid.word,[1,-2,1,-2]);assert.match(get('x-name').textContent,/figure-eight/);
 const hits=()=>walk(editorBox,n=>n.tag==='rect'&&n.attrs.class==='be-hit');
 assert.equal(hits().length,4);hits()[1].dispatch('click');assert.deepEqual(p.state.braid.word,[1,-2,1,-2]);
 walk(editorBox,n=>n.attrs['aria-label']==='Flip selected crossing')[0].click();assert.deepEqual(p.state.braid.word,[1,2,1,-2]);
 walk(editorBox,n=>n.tag==='button'&&n.text==='Tap deletes')[0].click();hits()[1].dispatch('click');assert.deepEqual(p.state.braid.word,[1,1,-2]);
 walk(editorBox,n=>n.tag==='button'&&n.text==='Remove last crossing')[0].click();assert.deepEqual(p.state.braid.word,[1,1]);
 walk(editorBox,n=>n.tag==='button'&&n.attrs['aria-label']==='One strand more')[0].click();assert.equal(p.state.braid.n,4);
 // One history covers diagram edits, examples, strand counts and typed words.
 get('braidUndo').click();assert.equal(p.state.braid.n,3);assert.deepEqual(p.state.braid.word,[1,1]);
 get('braidRedo').click();assert.equal(p.state.braid.n,4);
 p.braidEditor.setMode('select');p.showBraid({n:3,word:[1,-2]});
 hits()[0].dispatch('click');const insertion=walk(editorBox,n=>n.attrs['aria-label']==='Insert crossing position')[0];
 insertion.value='before';gens().find(b=>b.text==='σ₂').click();assert.deepEqual(p.state.braid.word,[2,1,-2]);
 get('braidUndo').click();assert.deepEqual(p.state.braid.word,[1,-2]);
 walk(editorBox,n=>n.tag==='button'&&n.text==='⇄ Mirror braid')[0].click();assert.deepEqual(p.state.braid.word,[-1,2]);assert(get('braidRedo').disabled);
 get('braidUndo').click();assert.deepEqual(p.state.braid.word,[1,-2]);
 walk(editorBox,n=>n.tag==='button'&&n.text==='Clear')[0].click();assert.deepEqual(p.state.braid.word,[]);
 get('braidUndo').click();assert.deepEqual(p.state.braid.word,[1,-2]);
 assert.equal(get('braidInput').value,'s1 S2');assert.equal(get('braidStrands').value,'3');
 p.showBraid({n:1,word:[]});assert.equal(p.braidEditor.n,1);assert.equal(gens().length,0);assert(get('braidStats').textContent.includes('1 strand'));
 // Custom styling keeps centerlines and exact invariants, and uses matching component colors.
 p.showBraid({n:3,word:[1,-2,1,-2,1,-2]});p.clearSelection();p.syncSurface();
 const beforeStyle=Array.from(p.surface.geometry.attributes.position.array), beforeMath=['x-jones','x-alex','x-matrix'].map(id=>get(id).textContent);
 const colorInput=get('braidComponentColors').children[1].children[0];colorInput.value='#12abef';colorInput.dispatch('input');
 match(rows()[1],rgb(new Color('#12abef')));assert.equal(get('x-stripes').children[1].style.color,'#12abef');
 get('braidWidth').value='140';get('braidWidth').dispatch('input');p.syncSurface();
 const afterStyle=p.surface.geometry.attributes.position.array;
 assert.notDeepEqual(Array.from(afterStyle),beforeStyle);
 for(let i=0;i<beforeStyle.length;i+=6)for(let k=0;k<3;k++)assert(Math.abs(beforeStyle[i+k]+beforeStyle[i+3+k]-afterStyle[i+k]-afterStyle[i+3+k])<1e-6,'ribbon centerlines unchanged');
 assert.deepEqual(['x-jones','x-alex','x-matrix'].map(id=>get(id).textContent),beforeMath);
 assert.equal(JSON.parse(savedPreferences.get(win.BraidControls.KEY)).width,1.4);
 assert.equal(JSON.parse(savedPreferences.get(win.BraidControls.KEY)).colors[1],'#12abef');
 get('braidStyleReset').click();assert.equal(get('braidWidth').value,'100');paint([0,2,1]);
 p.setSheet('hidden');p.syncQuick();assert.equal(get('braidToolbar').hidden,false);p.setLabCut('meridian');p.syncQuick();assert.equal(get('braidToolbar').hidden,true);p.setLabCut(null);p.syncQuick();assert.equal(get('braidToolbar').hidden,false);
 console.log('PASS: braid selection/insertion/mirror/clear/undo/redo, single strand, persistent component colors, ribbon widths preserve centerlines/invariants, toolbar visibility.');
 // Pull tool starts from the original braid, pauses between gestures, and cleans up.
 get('braidViewPull').click();p.render(false,0,[0,0,0]);
 assert(p.getRelax().paused);assert.equal(get('braidPullOptions').hidden,false);assert.equal(get('pullComponent').children.length,4);
 const pullStart=Array.from(p.getRelax().S.P);tick1();assert.deepEqual(Array.from(p.getRelax().S.P),pullStart);
 get('pullTighten').click();tick1();assert.notDeepEqual(Array.from(p.getRelax().S.P),pullStart);
 get('pullTighten').click();const held=Array.from(p.getRelax().S.P);tick1();assert.deepEqual(Array.from(p.getRelax().S.P),held);
 get('pullReset').click();p.render(false,0,[0,0,0]);assert.deepEqual(Array.from(p.getRelax().S.P),pullStart);
 get('pullUndo').click();p.render(false,0,[0,0,0]);assert.deepEqual(Array.from(p.getRelax().S.P),held);
 get('braidViewRibbon').click();assert.equal(get('braidPullOptions').hidden,true);assert.equal(p.getRelax(),null);
 console.log('PASS: Pull view, paused geometry, tightening, pause, reset, shape undo and view cleanup.');
 // Seifert surface: shown instead of the ribbons, with its genus, and printable
 p.showBraid({n:3,word:[1,-2,1,-2]});const sb=get('seifertBox');sb.checked=true;sb.dispatch('change');p.render(false,0,[0,0,0]);
 assert.equal(p.getSeif().genus,1);assert.equal(p.surface.visible,false);tick1();assert.match(get('hud').textContent,/Seifert surface · genus 1/);
 assert.match(get('x-seifert').textContent,/3 disks \+ 4 bands · χ = −1 · genus 1/);assert.match(get('x-seifert-note').textContent,/the knot has genus 1/);
 let made=p.makeSTL();assert(made&&closed(made),'Seifert STL is a closed solid');
 sb.checked=false;sb.dispatch('change');p.render(false,0,[0,0,0]);assert.equal(p.surface.visible,true);
 // relaxation runs through the frame loop and keeps the knot
 get('relaxBtn').click();assert(p.getRelax());for(let i=0;i<40;i++)tick1();
 assert(p.getRelax().S.steps>0);assert.equal(p.surface.visible,false);assert.match(get('hud').textContent,/Relax/);
 made=p.makeSTL();assert(made&&made.indices.length>0,'relaxed tubes export');
 get('relaxBtn').click();assert.equal(p.getRelax(),null);
 // Oversized relaxation is rejected before changing the displayed braid or view.
 p.showBraid({n:10,word:Array(110).fill(1)});get('relaxBtn').click();
 assert.equal(p.getRelax(),null);assert.match(get('x-status').textContent,/too large to relax/);
 // the twisted torus and braid ribbons export as closed solids too
 p.showBraid(null);get('shape-hex').click();p.twistTo(1/3);made=p.makeSTL();assert(closed(made),'torus STL closed');
 get('cutBtn').click();made=p.makeSTL();assert(closed(made),'cut torus STL closed');get('cutBtn').click();
 get('shape-band2').click();p.twistTo(0.5);made=p.makeSTL();assert(closed(made),'Möbius strip STL closed');
 p.showBraid({n:3,word:[1,-2,1,-2,1,-2]});made=p.makeSTL();assert(closed(made),'braid ribbons STL closed');
 get('x-png').click();assert.match(get('x-status').textContent,/Saved twisted-toroids-braid-.*\.png/);
 get('x-stl').click();assert.match(get('x-status').textContent,/Saved twisted-toroids-braid-.*\.stl/);
 console.log('PASS: Jones and table names in readouts, HUD and export; table picker; diagram editor add/flip/delete/strands; Seifert view, genus and STL; relaxation in the frame loop; PNG and closed STL solids for torus, cut, Möbius strip and braid.');
 // the general cut explorer: Klein bottle presets, slopes, and loops drawn by tapping the map
 p.showBraid(null);
 p.setLabSurface('klein');assert.equal(get('labCut').children.length,5);
 p.setLabCut('k-closed');p.render(false,0,[0,0,0]);assert.equal(get('labOrient').textContent,'One-sided');assert.equal(get('labPieces').textContent,'1');
 for(const kind of ['k-closed','k-meridian','k-core','k-draw']) {
  p.setLabCut(kind);assert.throws(()=>p.makeSTL(),/STL export is unavailable for Klein-bottle/);
  get('x-stl').click();assert.match(get('x-status').textContent,/Save a picture instead/);
 }
 p.setLabCut('k-between');assert.equal(get('labPieces').textContent,'2');assert.match(get('labResult').textContent,/2 Möbius bands/);
 assert.throws(()=>p.makeSTL(),/STL export is unavailable for Klein-bottle/);
 get('x-png').click();assert.match(get('x-status').textContent,/Saved .*\.png/);
 p.render(false,0,[0,0,0]);p.chooseMapPoint(.5,.5);p.syncExplore();assert.equal(p.mapMarker.visible,true);
 p.setLabSurface('torus');p.setLabCut('slope');get('labA').value='2';get('labB').value='4';get('labA').dispatch('input');
 assert.equal(get('labPieces').textContent,'2');assert.match(get('labWhy').textContent,/factor 2/);
 p.setLabCut('draw');get('mapDetails').open=true;
 const tap=(u,v)=>{const x=(36+568*u)*600/640,y=(28+212*(1-v))*550/280;get('flatMap').dispatch('pointerdown',{clientX:x,clientY:y});get('flatMap').dispatch('pointerup',{clientX:x,clientY:y});};
 for(const [u,v] of [[.1,.5],[.45,.55],[.8,.5]])tap(u,v);
 assert.equal(get('labClose').disabled,false);get('labClose').click();assert.match(get('labResult').textContent,/annulus/);assert.equal(p.getLabLoops()[0].a,1);
 get('flatMap').dispatch('keydown',{key:'ArrowUp'});
 for(const [u,v] of [[.5,.1],[.55,.45],[.5,.8]])tap(u,v);get('labClose').click();assert.match(get('labResult').textContent,/One piece, a disk/);
 get('labUndo').click();assert.equal(p.getLabLoops().length,1);get('labClear').click();assert.equal(p.getLabLoops().length,0);assert.match(get('labResult').textContent,/a torus, with no boundary/);
 get('flatMap').dispatch('keydown',{key:'Enter'});get('flatMap').dispatch('keydown',{key:'ArrowRight'});get('flatMap').dispatch('keydown',{key:'Enter'});
 assert.match(get('labDrawStatus').textContent,/2 points/);get('flatMap').dispatch('keydown',{key:'Escape'});assert.match(get('labDrawStatus').textContent,/Tap the map/);
 p.setLabCut(null);
 console.log('PASS: Klein bottle presets and readouts, (a, b) slopes, loops drawn by tapping and by keyboard, undo/clear, marker on cut pieces.');
 // every challenge: start it, fail, then solve it through the page's own controls
 const pick=id=>{get('challengePick').value=id;get('challengePick').dispatch('change');get('challengeStart').click();};
 const check=()=>{get('challengeCheck').click();return get('challengeFeedback').textContent;};
 pick('hopf');assert.match(check(),/Cut along the color lines/);get('cutBtn').click();assert.match(check(),/^Not yet/);get('cutBtn').click();p.twistTo(1);get('cutBtn').click();assert.match(check(),/^Solved/);
 pick('cinquefoil');p.twistTo(2.5);get('cutBtn').click();assert.match(check(),/^Solved/);
 pick('four');get('shape-square').click();p.twistTo(1);get('cutBtn').click();assert.match(check(),/^Solved/);
 pick('figure8');assert.match(check(),/^Not yet/);p.showBraid({n:3,word:[1,-2,1,-2]});assert.match(check(),/^Solved/);
 pick('amphichiral');assert.match(check(),/^Not yet/);p.showBraid({n:3,word:[1,1,-2,1,-2,-2]});assert.match(check(),/^Solved/);
 pick('genus2');assert.match(check(),/^Not yet/);p.showBraid({n:2,word:[1,1,1,1,1]});assert.match(check(),/^Solved.*genus 2/);
 p.showBraid({n:3,word:[1,1,-1,1,1,1,1,1]});assert.match(check(),/^Not yet/);
 pick('brunnian');p.showBraid({n:3,word:[1,1,2,2]});assert.match(check(),/does not come apart/);p.showBraid({n:3,word:[1,-2,1,-2,1,-2]});assert.match(check(),/^Solved/);
 pick('disk');assert.equal(p.getLabModel().surface,'torus');assert.match(check(),/^Not yet/);
 for(const [u,v] of [[.1,.5],[.45,.55],[.8,.5]])tap(u,v);get('labClose').click();for(const [u,v] of [[.5,.1],[.55,.45],[.5,.8]])tap(u,v);get('labClose').click();assert.match(check(),/^Solved/);
 pick('mobius');assert.equal(p.getLabModel().surface,'klein');get('labCut').value='k-between';get('labCut').dispatch('change');assert.match(check(),/^Solved/);
 assert.equal(get('challengeProgress').textContent,EX.CHALLENGES.length+' of '+EX.CHALLENGES.length+' solved this session.');
 p.setLabCut(null);
 console.log('PASS: all '+EX.CHALLENGES.length+' challenges start in the right mode and are solved (and failed) through the page controls.');
}
