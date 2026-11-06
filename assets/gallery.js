'use strict';
// ===== Settings =====
const GALLERY_FOLDER='1Okn6FxWbYujH1r-UmJuUJ1Aq9V4-vSsQjYZE6U9--6ymY91pKMxFYGIl6V-8c0WO6etwZgti'; // Google Drive folder (shared "Anyone with the link")
const GOOGLE_API_KEY='AIzaSyA00rA6evXiyZe9EtBj1qRGW2zRqqxuWO4';                                         // Drive API key (restrict it to this site's address in Google Cloud)
// ====================
// Kinus photo & video strip, loaded straight from a public Google Drive folder.
// Starts in the middle, loops forever, pauses on hover, drag to move, hides near-duplicate photos.
(function(){
 const section=document.getElementById('gallery');if(!section)return;
 const track=section.querySelector('.gal-track');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const src=(it,w)=>it.type==='video'?'https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(it.id)+'?alt=media&key='+GOOGLE_API_KEY:'https://lh3.googleusercontent.com/d/'+encodeURIComponent(it.id)+'=w'+(w||1200);
 // a Drive file's name ends with " - <Sender>"; only a short hash is kept so names never reach the page
 const senderOf=name=>{const b=(name||'').replace(/\.[a-z0-9]+$/i,'');const i=b.lastIndexOf(' - ');if(i<1)return null;let h=2166136261;for(const c of b.slice(i+3).trim().toLowerCase()){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);};
 async function listDrive(){const items=[];let page='';do{const u=new URL('https://www.googleapis.com/drive/v3/files');u.searchParams.set('q',"'"+GALLERY_FOLDER+"' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')");u.searchParams.set('key',GOOGLE_API_KEY);u.searchParams.set('pageSize','200');u.searchParams.set('orderBy','createdTime desc');u.searchParams.set('fields','nextPageToken,files(id,name,mimeType,imageMediaMetadata(width,height,rotation),videoMediaMetadata(width,height))');if(page)u.searchParams.set('pageToken',page);const r=await fetch(u);if(!r.ok)throw new Error('drive '+r.status);const d=await r.json();for(const f of d.files||[]){const video=f.mimeType.startsWith('video/');const m=video?f.videoMediaMetadata:f.imageMediaMetadata;let w=m&&m.width,h=m&&m.height;if(!video&&m&&(m.rotation===1||m.rotation===3))[w,h]=[h,w];items.push({id:f.id,type:video?'video':'image',w:w||null,h:h||null,g:senderOf(f.name)});}page=d.nextPageToken||'';}while(page&&items.length<1000);return items;}
 const SPEED=0.04;           // pixels per millisecond
 const SAME_FAMILY=26;      // look-alike score (avg colour difference 0–255 on a 12x12 thumbnail) to hide a photo from the same sender
 const ANY_SENDER=14;       // stricter score when the photos come from different (or unknown) senders

 // ---- look-alike detection: compare tiny 12x12 colour thumbnails of every photo ----
 function sigOf(it){return new Promise(res=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{if(img.naturalWidth&&img.naturalHeight)it.r=Math.min(1.8,Math.max(.56,img.naturalWidth/img.naturalHeight));try{const c=document.createElement('canvas');c.width=12;c.height=12;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,12,12);const d=x.getImageData(0,0,12,12).data;const v=[];for(let k=0;k<d.length;k+=4)v.push(d[k],d[k+1],d[k+2]);res({it,sig:v,ok:true});}catch{res({it,ok:true});}};img.onerror=()=>res({it,ok:true});img.src=src(it,200);});}
 function videoShape(it){return new Promise(res=>{if(it.r)return res({it,ok:true});const v=document.createElement('video');v.muted=true;v.preload='metadata';let done=false;const fin=()=>{if(done)return;done=true;if(v.videoWidth&&v.videoHeight)it.r=Math.min(1.8,Math.max(.56,v.videoWidth/v.videoHeight));v.removeAttribute('src');v.load();res({it,ok:true});};v.addEventListener('loadedmetadata',fin);v.addEventListener('error',fin);setTimeout(fin,6000);v.src=src(it);});}
 const diff=(a,b)=>{let n=0;for(let k=0;k<a.length;k++)n+=Math.abs(a[k]-b[k]);return n/a.length;};
 async function dedupe(items){
  const out=[],kept=[];
  const done=await Promise.all(items.map(it=>it.type==='image'?sigOf(it):videoShape(it)));
  for(const h of done){if(!h.ok)continue;
   if(h.sig&&kept.some(k=>diff(k.sig,h.sig)<=(k.g&&k.g===h.it.g?SAME_FAMILY:ANY_SENDER)))continue;
   if(h.sig)kept.push({sig:h.sig,g:h.it.g});h.it.sig=h.sig;out.push(h.it);}
  return out;
 }
 // Spread the photos out so look-alike shots, the same family's photos and videos don't bunch up.
 function mix(list){
  const tone=sig=>{const t=[0,0,0];for(let k=0;k<sig.length;k++)t[k%3]+=sig[k];const n=sig.length/3;return t.map(v=>v/n);};
  for(const it of list)if(it.sig)it.tone=tone(it.sig);
  const sim=(a,b)=>{let s=0;
   if(a.sig&&b.sig){s+=.6*Math.max(0,1-diff(a.sig,b.sig)/70);s+=.5*Math.max(0,1-(Math.abs(a.tone[0]-b.tone[0])+Math.abs(a.tone[1]-b.tone[1])+Math.abs(a.tone[2]-b.tone[2]))/3/45);}
   if(a.g&&a.g===b.g)s+=.9;
   if(a.type==='video'&&b.type==='video')s+=.8;
   if((a.r||1)<.9&&(b.r||1)<.9)s+=.1;
   return s;};
  const left=list.slice(),out=[];
  while(left.length){
   let best=0,bestCost=Infinity;
   for(let i=0;i<left.length;i++){let c=Math.random()*.25;
    for(let j=1;j<=4&&j<=out.length;j++)c+=sim(left[i],out[out.length-j])*[0,1,.6,.35,.2][j];
    if(c<bestCost){bestCost=c;best=i;}}
   out.push(left.splice(best,1)[0]);}
  return out;
 }

 // ---- tiles ----
 function tile(it){
  const fig=document.createElement('figure');fig.className='gal-item gal-'+it.type;
  fig.style.setProperty('--r',it.r||(it.type==='video'?.5625:1));
  if(it.type==='video'){
   const v=document.createElement('video');v.muted=true;v.loop=true;v.playsInline=true;v.setAttribute('playsinline','');v.preload='metadata';v.src=src(it);v.setAttribute('aria-label','Kinus video');v.draggable=false;
   v.addEventListener('loadedmetadata',()=>{if(v.videoWidth&&v.videoHeight)fig.style.setProperty('--r',Math.min(1.8,Math.max(.56,v.videoWidth/v.videoHeight)));measure();});
   const b=document.createElement('button');b.type='button';b.className='gal-sound';b.setAttribute('aria-label','Unmute video');b.textContent='🔇';
   b.addEventListener('click',e=>{e.stopPropagation();const turnOn=v.muted;for(const o of track.querySelectorAll('video')){o.muted=true;const ob=o.parentElement.querySelector('.gal-sound');ob.textContent='🔇';ob.setAttribute('aria-label','Unmute video');}if(turnOn){v.muted=false;v.play().catch(()=>{});b.textContent='🔊';b.setAttribute('aria-label','Mute video');}});
   let tries=0;v.addEventListener('error',function onErr(){if(tries++===0){v.src='https://drive.usercontent.google.com/download?id='+encodeURIComponent(it.id)+'&export=download&confirm=t';v.load();if(!v.paused||v.closest('.gal-item'))v.play().catch(()=>{});return;}v.removeEventListener('error',onErr);const f=document.createElement('iframe');f.src='https://drive.google.com/file/d/'+encodeURIComponent(it.id)+'/preview';f.allow='autoplay';f.title='Kinus video';f.className='gal-frame';fig.replaceChildren(f);});
   fig.append(v,b);
  }else{
   const img=document.createElement('img');img.loading='lazy';img.referrerPolicy='no-referrer';img.decoding='async';img.alt='Kinus photo';img.src=src(it,800);img.draggable=false;
   img.addEventListener('load',()=>{if(img.naturalWidth&&img.naturalHeight)fig.style.setProperty('--r',Math.min(1.8,Math.max(.56,img.naturalWidth/img.naturalHeight)));measure();});
   img.addEventListener('click',()=>{if(!dragged)lightbox(it);});
   fig.append(img);
  }
  return fig;
 }
 function lightbox(it){
  const d=document.createElement('div');d.className='gal-lightbox';d.setAttribute('role','dialog');d.setAttribute('aria-label','Photo');
  const img=document.createElement('img');img.src=src(it,1800);img.alt='Kinus photo';
  const x=document.createElement('button');x.type='button';x.className='gal-close';x.textContent='×';x.setAttribute('aria-label','Close');
  const close=()=>{d.remove();document.removeEventListener('keydown',esc);};const esc=e=>{if(e.key==='Escape')close();};
  d.addEventListener('click',e=>{if(e.target!==img)close();});document.addEventListener('keydown',esc);
  d.append(img,x);document.body.append(d);x.focus();
 }

 // ---- endless loop: three copies of the set; keep the view inside the middle copy ----
 let setWidth=0,hovering=false,dragging=false,dragged=false;
 const measure=()=>{const first=track.querySelector('[data-copy="1"]'),second=track.querySelector('[data-copy="2"]');setWidth=first&&second?second.offsetLeft-first.offsetLeft:0;};
 const wrap=()=>{if(!setWidth)return;if(track.scrollLeft<setWidth*.5)track.scrollLeft+=setWidth;else if(track.scrollLeft>setWidth*1.5)track.scrollLeft-=setWidth;};
 function loop(){let last=performance.now();const step=t=>{const dt=Math.min(64,t-last);last=t;if(!hovering&&!dragging&&!reduce&&setWidth){track.scrollLeft+=dt*SPEED;}wrap();requestAnimationFrame(step);};requestAnimationFrame(step);}

 // hover pauses, leaving resumes
 track.addEventListener('mouseenter',()=>{hovering=true;});
 track.addEventListener('mouseleave',()=>{hovering=false;});
 track.addEventListener('touchstart',()=>{hovering=true;},{passive:true});
 track.addEventListener('touchend',()=>{setTimeout(()=>{hovering=false;},1500);},{passive:true});
 // mouse drag to move (touch screens swipe natively)
 let startX=0,startLeft=0;
 track.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button'))return;dragging=true;dragged=false;startX=e.clientX;startLeft=track.scrollLeft;});
 track.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-startX;if(!dragged&&Math.abs(dx)>5){dragged=true;track.classList.add('dragging');try{track.setPointerCapture(e.pointerId);}catch{}}if(!dragged)return;track.scrollLeft=startLeft-dx;wrap();if(track.scrollLeft!==startLeft-dx){startLeft=track.scrollLeft+dx;}});
 const endDrag=e=>{if(!dragging)return;dragging=false;track.classList.remove('dragging');setTimeout(()=>{dragged=false;},0);};
 track.addEventListener('pointerup',endDrag);track.addEventListener('pointercancel',endDrag);
 track.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){track.scrollLeft+=300;wrap();}if(e.key==='ArrowLeft'){track.scrollLeft-=300;wrap();}});

 function playVisible(){
  if(!('IntersectionObserver' in window))return;
  const io=new IntersectionObserver(es=>{for(const e of es){const v=e.target;if(e.isIntersecting&&!reduce)v.play().catch(()=>{});else{v.pause();}}},{root:track,threshold:.4});
  track.querySelectorAll('video').forEach(v=>io.observe(v));
 }

 listDrive().then(items=>({items})).then(async({items})=>{
  if(!items||!items.length)return;
  items=items.map(it=>({...it,r:it.w&&it.h?Math.min(1.8,Math.max(.56,it.w/it.h)):null}));
  const list=mix(await dedupe(items));if(!list.length)return;
  for(let copy=0;copy<3;copy++)list.forEach((it,i)=>{const t=tile(it);if(i===0)t.dataset.copy=String(copy);if(copy!==1)t.setAttribute('aria-hidden','true');track.append(t);});
  section.hidden=false;section.classList.add('gal-loading');
  requestAnimationFrame(()=>{measure();const mid=track.querySelector('[data-copy="1"]');if(mid)track.scrollLeft=mid.offsetLeft+setWidth/2-track.clientWidth/2;playVisible();loop();setTimeout(()=>section.classList.remove('gal-loading'),120);});
  new ResizeObserver(()=>measure()).observe(track);
 }).catch(()=>{});
})();
