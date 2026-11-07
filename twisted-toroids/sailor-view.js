/* Small orthographic 3D rope viewer. Canvas2D keeps the book usable without
   WebGL, including on devices where the main surface lab cannot initialize. */
(function(root){
  'use strict';
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const tint=(color,shade)=>'rgb('+color.map(v=>Math.round(Math.min(255,v*shade))).join(',')+')';
  class RopeView {
    constructor(canvas,{interactive=true}={}) {
      this.canvas=canvas;this.interactive=interactive;this.ctx=canvas.getContext('2d');this.yaw=-.08;this.pitch=.22;this.zoom=1;this.spread=1;this.scene={ropes:[]};this.pending=0;this.pointers=new Map();
      this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas);
      if(interactive)this.bind();
    }
    setScene(scene){this.scene=scene;this.draw();}
    home(flat=false){this.yaw=flat?0:-.08;this.pitch=flat?0:.22;this.zoom=1;this.draw();}
    bind(){
      const c=this.canvas;
      c.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;this.pointers.set(e.pointerId,[e.clientX,e.clientY]);c.setPointerCapture(e.pointerId);c.classList.add('dragging');});
      c.addEventListener('pointermove',e=>{if(!this.pointers.has(e.pointerId))return;
        const prev=this.pointers.get(e.pointerId),next=[e.clientX,e.clientY];
        if(this.pointers.size===1){this.yaw+=(next[0]-prev[0])*.009;this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+(next[1]-prev[1])*.009));}
        else {const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)[1],d0=Math.hypot(prev[0]-other[0],prev[1]-other[1]),d1=Math.hypot(next[0]-other[0],next[1]-other[1]);if(d0>4)this.zoom=Math.max(.55,Math.min(2.2,this.zoom*d1/d0));}
        this.pointers.set(e.pointerId,next);this.draw();
      });
      const end=e=>{this.pointers.delete(e.pointerId);if(!this.pointers.size)c.classList.remove('dragging');};
      ['pointerup','pointercancel','lostpointercapture'].forEach(t=>c.addEventListener(t,end));
      c.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.55,Math.min(2.2,this.zoom*Math.exp(-e.deltaY*.001)));this.draw();},{passive:false});
      c.addEventListener('keydown',e=>{const keys={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]};if(keys[e.key]){e.preventDefault();this.yaw+=keys[e.key][0];this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+keys[e.key][1]));}else if(e.key==='Home'){e.preventDefault();this.home();}else if(e.key==='+'||e.key==='='){e.preventDefault();this.zoom=Math.min(2.2,this.zoom*1.1);}else if(e.key==='-'){e.preventDefault();this.zoom=Math.max(.55,this.zoom/1.1);}else return;this.draw();});
    }
    draw(){if(this.pending)return;this.pending=requestAnimationFrame(()=>{this.pending=0;this.paint();});}
    paint(){
      const {canvas:c,ctx:g}=this,w=c.clientWidth,h=c.clientHeight;if(!g||!w||!h)return;
      const dpr=Math.min(devicePixelRatio||1,2);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
      const scale=Math.min(w/7.5,(this.interactive?h-100:h)/6.2)*this.zoom,cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch);
      const rotate=p=>{const x=p[0]*cy+p[2]*sy,z=-p[0]*sy+p[2]*cy;return [x,p[1]*cp-z*sp,p[1]*sp+z*cp];};
      const project=p=>{const q=rotate(p);return [w/2+q[0]*scale,h/2-(this.interactive?16:0)-q[1]*scale,q[2]];};
      const faces=[];
      const polygon=(points,color)=>{const p=points.map(project);faces.push({p,z:p.reduce((s,v)=>s+v[2],0)/p.length,color});};
      const tube=(points,radius,color,texture=true)=>{
        if(points.length<2)return;const col=rgb(color),rings=[],sides=10;
        // Use a smoothly varying frame, transported along the tangent.
        let u=null;
        for(let i=0;i<points.length;i++){
          const tangent=norm(sub(points[Math.min(i+1,points.length-1)],points[Math.max(0,i-1)]));
          if(!u)u=norm(cross(tangent,Math.abs(tangent[2])<.8?[0,0,1]:[0,1,0]));
          else {const d=u.reduce((s,v,k)=>s+v*tangent[k],0);u=norm(u.map((v,k)=>v-d*tangent[k]));}
          const v=cross(tangent,u),ring=[];
          for(let j=0;j<sides;j++){const a=j*2*Math.PI/sides,n=u.map((x,k)=>x*Math.cos(a)+v[k]*Math.sin(a));ring.push({p:points[i].map((x,k)=>x+radius*n[k]),n});}rings.push(ring);
        }
        for(let i=1;i<rings.length;i++)for(let j=0;j<sides;j++){
          const k=(j+1)%sides,a=rings[i-1][j],b=rings[i][j],d=rings[i-1][k],e=rings[i][k];
          const n=rotate(a.n),light=.72+.36*Math.max(-.5,n[0]*-.4+n[1]*.55+n[2]*.75),braid=texture&&((i+j*2)%9<2)? .83:1;
          polygon([a.p,b.p,e.p,d.p],tint(col,light*braid));
        }
        polygon(rings[0].map(v=>v.p),tint(col,.85));polygon(rings.at(-1).map(v=>v.p),texture?'#ed9d51':tint(col,1.1));
      };
      const scene=this.scene,spread=this.spread;
      if(scene.torus){
        g.lineWidth=1;g.strokeStyle='#397b7b22';
        for(let j=0;j<12;j++){
          g.beginPath();for(let i=0;i<=100;i++){const a=i/100*Math.PI*2,b=j/12*Math.PI*2,p=project([(1.7+.63*Math.cos(b))*Math.cos(a),(1.7+.63*Math.cos(b))*Math.sin(a),.63*Math.sin(b)]);i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);}g.stroke();
        }
        for(let j=0;j<24;j++){
          g.beginPath();for(let i=0;i<=32;i++){const a=j/24*Math.PI*2,b=i/32*Math.PI*2,p=project([(1.7+.63*Math.cos(b))*Math.cos(a),(1.7+.63*Math.cos(b))*Math.sin(a),.63*Math.sin(b)]);i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);}g.stroke();
        }
      }
      if(scene.support){const s=scene.support,points=Array.from({length:25},(_,i)=>s.center.map((v,k)=>(v+(k===(s.axis==='x'?0:1)?s.length*(i/24-.5):0))*spread));tube(points,s.radius*spread,'#bb9c69',false);}
      for(const rope of scene.ropes){const points=rope.points.filter((_,i)=>i%2===0||i===rope.points.length-1).map(p=>p.map(v=>v*spread));tube(points,.068,rope.color);}
      faces.sort((a,b)=>a.z-b.z);g.lineJoin='round';g.lineWidth=.55;
      for(const f of faces){g.fillStyle=g.strokeStyle=f.color;g.beginPath();f.p.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();g.stroke();}
      // The two endpoint markers make the open ropes explicit, even in torus view.
      for(const r of scene.ropes){if(r.points.length<2)continue;
        for(const [i,label] of [[0,'S'],[r.points.length-1,'E']]){const p=project(r.points[i].map(v=>v*spread));if(!this.interactive)continue;g.fillStyle=label==='S'?'#19424a':'#c6613c';g.beginPath();g.arc(p[0],p[1],7,0,Math.PI*2);g.fill();g.fillStyle='#fff';g.font='bold 9px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(label,p[0],p[1]+.5);}
      }
    }
  }
  root.RopeView=RopeView;
})(globalThis);
