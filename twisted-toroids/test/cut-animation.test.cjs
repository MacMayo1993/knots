const assert=require('node:assert/strict'),C=require('../cut-animation.js');
const close=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);
for(let j=0;j<=100;j++){
 const u=j/100;
 assert.equal(C.amount(0,u),0);assert.equal(C.amount(1,u),1);
 let before=0;
 for(let i=0;i<=100;i++){
  const t=i/100,e=C.amount(t,u);
  assert(e>=0&&e<=1);assert(e>=before-1e-12);before=e;
  close(e,C.amount(t,u+1));close(e,C.amount(t,1-u));
  close(C.amount(t,0),C.amount(t,1));
  if(C.distance(u)>C.reach(t))assert.equal(e,0,'ahead of the cut stays joined');
 }
}
assert(C.amount(.35,.05)>.9);assert.equal(C.amount(.35,.5),0);
assert.deepEqual(C.fronts(0),[]);assert.deepEqual(C.fronts(1),[]);assert.deepEqual(C.fronts(.95),[.5]);
const tips=C.fronts(.4);close(tips[0]+tips[1],1);tips.forEach(u=>close(C.amount(.4,u),0));
let p=0;for(let i=0;i<72;i++)p=C.advance(p,1,.05);assert.equal(p,1);
for(let i=0;i<72;i++)p=C.advance(p,0,.05);assert.equal(p,0);
close(C.advance(.4,1,0),.4);close(C.advance(.4,0,0),.4);
const f=C.advance(.4,1,.05);close(C.advance(f,0,.05),.4);
assert.equal(C.advance(.99,1,1),1);assert.equal(C.advance(.01,0,1),0);
console.log('PASS: local opening, untouched material ahead, periodic seam continuity, monotonic/reversible progression, exact endpoints and bounded timing.');
