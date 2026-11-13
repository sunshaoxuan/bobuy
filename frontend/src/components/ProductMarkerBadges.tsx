import {Tooltip} from 'antd';
import {useEffect,useRef,useState} from 'react';
import {storefrontApi} from '../api';
import type {ProductMarkerDefinition,PublicReferencePrice} from '../api';
import {localizedContent,useI18n} from '../i18n';
import {orderedMarkers} from '../productMarkers';
import '../product-markers.css';
import {currentOfferPeriods,offerPeriodCopy} from './offerPeriodText';

export default function ProductMarkerBadges({markers,overlay=false,promotionPrices,productId}:{markers:ProductMarkerDefinition[];overlay?:boolean;promotionPrices?:PublicReferencePrice[];productId?:string}) {
  const {locale,t}=useI18n();
  const [loaded,setLoaded]=useState<{id:string;status:'loading'|'ready'|'error';prices?:PublicReferencePrice[]}>();
  const pending=useRef<string>(),currentId=useRef(productId),mounted=useRef(true);currentId.current=productId;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function loadPeriod(open:boolean){
    if(!open||!overlay||!productId||promotionPrices!==undefined||pending.current===productId||(loaded?.id===productId&&loaded.status==='ready'))return;
    const id=productId;pending.current=id;setLoaded({id,status:'loading'});
    try{const detail=await storefrontApi.productDetail(id);if(mounted.current&&currentId.current===id)setLoaded({id,status:'ready',prices:detail.item.referencePrices??[]});}
    catch{if(mounted.current&&currentId.current===id)setLoaded({id,status:'error'});}
    finally{if(pending.current===id)pending.current=undefined;}
  }
  const visible=orderedMarkers(markers,true);
  if(!visible.length)return null;const displayed=overlay?visible.slice(0,3):visible;
  const copy=offerPeriodCopy[locale],state=loaded?.id===productId?loaded:undefined;
  const periods=currentOfferPeriods(promotionPrices??state?.prices??[],locale);
  const message=state?.status==='loading'?copy.loading:state?.status==='error'?copy.error:copy.unknown;
  const periodText=<span className="offer-period-copy"><strong>{copy.label}{locale==='en-US'?':':'：'}</strong>{periods.length?periods.map(period=><span key={period}>{period}</span>):<span>{message}</span>}</span>;
  return <ul className={'product-marker-badges'+(overlay?' marker-image-overlay':'')} aria-label={t('marker.assigned')}>
    {displayed.map(marker=>{const discount=marker.code==='discount',expand=discount&&overlay;return <li key={marker.id} className={discount&&!overlay&&promotionPrices!==undefined?'product-marker-with-period':undefined}><Tooltip title={expand?periodText:localizedContent(marker.name,locale)} placement={expand?'right':'top'} overlayClassName={expand?'offer-period-tooltip':undefined} trigger={expand?['hover','focus','click']:['hover','focus']} onOpenChange={expand?loadPeriod:undefined}><span className={'product-marker-badge marker-color-'+marker.color} aria-label={localizedContent(marker.name,locale)} tabIndex={expand?0:undefined} data-card-action={expand?'offer-period':undefined}>{marker.badge}</span></Tooltip>{discount&&!overlay&&promotionPrices!==undefined&&<small className="product-marker-period" aria-label={copy.label}>{periodText}</small>}</li>;})}
    {overlay&&visible.length>3&&<li><Tooltip title={visible.slice(3).map(marker=>localizedContent(marker.name,locale)).join(', ')}><span className="product-marker-badge marker-more" aria-label={t('marker.more',{count:visible.length-3})}>+{visible.length-3}</span></Tooltip></li>}
  </ul>;
}
