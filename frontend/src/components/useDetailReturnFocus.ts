import {useEffect,useRef,type RefObject} from 'react';

/** The list owns return focus because its route-driven detail may unmount immediately. */
export function useDetailReturnFocus(root:RefObject<HTMLElement>,detailKey:string|undefined,scope:string){
 const previous=useRef(detailKey),opener=useRef<{element:HTMLElement;key:string;kind:string;scope:string;x:number;y:number}>();
 useEffect(()=>{
  const closed=previous.current;previous.current=detailKey;
  if(detailKey||!closed)return;
  let stopped=false,frame=0,timer:ReturnType<typeof setTimeout>;
  const saved=opener.current,container=root.current;
  if(!container)return;
  const visible=(el:HTMLElement|null|undefined):el is HTMLElement=>!!el&&el.isConnected&&!el.matches(':disabled')&&!el.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(el).visibility!=='hidden'&&el.getClientRects().length>0;
  const observer=new MutationObserver(()=>attempt(false));
  function stop(){if(stopped)return;stopped=true;observer.disconnect();cancelAnimationFrame(frame);clearTimeout(timer);document.removeEventListener('pointerdown',stop);document.removeEventListener('keydown',stop);if(opener.current===saved)opener.current=undefined;}
  function attempt(expired:boolean){
   if(stopped)return;
   const active=document.activeElement;
   // A new action outside the list takes priority over a delayed restoration.
   if(active instanceof HTMLElement&&active!==document.body&&active.isConnected&&!container!.contains(active))return;
   const key=saved?.scope===scope?saved.key:closed;
   const card=Array.from(container!.querySelectorAll<HTMLElement>('[data-occurrence-key]')).find(el=>el.dataset.occurrenceKey===key);
   const kind=saved?.scope===scope?saved.kind:'photo';
   const controls=card?Array.from(card.querySelectorAll<HTMLElement>('[data-detail-trigger]')):[];
   let target=saved?.scope===scope&&visible(saved.element)?saved.element:controls.find(el=>el.dataset.detailTrigger===kind&&visible(el))??controls.find(visible);
   if(!target&&!expired&&container!.querySelector('[data-detail-list-ready="false"]'))return;
   if(!target){const candidates=Array.from(container!.querySelectorAll<HTMLElement>('[data-detail-trigger]')).filter(visible);target=candidates.find(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<window.innerHeight;})??container!.querySelector<HTMLElement>('[data-detail-focus-fallback]')??undefined;}
   if(visible(target)){
    // Routing can temporarily remove the list and clamp the document scroll to zero.
    // Restore the captured viewport only for the surviving/rebuilt original card.
    if(saved?.scope===scope&&(target===saved.element||controls.includes(target)))window.scrollTo({left:saved.x,top:saved.y,behavior:'instant'});
    stop();target.focus({preventScroll:true});
   }
  }
  observer.observe(container,{childList:true,subtree:true,attributes:true,attributeFilter:['data-detail-list-ready','hidden','style']});
  frame=requestAnimationFrame(()=>{attempt(false);if(!stopped){document.addEventListener('pointerdown',stop);document.addEventListener('keydown',stop);}});timer=setTimeout(()=>{attempt(true);stop();},500);
  return stop;
 },[detailKey,scope,root]);
 return (element:HTMLElement,key:string)=>{opener.current={element,key,kind:element.dataset.detailTrigger??'photo',scope,x:window.scrollX,y:window.scrollY};};
}
