import {useEffect,useState} from 'react';
import {Alert,Button,Checkbox,Select} from 'antd';
import {api, recommendationApi,type RecommendationDetail,type RecommendationFacts} from '../api';
import {localizedContent,useI18n} from '../i18n';
import {FactsForm,factsError,OfferInfo} from './RecommendationFacts';

type Product={id:string;name:Record<string,string>;itemNumber?:string;recordVersion?:number;catalogData?:unknown};
export default function RecommendationFromProduct({detail,onChange,onPendingChange}:{detail:RecommendationDetail;onChange:(value:RecommendationDetail)=>void;onPendingChange:(value:boolean)=>void}){
 const {t,locale}=useI18n();const [products,setProducts]=useState<Product[]>([]),[productId,setProductId]=useState<string>(),[facts,setFacts]=useState<RecommendationFacts>({name:''}),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;void api.products().then(rows=>{if(active)setProducts(rows.map(row=>row.product).filter(p=>p.catalogData));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[detail.post.id]);
 useEffect(()=>{onPendingChange(!!productId);return()=>onPendingChange(false);},[productId,onPendingChange]);
 if(detail.post.published)return null;
 const product=products.find(p=>p.id===productId);
 return <section className="rec-catalog-link rec-from-product"><h2>{t('catalog.from_product')}</h2><p>{t('catalog.from_product_hint')}</p>
 {error&&<Alert type="error" message={error}/>}
 <Select aria-label={t('catalog.select_profile')} showSearch optionFilterProp="label" style={{width:'100%'}} value={productId} disabled={busy} options={products.map(p=>({value:p.id,label:[p.itemNumber,localizedContent(p.name,locale),p.id.slice(-8)].join(' · ')}))} onChange={id=>{const p=products.find(p=>p.id===id)!;setProductId(id);setFacts({name:p.name['ja-JP']??'',itemNumber:p.itemNumber});setReviewed(false);setError('');}}/>
 {product&&<><FactsForm facts={facts} identityReadOnly disabled={busy} onChange={value=>{setFacts(value);setReviewed(false);}}/><OfferInfo facts={facts}/>
 <Checkbox checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}>{t('catalog.from_product_review')}</Checkbox>
 <Button type="primary" loading={busy} disabled={!reviewed||!!factsError(facts)} onClick={()=>{setBusy(true);setError('');void recommendationApi.fromProduct(detail.post.id,{productId:product.id,productVersion:product.recordVersion??0,facts,version:detail.post.version,reviewed:true}).then(value=>{onChange(value);setProductId(undefined);setReviewed(false);}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>{t('catalog.from_product_add')}</Button>
 <Button disabled={busy} onClick={()=>{setProductId(undefined);setReviewed(false);setError('');}}>{t('common.cancel')}</Button></>}
 </section>;
}
