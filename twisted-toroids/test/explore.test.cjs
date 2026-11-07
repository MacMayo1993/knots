const assert = require('node:assert/strict');
const E = require('../explore.js'), K = require('../knotmath.js');
let checks = 0;
function equal(a,b) { assert.deepEqual(a,b); checks++; }
// Inspect the generated simplicial surface, independently of the preset labels.
function topology(m) {
  const adj = Array.from(m.components,() => new Set()), edges = new Map();
  const faces = [];
  for (let i=0;i<m.indices.length;i+=3) {
    const tri=m.indices.slice(i,i+3); faces.push(tri);
    for (let k=0;k<3;k++) {
      const a=tri[k],b=tri[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');
      adj[a].add(b); adj[b].add(a);
      if (!edges.has(key)) edges.set(key,[]);
      edges.get(key).push([a,b]);
    }
  }
  const groups=[], seen=new Set();
  for (let v=0;v<adj.length;v++) {
    if(seen.has(v)) continue;
    const group=new Set([v]),queue=[v]; seen.add(v);
    for(const a of queue) for(const b of adj[a]) if(!seen.has(b)){seen.add(b);group.add(b);queue.push(b);}
    groups.push(group);
  }
  return groups.map(g=>{
    let edgeCount=0,faceCount=0; const boundary=new Map();
    for(const tri of faces) if(g.has(tri[0]))faceCount++;
    for(const list of edges.values()) {
      if(!g.has(list[0][0]))continue; edgeCount++;
      assert(list.length===1||list.length===2,'manifold edge');
      if(list.length===2) equal(list[0],[list[1][1],list[1][0]]); // consistent orientation
      else {
        const [a,b]=list[0];
        if(!boundary.has(a))boundary.set(a,[]); if(!boundary.has(b))boundary.set(b,[]);
        boundary.get(a).push(b); boundary.get(b).push(a);
      }
    }
    for(const nb of boundary.values())equal(nb.length,2); // each boundary is a loop
    let loops=0; const seenBoundary=new Set();
    for(const v of boundary.keys()) {
      if(seenBoundary.has(v))continue; loops++;
      const queue=[v];seenBoundary.add(v);
      for(const a of queue)for(const b of boundary.get(a))if(!seenBoundary.has(b)){seenBoundary.add(b);queue.push(b);}
    }
    return {euler:g.size-edgeCount+faceCount,boundaries:loops};
  }).sort((a,b)=>a.euler-b.euler);
}
for(const resolution of [[16,8],[96,48]])for(const kind of Object.keys(E.CUTS)) {
  const m=E.makeCutMesh(kind,...resolution), t=topology(m);
  equal(t,kind==='patch'?[{euler:-1,boundaries:1},{euler:1,boundaries:1}]:[{euler:0,boundaries:kind==='closed'?0:2}]);
  equal(t.length,E.CUTS[kind].components);
  equal(t.reduce((s,c)=>s+c.boundaries,0),E.CUTS[kind].boundaries);
  assert(m.positions.every(Number.isFinite)); checks++;
  for(let i=0;i<m.components.length;i++)equal(m.positions.slice(i*3,i*3+3),E.cutPoint(kind,m.params[i*2],m.params[i*2+1],m.components[i]));
}
for(let n=2;n<=8;n++)for(let s=-24;s<=24;s++)for(const v of [0,.01,.3,.9,1]) {
  const k=s/n,m=E.mapPoint(.7,v,n);
  equal(m.piece,Math.min(n-1,Math.floor(v*n)));
  assert(Math.abs(E.wrap(m.phi/(2*Math.PI)+.5/n)-m.v)<1e-9);checks++;
  const mate=E.seamMate(v,k);
  const a=(v-.5/n+k)*2*Math.PI,b=(mate-.5/n)*2*Math.PI;
  assert(Math.hypot(Math.cos(a)-Math.cos(b),Math.sin(a)-Math.sin(b))<1e-10);checks++;
}
function construction(n,k,extra={}) { return {description:K.describe({kind:'ring',pieces:n,turn:k}),pieces:n,turn:k,ready:true,cut:true,ring:true,...extra}; }
for(const [id,n,k] of [['three',6,.5],['three',3,0],['trefoils',6,2/3],['trefoils',6,-2/3],['mirror',3,-2/3]])equal(E.checkChallenge(id,construction(n,k)).pass,true);
for(const [id,n,k] of [['three',6,1/6],['trefoils',6,1/3],['trefoils',2,1],['mirror',3,2/3],['mirror',3,-1/3]])equal(E.checkChallenge(id,construction(n,k)).pass,false);
for(const extra of [{cut:false},{ready:false},{ring:false},{description:{ok:false}}])equal(E.checkChallenge('three',construction(6,.5,extra)).pass,false);
equal(E.checkChallenge('three',construction(6,.123)).pass,false);
assert.throws(()=>E.makeCutMesh('patch',10,8));checks++;
console.log(`PASS: ${checks} checks — mesh components, orientability, boundary loops, Euler characteristics, map seams, and challenge success/failure cases.`);
