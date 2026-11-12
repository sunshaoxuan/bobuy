import type {ReactNode} from 'react';
import {useI18n} from '../i18n';
import {formatMoney} from '../currency';
import {referencePriceDisplay} from '../referencePriceDisplay';
import {useJapaneseDay} from '../recommendationSchedule';
import {type DetailReferenceFacts} from '../productDetailContent';
import CardPrice from './CardPrice';
import './consumer-detail.css';

export function ConsumerDetail({media,children}:{media:ReactNode;children:ReactNode}){
 return <div className="consumer-detail-layout"><div className="consumer-detail-media">{media}</div><div className="consumer-detail-info">{children}</div></div>;
}
export function ProductDetailCode({value}:{value?:string|null}){
 const {t}=useI18n();return <p className="consumer-product-code" title={`${t('rec.code')}: ${value||t('rec.not_stated')}`}><strong>No.{value||'?'}</strong></p>;
}
export function ProductDetailSpecs({model,packaging,specification,specificationLanguage}:{model?:string|null;packaging?:string|null;specification?:string|null;specificationLanguage?:string}){
 const {t}=useI18n();
 const rows:Array<[string,string|null|undefined]>=[['master.model',model],['master.packaging',packaging],['master.specifications',specification]];
 return rows.some(([,value])=>!!value)?<dl className="consumer-product-specs">{rows.filter(([,value])=>!!value).map(([key,value])=><div key={key}><dt>{t(key)}</dt><dd lang={key==='master.specifications'?specificationLanguage:undefined}>{value}</dd></div>)}</dl>:null;
}
export function DetailOffer({facts,online,heading=true}:{facts:DetailReferenceFacts;online?:DetailReferenceFacts;heading?:boolean}){
 const {t,locale}=useI18n(),today=useJapaneseDay(),display=referencePriceDisplay(facts,today);
 const currency=('currency' in facts&&facts.currency)||'JPY',money=(value:number)=>formatMoney(value,currency,locale).slice(currency.length+1);
 const onlineDisplay=online?referencePriceDisplay(online,today):undefined;
 return <section className="consumer-reference">
  <div className="consumer-reference-heading">{heading&&<h2>{t('detail.reference')}</h2>}<small>{currency}</small></div>
  {display.originalPrice!=null&&<div className="consumer-reference-adjustments"><span>{t('detail.original_price')}: <del>{money(display.originalPrice)}</del></span><span className="consumer-reference-discount">−{money(display.discountAmount!)}</span></div>}
  <div className="consumer-reference-price-line"><div className="consumer-reference-price"><CardPrice amount={display.amount} currency={currency} kind="reference"/></div>{facts.priceUnit&&<span className="consumer-reference-unit">/ {facts.priceUnit}</span>}</div>
  {online&&<p className="consumer-online-price"><small>{t('ref.COSTCO_ONLINE')}: {onlineDisplay?.amount!=null?formatMoney(onlineDisplay.amount,('currency' in online&&online.currency)||'JPY',locale):t('rec.not_stated')}{online.priceUnit?` / ${online.priceUnit}`:''}</small></p>}
 </section>;
}
