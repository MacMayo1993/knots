/* Paint palettes and saved appearance preferences; usable in a browser or Node. */
(function (root) {
  'use strict';
  const KEY = 'twisted-toroids-appearance';
  const PAINT_KEY = 'twisted-toroids-paint';
  const LEGACY_PAINT_KEY = 'half-twisted-torus-paint';
  const VARIABLES = ['--red','--ochre','--blue','--green','--violet','--teal','--rose','--lime'];
  const PALETTES = [
    { id:'classic', name:'Classic', note:'The original lab colors', colors:['#cf3f3a','#d39322','#2d63c8','#2b9467','#7b5cc4','#2a9aa6','#d9668f','#8fb83a'] },
    { id:'aurora', name:'Aurora', note:'Violet, mint, and polar light', colors:['#9878ec','#f2b45f','#60d8b5','#eb7aab','#5f92e6','#66c9df','#cf9fe5','#c5da73'] },
    { id:'sunset', name:'Sunset', note:'Coral, gold, and dusk blue', colors:['#ef6a60','#f6bd5c','#697bd5','#c475a9','#a95583','#4d9d9b','#f39a73','#a7ad68'] },
    { id:'lagoon', name:'Lagoon', note:'Deep water and bright coral', colors:['#21b6a8','#e7c773','#477bd9','#93d7b3','#8b85ce','#56c7e4','#ed8d83','#bed567'] },
    { id:'candy', name:'Candy', note:'Playful pink, sky, and lime', colors:['#ed79b9','#f5c665','#78b9ed','#94cf98','#b698e1','#72d0cd','#f38d87','#d4dc78'] },
    { id:'bold', name:'Bold', note:'Strong, distinct paint colors', colors:['#d95636','#e5af28','#2878bf','#25956d','#955fc3','#2ab4bf','#cf6c9a','#96b53b'] }
  ];
  const FINISHES = {
    matte:{roughness:0.9,metalness:0},
    satin:{roughness:0.48,metalness:0.08},
    gloss:{roughness:0.23,metalness:0.16}
  };
  const defaults = () => ({palette:'classic',mode:'system',finish:'satin'});
  function normalize(value) {
    const v=value && typeof value==='object' ? value : {}, d=defaults();
    if(PALETTES.some(p=>p.id===v.palette))d.palette=v.palette;
    if(['system','light','dark'].includes(v.mode))d.mode=v.mode;
    if(Object.prototype.hasOwnProperty.call(FINISHES,v.finish))d.finish=v.finish;
    return d;
  }
  function read(storage,key) { try{return storage ? storage.getItem(key) : null;}catch(_){return null;} }
  function load(storage) { try{return normalize(JSON.parse(read(storage,KEY)));}catch(_){return defaults();} }
  function save(storage,value) { try{storage.setItem(KEY,JSON.stringify(normalize(value)));return true;}catch(_){return false;} }
  function loadPaint(storage) {
    try {
      const raw=read(storage,PAINT_KEY), parsed=JSON.parse(raw===null ? read(storage,LEGACY_PAINT_KEY) : raw);
      return Array.from({length:8},(_,i)=>Array.isArray(parsed)&&/^#[\da-f]{6}$/i.test(parsed[i]) ? parsed[i] : null);
    }catch(_){return Array(8).fill(null);}
  }
  function apply(root,settings,custom=Array(8).fill(null)) {
    const s=normalize(settings), palette=PALETTES.find(p=>p.id===s.palette);
    if(s.mode==='system')root.removeAttribute('data-theme');else root.setAttribute('data-theme',s.mode);
    VARIABLES.forEach((name,i)=>{
      const color=custom[i] || (s.palette==='classic' ? null : palette.colors[i]);
      if(color)root.style.setProperty(name,color);else root.style.removeProperty(name);
    });
    for(const [name,index] of [['--scene-a',0],['--scene-b',2]]) {
      const hex=custom[index]||palette.colors[index];
      root.style.setProperty(name,[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(','));
    }
  }
  function bootstrap(root,storage) {const settings=load(storage);apply(root,settings,loadPaint(storage));return settings;}
  const api={KEY,PAINT_KEY,LEGACY_PAINT_KEY,VARIABLES,PALETTES,FINISHES,normalize,load,save,loadPaint,apply,bootstrap};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ToroidAppearance=api;
})(typeof window!=='undefined'?window:globalThis);
