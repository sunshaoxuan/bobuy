import {Tooltip} from 'antd';
import {useRef,useState} from 'react';
import type {ProductMarkerDefinition} from '../api';
import type {OfferPeriodSource} from './offerPeriodText';
import {localizedContent,useI18n} from '../i18n';
import {orderedMarkers} from '../productMarkers';
import '../product-markers.css';
import {currentOfferPeriods,offerPeriodCopy} from './offerPeriodText';

export default function ProductMarkerBadges({markers,overlay=false,promotionPrices}:{markers:ProductMarkerDefinition[];overlay?:boolean;promotionPrices?:OfferPeriodSource[]}) {
  const {locale,t}=useI18n();
  const [hintOpen,setHintOpen]=useState(false);
  const [hintWidth,setHintWidth]=useState(280);const trigger=useRef<HTMLSpanElement>(null);
  function openPeriod(open:boolean){
    if(open&&trigger.current)setHintWidth(Math.max(56,Math.min(280,window.innerWidth-trigger.current.getBoundingClientRect().right-16)));
    setHintOpen(open);
  }
  const visible=orderedMarkers(markers,true);
  if(!visible.length)return null;const displayed=overlay?visible.slice(0,3):visible;
  const copy=offerPeriodCopy[locale];
  const periods=currentOfferPeriods(promotionPrices??[],locale);
  const message=copy.unknown;
  const periodText=<span className="offer-period-copy"><strong>{copy.label}{locale==='en-US'?':':'：'}</strong>{periods.length?periods.map(period=><span key={period}>{period.split(/(\d+年|\d+月\d+日|\d{1,2}:\d{2}(?::\d{2})?)/).map((part,index)=>index%2?<span className="offer-period-date" key={index}>{part}</span>:part)}</span>):<span>{message}</span>}</span>;
  return <ul className={'product-marker-badges'+(overlay?' marker-image-overlay':'')} aria-label={t('marker.assigned')}>
    {displayed.map(marker=>{const discount=marker.code==='discount',expand=discount&&overlay&&periods.length>0;return <li key={marker.id} className={discount&&!overlay&&periods.length>0?'product-marker-with-period':undefined}><Tooltip title={expand?periodText:localizedContent(marker.name,locale)} placement={expand?'rightTop':'top'} overlayClassName={expand?'offer-period-tooltip':undefined} overlayStyle={expand?{maxWidth:hintWidth,boxSizing:'border-box'}:undefined} trigger={['hover','focus']} open={expand?hintOpen:undefined} onOpenChange={expand?openPeriod:undefined}><span ref={expand?trigger:undefined} className={'product-marker-badge marker-color-'+marker.color} aria-label={localizedContent(marker.name,locale)} tabIndex={expand?0:undefined} data-card-action={expand?'offer-period':undefined} onClick={expand?()=>void openPeriod(true):undefined}>{marker.badge}</span></Tooltip>{discount&&!overlay&&periods.length>0&&<small className="product-marker-period" aria-label={copy.label}>{periodText}</small>}</li>;})}
    {overlay&&visible.length>3&&<li><Tooltip title={visible.slice(3).map(marker=>localizedContent(marker.name,locale)).join(', ')}><span className="product-marker-badge marker-more" aria-label={t('marker.more',{count:visible.length-3})}>+{visible.length-3}</span></Tooltip></li>}
  </ul>;
}
