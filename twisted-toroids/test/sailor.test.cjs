// These are spaced threading diagrams, not rope physics. Protect the authored
// crossings, rope/support clearance, component count, and reversible guides.
const assert=require('node:assert/strict'),D=require('../sailor-data.js'),{segDist}=require('../relax.js');
let checks=0;const ok=(c,m)=>{checks++;assert(c,m);},distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function clearance(ropes){let minimum=Infinity;
 for(let a=0;a<ropes.length;a++)for(let b=a;b<ropes.length;b++){
  const p=ropes[a].points,q=ropes[b].points,P=p.flat().concat(q.flat());
  for(let i=0;i<p.length-1;i++)for(let j=a===b?i+10:0;j<q.length-1;j++)minimum=Math.min(minimum,segDist(P,i,i+1,p.length+j,p.length+j+1));
 }return minimum;
}
ok(D.KNOTS.length===5,'five practical knots');
for(const k of D.KNOTS){
 ok(k.ropes.length===(k.id==='carrick-bend'?2:1),k.id+' rope count');
 for(const r of k.ropes){ok(r.points.every(p=>p.length===3&&p.every(Number.isFinite)),k.id+' finite coordinates');ok(distance(r.points[0],r.points.at(-1))>.5,k.id+' distinct free ends');}
 const gap=clearance(k.ropes);ok(gap>2*.068+.02,k.id+' nonlocal rope clearance exceeds diameter: '+gap);
 if(k.support){const s=k.support,axis=s.axis==='x'?0:1;for(const r of k.ropes)for(const p of r.points){const v=p.map((x,i)=>x-s.center[i]);if(Math.abs(v[axis])<s.length/2)ok(Math.hypot(...v.filter((_,i)=>i!==axis))>s.radius+.068,k.id+' outside support');}}
 for(let i=0;i<k.steps.length;i++){const e=D.endsAt(k,i);assert.deepEqual(e,k.steps[i].ends);checks++;ok(e.length===k.ropes.length&&e.every((x,j)=>x>=0&&x<=1&&(!i||x>=k.steps[i-1].ends[j])),k.id+' monotone steps');}
 assert.deepEqual(k.steps.at(-1).ends,k.ropes.map(()=>1));checks++;
 const before=JSON.stringify(k.ropes);
 for(let i=0;i<=100;i++){const t=i/100,a=D.transition(k,t),b=D.transition(k,1-(1-t));ok(a.ropes.length===k.ropes.length,k.id+' no joined ropes');ok(a.ropes.every(r=>r.points.length>1&&r.points.every(p=>p.every(Number.isFinite))),k.id+' visible finite rewind');if(a.torus)ok(!a.support,k.id+' support removed before winding');for(let j=0;j<k.ropes.length;j++)ok(distance(a.ropes[j].points.at(-1),b.ropes[j].points.at(-1))<1e-10,k.id+' deterministic reverse scrub');}
 ok(JSON.stringify(k.ropes)===before,k.id+' source unchanged');assert.deepEqual(D.transition(k,0).ropes,k.ropes);checks++;ok(clearance(D.transition(k,1).ropes)>.15,k.id+' windings separated');
}
const eight=D.crossings(D.KNOTS.find(k=>k.id==='figure-eight').ropes);ok(eight.length===4,'four figure-eight crossings');
const visits=eight.flatMap((c,i)=>[{at:c.i,id:i,over:c.zA>c.zB},{at:c.j,id:i,over:c.zB>c.zA}]).sort((a,b)=>a.at-b.at);
assert.deepEqual(visits.map(v=>v.id),[0,1,2,3,1,0,3,2]);checks++;ok(visits.every((v,i)=>v.over===(i%2===0)),'figure-eight alternating Gauss diagram');
const carrick=D.crossings(D.KNOTS.find(k=>k.id==='carrick-bend').ropes);ok(carrick.length===8,'eight Carrick crossings');
for(let r=0;r<2;r++){const v=carrick.flatMap(c=>[...(c.a===r?[{at:c.i,over:c.zA>c.zB}]:[]),...(c.b===r?[{at:c.j,over:c.zB>c.zA}]:[])]).sort((a,b)=>a.at-b.at);ok(v.every((x,i)=>!i||x.over!==v[i-1].over),'Carrick rope '+r+' alternates');}
console.log('Sailor diagrams: '+checks+' checks passed.');
