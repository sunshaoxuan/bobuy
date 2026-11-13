from pathlib import Path
r=Path(__file__).parent
def edit(p,a,b):
 f=r/p;s=f.read_text(encoding='utf-8');assert a in s,(p,a[:60]);f.write_text(s.replace(a,b),encoding='utf-8')
edit('backend/src/main/java/com/bobbuy/service/PublicProductBrowseService.java','java.math.BigDecimal discountAmount){}','java.math.BigDecimal discountAmount,RecommendationItem.PriceChange priceChange){}')
edit('backend/src/main/java/com/bobbuy/service/PublicProductBrowseService.java','p.promotion()?p.regularAmount().subtract(p.amount()):null);','p.promotion()?p.regularAmount().subtract(p.amount()):null,new RecommendationItem.PriceChange(p.documentId(),p.documentNumber(),p.type(),p.state(),p.startsAt(),p.endsAt(),p.amount(),p.regularAmount(),p.amount(),p.promotion()));')
edit('backend/src/main/java/com/bobbuy/service/PublicProductBrowseService.java','display.originalPrice(),display.discountAmount());','display.originalPrice(),display.discountAmount(),facts.priceChange);')
edit('backend/src/main/java/com/bobbuy/service/ProductSaleService.java','Instant validUntil,String channel) {}','Instant validUntil,String channel,RecommendationItem.PriceChange priceChange) {}')
edit('backend/src/main/java/com/bobbuy/service/ProductSaleService.java','nextChange,"STOREFRONT"));','nextChange,"STOREFRONT",adjustment==null?null:new RecommendationItem.PriceChange(adjustment.id,adjustment.documentNumber,adjustment.type.name(),"ACTIVE",adjustment.startsAt,adjustment.endsAt,amount,regular,amount,resolved.promotion())));')
edit('backend/src/main/java/com/bobbuy/service/StorefrontService.java','q.adjustmentId(),q.validFrom(),q.validUntil()))','q.adjustmentId(),q.validFrom(),q.validUntil(),q.priceChange()))')
edit('backend/src/main/java/com/bobbuy/service/StorefrontService.java','Instant priceValidUntil) {}','Instant priceValidUntil,RecommendationItem.PriceChange priceChange) {}')
edit('frontend/src/api.ts','priceValidUntil?:string };','priceValidUntil?:string;priceChange?:PriceChangeView|null };')
edit('frontend/src/api.ts',"export type CardReference={originalPrice?","export type CardReference={priceChange?:PriceChangeView|null;originalPrice?")
edit('frontend/src/components/offerPeriodText.ts',"import type {PublicReferencePrice} from '../api';","import type {PriceChangeView} from '../api';\nexport type OfferPeriodSource=Pick<PriceChangeView,'documentId'|'type'|'promotion'|'state'|'startsAt'|'endsAt'>;")
edit('frontend/src/components/offerPeriodText.ts','prices:PublicReferencePrice[]','prices:OfferPeriodSource[]')
edit('frontend/src/components/ProductMarkerBadges.tsx',"import {useEffect,useRef,useState} from 'react';\nimport {storefrontApi} from '../api';\nimport type {ProductMarkerDefinition,PublicReferencePrice} from '../api';","import {useRef,useState} from 'react';\nimport type {ProductMarkerDefinition} from '../api';\nimport type {OfferPeriodSource} from './offerPeriodText';")
f=r/'frontend/src/components/ProductMarkerBadges.tsx';s=f.read_text(encoding='utf-8');a=s.index('export default function');b=s.index('  const visible=');s=s[:a]+'''export default function ProductMarkerBadges({markers,overlay=false,promotionPrices}:{markers:ProductMarkerDefinition[];overlay?:boolean;promotionPrices?:OfferPeriodSource[]}) {
  const {locale,t}=useI18n();
  const [hintOpen,setHintOpen]=useState(false);
  const [hintWidth,setHintWidth]=useState(280);const trigger=useRef<HTMLSpanElement>(null);
  function openPeriod(open:boolean){
    if(open&&trigger.current)setHintWidth(Math.max(56,Math.min(280,window.innerWidth-trigger.current.getBoundingClientRect().right-16)));
    setHintOpen(open);
  }
'''+s[b:];s=s.replace("const copy=offerPeriodCopy[locale],state=loaded?.id===productId?loaded:undefined;","const copy=offerPeriodCopy[locale];").replace('promotionPrices??state?.prices??[]','promotionPrices??[]').replace("const message=state?.status==='loading'?copy.loading:state?.status==='error'?copy.error:copy.unknown;","const message=copy.unknown;").replace('loadPeriod','openPeriod');f.write_text(s,encoding='utf-8')
edit('frontend/src/pages/PublicProductCatalog.tsx','productId={entry.productId} overlay/><ReservationAdd','promotionPrices={selectedOfferSource(product,pending,entry.reference?.priceChange)} overlay/><ReservationAdd')
edit('frontend/src/pages/PublicProductCatalog.tsx','promotionPrices={opened.referencePrices??[]}','promotionPrices={selectedOfferSource(sale,pricePending(opened.productId),opened.referencePrices?.[0]??mainReference?.facts.priceChange)}')
edit('frontend/src/pages/PublicProductCatalog.tsx',"import ProductMarkerBadges from '../components/ProductMarkerBadges';","import ProductMarkerBadges from '../components/ProductMarkerBadges';\nimport {selectedOfferSource} from '../components/selectedOfferSource';")
