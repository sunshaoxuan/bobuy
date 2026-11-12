import {Tooltip} from 'antd';
import type {ProductMarkerDefinition,PublicReferencePrice} from '../api';
import {localizedContent,useI18n} from '../i18n';
import {orderedMarkers} from '../productMarkers';
import '../product-markers.css';

export default function ProductMarkerBadges({markers,overlay=false,promotionPrices}:{markers:ProductMarkerDefinition[];overlay?:boolean;promotionPrices?:PublicReferencePrice[]}) {
  const {locale,t}=useI18n();
  const visible=orderedMarkers(markers,true);
  if(!visible.length)return null;const displayed=overlay?visible.slice(0,3):visible;
  const now=Date.now(),jst=(at:number)=>new Date(at+9*60*60*1000).toISOString(),midnight=(at:number)=>jst(at).slice(11,23)==='00:00:00.000';
  const periods=[...new Set((promotionPrices??[]).filter(p=>p.type==='PROMOTION'&&p.promotion&&p.state==='ACTIVE'&&Date.parse(p.startsAt)<=now&&!!p.endsAt&&now<Date.parse(p.endsAt)).map(p=>{
    const start=Date.parse(p.startsAt),end=Date.parse(p.endsAt!),days=midnight(start)&&midnight(end);
    const format=(at:number)=>jst(at).slice(0,days?10:19).replace(/-/g,'/').replace('T',' ');
    return `${format(start)} → ${format(days?end-1:end)} JST`;
  }))];
  return <ul className={'product-marker-badges'+(overlay?' marker-image-overlay':'')} aria-label={t('marker.assigned')}>
    {displayed.map(marker=><li key={marker.id} className={marker.code==='discount'&&!overlay&&promotionPrices!==undefined?'product-marker-with-period':undefined}><Tooltip title={localizedContent(marker.name,locale)}><span className={'product-marker-badge marker-color-'+marker.color} aria-label={localizedContent(marker.name,locale)}>{marker.badge}</span></Tooltip>{marker.code==='discount'&&!overlay&&promotionPrices!==undefined&&<small className="product-marker-period" aria-label={t('rec.offer_period')}>{periods.length?periods.map(period=><span key={period}>{period}</span>):t('rec.not_stated')}</small>}</li>)}
    {overlay&&visible.length>3&&<li><Tooltip title={visible.slice(3).map(marker=>localizedContent(marker.name,locale)).join(', ')}><span className="product-marker-badge marker-more" aria-label={t('marker.more',{count:visible.length-3})}>+{visible.length-3}</span></Tooltip></li>}
  </ul>;
}
