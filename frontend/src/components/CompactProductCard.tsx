import {useEffect,useState,type ReactNode} from 'react';
import type {CardReference,StoreProduct,RecommendationFacts} from '../api';
import {referencePriceDisplay} from '../referencePriceDisplay';
import {useI18n} from '../i18n';
import CardPrice from './CardPrice';
import {ProductBrand} from './ProductMetadata';
import {ProductStars} from './ProductRating';
import {openCardDetail} from './openCardDetail';
import {ProductPopularity,recordProductClick} from './ProductPopularity';

export function referenceForCard(facts:RecommendationFacts&{id:number;currency?:string},postId:number,today?:string):CardReference|undefined{
 const display=referencePriceDisplay(facts,today??'');if(display.amount==null)return undefined;
 return {...display,amount:display.amount,currency:facts.currency??'JPY',unit:facts.priceUnit,postId,itemId:facts.id,state:display.state as CardReference['state']};
}

/** One public product-card hierarchy; source facts and conditions stay in detail. */
export default function CompactProductCard({name,originalName,language,brand,itemNumber,image,productId,rating,quote,reference,pending=false,eager=false,eagerRating=false,heading=2,occurrenceKey,onOpen,overlay,actions}:{
 name:string;originalName?:string;language?:string;brand?:string|null;itemNumber?:string|null;image?:string|null;
 productId?:string|null;rating?:number|null;quote?:StoreProduct;reference?:CardReference|null;
 pending?:boolean;eager?:boolean;eagerRating?:boolean;heading?:2|3;occurrenceKey?:string;
 onOpen:(trigger:HTMLButtonElement)=>void;overlay?:ReactNode;actions?:ReactNode;
}){
 const {t,locale}=useI18n(),Heading=heading===3?'h3':'h2';
 const nativeName=locale!=='ja-JP'?originalName?.trim():undefined;
 const original=reference?.originalPrice;
 const reduction=reference&&original!=null&&Number.isFinite(original)&&original>reference.amount?Math.round((original-reference.amount)*100)/100:undefined;
 const money=(value:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value)+' '+(reference?.currency??'JPY');
 const [pressed,setPressed]=useState(false);
 const open=(trigger:HTMLButtonElement)=>{if(productId)void recordProductClick(productId);onOpen(trigger);};
 useEffect(()=>{const clear=()=>setPressed(false);window.addEventListener('blur',clear);return()=>window.removeEventListener('blur',clear);},[]);
 const actual=!pending&&quote,kind=actual?'sale':reference?.amount!=null?'reference':'unknown';
 const referenceLabel=t(reference?.state==='EXPIRED'?'card.reference_past':reference?.state==='FUTURE'?'card.reference_future':reference?.state==='UNKNOWN'?'card.reference_undated':'card.reference');
 return <article className="store-product rec-pin catalog-master-card compact-product-card" data-product-id={productId??undefined} data-occurrence-key={occurrenceKey} data-card-detail data-pressed={pressed||undefined} onClick={event=>openCardDetail(event,open)} onPointerDown={event=>{if(event.pointerType!=='mouse')setPressed(true);}} onPointerUp={()=>setPressed(false)} onPointerCancel={()=>setPressed(false)} onPointerLeave={()=>setPressed(false)} onLostPointerCapture={()=>setPressed(false)}>
  <small className="rec-pin-code" title={`${t('rec.code')}: ${itemNumber||t('rec.not_stated')}`}><span className="compact-card-code-value">No.{itemNumber||'?'}</span></small>
  <div className="product-tile">
   <button type="button" className="product-photo" data-detail-trigger="photo" aria-label={t('store.detail_label',{name})} onClick={event=>open(event.currentTarget)}>
    {image?<img src={image} alt={name} loading={eager?'eager':'lazy'} onError={event=>{event.currentTarget.style.display='none';}}/>:<span className="rec-no-product-image">{t('gallery.pending')}</span>}
   </button>
   {overlay}
   <div className="product-body"><div className="compact-card-brand"><ProductBrand brand={brand}/></div><button type="button" className="product-name" data-detail-trigger="name" onClick={event=>open(event.currentTarget)}><Heading lang={language} title={name}>{name||t('rec.not_stated')}</Heading>{locale!=='ja-JP'&&<small className="compact-card-native-name" lang="ja" title={nativeName}>{nativeName?`（${nativeName}）`:'\u00a0'}</small>}</button></div>
  </div>
  <ProductStars value={rating} productId={productId} eager={eagerRating}/>
  <div className="compact-card-price" data-price-kind={kind} data-price-source-post={kind==='reference'?reference?.postId:undefined} data-price-source-item={kind==='reference'?reference?.itemId:undefined}>
   {actual?<><CardPrice amount={actual.price} currency={actual.currency}/>{actual.saleUnit&&<small className="card-price-unit" title={actual.saleUnit}>/ {actual.saleUnit}</small>}</>:reference?.amount!=null?<><small className="card-price-label">{referenceLabel}</small><div className="compact-card-discount">{reduction!=null&&<><del title={t('detail.original_price')}>{money(original!)}</del><span className="compact-card-reduction" aria-label={t('detail.discount_amount')}>−{money(reduction)}</span></>}</div><CardPrice amount={reference.amount} currency={reference.currency} kind="reference"/>{reference.unit&&<small className="card-price-unit" title={reference.unit}>/ {reference.unit}</small>}</>:<small className="card-price-label">{t('card.price_unknown')}</small>}
  </div>
  {actions}
  <ProductPopularity id={productId}/>
 </article>;
}
