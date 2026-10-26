import {useEffect,useState} from 'react';
import {Alert,Button,Popconfirm,Select,Table,Tag} from 'antd';
import {Link} from 'react-router-dom';
import {api,recommendationApi,type RecommendationDetail} from '../api';
import {localizedContent,useI18n} from '../i18n';
type CatalogProduct={id:string;name:Record<string,string>;itemNumber?:string;visibilityStatus?:string;attributes?:Record<string,unknown>};
export default function RecommendationCatalog({detail,onChange}:{detail:RecommendationDetail;onChange:(detail:RecommendationDetail)=>void}) {
 const {t,locale}=useI18n();const [products,setProducts]=useState<CatalogProduct[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [choices,setChoices]=useState<Record<number,string>>({});
 const missing=detail.items.filter(item=>!item.productId);
 const available=[...products,...detail.items.filter(item=>item.productId&&!products.some(product=>product.id===item.productId)).map(item=>({id:item.productId!,name:{'ja-JP':item.name},itemNumber:item.itemNumber??undefined} as CatalogProduct))].filter((product,index,values)=>values.findIndex(value=>value.id===product.id)===index);
 async function load(){const result=await api.products();setProducts(result.map(value=>value.product));}
 useEffect(()=>{let active=true;void api.products().then(result=>{if(active)setProducts(result.map(value=>value.product));}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[detail.post.id]);
 async function link(itemIds:number[],productId?:string){setBusy(true);setError('');try {onChange(await recommendationApi.catalog(detail.post.id,{itemIds,productId,version:detail.post.version}));await load();}catch(error){setError((error as Error).message);}finally{setBusy(false);}}
 return <section className="rec-catalog-link"><h2>{t('catalog.title')}</h2><p>{t('catalog.hint')}</p>
  {error&&<Alert type="error" message={error}/>}
  <Popconfirm title={t('catalog.confirm_build')} onConfirm={()=>void link(missing.map(item=>item.id))} disabled={!missing.length||busy||detail.post.published}>
   <Button loading={busy} disabled={!missing.length||busy||detail.post.published}>{t('catalog.build_missing',{count:missing.length})}</Button>
  </Popconfirm><Link className="rec-stock-link" to="/admin/stock-master">{t('nav.stock_master')}</Link>
  <Alert type="info" message={t('catalog.price_pending')} showIcon/>
  <Table rowKey="id" size="small" dataSource={detail.items} scroll={{x:700}} pagination={{pageSize:12,showSizeChanger:false}} columns={[
   {title:t('rec.name'),render:(_,item)=><><strong>{item.name}</strong><small>{item.itemNumber||t('rec.not_stated')}</small></>},
   {title:t('catalog.profile'),render:(_,item)=>{const product=available.find(value=>value.id===item.productId);return item.productId?<><Tag>{t('catalog.linked')}</Tag><small>{product?localizedContent(product.name,locale):item.productId}</small></>:<Tag>{t('catalog.not_linked')}</Tag>;}},
   {title:t('catalog.reuse'),render:(_,item)=><div className="rec-catalog-choice"><Select aria-label={t('catalog.reuse')+': '+item.name} showSearch optionFilterProp="label" value={choices[item.id]} placeholder={t('catalog.select_profile')} disabled={busy||detail.post.published}
     onChange={value=>setChoices(previous=>({...previous,[item.id]:value}))} options={available.map(product=>({value:product.id,label:[product.itemNumber,localizedContent(product.name,locale),product.attributes?.recommendationSourceIssue?t('catalog.source_issue',{id:String(product.attributes.recommendationSourceIssue)}):undefined,product.id.slice(-8)].filter(Boolean).join(' · ')}))}/>
     <Popconfirm title={t('catalog.confirm_link')} onConfirm={()=>void link([item.id],choices[item.id])} disabled={!choices[item.id]||busy||detail.post.published}><Button disabled={!choices[item.id]||busy||detail.post.published}>{t('catalog.link')}</Button></Popconfirm></div>}
  ]}/>
 </section>;
}
