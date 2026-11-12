import {useEffect,useState} from 'react';
import {FireFilled} from '@ant-design/icons';
import {Tooltip} from 'antd';
import {useI18n} from '../i18n';

type State={clicks?:string;error?:boolean};
const values=new Map<string,State>(),listeners=new Map<string,Set<()=>void>>(),requests=new Map<string,Promise<void>>();
const notify=(id:string)=>listeners.get(id)?.forEach(listener=>listener());
async function load(id:string){
 if(requests.has(id))return requests.get(id);
 const task=(async()=>{try{const response=await fetch('/api/storefront/product-popularity/'+encodeURIComponent(id),{cache:'no-store'});if(!response.ok)throw Error();const value=(await response.json()).data;const current=values.get(id)?.clicks??'0';values.set(id,{clicks:BigInt(value.clicks)>BigInt(current)?value.clicks:current});}catch{values.set(id,{...values.get(id),error:true});}finally{requests.delete(id);notify(id);}})();
 requests.set(id,task);return task;
}
export async function recordProductClick(id:string){
 try{
  const response=await fetch('/api/storefront/product-popularity/'+encodeURIComponent(id)+'/click',{method:'POST'});
  if(!response.ok)throw Error();const value=(await response.json()).data;
  const current=values.get(id)?.clicks??'0';values.set(id,{clicks:BigInt(value.clicks)>BigInt(current)?value.clicks:current});notify(id);
  try{localStorage.setItem('product-popularity-updated',JSON.stringify({id,nonce:crypto.randomUUID()}));}catch{}
 }catch{values.set(id,{...values.get(id),error:true});notify(id);}
}
export function ProductPopularity({id}:{id?:string|null}){
 const {t,locale}=useI18n(),[,render]=useState(0);
 useEffect(()=>{if(!id)return;const listener=()=>render(n=>n+1);let group=listeners.get(id);if(!group){group=new Set();listeners.set(id,group);}group.add(listener);void load(id);
  const refresh=()=>void load(id),sync=(event:StorageEvent)=>{if(event.key==='product-popularity-updated'){try{if(JSON.parse(event.newValue??'{}').id===id)void load(id);}catch{}}};
  window.addEventListener('focus',refresh);window.addEventListener('storage',sync);
  return()=>{group!.delete(listener);if(!group!.size)listeners.delete(id);window.removeEventListener('focus',refresh);window.removeEventListener('storage',sync);};
 },[id]);
 const state=id?values.get(id):undefined;
 const count=state?.clicks==null?undefined:BigInt(state.clicks),exact=count?.toLocaleString(locale),compact=count!=null&&count>9999n;
 const shown=count==null?'…':compact?new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:1}).format(count):exact;
 return <small className="product-popularity" data-card-action aria-live="polite" title={state?.error?t('heat.error'):undefined}><span><FireFilled aria-hidden/> {t('heat.label')}</span><Tooltip title={compact?exact:undefined} trigger={['hover','focus','click']}><span tabIndex={compact?0:undefined} aria-label={exact?t('heat.label')+' '+exact:undefined}>{state?.error?t('heat.unavailable'):shown}</span></Tooltip></small>;
}
