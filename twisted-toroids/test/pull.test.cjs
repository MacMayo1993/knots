const assert = require('node:assert/strict');
const KM = require('../knotmath.js'), RX = require('../relax.js');
let checks=0; const ok=(v,m)=>{checks++;assert(v,m);};
// Independent exact polygonal linking integral, not the braid word's readout.
function link(P,Q) {
  const sub=(a,b)=>a.map((x,i)=>x-b[i]), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  const angle=(a,b,c)=>{const A=Math.hypot(...a),B=Math.hypot(...b),C=Math.hypot(...c);return 2*Math.atan2(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]),A*B*C+dot(a,b)*C+dot(b,c)*A+dot(c,a)*B);};
  let sum=0;
  for(let i=0;i<P.length;i++)for(let j=0;j<Q.length;j++){
    const a=sub(P[i],Q[j]),b=sub(P[i],Q[(j+1)%Q.length]),c=sub(P[(i+1)%P.length],Q[(j+1)%Q.length]),d=sub(P[(i+1)%P.length],Q[j]);
    sum+=angle(a,b,c)+angle(a,c,d);
  }
  return sum/(4*Math.PI);
}
for(const whole of [false,true]) {
  const S=RX.create(RX.fromBraid(KM,2,[1,1])); const old=S.P.slice(), v=3;
  const target=Array.from(old.slice(3*v,3*v+3));target[0]+=1e6;
  const r=RX.step(S,{relax:false,handle:{vertex:v,target,whole}});
  ok(r.move>0&&r.move<r.gap/2,'handle force obeys cap');
  for(let i=S.start[1]*3;i<S.P.length;i++)assert.equal(S.P[i],old[i],'unselected component has no handle force');
  const delta=i=>Array.from(S.P.slice(3*i,3*i+3)).map((x,d)=>x-old[3*i+d]);
  if(whole)for(let i=0;i<S.len[0];i++)delta(i).forEach((x,d)=>ok(Math.abs(x-delta(v)[d])<1e-12,'whole component translates uniformly'));
  else assert.deepEqual(delta(Math.floor(S.len[0]/2)),[0,0,0],'local handle does not move opposite arc');
}
for(const [n,word] of [[2,[1,1,1]],[2,[1,1]],[3,[1,1,2,2]],[3,[1,-2,1,-2,1,-2]]]) {
  const S=RX.create(RX.fromBraid(KM,n,word)), expected=KM.readBraid(n,word).linking;
  const frame=RX.displayFrame(S), frozen=JSON.stringify(frame);
  for(let k=0;k<240;k++) {
    const vertex=S.start[k<120?0:S.len.length-1], before=S.P.slice();
    const r=RX.step(S,{handle:{vertex,target:[4*Math.cos(k/40),2*Math.sin(k/30),-3],whole:k>=120}});
    let actual=0;for(let i=0;i<S.N;i++)actual=Math.max(actual,Math.hypot(...[0,1,2].map(d=>S.P[3*i+d]-before[3*i+d])));
    ok(r.gap>0&&actual<r.gap/2,'collision bound: '+JSON.stringify({n,word,k,actual,...r}));
    ok(Array.from(S.P).every(Number.isFinite),'finite geometry under prolonged pulling');
  }
  const C=RX.curves(S,2.1,frame);
  for(let i=0;i<C.length;i++)for(let j=i+1;j<C.length;j++)ok(Math.abs(link(C[i],C[j])-expected[i][j])<1e-7,'pull keeps independent polygonal linking integral');
  assert.equal(JSON.stringify(frame),frozen,'display transform does not drift under pulling');
  const vertex=S.start[S.len.length-1];ok(RX.nearestVertex(S,Array.from(S.P.slice(3*vertex,3*vertex+3)),S.len.length-1)===vertex,'component-filtered picking');
}
const S=RX.create(RX.fromBraid(KM,1,[])), saved=S.P.slice();
RX.step(S,{relax:false,handle:{vertex:0,target:[NaN,0,0]}});assert.deepEqual(S.P,saved);
RX.step(S,{relax:false,handle:{vertex:-1,target:[1,0,0]}});assert.deepEqual(S.P,saved);
console.log('PASS: '+checks+' pulling checks — local/whole-component forces, large targets, per-vertex collision bounds, independent linking integrals, fixed display transform and invalid handles.');
