import {preloadCategoryIcons,preloadCategoryIconUrls} from './categoryIconPriority';
import {useEffect,useRef,useState} from 'react';
import {storefrontApi,type BrowsePage,type ProductBrowseCard,type BrowseQuery} from './api';
import {useReadRecovery} from './hooks/useReadRecovery';
import {isRecoverableReadError} from './readRecovery';

type ShelfState={page?:number;items:ProductBrowseCard[];busy:boolean;loaded:boolean;error:string;recoverable?:boolean};
type State={identity:string;page?:BrowsePage<ProductBrowseCard>;shelves:Record<string,ShelfState>;busy:boolean;error:string;changed:boolean;recoverable?:boolean};
const empty=(identity:string):State=>({identity,shelves:{},busy:false,error:'',changed:false});

/** Overview navigation and its first shelf share one response; at most two visible shelves in flight, never an all-shelf fan-out.
 * Each response is pinned to the metadata revision. Failed shelves retry independently. */
export function useProgressiveCatalog(identity:string,query:BrowseQuery,enabled:boolean,paused:boolean,acceptDataset?:(revision:string)=>boolean,seed?:BrowsePage<ProductBrowseCard>){
 const [state,setState]=useState<State>(()=>empty(identity));
 const current=useRef(state),generation=useRef(0),wanted=useRef(new Map<string,number>()),flights=useRef(new Set<string>()),navFlight=useRef(false),initialPending=useRef(false);
 const input=useRef({identity,query,enabled,paused,acceptDataset,seed});input.current={identity,query,enabled,paused,acceptDataset,seed};
 function publish(next:State){current.current=next;setState(next);}
 function active(token:number){return token===generation.current&&current.current.identity===input.current.identity&&input.current.enabled;}
 function pump(){
  const snapshot=current.current,token=generation.current;
  if(!active(token)||!snapshot.page||snapshot.changed||input.current.paused||initialPending.current)return;
  for(const [category,page] of wanted.current){
   if(flights.current.size>=2)break;
   const prior=current.current.shelves[category];
   if(prior?.loaded&&page<=(prior.page??-1)){wanted.current.delete(category);continue;}
   if(prior?.error||flights.current.has(category))continue;
   const meta=snapshot.page.shelves?.find(s=>s.category===category);if(!meta)continue;
   wanted.current.delete(category);flights.current.add(category);
   publish({...current.current,shelves:{...current.current.shelves,[category]:{...prior,items:prior?.items??[],busy:true,loaded:!!prior?.loaded,error:''}}});
   void storefrontApi.productShelf({...input.current.query,category,scopeCategory:input.current.query.category,page,revision:snapshot.page.revision}).then(result=>{
    if(!active(token))return;
    if(result.revision!==snapshot.page!.revision||result.datasetRevision!==snapshot.page!.datasetRevision)throw Error('browse.changed');
    const shelf=result.shelves?.[0];
    if(result.shelves?.length!==1||shelf?.category!==category||shelf.total!==meta.total||!Array.isArray(shelf.items)||shelf.items.length!==Math.min(input.current.query.sections?24:8,Math.max(0,meta.total-page*24))||input.current.query.sections&&result.page!==page)throw Error('browse.invalid');
    const before=page>0?(prior?.items??[]):[];
    if(page===0&&prior?.items.length&&prior.items.some((item,index)=>item.productId!==shelf.items[index]?.productId))throw Error('browse.changed');
    const existing=new Set(Object.entries(current.current.shelves).filter(([key])=>key!==category).flatMap(([,s])=>s.items.map(i=>i.productId)));
    before.forEach(item=>existing.add(item.productId));
    for(const item of shelf.items){if(!item.productId||existing.has(item.productId))throw Error('browse.changed');existing.add(item.productId);}
    publish({...current.current,shelves:{...current.current.shelves,[category]:{page,items:[...before,...shelf.items],busy:false,loaded:true,error:''}}});
   }).catch(error=>{
    if(!active(token))return;
    const message=(error as Error).message;
    publish({...current.current,changed:message==='browse.changed'||current.current.changed,shelves:{...current.current.shelves,[category]:{...prior,items:prior?.items??[],busy:false,loaded:!!prior?.loaded,error:message,recoverable:isRecoverableReadError(error)}}});
   }).finally(()=>{if(active(token)){flights.current.delete(category);pump();}});
  }
 }
 async function navigation(){
  if(navFlight.current||!input.current.enabled)return;
  const token=generation.current;navFlight.current=true;initialPending.current=true;publish({...current.current,busy:true,error:''});
  try{
   const seed=input.current.seed;
   const result=seed??await storefrontApi.productOverview(input.current.query);
   if(!active(token))return;
   if(!result.revision||!result.datasetRevision||!Array.isArray(result.categories)||!Array.isArray(result.shelves)||!seed&&result.items.length||!Number.isSafeInteger(result.matchedTotal)||result.matchedTotal<0)throw Error('browse.invalid');
   const ids=new Set<string>();let total=0;
   for(const [index,s] of result.shelves.entries()){
    if(!s.category||ids.has(s.category)||!Number.isSafeInteger(s.total)||s.total<=0||!Array.isArray(s.items)||s.items.length!==(seed?Math.min(8,s.total):index===0?Math.min(8,s.total):0)||new Set(s.items.map(i=>i.productId)).size!==s.items.length||s.items.some(i=>!i.productId))throw Error('browse.invalid');ids.add(s.category);total+=s.total;
   }
   if(total!==result.matchedTotal)throw Error('browse.invalid');
   if(input.current.acceptDataset&&!input.current.acceptDataset(result.datasetRevision))throw Error('browse.changed');
   preloadCategoryIcons(result.categories);
   const first=result.shelves[0];
   if(first)flights.current.add(first.category);
   publish({...current.current,page:result,busy:false,error:'',shelves:first?{[first.category]:{items:[],busy:true,loaded:false,error:''}}:{}});
   // Paint navigation first, then submit the already-received shelf in the following task.
   // Yield past this paint without waiting a second frame or any image/network promise.
   const frame=typeof requestAnimationFrame==='function'?requestAnimationFrame:(fn:FrameRequestCallback)=>setTimeout(()=>fn(0),0);
   frame(()=>setTimeout(()=>{
    if(!active(token))return;
    initialPending.current=false;
    if(first){flights.current.delete(first.category);const initial=seed?result.shelves!:[first];initial.forEach(s=>wanted.current.delete(s.category));publish({...current.current,shelves:{...current.current.shelves,...Object.fromEntries(initial.map(s=>[s.category,{page:seed||input.current.query.sections?-1:0,items:s.items,busy:false,loaded:true,error:''}]))}});}
    pump();
   },0));
  }catch(error){initialPending.current=false;if(active(token))publish({...current.current,busy:false,error:(error as Error).message,changed:(error as Error).message==='browse.changed',recoverable:isRecoverableReadError(error)});}
  finally{if(active(token))navFlight.current=false;}
 }
 useEffect(()=>{
  generation.current++;wanted.current=new Map();flights.current=new Set();navFlight.current=false;
  publish(empty(identity));if(enabled){
   void navigation();
   const token=generation.current;
   void (async()=>{try{const urls=await storefrontApi.categoryIcons();if(active(token)&&Array.isArray(urls)&&urls.every(url=>typeof url==='string'))preloadCategoryIconUrls(urls);}catch{/* Optional art hints never block product data or create a page error. */}})();
  }
  return()=>{generation.current++;};
 },[identity,enabled]);
 useEffect(()=>{if(!paused)pump();},[paused]);
 function activate(category:string){if(!current.current.shelves[category]?.loaded){wanted.current.set(category,0);pump();}}
 function next(category:string){const s=current.current.shelves[category],meta=current.current.page?.shelves?.find(s=>s.category===category);if(!s||s.busy||s.error||!meta||s.items.length>=meta.total)return;wanted.current.set(category,(s.page??-1)+1);pump();}
 function retry(category?:string){
  if(!category){void navigation();return;}
  if(flights.current.has(category)||current.current.changed)return;
  const prior=current.current.shelves[category];
  publish({...current.current,shelves:{...current.current.shelves,[category]:{...prior,items:prior?.items??[],loaded:!!prior?.loaded,busy:false,error:''}}});wanted.current.set(category,(prior?.page??-1)+1);pump();
 }
 const visible=state.identity===identity?state:empty(identity);
 useReadRecovery(()=>{
  if(!current.current.page)void navigation();
  else for(const [id,s] of Object.entries(current.current.shelves))if(s.recoverable)retry(id);
 },enabled&&!paused&&!visible.changed&&(!!visible.recoverable||Object.values(visible.shelves).some(s=>s.recoverable)),identity);
 return {...visible,activate,retry,next};
}
