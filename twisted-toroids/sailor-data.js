/* Original, deliberately spaced rope diagrams. Not a load/rope-physics solver.
   Each guide feeds a free end along a fixed route; it never interpolates a
   closed knot into another knot. Coordinates are right-handed, z toward viewer. */
(function (root, factory) {
  const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SailorKnots = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2, BLUE = '#198a9d', RED = '#e67b59';
  const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
  const length = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
  function curve(nodes, count = 14) {
    const out = [];
    for(let i=0;i<nodes.length-1;i++) {
      const p0=nodes[Math.max(0,i-1)], p1=nodes[i], p2=nodes[i+1], p3=nodes[Math.min(nodes.length-1,i+2)];
      for(let j=0;j<count;j++) { const t=j/count,t2=t*t,t3=t2*t;
        out.push(p1.map((v,k)=>.5*((2*v)+(-p0[k]+p2[k])*t+(2*p0[k]-5*v+4*p2[k]-p3[k])*t2+(-p0[k]+3*v-3*p2[k]+p3[k])*t3)));
      }
    }
    out.push(nodes[nodes.length-1].slice()); return out;
  }
  function resample(points, count=360) {
    const sums=[0]; for(let i=1;i<points.length;i++) sums.push(sums[i-1]+length(points[i],points[i-1]));
    let j=1; return Array.from({length:count},(_,i)=>{const s=sums.at(-1)*i/(count-1);while(j<sums.length-1&&sums[j]<s)j++;return mix(points[j-1],points[j],(s-sums[j-1])/(sums[j]-sums[j-1]||1));});
  }
  function arc(axis, center, radius, start, end, alongStart, alongEnd, n=80) {
    return Array.from({length:n},(_,i)=>{const u=i/(n-1),a=start+(end-start)*u;
      return axis==='y' ? [center[0]+radius*Math.cos(a),alongStart+(alongEnd-alongStart)*u,center[1]+radius*Math.sin(a)]
        : [alongStart+(alongEnd-alongStart)*u,center[0]+radius*Math.cos(a),center[1]+radius*Math.sin(a)];});
  }
  const rope = (nodes,color=BLUE) => ({points:resample(curve(nodes)),color});
  const raw = (points,color=BLUE) => ({points:resample(points),color});
  const step = (title,text,ends) => ({title,text,ends});
  const bowline = rope([
    [-1.0,2.55,0],[-.85,1.25,0],[-.65,.45,0],[-.85,-.1,0],[-.5,-.55,0],[.2,-.5,0],[.65,.05,0],[.4,.65,0],[-.2,.8,0],[-.65,.45,.42],
    [-1.45,-.85,.25],[-1.55,-1.9,0],[-.8,-2.5,0],[.5,-2.55,0],[1.45,-1.9,0],[1.55,-.9,0],[.85,-.4,-.8],[-.3,-.05,-.8],[-.3,.3,.5],
    [-.3,1.25,.55],[-1.1,1.4,.55],[-1.5,1.2,0],[-1.1,1.2,-.55],[-.25,1.15,-.55],[.45,.95,0],[.3,.25,.5],[.22,-.1,-.45],[.35,-1.3,-.45]
  ]);
  // An open figure-eight diagram: the tail crosses over, around the standing
  // part, then through the original loop. Depth is authored at each crossing.
  const eight = rope([
    [-2.5,1.2,0],[-1.4,.65,0],[-.4,-.3,0],[.7,-1.1,0],[1.65,-.95,0],[2,-.25,0],[1.65,.5,0],[.8,.7,0],[0,.25,.42],
    [-1.0,-.55,.42],[-1.8,-.45,.42],[-2.05,.3,.42],[-1.65,1.05,-.42],[-.8,1.25,-.42],[-.1,.7,-.42],[.55,-.05,-.42],
    [1.05,-.4,-.42],[1.3,-.25,.42],[1.1,.05,.55],[.45,.5,.55],[-.05,1.2,.55],[.1,2.0,.55]
  ]);
  // Clove: two turns around a vertical post; the diagonal crossover lies in
  // front of the tail tuck. The last pass is between the post and crossover.
  const clovePoints=[[2.8,-1.2,1.0],[1.1,-1.05,1.0],
    ...arc('y',[0,0],1,Math.PI/2,Math.PI/2+TAU,-1,-.55),
    [0,-.35,1.4],[0,.35,1.4],
    ...arc('y',[0,0],1,Math.PI/2,Math.PI/2+TAU,.55,1),
    [-.6,.6,1.4],[-.45,.25,1.2],[.5,-.35,.83],[2.4,-.65,.83]];
  const clove=raw(curve(clovePoints,3));
  // Carrick's flat, alternating weave; the two ropes stay separate.
  const carrickBlue=rope([[-2.8,-1.1,0],[-1.55,-.65,0],[-.25,.7,0],[.6,1.4,0],[1.55,1.2,0],[1.9,.5,0],[1.5,-.25,0],[.5,-.6,0],[-.7,-.1,.45],[-1.6,.9,.45],[-2.6,1.25,.45]]);
  const carrickRed=rope([[2.8,1.1,.25],[1.5,.65,.45],[.15,-.8,.45],[-.7,-1.45,.45],[-1.65,-1.15,.45],[-1.95,-.45,0],[-1.5,.25,-.45],[-.6,.55,-.45],[.35,.2,-.45],[1.25,-.8,-.45],[2.6,-1.25,-.45]],RED);
  const anchorPoints=[[-.8,-2.7,0],[-.8,-1.2,0],
    ...arc('x',[.65,0],1.05,Math.PI,Math.PI+TAU,-.8,-.12),
    ...arc('x',[.65,0],1.05,Math.PI+TAU,Math.PI+2*TAU,.12,.8),
    [.85,-.7,.45],[.2,-1.1,.55],[-1.15,-1.1,.55],[-1.35,-.8,-.3],
    [-1.15,-.19,0],[-.65,-.19,0],[.5,-.19,0],[1.15,-.19,0],
    [1.3,-.8,.3],[.35,-1.6,.55],[-.8,-1.7,.55],[-1.4,-1.85,.4],[-1.45,-1.95,0],
    [-1.3,-2,-.4],[-.55,-1.95,-.4],[-.2,-1.8,0],[-.4,-1.6,.1],[.3,-2.65,.15]];
  const anchor=raw(curve(anchorPoints,3));
  function crossings(ropes) {
    const out=[];
    for(let a=0;a<ropes.length;a++)for(let b=a;b<ropes.length;b++){
      const p=ropes[a].points,q=ropes[b].points;
      for(let i=0;i<p.length-1;i++)for(let j=a===b?i+3:0;j<q.length-1;j++){
        const A=p[i],B=p[i+1],C=q[j],D=q[j+1],u=[B[0]-A[0],B[1]-A[1]],v=[D[0]-C[0],D[1]-C[1]],s=[C[0]-A[0],C[1]-A[1]],det=u[0]*v[1]-u[1]*v[0];
        if(Math.abs(det)<1e-10)continue;
        const t=(s[0]*v[1]-s[1]*v[0])/det,r=(s[0]*u[1]-s[1]*u[0])/det;
        if(t>0&&t<1&&r>0&&r<1)out.push({a,b,i:i+t,j:j+r,zA:A[2]+t*(B[2]-A[2]),zB:C[2]+r*(D[2]-C[2])});
      }
    }
    return out;
  }
  function heights(rope,anchors){
    anchors=[[0,0],...anchors,[rope.points.length-1,0]].sort((a,b)=>a[0]-b[0]);let j=1;
    rope.points=rope.points.map((p,i)=>{while(j<anchors.length-1&&anchors[j][0]<i)j++;const a=anchors[j-1],b=anchors[j],t=Math.max(0,Math.min(1,(i-a[0])/(b[0]-a[0]))),u=t*t*(3-2*t);return [p[0],p[1],a[1]+(b[1]-a[1])*u];});
  }
  // The figure-eight has Gauss word A B C D B A D C. An alternating
  // assignment gives its standard reduced four-crossing diagram.
  const eightCross=crossings([eight]);
  const eightVisits=eightCross.flatMap((c,k)=>[{at:c.i,k,side:'i'},{at:c.j,k,side:'j'}]).sort((a,b)=>a.at-b.at);
  heights(eight,eightVisits.map((v,i)=>[v.at,i%2===0?.3:-.3]));
  // The flat Carrick mat alternates at all eight crossings on both ropes.
  const carrickCross=crossings([carrickBlue,carrickRed]);
  const blueVisits=carrickCross.flatMap((c,k)=>[...(c.a===0?[{at:c.i,k,side:'i'}]:[]),...(c.b===0?[{at:c.j,k,side:'j'}]:[])]).sort((a,b)=>a.at-b.at);
  const blueHeights=blueVisits.map((v,i)=>[v.at,i%2===0?-.3:.3]);
  const redHeights=[];
  blueVisits.forEach((v,i)=>{const c=carrickCross[v.k];if(c.b===1)redHeights.push([c.j,-blueHeights[i][1]]);});
  for(const c of carrickCross.filter(c=>c.a===1))redHeights.push([c.i,.3],[c.j,-.3]);
  heights(carrickBlue,blueHeights);heights(carrickRed,redHeights);
  const KNOTS = [
    {id:'bowline',name:'Bowline',kind:'Loop',number:'01',summary:'A fixed loop, made with one working end.',use:'A loop at the end of a line.',ropes:[bowline],support:null,source:'bowline-knot',
      note:'The tail finishes inside the large loop. An unloaded bowline can work loose.',
      steps:[step('Leave a long tail','The standing part stays still. Leave enough working end for a large loop.',[.13]),step('Make the small loop','Cross the working part over the standing part to make the small nipping loop.',[.27]),step('Make the big loop','Bring the long end around to create the loop that will remain in the finished bowline.',[.62]),step('Come up through','Pass the working end up through the small loop.',[.69]),step('Go around the standing part','Take the end behind and around the standing part to make the collar.',[.89]),step('Go back through','Return through the small loop. The tail rests inside the large loop.',[1])]},
    {id:'figure-eight',name:'Figure-eight',kind:'Stopper',number:'02',summary:'A familiar stopper with an over-and-under path.',use:'A stopper at the end of a line.',ropes:[eight],support:null,source:'figure-8-knot',
      note:'This is the single-rope stopper, not a rethreaded figure-eight loop.',
      steps:[step('Start with a tail','Follow the orange tip: it marks the working end.',[.12]),step('Make the first loop','Cross the working end over the standing part.',[.50]),step('Go around the standing part','Take the end underneath, then around the standing part.',[.76]),step('Thread the loop','Bring the working end through the first loop.',[.91]),step('Finish the stopper','Trace the two lobes and their alternating over-and-under crossings.',[1])]},
    {id:'clove-hitch',name:'Clove hitch',kind:'Hitch',number:'03',summary:'Two turns and a tuck around a post.',use:'A temporary attachment around a post.',ropes:[clove],support:{type:'post',axis:'y',radius:.68,length:4.6,center:[0,0,0]},source:'clove-hitch-knot-rope-end',
      note:'The post is part of this arrangement. A clove hitch can slip or bind.',
      steps:[step('Bring the line to the post','The post stays in place while the working end travels around it.',[.1]),step('Take the first turn','Wrap once around the post.',[.40]),step('Cross over','Bring the working end across the first turn.',[.50]),step('Take the second turn','Wrap around the post a second time.',[.80]),step('Tuck under the crossover','Pass the working end beneath the diagonal crossover.',[1])]},
    {id:'carrick-bend',name:'Carrick bend',kind:'Bend',number:'04',summary:'Two ropes woven into a generous, open mat.',use:'A bend joining two separate lines.',ropes:[carrickBlue,carrickRed],support:null,source:'carrick-bend-knot',
      note:'Shown in its open mat form. Under tension, the dressed bend changes shape.',
      steps:[step('Make a loop in blue','Cross the blue tail under its standing part.',[1,0]),step('Introduce the second line','Bring the coral line into the weave.',[1,.16]),step('Follow over and under','Weave around the blue ends, keeping the two lines distinct.',[1,.48]),step('Weave across the loop','Continue across the loop with alternating over-and-under passes.',[1,.79]),step('Finish with opposite tails','The free ends leave at diagonally opposite corners of the mat.',[1,1])]},
    {id:'anchor-hitch',name:'Anchor hitch',kind:'Hitch',number:'05',summary:'Two round turns followed by two half hitches.',use:'A traditional hitch to a ring or round support.',ropes:[anchor],support:{type:'post',axis:'x',radius:.72,length:4.7,center:[0,.65,0]},source:'anchor-hitch-knot',
      note:'Also called the fisherman’s hitch. A round bar stands in for the attachment ring.',
      steps:[step('Bring the line to the support','Leave a working end long enough for the turns and hitches.',[.09]),step('Take two round turns','Wrap twice around the support and leave the turns loose.',[.60]),step('Pass under the turns','Bring the working end across the standing part, then through the loose turns.',[.79]),step('Add the second half hitch','Make another half hitch around the standing part.',[.94]),step('Inspect the route','Follow both wraps and both hitches before returning to the start.',[1])]},
  ];
  function prefix(points,t) {
    t=Math.max(0,Math.min(1,Number.isFinite(t)?t:0));
    const n=(points.length-1)*t,i=Math.floor(n),out=points.slice(0,i+1);
    if(i<points.length-1)out.push(mix(points[i],points[i+1],n-i)); return out;
  }
  function endsAt(knot,progress) {
    const x=Math.max(0,Math.min(knot.steps.length-1,progress)),i=Math.floor(x),a=knot.steps[i].ends,b=knot.steps[Math.min(i+1,knot.steps.length-1)].ends;
    return a.map((v,j)=>v+(b[j]-v)*(x-i));
  }
  // A trefoil-shaped, OPEN toroidal winding. The small gap is intentional.
  // This winding is a new arrangement of free ends, not a closed-knot isotopy.
  function winding(index=0,total=1) {
    return Array.from({length:360},(_,i)=>{
      const t=.10+(TAU-.20)*i/359,a=2*t+index*Math.PI, b=3*t, R=1.7, r=.62+(total>1?index*.22:0);
      return [(R+r*Math.cos(b))*Math.cos(a),(R+r*Math.cos(b))*Math.sin(a),r*Math.sin(b)];
    });
  }
  // Reverse the guide first; all supports leave before the toroidal guide starts.
  // At the midpoint, a short straight segment marks the remaining free rope.
  function transition(knot,t) {
    t=Math.max(0,Math.min(1,Number.isFinite(t)?t:0));
    const phase=t<.45?'unthread':t<.58?'free':'wind',minimum=.035;
    const base=knot.ropes.map((r,i)=>{
      const target=winding(i,knot.ropes.length);
      let points;
      if(phase==='unthread')points=prefix(r.points,1-(1-minimum)*t/.45);
      else if(phase==='wind')points=prefix(target,minimum+(1-minimum)*(t-.58)/.42);
      else {
        const a=resample(prefix(r.points,minimum),16),b=resample(prefix(target,minimum),16),u=(t-.45)/.13,v=u*u*(3-2*u);
        points=a.map((p,j)=>mix(p,b[j],v));
      }
      return {color:r.color,points};
    });
    return {phase,ropes:base,support:phase==='unthread'?knot.support:null,torus:phase==='wind'};
  }
  return {KNOTS,curve,resample,prefix,endsAt,winding,transition,crossings,BLUE,RED};
});
