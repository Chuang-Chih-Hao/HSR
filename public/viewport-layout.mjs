// Keep controls inside the viewport. ResizeObserver also handles tab switches,
// dynamic camera controls and browser toolbars on mobile.
export const COMPACT_QUERY='(max-width: 850px), (max-height: 640px)';
export function fitScale(available,content){
 if(!(available>0)||!(content>0))return 1;
 return Math.min(1,available/content);
}
export function installViewportLayout(doc=document,win=window){
 const tabs=[...doc.querySelectorAll('.console-tabs [role=tab]')];
 const panes=[...doc.querySelectorAll('.panel-inner > .tab-pane')];
 const slot=doc.querySelector('.panel-slot'),inner=doc.querySelector('.panel-inner');
 const tracker=doc.getElementById('routeTracker'),desktop=doc.getElementById('routeDesktop'),mobile=doc.getElementById('routeMobile');
 const compact=win.matchMedia(COMPACT_QUERY);
 let active='drive',raf=0;
 const fit=()=>{
  raf=0;
  const scale=fitScale(slot.clientHeight,inner.offsetHeight);
  inner.style.transform='scale('+scale+')';
 };
 const schedule=()=>{if(!raf)raf=win.requestAnimationFrame(fit);};
 function show(id,focus=false){
  const selected=tabs.find(t=>t.dataset.tab===id&&!t.hidden);
  if(!selected)return;
  active=id;
  tabs.forEach(t=>{const on=t===selected;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;});
  panes.forEach(p=>{const on=p.id==='panel-'+id;p.hidden=!on;p.classList.toggle('is-active',on);});
  if(focus)selected.focus({preventScroll:true});
  schedule();
 }
 function resize(){
  const progress=doc.getElementById('tab-progress');
  progress.hidden=!compact.matches;
  const host=compact.matches?mobile:desktop;
  if(tracker.parentElement!==host)host.append(tracker);
  if(active==='progress'&&!compact.matches)show('drive');
  schedule();
 }
 for(const t of tabs){
  t.addEventListener('click',()=>show(t.dataset.tab));
  t.addEventListener('keydown',e=>{
   const visible=tabs.filter(b=>!b.hidden);
   const i=visible.indexOf(t);
   let next;
   if(e.key==='ArrowRight')next=visible[(i+1)%visible.length];
   if(e.key==='ArrowLeft')next=visible[(i+visible.length-1)%visible.length];
   if(e.key==='Home')next=visible[0];if(e.key==='End')next=visible.at(-1);
   if(next){e.preventDefault();e.stopPropagation();show(next.dataset.tab,true);}
  });
 }
 compact.addEventListener('change',resize);win.addEventListener('resize',resize);
 const RO=win.ResizeObserver;
 if(RO){const observer=new RO(schedule);observer.observe(slot);observer.observe(inner);}
 if(doc.fonts?.ready)doc.fonts.ready.then(schedule);
 resize();show('drive');
 return {show,resize};
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installViewportLayout());
 else installViewportLayout();
}
