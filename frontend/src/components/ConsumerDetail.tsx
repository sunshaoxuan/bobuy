import type {ReactNode} from 'react';
import type {RecommendationFacts} from '../api';
import {useI18n} from '../i18n';
import {OfferInfo} from './RecommendationFacts';
import './consumer-detail.css';

export function ConsumerDetail({media,children}:{media:ReactNode;children:ReactNode}){
 return <div className="consumer-detail-layout"><div className="consumer-detail-media">{media}</div><div className="consumer-detail-info">{children}</div></div>;
}
export function DetailOffer({facts}:{facts:RecommendationFacts}){
 const {t}=useI18n();
 return <section className="consumer-reference"><h2>{t('detail.reference')}</h2><OfferInfo facts={{...facts,offerNotes:undefined}}/>{facts.offerNotes&&<div className="consumer-conditions"><h3>{t('detail.conditions')}</h3><p>{facts.offerNotes}</p></div>}</section>;
}
