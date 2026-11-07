(function(){
  'use strict';
  const {KNOTS,prefix,endsAt,transition}=SailorKnots,$=id=>document.getElementById(id),KEY='twisted-toroids-sailors-book-v1';
  let saved={bookmarks:[]};try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&Array.isArray(v.bookmarks))saved={bookmarks:v.bookmarks.filter(id=>KNOTS.some(k=>k.id===id))};}catch(_){}
  const write=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved));}catch(_){}};
  const hashKnot=()=>KNOTS.find(k=>k.id===location.hash.slice(1))||KNOTS[0];
  let knot=hashKnot(),mode='tie',progress=knot.steps.length-1,playing=false,lastTime=0,frame=0,speed=1,stepIndex=-1;
  const viewer=new RopeView($('ropeCanvas'));
  try{const back=sessionStorage.getItem('twisted-toroids-book-return');if(back){const url=new URL(back,location.href);if(url.origin===location.origin&&url.pathname.endsWith('/index.html'))$('backToLab').href=url.href;}}catch(_){}
  const announce=text=>{$('announcement').textContent=text;};
  const shelf=$('knotShelf');
  for(const k of KNOTS){
    const card=document.createElement('button');card.type='button';card.className='knot-card';card.id='card-'+k.id;card.setAttribute('aria-pressed','false');card.setAttribute('aria-label',k.name+', '+k.kind.toLowerCase());
    card.innerHTML='<span class="card-number">'+k.number+'</span><span class="card-saved" aria-hidden="true"></span><canvas aria-hidden="true"></canvas><span class="card-text"><span><b>'+k.name+'</b><small>'+k.kind+'</small></span><span class="card-arrow" aria-hidden="true">→</span></span>';
    shelf.append(card);const thumb=new RopeView(card.querySelector('canvas'),{interactive:false});thumb.setScene({ropes:k.ropes,support:k.support});
    card.addEventListener('click',()=>select(k,true));
  }
  function stop(){playing=false;cancelAnimationFrame(frame);frame=0;lastTime=0;updatePlay();}
  function updatePlay(){
    $('play').firstElementChild.textContent=playing?'Ⅱ':'▷';
    $('playLabel').textContent=playing?'Pause':mode==='tie'?(progress>=knot.steps.length-1?'Watch it tie':'Play'):(progress>=1?'Replay rewind':'Play rewind');
    $('play').setAttribute('aria-label',playing?'Pause playback':$('playLabel').textContent);
  }
  function markSaved(){
    const marked=saved.bookmarks.includes(knot.id);$('bookmark').setAttribute('aria-pressed',String(marked));$('bookmark').setAttribute('aria-label',(marked?'Remove bookmark for ':'Bookmark ')+knot.name);$('bookmark').firstElementChild.textContent=marked?'★':'☆';
    for(const k of KNOTS)$('card-'+k.id).querySelector('.card-saved').textContent=saved.bookmarks.includes(k.id)?'★':'';
  }
  function select(k,updateHash){
    stop();knot=k;mode='tie';progress=k.steps.length-1;stepIndex=-1;viewer.home();viewer.spread=1;$('spacing').value=100;$('spacingValue').textContent='1×';
    for(const x of KNOTS)$('card-'+x.id).setAttribute('aria-pressed',String(k.id===x.id));
    $('knotKind').textContent=k.number+' / '+k.kind.toUpperCase();$('knotName').textContent=k.name;$('knotSummary').textContent=k.summary;$('use').textContent=k.use;$('knotNote').textContent=k.note;
    $('reference').href='https://www.animatedknots.com/'+k.source;
    $('ropeCount').textContent=k.ropes.length+' '+(k.ropes.length===1?'ROPE':'ROPES')+' · '+k.ropes.length*2+' FREE ENDS';
    $('torusDetail').textContent=k.ropes.length===2?'The two lines stay separate. Each receives its own open winding; no ends are joined.':k.support?'The support is removed after unthreading. Keeping it would give a different geometric problem.':'The winding follows a (2, 3) torus path with a gap. The original boating knot is not being classified as a closed trefoil.';
    $('steps').replaceChildren();k.steps.forEach((s,i)=>{
      const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.step=i;
      button.innerHTML='<span class="step-number">'+(i+1)+'</span><span><b>'+s.title+'</b><span class="step-description">'+s.text+'</span></span>';
      button.addEventListener('click',()=>{stop();progress=i;render(true);});li.append(button);$('steps').append(li);
    });
    if(updateHash&&location.hash!=='#'+k.id)history.pushState(null,'','#'+k.id);
    markSaved();syncMode();render(true);
  }
  function syncMode(){
    const tie=mode==='tie';$('tieMode').setAttribute('aria-selected',String(tie));$('torusMode').setAttribute('aria-selected',String(!tie));$('tieMode').tabIndex=tie?0:-1;$('torusMode').tabIndex=tie?-1:0;
    $('viewerPanel').setAttribute('aria-labelledby',tie?'tieMode':'torusMode');$('tyingNotes').hidden=!tie;$('torusNotes').hidden=tie;
    $('timeline').max=tie?(knot.steps.length-1)*100:1000;$('timeline').setAttribute('aria-label',tie?'Tying progress':'Unthread and wind progress');
    $('spacing').disabled=!tie;if(!tie){viewer.spread=1;$('spacing').value=100;$('spacingValue').textContent='1×';}
  }
  function render(speak=false){
    let label;
    if(mode==='tie'){
      const ends=endsAt(knot,progress),i=Math.min(knot.steps.length-1,Math.ceil(progress-1e-5));
      viewer.setScene({ropes:knot.ropes.map((r,j)=>({color:r.color,points:prefix(r.points,ends[j])})),support:knot.support});
      label=knot.steps[i].title;$('viewLabel').textContent='TYING DIAGRAM';$('progressCount').textContent=(i+1)+' / '+knot.steps.length;$('timeline').value=Math.round(progress*100);
      if(i!==stepIndex){stepIndex=i;[...$('steps').querySelectorAll('button')].forEach((b,j)=>{if(j===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');b.classList.toggle('done',j<i);});}
      $('previous').disabled=progress<=0;$('next').disabled=progress>=knot.steps.length-1;
      $('ropeCanvas').setAttribute('aria-label',knot.name+', step '+(i+1)+' of '+knot.steps.length+': '+label+'. Rotatable 3D rope diagram.');
    }else{
      const scene=transition(knot,progress);viewer.setScene(scene);
      label=scene.phase==='unthread'?'Unthread the knot':scene.phase==='free'?'Free rope · support removed':'Wind around the torus';
      $('viewLabel').textContent=scene.phase==='wind'?'OPEN TOROIDAL WINDING':'REVERSING THE ROUTE';$('progressCount').textContent=Math.round(progress*100)+'%';$('timeline').value=Math.round(progress*1000);
      for(const [id,p]of[['phaseUnthread','unthread'],['phaseFree','free'],['phaseWind','wind']])$(id).classList.toggle('active',scene.phase===p);
      $('previous').disabled=progress<=0;$('next').disabled=progress>=1;
      $('ropeCanvas').setAttribute('aria-label',knot.name+': '+label+'. The rope ends remain open.');
    }
    $('progressLabel').textContent=label;$('timeline').setAttribute('aria-valuetext',label);updatePlay();if(speak)announce(knot.name+'. '+label);
  }
  function setMode(next){if(mode===next)return;stop();mode=next;progress=mode==='tie'?knot.steps.length-1:0;stepIndex=-1;syncMode();render(true);}
  $('tieMode').addEventListener('click',()=>setMode('tie'));$('torusMode').addEventListener('click',()=>setMode('torus'));
  document.querySelector('.modes').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setMode(e.key==='Home'?'tie':e.key==='End'?'torus':mode==='tie'?'torus':'tie');$(mode==='tie'?'tieMode':'torusMode').focus();}});
  function tick(time){
    if(!playing)return;const dt=lastTime?Math.min((time-lastTime)/1000,.08):0;lastTime=time;
    const max=mode==='tie'?knot.steps.length-1:1;progress=Math.min(max,progress+dt*speed/(mode==='tie'?2.4:12));render();
    if(progress>=max){stop();announce(mode==='tie'?knot.name+' diagram complete.':'Toroidal winding complete. The ends remain open.');}else frame=requestAnimationFrame(tick);
  }
  $('play').addEventListener('click',()=>{if(playing){stop();return;}if(progress>=(mode==='tie'?knot.steps.length-1:1))progress=0;playing=true;lastTime=0;render();frame=requestAnimationFrame(tick);});
  $('previous').addEventListener('click',()=>{stop();progress=mode==='tie'?Math.max(0,Math.ceil(progress)-1):Math.max(0,progress-.1);render(true);});
  $('next').addEventListener('click',()=>{stop();progress=mode==='tie'?Math.min(knot.steps.length-1,Math.floor(progress)+1):Math.min(1,progress+.1);render(true);});
  $('restart').addEventListener('click',()=>{stop();progress=0;render(true);});
  $('timeline').addEventListener('input',()=>{stop();progress=Number($('timeline').value)/(mode==='tie'?100:1000);render();});
  $('timeline').addEventListener('change',()=>render(true));
  $('speed').addEventListener('change',()=>{speed=Number($('speed').value)||1;});
  $('spacing').addEventListener('input',()=>{viewer.spread=Number($('spacing').value)/100;$('spacingValue').textContent=viewer.spread.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+'×';viewer.draw();});
  $('resetView').addEventListener('click',()=>viewer.home());$('frontView').addEventListener('click',()=>viewer.home(true));
  $('bookmark').addEventListener('click',()=>{const i=saved.bookmarks.indexOf(knot.id);if(i<0)saved.bookmarks.push(knot.id);else saved.bookmarks.splice(i,1);write();markSaved();announce(knot.name+(i<0?' bookmarked.':' bookmark removed.'));});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  window.addEventListener('hashchange',()=>{const selected=KNOTS.find(k=>k.id===location.hash.slice(1));if(selected&&selected.id!==knot.id)select(selected,false);});
  window.addEventListener('popstate',()=>{if(location.hash!=='#workspace'&&hashKnot().id!==knot.id)select(hashKnot(),false);});
  select(knot,false);
})();
