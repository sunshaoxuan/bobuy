import type {PublicCatalogEntry,RecommendationFacts} from './api';
import {resolvedOfferWindow} from './referenceOfferWindow';

function day(value?:string|null):value is string{return !!value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
/** Derived display only. Historical source facts and actual selling prices are unchanged. */
export function referencePriceDisplay(facts:RecommendationFacts,today:string){
 const window=resolvedOfferWindow(facts),valid=day(today)&&(!window.start||day(window.start))&&(!window.end||day(window.end))&&!(window.start&&window.end&&window.start>window.end);
 const state=valid&&window.end&&today>window.end?'EXPIRED':valid&&window.start&&today<window.start?'FUTURE':valid&&window.start&&window.end?'ACTIVE':'UNKNOWN';
 const amount=facts.referencePrice,original=facts.originalPrice;
 const discounted=amount!=null&&((original!=null&&original>amount)||(facts.discountAmount!=null&&facts.discountAmount>0));
 const outside=state==='EXPIRED'||state==='FUTURE';
 return {amount:amount==null?null:discounted&&outside?original!=null&&original>=amount?original:null:amount,
  originalPrice:discounted&&!outside&&original!=null&&amount!=null&&original>amount?original:null,
  discountAmount:discounted&&!outside&&original!=null&&amount!=null&&original>amount?Math.round((original-amount)*100)/100:null,state};
}

/** Latest occurrence within each channel, with strict same-product identity. */
export function selectReferenceOffers(entry:PublicCatalogEntry){
 const rows=entry.referenceOffers.filter(row=>row.facts.productId===entry.productId&&!!entry.itemNumber&&row.facts.itemNumber===entry.itemNumber)
  .sort((a,b)=>b.postId-a.postId||b.facts.id-a.facts.id);
 const warehouse=rows.find(row=>row.facts.referenceContext?.channel==='COSTCO_WAREHOUSE');
 const online=rows.find(row=>row.facts.referenceContext?.channel==='COSTCO_ONLINE');
 return {main:warehouse??online??rows[0],online:warehouse?online:undefined};
}
