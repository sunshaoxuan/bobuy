import type {ReactNode} from 'react';
import {useI18n} from '../i18n';
import {formatMoney} from '../currency';
import {resolvedOfferWindow} from '../referenceOfferWindow';
import {japanDate} from '../recommendationSchedule';
import {showReferenceResolution,type DetailReferenceFacts} from '../productDetailContent';
import CardPrice from './CardPrice';
import './consumer-detail.css';

export function ConsumerDetail({media,children}:{media:ReactNode;children:ReactNode}){
 return <div className="consumer-detail-layout"><div className="consumer-detail-media">{media}</div><div className="consumer-detail-info">{children}</div></div>;
}
export function ProductDetailCode({value}:{value?:string|null}){
 const {t}=useI18n();return <p className="consumer-product-code" title={`${t('rec.code')}: ${value||t('rec.not_stated')}`}><strong>No.{value||'?'}</strong></p>;
}
export function ProductDetailSpecs({model,packaging,specification}:{model?:string|null;packaging?:string|null;specification?:string|null}){
 const {t}=useI18n();
 const rows=[['master.model',model],['master.packaging',packaging],['master.specifications',specification]].filter(([,value])=>!!value);
 return rows.length?<dl className="consumer-product-specs">{rows.map(([key,value])=><div key={key}><dt>{t(key!)}</dt><dd>{value}</dd></div>)}</dl>:null;
}
export function DetailOffer({facts,heading=true}:{facts:DetailReferenceFacts;heading?:boolean}){
 const {t,locale}=useI18n(),window=resolvedOfferWindow(facts),today=japanDate();
 const currency=('currency' in facts&&facts.currency)||'JPY',money=(value:number)=>formatMoney(value,currency,locale).slice(currency.length+1);
 const period=(start?:string|null,end?:string|null)=>[start||t('rec.period_unknown'),end||t('rec.period_unknown')].join(' – ');
 const source=facts.referenceContext?.sourceUrl;let href:string|undefined;
 try{const parsed=new URL(source??'');if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)href=source;}catch{/* Retain source text, never manufacture a replacement URL. */}
 return <><section className="consumer-reference">
  <div className="consumer-reference-heading">{heading&&<h2>{t('detail.reference')}</h2>}<small>{currency}</small></div>
  {(facts.originalPrice!=null&&facts.originalPrice!==facts.referencePrice||facts.discountAmount!=null)&&<div className="consumer-reference-adjustments">{facts.originalPrice!=null&&facts.originalPrice!==facts.referencePrice&&<span>{t('detail.original_price')}: <del>{money(facts.originalPrice)}</del></span>}{facts.discountAmount!=null&&<span className="consumer-reference-discount">{t('detail.discount_amount')}: −{money(facts.discountAmount)}</span>}</div>}
  <div className="consumer-reference-price-line"><div className="consumer-reference-price"><CardPrice amount={facts.referencePrice} currency={currency} kind="reference"/></div>{facts.priceUnit&&<span className="consumer-reference-unit">/ {facts.priceUnit}</span>}</div>
  <dl className="consumer-reference-facts">
   {facts.referenceContext?.channel&&<div><dt>{t('ref.channel')}</dt><dd>{t('ref.'+facts.referenceContext.channel)}</dd></div>}
   {facts.referenceContext?.variantKey&&<div><dt>{t('ref.variantKey')}</dt><dd>{facts.referenceContext.variantKey}</dd></div>}
   <div><dt>{t('rec.offer_period')}</dt><dd>{!window.start&&!facts.referenceContext?.startSearchComplete?t('ref.review_start')+' – '+(window.end||t('rec.period_unknown')):period(window.start,window.end)} <small>{t('rec.japan_dates')}</small>{facts.referenceContext?.activityApplies&&(!facts.offerStart||!facts.offerEnd)&&<small> · {t('ref.inherited')}</small>}</dd></div>
   {(facts.couponStart||facts.couponEnd)&&<div><dt>{t('rec.coupon_period')}</dt><dd>{period(facts.couponStart,facts.couponEnd)} <small>{t('rec.japan_dates')}</small></dd></div>}
   {source&&<div><dt>{t('detail.source')}</dt><dd>{href?<a href={href} aria-label={t('detail.source')} target="_blank" rel="noopener noreferrer">{new URL(href).hostname}</a>:source}</dd></div>}
  </dl>
  {window.start&&window.end&&(today>window.end||today<window.start)&&<small className="consumer-reference-state">{t(today>window.end?'rec.expired':'rec.upcoming')}</small>}
  {showReferenceResolution(facts)&&<p className="consumer-reference-resolution">{t('ref.current')}: {facts.referenceQuote?.state==='ACTIVE'&&facts.referenceQuote.amount!=null?money(facts.referenceQuote.amount):t(facts.referenceQuote?.state==='CONFLICT'?'ref.conflict':'ref.unknown')}</p>}
 </section>{facts.offerNotes&&<section className="consumer-conditions"><h3>{t('detail.conditions')}</h3><p>{facts.offerNotes}</p></section>}</>;
}
