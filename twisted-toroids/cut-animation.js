/* Spatial cut progress shared by the mesh, its overlays, and the flat map. */
(function(root) {
  'use strict';
  const DURATION = 3.6;
  const TRAIL = 0.14; // a short, smooth opening region behind each cutting tip
  const clamp = x => Math.max(0,Math.min(1,x));
  const smooth = x => { const t=clamp(x); return t*t*(3-2*t); };
  function distance(u) {
    const v=((u%1)+1)%1;
    return 2*Math.min(v,1-v);
  }
  function amount(progress,u) {
    if(progress<=0)return 0;
    if(progress>=1)return 1;
    return smooth((progress*(1+TRAIL)-distance(u))/TRAIL);
  }
  function reach(progress) { return clamp(progress*(1+TRAIL)); }
  function fronts(progress) {
    if(progress<=0 || progress>=1)return [];
    const r=reach(progress);
    return r>=1 ? [0.5] : [r/2,1-r/2];
  }
  function advance(progress,target,dt) {
    const p=clamp(progress), t=clamp(target), step=Math.max(0,dt)/DURATION;
    return Math.abs(t-p)<=step+1e-12 ? t : p+Math.sign(t-p)*step;
  }
  const api={DURATION,TRAIL,distance,amount,reach,fronts,advance};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.ToroidCutAnimation=api;
})(typeof window!=='undefined'?window:globalThis);
