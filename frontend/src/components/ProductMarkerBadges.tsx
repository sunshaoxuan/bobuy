import {Tooltip} from 'antd';
import type {ProductMarkerDefinition} from '../api';
import {localizedContent,useI18n} from '../i18n';
import {orderedMarkers} from '../productMarkers';
import '../product-markers.css';

export default function ProductMarkerBadges({markers,overlay=false}:{markers:ProductMarkerDefinition[];overlay?:boolean}) {
  const {locale,t}=useI18n();
  const visible=orderedMarkers(markers,true);
  if(!visible.length)return null;const displayed=overlay?visible.slice(0,3):visible;
  return <ul className={'product-marker-badges'+(overlay?' marker-image-overlay':'')} aria-label={t('marker.assigned')}>
    {displayed.map(marker=><li key={marker.id}><Tooltip title={localizedContent(marker.name,locale)}><span className={'product-marker-badge marker-color-'+marker.color} aria-label={localizedContent(marker.name,locale)}>{marker.badge}</span></Tooltip></li>)}
    {overlay&&visible.length>3&&<li><Tooltip title={visible.slice(3).map(marker=>localizedContent(marker.name,locale)).join(', ')}><span className="product-marker-badge marker-more" aria-label={t('marker.more',{count:visible.length-3})}>+{visible.length-3}</span></Tooltip></li>}
  </ul>;
}
