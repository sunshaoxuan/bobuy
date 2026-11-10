import { useEffect, useRef, useState } from 'react';
import type { CustomerAmendmentDelivery, CustomerAmendmentLine, CustomerAmendmentProduct, CustomerAmendmentInput, CustomerAmendmentSnapshot } from '../api';
export type AmendmentLine = CustomerAmendmentLine;
export type AmendmentOrder = {id:number;revision:string;editable:boolean;lines:AmendmentLine[];delivery?:CustomerAmendmentDelivery|null;products?:CustomerAmendmentProduct[];currency?:string;originalProducts?:CustomerAmendmentSnapshot[]};
export type AmendmentLabels = Record<'title'|'quantity'|'save'|'reload'|'conflict'|'failed'|'locked'|'saved',string>
  & Partial<Record<'remove'|'add'|'select'|'changeAddress'|'contactName'|'phone'|'countryRegion'|'city'|'addressLine'|'postalCode'|'unavailable'|'total',string>>;
type Props = {subject:string;sessionKey?:string;order:AmendmentOrder;labels:AmendmentLabels;save:(orderId:number,input:CustomerAmendmentInput)=>Promise<AmendmentOrder>;
  reload?:()=>Promise<AmendmentOrder>;name?:(value:Record<string,string>)=>string;money?:(amount:number,currency:string)=>string};
const blankAddress:CustomerAmendmentDelivery={contactName:'',countryRegion:'',city:'',addressLine:'',phone:'',postalCode:''};
export default function CustomerOrderAmendment(props:Props) {return <Form key={JSON.stringify([props.subject,props.sessionKey,props.order.id])} {...props}/>;}
function Form({order,save,reload,labels,name,money}:Props) {
  const [draft,setDraft]=useState(()=>order.lines.map(x=>({...x}))),[catalog,setCatalog]=useState(order.products),[base,setBase]=useState(order.revision);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[conflicted,setConflicted]=useState(false),[accepted,setAccepted]=useState<{fromRevision:string;order:AmendmentOrder}>();
  const [selection,setSelection]=useState(''),[changeAddress,setChangeAddress]=useState(false),[address,setAddress]=useState<CustomerAmendmentDelivery>(()=>({...blankAddress,...order.delivery}));
  const mounted=useRef(true),pending=useRef(false),latest=useRef(order);latest.current=order;const retry=useRef<{payload:string;requestId:string}>();
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const propIsKnownOld=accepted?.fromRevision===order.revision,conflict=conflicted||(base!==order.revision&&!propIsKnownOld),editable=order.editable&&(!propIsKnownOld||accepted.order.editable);
  const byId=new Map(catalog?.map(p=>[p.id,p])),available=draft.every(l=>catalog===undefined||byId.has(l.productId));
  const valid=draft.length>0&&draft.length<=50&&new Set(draft.map(l=>l.productId)).size===draft.length&&draft.every(l=>Number.isInteger(l.quantity)&&l.quantity>=1&&l.quantity<=99)&&available
    &&(!changeAddress||[address.contactName,address.countryRegion,address.city,address.addressLine].every(v=>v.trim().length>0));
  function accept(result:AmendmentOrder,externalRevision:string):boolean {
    if(!mounted.current)return false;
    if(latest.current.revision!==externalRevision&&latest.current.revision!==result.revision){setConflicted(true);setMessage('');return false;}
    if(result.id!==order.id||!/^[0-9a-f]{64}$/.test(result.revision))throw new Error('Invalid amendment response');
    setAccepted({fromRevision:latest.current.revision,order:result});setConflicted(false);setBase(result.revision);setDraft(result.lines.map(x=>({...x})));setCatalog(result.products);
    setAddress({...blankAddress,...result.delivery});setChangeAddress(false);setSelection('');retry.current=undefined;return true;
  }
  function failure(error:unknown){if(!mounted.current)return;if((error as {status?:number})?.status===409){setConflicted(true);setMessage('');}else setMessage(labels.failed);}
  function productLabel(product:CustomerAmendmentSnapshot){return [...new Set([name?.(product.name)??Object.values(product.name)[0],product.brand,product.itemNumber,product.model,product.packaging,product.specifications?(name?.(product.specifications)??Object.values(product.specifications)[0]):null,product.unit].filter(Boolean))].join(' · ');}
  return <section aria-label={labels.title} style={{minWidth:0}}><h3>{labels.title}</h3>
    {!editable&&<p role="status">{labels.locked}</p>}{conflict&&<p role="alert">{labels.conflict}</p>}{!available&&labels.unavailable&&<p role="alert">{labels.unavailable}</p>}
    <form style={{display:'grid',gap:10,minWidth:0}} onSubmit={async event=>{
      event.preventDefault();if(pending.current||!editable||conflict||!valid)return;pending.current=true;setBusy(true);setMessage('');const externalRevision=latest.current.revision;
      const lines=draft.map(({productId,quantity,priceToken,priceRevision,currency})=>({productId,quantity,priceToken,priceRevision,currency}));
      const input={expectedRevision:base,lines,...(changeAddress?{delivery:{...address}}:{})},payload=JSON.stringify(input);
      if(retry.current?.payload!==payload)retry.current={payload,requestId:crypto.randomUUID()};
      try{const result=await save(order.id,{...input,requestId:retry.current.requestId});if(accept(result,externalRevision))setMessage(labels.saved);}
      catch(error){failure(error);}finally{pending.current=false;if(mounted.current)setBusy(false);}
    }}>
      {draft.map((line,index)=>{const product=byId.get(line.productId),description=product??(propIsKnownOld?accepted.order:order).originalProducts?.find(p=>p.id===line.productId);return <div key={`${line.productId}:${index}`} style={{display:'grid',gap:4,minWidth:0}}>
        <label style={{overflowWrap:'anywhere'}}>{description?productLabel(description):line.productId}<span> · {labels.quantity}</span>
          <input aria-label={`${labels.quantity} ${line.productId}`} type="number" min={1} max={99} style={{maxWidth:'100%',boxSizing:'border-box'}}
            value={Number.isNaN(line.quantity)?'':line.quantity} disabled={busy||!editable} onChange={event=>{const quantity=event.currentTarget.valueAsNumber;setDraft(rows=>rows.map((row,i)=>i===index?{...row,quantity}:row));setMessage('');}}/>
        </label>{product&&money&&<span>{money(product.amount,product.currency)}{product.unit?' / '+product.unit:''}</span>}{labels.remove&&<button type="button" disabled={busy||!editable} onClick={()=>setDraft(rows=>rows.filter((_,i)=>i!==index))}>{labels.remove}</button>}
      </div>;})}
      {catalog&&labels.add&&labels.select&&<div style={{display:'flex',gap:8,minWidth:0}}>
        <select aria-label={labels.select} value={selection} style={{minWidth:0,maxWidth:'100%',flex:1}} disabled={busy||!editable||draft.length>=50} onChange={e=>setSelection(e.target.value)}>
          <option value="">{labels.select}</option>{catalog.filter(p=>!draft.some(l=>l.productId===p.id)).map(p=><option key={p.id} value={p.id}>{productLabel(p)}{money?' · '+money(p.amount,p.currency):''}</option>)}
        </select><button type="button" disabled={busy||!editable||!selection||draft.length>=50} onClick={()=>{const p=byId.get(selection);if(!p)return;setDraft(rows=>rows.some(l=>l.productId===p.id)?rows:[...rows,{productId:p.id,quantity:1,priceToken:p.priceToken,priceRevision:p.priceRevision,currency:p.currency}]);setSelection('');}}>{labels.add}</button>
      </div>}
      {catalog&&available&&money&&order.currency&&<p>{labels.total}: {money(draft.reduce((sum,l)=>sum+(byId.get(l.productId)?.amount??0)*l.quantity,0),order.currency)}</p>}
      {labels.changeAddress&&<label><input type="checkbox" checked={changeAddress} disabled={busy||!editable} onChange={e=>setChangeAddress(e.target.checked)}/>{labels.changeAddress}</label>}
      {changeAddress&&(['contactName','countryRegion','city','addressLine','phone','postalCode'] as const).map(field=><label key={field}>{labels[field]}
        <input aria-label={labels[field]} style={{width:'100%',boxSizing:'border-box'}} value={address[field]??''} disabled={busy||!editable}
          required={['contactName','countryRegion','city','addressLine'].includes(field)} maxLength={field==='addressLine'?500:field==='phone'?40:field==='postalCode'?30:120}
          onChange={e=>setAddress(current=>({...current,[field]:e.target.value}))}/></label>)}
      <button type="submit" disabled={busy||conflict||!valid||!editable}>{labels.save}</button>
      <button type="button" disabled={busy} onClick={async()=>{
        if(pending.current)return;pending.current=true;setBusy(true);setMessage('');const externalRevision=latest.current.revision;
        try{const current=reload?await reload():(propIsKnownOld?accepted.order:order);accept(current,externalRevision);}catch(error){failure(error);}finally{pending.current=false;if(mounted.current)setBusy(false);}
      }}>{labels.reload}</button>
    </form>{message&&<p role="status">{message}</p>}
  </section>;
}
