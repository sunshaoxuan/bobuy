import type {PublicCatalogEntry,RecommendationItem} from './api';
import {localizedContent,type Locale} from './i18n';
import {recommendationText} from './recommendationText';

/** Only move exactly equal, explicitly supplied facts. Never infer a historical value from a master. */
export function productDetailContent(entry:PublicCatalogEntry,locale:Locale){
 const rows=entry.referenceOffers.map(offer=>({
  ...offer,key:offer.postId+':'+offer.facts.id,text:recommendationText(offer.facts,locale),
  sameIdentity:!!entry.productId&&offer.facts.productId===entry.productId&&!!entry.itemNumber&&offer.facts.itemNumber===entry.itemNumber
 }));
 const common=(read:(row:typeof rows[number])=>string|undefined|null,fallback:string)=>{
  if(!rows.length)return fallback;
  if(!rows.every(row=>row.sameIdentity))return '';
  const value=read(rows[0])??'';return value&&rows.every(row=>(read(row)??'')===value)?value:'';
 };
 const specification=common(row=>row.text.specification,localizedContent(entry.specification,locale));
 const description=common(row=>row.text.description,localizedContent(entry.description,locale));
 const model=common(row=>row.facts.model,entry.model??''),packaging=common(row=>row.facts.packaging,entry.packaging??'');
 const historicalName=common(row=>row.text.primaryName,'');
 const name=localizedContent(entry.name,locale);
 return {specification,description,model,packaging,historicalName:historicalName&&historicalName!==name?rows[0].text.name:'',rows:rows.map(row=>({
  ...row,
  name:row.sameIdentity&&(row.text.primaryName===name||row.text.primaryName===historicalName)?'':row.text.name,
  itemNumber:row.sameIdentity?'':row.facts.itemNumber??'',
  specification:row.text.specification===specification?'':row.text.specification,
  description:row.text.description===description?'':row.text.description,
  model:row.facts.model===model?'':row.facts.model??'',packaging:row.facts.packaging===packaging?'':row.facts.packaging??''
 }))};
}

export type DetailReferenceFacts=RecommendationItem|({currency?:string}&import('./api').RecommendationFacts);
