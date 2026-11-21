import {useEffect,useState} from 'react';

/** One background image at a time, only after the selected image has settled.
 * A user's selection always wins over background work. Errors release the queue.
 * Keeping this opt-in leaves editorial/admin galleries unchanged. */
export function useProgressiveImages(urls:string[],index:number,enabled:boolean){
 const identity=JSON.stringify(urls),selected=urls[index];
 const [state,setState]=useState<{identity:string;settled:Set<string>;background?:string}>(()=>({identity,settled:new Set()}));
 const current=state.identity===identity?state:{identity,settled:new Set<string>()};
 useEffect(()=>{setState({identity,settled:new Set()});},[identity]);
 useEffect(()=>{
  if(!enabled||!current.settled.has(selected))return;
  const next=urls.find(url=>!current.settled.has(url));if(!next)return;
  const advance=()=>setState(prior=>prior.identity===identity?{...prior,background:next}:prior);
  // Yield to the text/current-image paint and pending interaction, not a fixed delay.
  if(typeof requestIdleCallback==='function'){const id=requestIdleCallback(advance,{timeout:1000});return()=>cancelIdleCallback(id);}
  const id=setTimeout(advance,0);return()=>clearTimeout(id);
 },[identity,selected,enabled,current.settled]);
 function settled(url:string){if(!enabled)return;setState(prior=>prior.identity!==identity||prior.settled.has(url)?prior:{...prior,settled:new Set([...prior.settled,url])});}
 return {allows:(url:string)=>!enabled||url===selected||current.settled.has(url)||current.settled.has(selected)&&url===current.background,
  priority:(url:string):'high'|'low'|'auto'=>!enabled?'auto':url===selected?'high':'low',settled};
}
