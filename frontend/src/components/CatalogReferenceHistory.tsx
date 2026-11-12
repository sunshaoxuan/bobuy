import type {PublicCatalogEntry,PublicReferencePrice,RecommendationFacts} from '../api';
import {selectReferenceOffers} from '../referencePriceDisplay';
import {DetailOffer} from './ConsumerDetail';
import {useI18n} from '../i18n';
import {recommendationText} from '../recommendationText';

export default function CatalogReferenceHistory({entry}:{entry:PublicCatalogEntry}){
 const {locale}=useI18n(),{main,online}=selectReferenceOffers(entry);
 const prices=entry.referencePrices??[];
 if(prices.length){const facts=(p:PublicReferencePrice):RecommendationFacts&{currency:string}=>({name:'',currency:p.currency,referencePrice:p.amount,originalPrice:p.promotion?p.regularAmount:null,priceUnit:p.unit,priceChange:{documentId:p.documentId,documentNumber:p.documentNumber,type:p.type,state:p.state,startsAt:p.startsAt,endsAt:p.endsAt,amount:p.amount,beforeAmount:p.regularAmount,effectiveAmount:p.amount,promotion:p.promotion}});const additional=prices.find(p=>p.channel==='COSTCO_ONLINE'&&prices[0].channel!=='COSTCO_ONLINE');return <div className="catalog-reference-history" data-product-id={entry.productId} data-price-document={prices[0].documentId}><DetailOffer facts={facts(prices[0])} online={additional?facts(additional):undefined}/></div>;}
 if(!main)return null;
 const withUnit=(facts:typeof main.facts)=>({...facts,priceUnit:facts.priceUnit||recommendationText(facts,locale).specification});
 return <div className="catalog-reference-history" data-product-id={entry.productId} data-reference-key={`${main.postId}:${main.facts.id}`}><DetailOffer facts={withUnit(main.facts)} online={online?withUnit(online.facts):undefined}/></div>;
}
