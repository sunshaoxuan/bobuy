import {useCallback,useEffect,useRef,useState} from 'react';
import {CATALOG_BATCH} from './publicCatalog';

/** Reveals already-validated catalog rows; never requests another server page. */
export function useCatalogReveal(identity:string,total:number,enabled:boolean,paused:boolean){
 const [window,setWindow]=useState({identity,limit:CATALOG_BATCH});
 const limit=window.identity===identity?window.limit:CATALOG_BATCH;
 const sentinel=useRef<HTMLDivElement>(null),pending=useRef(false);
 const advance=useCallback(()=>setWindow({identity,limit:Math.min(limit+CATALOG_BATCH,total)}),[identity,limit,total]);
 const reveal=useCallback(()=>{if(!enabled||paused||limit>=total||pending.current)return;pending.current=true;advance();},[advance,enabled,paused,limit,total]);
 useEffect(()=>{
  pending.current=false;
  const target=sentinel.current;
  if(!enabled||paused||limit>=total||!target||typeof IntersectionObserver!=='function'||typeof requestAnimationFrame!=='function')return;
  let active=true,frame:number|undefined;
  const observer=new IntersectionObserver(entries=>{
   if(!active||pending.current||!entries.some(entry=>entry.target===target&&entry.isIntersecting))return;
   pending.current=true;
   frame=requestAnimationFrame(()=>{if(active)advance();});
  },{root:null,rootMargin:'0px 0px 120px 0px',threshold:0});
  observer.observe(target);
  return()=>{active=false;observer.disconnect();if(frame!==undefined)cancelAnimationFrame(frame);};
 },[advance,enabled,paused,limit,total]);
 return {limit,sentinel,reveal};
}
