import {useCallback,useEffect,useRef,useState} from 'react';
import {storefrontApi,type BrowsePage,type BrowseQuery,type ProductBrowseCard} from './api';
import {preloadCategoryIcons,preloadCategoryIconUrls} from './categoryIconPriority';
import {missingRange} from './catalogWindow';
import {useReadRecovery} from './hooks/useReadRecovery';
import {isRecoverableReadError} from './readRecovery';
export type WindowRows={items:Map<number,ProductBrowseCard>;total:number;busy:boolean;error:string;recoverable?:boolean};
type State={identity:string;page?:BrowsePage<ProductBrowseCard>;rows:Record<string,WindowRows>;continuous:boolean;busy:boolean;error:string;changed:boolean;recoverable?:boolean};
const empty=(identity:string):State=>({identity,rows:{},continuous:false,busy:false,error:'',changed:false});
/** Sparse ranges retain already-read facts, while only current viewport windows request work.
 * One revision, at most two in-flight sections; fast scrolling never drains intervening pages. */
export function useVisibleCatalog(identity:string,query:BrowseQuery,enabled:boolean,paused:boolean,initialLimit:number,acceptDataset?:(revision:string)=>boolean){
 const [state,setState]=useState<State>(()=>empty(identity)),current=useRef(state),generation=useRef(0),flights=useRef(new Set<string>()),wanted=useRef(new Map<string,{start:number;end:number}>()),initialPending=useRef(false);
 const input=useRef({identity,query,enabled,paused,initialLimit,acceptDataset});input.current={identity,query,enabled,paused,initialLimit,acceptDataset};
 const active=(token:number)=>token===generation.current&&input.current.enabled&&current.current.identity===input.current.identity;
 function publish(next:State){current.current=next;setState(next);}
 function pump(){
  const token=generation.current,snapshot=current.current;if(!active(token)||!snapshot.page||snapshot.changed||input.current.paused||initialPending.current)return;
  for(const [key,range] of wanted.current){
   if(flights.current.size>=2)break;const prior=current.current.rows[key];if(!prior||prior.error||flights.current.has(key))continue;
   const missing=missingRange(prior.items,range.start,Math.min(range.end,prior.total));if(!missing)continue;
   flights.current.add(key);publish({...current.current,rows:{...current.current.rows,[key]:{...prior,busy:true}}});
   const request={...input.current.query,...missing,revision:snapshot.page.revision};
   const task=snapshot.continuous?storefrontApi.productShelf({...request,sections:true,scopeCategory:input.current.query.category,category:key}):storefrontApi.productBrowse(request);
   void task.then(result=>{
    if(!active(token))return;
    if(result.revision!==snapshot.page!.revision||result.datasetRevision!==snapshot.page!.datasetRevision)throw Error('browse.changed');
    const shelf=result.shelves?.[0],items=snapshot.continuous?shelf?.items:result.items;
    if(result.offset!==missing.offset||result.size!==missing.limit||snapshot.continuous&&(result.shelves?.length!==1||shelf?.category!==key||shelf.total!==prior.total)||!snapshot.continuous&&result.matchedTotal!==prior.total||!items||items.length!==Math.min(missing.limit,prior.total-missing.offset))throw Error('browse.invalid');
    const occupied=new Map<string,string>();for(const [section,rows] of Object.entries(current.current.rows))for(const [index,item] of rows.items)occupied.set(item.productId,section+':'+index);
    const next=new Map(current.current.rows[key].items);
    items.forEach((item,index)=>{const at=missing.offset+index,position=key+':'+at,previous=occupied.get(item.productId);if(!item.productId||previous&&previous!==position)throw Error('browse.changed');occupied.set(item.productId,position);next.set(at,item);});
    publish({...current.current,rows:{...current.current.rows,[key]:{...prior,items:next,busy:false,error:''}}});
   }).catch(error=>{if(active(token))publish({...current.current,changed:current.current.changed||(error as Error).message==='browse.changed',rows:{...current.current.rows,[key]:{...current.current.rows[key],busy:false,error:(error as Error).message,recoverable:isRecoverableReadError(error)}}});})
   .finally(()=>{if(active(token)){flights.current.delete(key);pump();}});
  }
 }
 async function navigation(){
  const token=generation.current;if(initialPending.current||!input.current.enabled)return;
  initialPending.current=true;publish({...current.current,busy:true,error:''});
  try{
   const q=input.current.query,grouped=!q.query?.trim()&&(q.sort??'default')==='default';
   const limit=Math.max(1,Math.min(48,input.current.initialLimit));
   const result=await (grouped&&!q.category?storefrontApi.productOverview({...q,sections:true,offset:0,limit}):storefrontApi.productBrowse({...q,page:0,sections:grouped,offset:0,limit}));
   if(!active(token))return;
   if(result.offset!==0||result.size!==limit||!result.revision||!result.datasetRevision||!Array.isArray(result.categories)||!Number.isSafeInteger(result.matchedTotal)||result.matchedTotal<0)throw Error('browse.invalid');
   const selected=result.categories.find(c=>c.id===(result.selectedCategory??q.category)),continuous=grouped&&(!q.category||!selected?.parentId)&&!!result.shelves?.length;
   const sections=continuous?result.shelves!:[];const ids=new Set<string>();let total=0;
   for(const [index,s] of sections.entries()){if(!s.category||ids.has(s.category)||!Number.isSafeInteger(s.total)||s.total<=0||s.items.length!==(index===0?Math.min(limit,s.total):0))throw Error('browse.invalid');ids.add(s.category);total+=s.total;}
   if(continuous&&total!==result.matchedTotal)throw Error('browse.invalid');
   const first=continuous?sections[0]?.items:result.items;
   if(!first||first.length!==Math.min(limit,continuous?sections[0].total:result.matchedTotal)||new Set(first.map(i=>i.productId)).size!==first.length||first.some(i=>!i.productId))throw Error('browse.invalid');
   if(input.current.acceptDataset&&!input.current.acceptDataset(result.datasetRevision))throw Error('browse.changed');
   const rows:Record<string,WindowRows>=Object.fromEntries((continuous?sections.map(s=>[s.category,s.total] as const):[['',result.matchedTotal] as const]).map(([id,total])=>[id,{items:new Map(),total,busy:false,error:''}]));
   const key=continuous?sections[0].category:'';
   const seeded={...rows,[key]:{...rows[key],items:new Map(first.map((item,index)=>[index,item]))}};
   if(continuous){
    preloadCategoryIcons(result.categories);publish({...current.current,page:result,rows,continuous,busy:false});
    requestAnimationFrame(()=>setTimeout(()=>{if(!active(token))return;initialPending.current=false;publish({...current.current,rows:seeded});pump();},0));
   }else{
    // A selected leaf/search has no staged section navigation: publish its cards together.
    initialPending.current=false;publish({...current.current,page:result,rows:seeded,continuous,busy:false});pump();
   }
  }catch(error){if(active(token)){initialPending.current=false;publish({...current.current,busy:false,error:(error as Error).message,changed:(error as Error).message==='browse.changed',recoverable:isRecoverableReadError(error)});}}
 }
 useEffect(()=>{generation.current++;flights.current=new Set();wanted.current=new Map();initialPending.current=false;publish(empty(identity));if(enabled){void navigation();const token=generation.current;const q=input.current.query;if(!q.category&&!q.query?.trim()&&(q.sort??'default')==='default')void(async()=>{try{const urls=await storefrontApi.categoryIcons();if(active(token)&&Array.isArray(urls)&&urls.every(url=>typeof url==='string'))preloadCategoryIconUrls(urls);}catch{/* Hints never block products. */}})();}return()=>{generation.current++;};},[identity,enabled]);
 useEffect(()=>{if(!paused)pump();},[paused]);
 const ensure=useCallback((key:string,start:number,end:number)=>{if(input.current.identity!==identity)return;const prior=wanted.current.get(key);if(prior?.start===start&&prior.end===end)return;wanted.current.set(key,{start,end});publish({...current.current});pump();},[identity]);
 function retry(key?:string){if(key===undefined&&!current.current.page){void navigation();return;}for(const [id,row] of Object.entries(current.current.rows))if(key===undefined||id===key)current.current.rows[id]={...row,error:'',recoverable:false};publish({...current.current});pump();}
 const shown=state.identity===identity?state:empty(identity);
 useReadRecovery(()=>retry(),enabled&&!paused&&!shown.changed&&(!!shown.recoverable||Object.values(shown.rows).some(row=>row.recoverable)),identity);
 const visible=Object.entries(shown.rows).flatMap(([id,row])=>{const range=wanted.current.get(id);return range?[...row.items].filter(([index])=>index>=range.start&&index<range.end).map(([,item])=>item):[];});
 return {...shown,visible,ensure,retry,next:()=>{},items:shown.continuous?[]:visible};
}
