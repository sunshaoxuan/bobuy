import type {PublicCatalogEntry,RecommendationFacts} from './api';
/** Reference amounts and promotion status come exclusively from ERP document projections. */
export function referencePriceDisplay(facts:RecommendationFacts,_today:string){
 const d=facts.priceChange;if(!d)return {amount:null,originalPrice:null,discountAmount:null,state:'UNKNOWN'};
 const amount=d.effectiveAmount??(['EXPIRED','FUTURE'].includes(d.state)?d.beforeAmount:d.amount);
 const original=d.promotion&&d.state==='ACTIVE'?d.beforeAmount:null;
 return {amount,originalPrice:original,discountAmount:original!=null&&amount!=null?Math.round((original-amount)*100)/100:null,state:d.state};
}
export function selectReferenceOffers(entry:PublicCatalogEntry){
 const rows=entry.referenceOffers.filter(row=>row.facts.productId===entry.productId&&row.facts.itemNumber===entry.itemNumber).sort((a,b)=>b.postId-a.postId||b.facts.id-a.facts.id);
 const warehouse=rows.find(row=>row.facts.referenceContext?.channel==='COSTCO_WAREHOUSE'),online=rows.find(row=>row.facts.referenceContext?.channel==='COSTCO_ONLINE');return {main:warehouse??online??rows[0],online:warehouse?online:undefined};
}
