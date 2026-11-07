import {useCallback,useEffect,useRef,useState} from 'react';
import {storefrontApi,type BrowsePage,type StoreProduct} from './api';

type State<T>={identity:string;items:T[];page?:BrowsePage<T>;busy:boolean;error:string;changed:boolean};
export function useBrowsePages<T>(identity:string,request:(page:number,revision?:string)=>Promise<BrowsePage<T>>,keyOf:(item:T)=>string,enabled=true,acceptDataset?:(revision:string)=>boolean,size=24,paused=false){
 const [state,setState]=useState<State<T>>({identity,items:[],busy:false,error:'',changed:false});
 const latest=useRef(identity);latest.current=identity;
 const pausedRef=useRef(paused);pausedRef.current=paused;
 const deferred=useRef<{identity:string;token:number;state:State<T>}>();
 const current=useRef(state),requestRef=useRef(request),keyRef=useRef(keyOf),acceptRef=useRef(acceptDataset),flight=useRef(false),generation=useRef(0);
 requestRef.current=request;keyRef.current=keyOf;acceptRef.current=acceptDataset;current.current=state;
 const run=useCallback(async(restart=false)=>{
  if(flight.current||latest.current!==identity)return;
  const prior=current.current.identity===identity?current.current:undefined;
  if(!restart&&(prior?.changed||prior?.page&&!prior.page.hasNext))return;
  flight.current=true;const token=generation.current,index=restart?0:(prior?.page?.page??-1)+1;
  setState(previous=>({...previous,identity,busy:true,error:'',changed:false}));
  try{
   const result=await requestRef.current(index,index?prior?.page?.revision:undefined);
   if(token!==generation.current||latest.current!==identity)return;
   if(result.page!==index||result.size!==size||!Array.isArray(result.items)||result.items.length>size||typeof result.hasNext!=='boolean'||!result.revision||!result.datasetRevision||!Number.isSafeInteger(result.matchedTotal)||result.matchedTotal<0||!Number.isSafeInteger(result.scopeTotal)||result.scopeTotal<result.matchedTotal)throw Error('browse.invalid');
   if(index&&(!prior?.page||result.revision!==prior.page.revision||result.datasetRevision!==prior.page.datasetRevision||result.matchedTotal!==prior.page.matchedTotal||result.scopeTotal!==prior.page.scopeTotal))throw Error('browse.changed');
   const before=index?(prior?.items??[]):[],seen=new Set(before.map(keyRef.current));
   for(const item of result.items){const key=keyRef.current(item);if(!key||seen.has(key))throw Error('browse.changed');seen.add(key);}
   const items=[...before,...result.items];
   if(items.length>result.matchedTotal||result.hasNext&&(!result.items.length||items.length>=result.matchedTotal)||!result.hasNext&&items.length!==result.matchedTotal)throw Error('browse.invalid');
   if(acceptRef.current&&!acceptRef.current(result.datasetRevision))throw Error('browse.changed');
   const committed={identity,items,page:result,busy:false,error:'',changed:false};
   if(index>0&&pausedRef.current){deferred.current={identity,token,state:committed};setState(previous=>({...previous,busy:false,error:''}));}else setState(committed);
  }catch(error){if(token===generation.current&&latest.current===identity)setState(previous=>({...previous,identity,busy:false,error:(error as Error).message,changed:(error as Error).message==='browse.changed'}));}
  finally{if(token===generation.current)flight.current=false;}
 },[identity,size]);
 useEffect(()=>{generation.current++;flight.current=false;deferred.current=undefined;const empty={identity,items:[],busy:false,error:'',changed:false};current.current=empty;setState(empty);if(enabled)void run(true);return()=>{generation.current++;flight.current=false;};},[identity,enabled,run]);
 useEffect(()=>{const cached=deferred.current;if(!paused&&cached&&cached.identity===identity&&cached.token===generation.current){deferred.current=undefined;setState(cached.state);}},[identity,paused]);
 const next=useCallback(()=>{if(enabled&&!pausedRef.current&&!deferred.current)void run();},[enabled,run]);
 const retry=useCallback(()=>{if(enabled)void run();},[enabled,run]);
 return {...(state.identity===identity?state:{identity,items:[],busy:false,error:'',changed:false}),next,retry};
}

export function useSectionActivation(identity:string){
 const element=useRef<HTMLElement>(null),[seen,setSeen]=useState<string>();
 const latest=useRef(identity);latest.current=identity;
 const active=seen===identity||typeof IntersectionObserver==='undefined';
 useEffect(()=>{if(active||!element.current)return;let live=true;const observer=new IntersectionObserver(entries=>{if(live&&latest.current===identity&&entries.some(entry=>entry.isIntersecting)){setSeen(identity);observer.disconnect();}},{root:null,rootMargin:'120px 0px'});observer.observe(element.current);return()=>{live=false;observer.disconnect();};},[identity,active]);
 return {element,active};
}

/** One automatic page per entry into the near-bottom region; remaining visible is not another entry. */
export function useNextBrowsePage(identity:string,enabled:boolean,paused:boolean,next:()=>void){
 const element=useRef<HTMLDivElement>(null),latch=useRef({identity,entered:false}),nextRef=useRef(next);nextRef.current=next;
 if(latch.current.identity!==identity)latch.current={identity,entered:false};
 useEffect(()=>{if(!enabled||paused||!element.current||typeof IntersectionObserver==='undefined')return;let live=true;const observer=new IntersectionObserver(entries=>{if(!live||latch.current.identity!==identity)return;for(const entry of entries){if(!entry.isIntersecting)latch.current.entered=false;else if(!latch.current.entered){latch.current.entered=true;nextRef.current();}}},{root:null,rootMargin:'0px 0px 120px 0px'});observer.observe(element.current);return()=>{live=false;observer.disconnect();};},[identity,enabled,paused]);
 return element;
}

export function useBoundedSales(ids:string[],identity:string,onSales?:(values:StoreProduct[])=>void){
 type Cache={identity:string;quotes:Record<string,StoreProduct>;done:Set<string>;requested:Set<string>;queue:string[];busy:boolean;error:string;alive:boolean};
 const create=():Cache=>({identity,quotes:{},done:new Set(),requested:new Set(),queue:[],busy:false,error:'',alive:true});
 const cache=useRef<Cache>(create());if(cache.current.identity!==identity){cache.current.alive=false;cache.current=create();}
 const [state,setState]=useState({identity,quotes:{} as Record<string,StoreProduct>,done:new Set<string>(),error:''});
 const [attempt,setAttempt]=useState(0),callback=useRef(onSales);callback.current=onSales;
 const idsKey=JSON.stringify([...new Set(ids)].sort());
 useEffect(()=>{const current=cache.current;current.alive=true;return()=>{current.alive=false;};},[identity]);
 useEffect(()=>{const current=cache.current;if(current.error)return;for(const id of JSON.parse(idsKey) as string[])if(!current.requested.has(id)){current.requested.add(id);current.queue.push(id);}
  if(current.busy||!current.queue.length)return;current.busy=true;
  void(async()=>{while(current.queue.length){const batch=current.queue.splice(0,24);try{const values=await storefrontApi.productSales(batch);if(!current.alive||cache.current!==current)return;if(values.some(value=>!batch.includes(value.id))||new Set(values.map(value=>value.id)).size!==values.length)throw Error('browse.invalid');values.forEach(value=>current.quotes[value.id]=value);batch.forEach(id=>current.done.add(id));setState({identity,quotes:{...current.quotes},done:new Set(current.done),error:''});callback.current?.(values);}catch(error){if(current.alive&&cache.current===current){batch.forEach(id=>current.requested.delete(id));current.error=(error as Error).message;setState({identity,quotes:{...current.quotes},done:new Set(current.done),error:current.error});}break;}}})().finally(()=>{current.busy=false;});
 },[idsKey,identity,attempt]);
 const current=state.identity===identity?state:undefined;
 useEffect(()=>{if(!current)return;const boundary=Object.values(current.quotes).map(value=>Date.parse(value.priceValidUntil??'')).filter(time=>Number.isFinite(time)&&time>Date.now());if(!boundary.length)return;const next=Math.min(...boundary);const timer=setTimeout(()=>{const value=cache.current;if(value.identity!==identity)return;for(const id of value.done){const end=Date.parse(value.quotes[id]?.priceValidUntil??'');if(Number.isFinite(end)&&end<=Date.now()){value.done.delete(id);value.requested.delete(id);}}setState(previous=>({...previous,done:new Set(value.done)}));setAttempt(value=>value+1);},Math.min(2147483647,Math.max(1,next-Date.now()+5)));return()=>clearTimeout(timer);},[state,identity]);
 return {quotes:current?.quotes??{},done:current?.done??new Set<string>(),error:current?.error??'',retry:()=>{cache.current.error='';setAttempt(value=>value+1);}};
}
