import type {PublicCatalogEntry} from '../api';
import {selectReferenceOffers} from '../referencePriceDisplay';
import {DetailOffer} from './ConsumerDetail';
import {useI18n} from '../i18n';
import {recommendationText} from '../recommendationText';

export default function CatalogReferenceHistory({entry}:{entry:PublicCatalogEntry}){
 const {locale}=useI18n(),{main,online}=selectReferenceOffers(entry);if(!main)return null;
 const withUnit=(facts:typeof main.facts)=>({...facts,priceUnit:facts.priceUnit||recommendationText(facts,locale).specification});
 return <div className="catalog-reference-history" data-product-id={entry.productId} data-reference-key={`${main.postId}:${main.facts.id}`}><DetailOffer facts={withUnit(main.facts)} online={online?withUnit(online.facts):undefined}/></div>;
}
