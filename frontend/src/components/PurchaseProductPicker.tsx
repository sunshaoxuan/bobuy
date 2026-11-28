import {Button,Input,List,Spin} from 'antd';
import {useEffect,useRef,useState} from 'react';
import {localizedContent,useI18n} from '../i18n';
import {storefrontApi,type ProductBrowseCard} from '../api';

export default function PurchaseProductPicker({merchantId,onChoose,onCancel}:{merchantId:number;onChoose:(id:string)=>void;onCancel:()=>void}){
 const {locale,t}=useI18n();const [query,setQuery]=useState(''),[rows,setRows]=useState<ProductBrowseCard[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');const generation=useRef(0);
 useEffect(()=>{const current=++generation.current,controller=new AbortController();const timer=window.setTimeout(async()=>{setBusy(true);setError('');try{const page=await storefrontApi.productBrowse({merchantId,query:query.trim(),locale,page:0});if(current===generation.current)setRows(page.items.filter(row=>row.cartEnabled));}catch{if(current===generation.current)setError(t('purchase.search_failed'));}finally{if(current===generation.current)setBusy(false);}},200);return()=>{controller.abort();window.clearTimeout(timer);};},[merchantId,query,locale,t]);
 return <div className="purchase-product-picker"><Input.Search value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('purchase.search_placeholder')} aria-label={t('purchase.search_placeholder')}/>{busy&&<Spin/>}{error&&<p role="alert">{error}</p>}<List dataSource={rows} locale={{emptyText:t('purchase.no_candidates')}} renderItem={row=><List.Item actions={[<Button key="choose" onClick={()=>onChoose(row.productId)}>{t('purchase.choose')}</Button>]}><List.Item.Meta title={localizedContent(row.name,locale)} description={[row.itemNumber,row.brand,localizedContent(row.specification,locale),row.reference&&`${row.reference.amount} ${row.reference.currency}/${row.reference.unit??''}`].filter(Boolean).join(' · ')}/></List.Item>}/><Button onClick={onCancel}>{t('purchase.cancel')}</Button></div>;
}
