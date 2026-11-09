import {Link,useLocation} from 'react-router-dom';
import type {PublicCatalogEntry} from '../api';
import {useI18n} from '../i18n';
import {productDetailContent} from '../productDetailContent';
import {DetailOffer} from './ConsumerDetail';

/** One source occurrence remains one row, including equal prices from different channels/periods. */
export default function CatalogReferenceHistory({entry,content}:{entry:PublicCatalogEntry;content:ReturnType<typeof productDetailContent>}){
 const {t}=useI18n(),location=useLocation();if(!content.rows.length)return null;
 return <section className="catalog-reference-history" data-product-id={entry.productId} aria-label={t('detail.reference')}>
  <h2>{t('detail.reference')}</h2>
  {content.historicalName&&<p className="consumer-history-name">{content.historicalName}</p>}
  {content.rows.map(row=>{
   const next=new URLSearchParams(location.search);next.set('item',String(row.facts.id));
   return <section className="consumer-reference-occurrence" key={row.key} data-reference-key={row.key} data-product-id={row.facts.productId??''}>
    <header><Link to={'/recommendations/'+row.postId+'?'+next.toString()}>{t('catalog.source_issue',{id:row.postId})}</Link></header>
    {row.name&&<h3 className="consumer-history-name">{row.name}</h3>}
    {row.itemNumber&&<p className="consumer-product-code"><span>{t('rec.code')}</span><strong>{row.itemNumber}</strong></p>}
    {row.specification&&<p className="consumer-reference-spec">{row.specification}</p>}
    {(row.model||row.packaging)&&<p className="consumer-reference-variant">{[row.model,row.packaging].filter(Boolean).join(' · ')}</p>}
    {row.description&&<div className="consumer-reference-description">{row.description.split('\n').map((line,index)=><p key={index}>{line}</p>)}</div>}
    {row.text.missing&&<small className="catalog-source">{t('article.field_source',{fields:row.text.sourceFields.map(key=>t(key==='description'?'master.descriptions':key==='specification'?'master.specifications':'rec.fact.'+key)).join(' · ')})}</small>}
    <DetailOffer facts={{...row.facts,offerNotes:row.text.offerNotes}} heading={false}/>
   </section>;
  })}
 </section>;
}
