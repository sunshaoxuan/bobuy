import {PlusOutlined} from '@ant-design/icons';
import {useEffect,useRef,useState} from 'react';
import type {StoreProduct} from '../api';
import {useI18n} from '../i18n';
/** Eligibility belongs to the existing quote/trip gates; this is only their visible action. */
export function liveReservationQuote(quote?:StoreProduct,now=Date.now()){
 if(!quote||!Number.isFinite(quote.price)||quote.price<0)return false;
 const from=quote.priceValidFrom?Date.parse(quote.priceValidFrom):undefined,until=quote.priceValidUntil?Date.parse(quote.priceValidUntil):undefined;
 return (from===undefined||Number.isFinite(from)&&now>=from)&&(until===undefined||Number.isFinite(until)&&now<until);
}
export default function ReservationAdd({allowed,name,count,onAdd,quote}:{allowed:boolean;name:string;count?:number;onAdd:()=>void;quote?:StoreProduct}){
 const {t}=useI18n(),button=useRef<HTMLButtonElement>(null),[,refresh]=useState(0);
 useEffect(()=>{const until=Date.parse(quote?.priceValidUntil??'');if(!allowed||!Number.isFinite(until)||until<=Date.now())return;const timer=setTimeout(()=>{if(document.activeElement===button.current)button.current?.closest('article')?.querySelector<HTMLButtonElement>('.product-photo')?.focus();refresh(v=>v+1);},Math.min(2147483647,until-Date.now()));return()=>clearTimeout(timer);},[allowed,quote?.priceValidUntil]);
 if(!allowed||!liveReservationQuote(quote))return null;
 return <button ref={button} type="button" className="product-add reservation-add" aria-label={t('store.add_label',{name})} onClick={event=>{event.stopPropagation();if(allowed&&liveReservationQuote(quote))onAdd();}}><PlusOutlined aria-hidden/>{!!count&&<span className="product-count">{count}</span>}</button>;
}
