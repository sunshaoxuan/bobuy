import type {ReactNode} from 'react';
import {useI18n} from '../i18n';
import {formatMoney} from '../currency';
import {resolvedOfferWindow} from '../referenceOfferWindow';
import {japanDate} from '../recommendationSchedule';
import {showReferenceResolution,type DetailReferenceFacts} from '../productDetailContent';
import './consumer-detail.css';

export function ConsumerDetail({media,children}:{media:ReactNode;children:ReactNode}){
 return <div className="consumer-detail-layout"><div className="consumer-detail-media">{media}</div><div className="consumer-detail-info">{children}</div></div>;
}
export function ProductDetailCode({value}:{value?:string|null}){
 const {t}=useI18n();return <p className="consumer-product-code"><span>{t('rec.code')}</span><strong>{value||t('rec.not_stated')}</strong></p>;
}
export function DetailOffer({facts,heading=true}:{facts:DetailReferenceFacts;heading?:boolean}){
 const {t,locale}=useI18n(),window=resolvedOfferWindow(facts),today=japanDate();
 const currency=('currency' in facts&&facts.currency)||'JPY',money=(value:number)=>formatMoney(value,currency,locale);
 const period=(start?:string|null,end?:string|null)=>[start||t('rec.period_unknown'),end||t('rec.period_unknown')].join(' – ');
 const source=facts.referenceContext?.sourceUrl;let href:string|undefined;
 try{const parsed=new URL(source??'');if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)href=source;}catch{/* Retain source text, never manufacture a replacement URL. */}
 return <section className="consumer-reference">
  {heading&&<h2>{t('detail.reference')}</h2>}
  <div className="consumer-reference-price-line"><strong className="consumer-reference-price">{facts.referencePrice==null?t('rec.not_stated'):money(facts.referencePrice)}</strong>{facts.priceUnit&&<span className="consumer-reference-unit">/ {facts.priceUnit}</span>}</div>
  <div className="consumer-reference-adjustments">{facts.originalPrice!=null&&facts.originalPrice!==facts.referencePrice&&<span>{t('detail.original_price')}: <del>{money(facts.originalPrice)}</del></span>}{facts.discountAmount!=null&&<span>{t('detail.discount_amount')}: {money(facts.discountAmount)}</span>}</div>
  <dl className="consumer-reference-facts">
   {facts.referenceContext?.channel&&<div><dt>{t('ref.channel')}</dt><dd>{t('ref.'+facts.referenceContext.channel)}</dd></div>}
   {facts.referenceContext?.variantKey&&<div><dt>{t('ref.variantKey')}</dt><dd>{facts.referenceContext.variantKey}</dd></div>}
   <div><dt>{t('rec.offer_period')}</dt><dd>{!window.start&&!facts.referenceContext?.startSearchComplete?t('ref.review_start')+' – '+(window.end||t('rec.period_unknown')):period(window.start,window.end)} <small>{t('rec.japan_dates')}</small>{facts.referenceContext?.activityApplies&&(!facts.offerStart||!facts.offerEnd)&&<small> · {t('ref.inherited')}</small>}</dd></div>
   {(facts.couponStart||facts.couponEnd)&&<div><dt>{t('rec.coupon_period')}</dt><dd>{period(facts.couponStart,facts.couponEnd)} <small>{t('rec.japan_dates')}</small></dd></div>}
   {source&&<div><dt>{t('detail.source')}</dt><dd>{href?<a href={href} target="_blank" rel="noopener noreferrer">{t('detail.source')}</a>:source}</dd></div>}
  </dl>
  {window.start&&window.end&&(today>window.end||today<window.start)&&<small className="consumer-reference-state">{t(today>window.end?'rec.expired':'rec.upcoming')}</small>}
  {showReferenceResolution(facts)&&<p className="consumer-reference-resolution">{t('ref.current')}: {facts.referenceQuote?.state==='ACTIVE'&&facts.referenceQuote.amount!=null?money(facts.referenceQuote.amount):t(facts.referenceQuote?.state==='CONFLICT'?'ref.conflict':'ref.unknown')}</p>}
  {facts.offerNotes&&<div className="consumer-conditions"><h3>{t('detail.conditions')}</h3><p>{facts.offerNotes}</p></div>}
 </section>;
}
