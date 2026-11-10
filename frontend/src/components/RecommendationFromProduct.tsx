import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Checkbox,Select} from 'antd';
import {api,recommendationApi,type RecommendationDetail,type RecommendationFacts} from '../api';
import {getStoredAccessToken,getStoredUser,subscribeToAuthChanges} from '../authStorage';
import {localizedContent,useI18n} from '../i18n';
import {FactsForm,factsError,OfferInfo} from './RecommendationFacts';

type Product={id:string;name:Record<string,string>;itemNumber?:string;recordVersion?:number;catalogData?:{supplierId?:string;specification?:Record<string,string>}};
type Attempt={postId:number;productId:string;productVersion:number;facts:RecommendationFacts;version:number;reviewed:true};
const identity=()=>JSON.stringify([getStoredUser()?.id,getStoredUser()?.roles,getStoredAccessToken()]);

export default function RecommendationFromProduct({detail,onChange,onPendingChange,suggestedProduct}:{detail:RecommendationDetail;onChange:(value:RecommendationDetail)=>void;onPendingChange:(value:boolean)=>void;suggestedProduct?:string}){
 const {t,locale}=useI18n();
 const [products,setProducts]=useState<Product[]>([]),[productId,setProductId]=useState<string>(),[facts,setFacts]=useState<RecommendationFacts>({name:''}),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[authEpoch,setAuthEpoch]=useState(0);
 const epoch=useRef(0),inFlight=useRef(false),attempt=useRef<Attempt>(),currentPost=useRef(detail.post.id);
 const currentDetail=useRef(detail);
 const [reloaded,setReloaded]=useState(false);
 currentPost.current=detail.post.id;
 currentDetail.current=detail;
 useEffect(()=>{let prior=identity();return subscribeToAuthChanges(()=>{const next=identity();if(next!==prior){prior=next;epoch.current++;setAuthEpoch(value=>value+1);}});},[]);
 useEffect(()=>{
  const request=++epoch.current,owner=identity();let active=true;
  setProducts([]);setProductId(undefined);setFacts({name:''});setReviewed(false);setBusy(false);setConflict(false);setReloaded(false);setError('');attempt.current=undefined;inFlight.current=false;
  void api.products().then(rows=>{if(active&&request===epoch.current&&owner===identity())setProducts(rows.map(row=>({...row.product,catalogData:row.product.catalogData as Product['catalogData']})).filter(p=>p.catalogData));}).catch(e=>{if(active&&request===epoch.current&&owner===identity())setError(e.message);});
  return()=>{active=false;epoch.current++;};
 },[detail.post.id,authEpoch]);
 useEffect(()=>{onPendingChange(!!productId||busy);return()=>onPendingChange(false);},[productId,busy,onPendingChange]);
 useEffect(()=>{const next=products.find(p=>p.id===suggestedProduct);if(!next)return;attempt.current=undefined;setProductId(next.id);setFacts({name:next.name['ja-JP']??'',itemNumber:next.itemNumber});setReviewed(false);setReloaded(false);setConflict(false);setError('');},[suggestedProduct,products]);
 const product=products.find(p=>p.id===productId);
 function changed(){attempt.current=undefined;setReviewed(false);setReloaded(false);setError('');}
 function acceptDetail(next:RecommendationDetail){
  const current=currentDetail.current;
  if(next.post.id!==current.post.id||!Number.isSafeInteger(next.post.version)||next.post.version<current.post.version)return false;
  currentDetail.current=next;onChange(next);return true;
 }
 async function submit(){
  if(inFlight.current||!product||!reviewed||conflict||!Number.isSafeInteger(product.recordVersion)||(product.recordVersion??-1)<0)return;
  const postId=detail.post.id,request=epoch.current,owner=identity();
  const isCurrent=()=>request===epoch.current&&owner===identity()&&currentPost.current===postId;
  const input=attempt.current??{postId,productId:product.id,productVersion:product.recordVersion!,facts:structuredClone(facts),version:detail.post.version,reviewed:true as const};
  attempt.current=input;inFlight.current=true;setBusy(true);setError('');
  try{
   const {postId:_,...body}=input;
   const value=await recommendationApi.fromProduct(postId,body);
   if(isCurrent()){
    if(acceptDetail(value)){setProductId(undefined);setReviewed(false);attempt.current=undefined;}
    else{setConflict(true);setReviewed(false);attempt.current=undefined;}
   }
  }catch(e){if(isCurrent()){setError((e as Error).message);if((e as {status?:number}).status===409){setConflict(true);setReviewed(false);attempt.current=undefined;}}}
  finally{if(isCurrent()){inFlight.current=false;setBusy(false);}}
 }
 async function reload(){
  if(inFlight.current)return;
  const postId=detail.post.id,request=epoch.current,owner=identity();const isCurrent=()=>request===epoch.current&&owner===identity()&&currentPost.current===postId;
  inFlight.current=true;setBusy(true);setError('');
  try{
   const [next,rows]=await Promise.all([recommendationApi.get(postId),api.products()]);
   if(isCurrent()){
    if(!acceptDetail(next)){setConflict(true);setReviewed(false);attempt.current=undefined;return;}
    const values=rows.map(row=>({...row.product,catalogData:row.product.catalogData as Product['catalogData']})).filter(p=>p.catalogData);setProducts(values);
    const current=values.find(p=>p.id===productId);if(current)setFacts(prior=>({...prior,name:current.name['ja-JP']??'',itemNumber:current.itemNumber}));
    setConflict(false);setReviewed(false);setReloaded(true);attempt.current=undefined;
   }
  }catch(e){if(isCurrent())setError((e as Error).message);}
  finally{if(isCurrent()){inFlight.current=false;setBusy(false);}}
 }
 return <section className="rec-catalog-link rec-from-product"><h2>{t('catalog.from_product')}</h2><p>{t('catalog.from_product_hint')}</p>
 {detail.post.published&&<Alert type="info" message={t('rec.item.append_hint')}/>}
 {error&&<Alert type="error" message={error}/>}
 {reloaded&&<Alert type="info" message={t('rec.item.reloaded_review')}/>}
 {conflict&&<Alert type="warning" message={t('rec.item.conflict')} action={<Button disabled={busy} onClick={()=>void reload()}>{t('rec.reload')}</Button>}/>}
 <Select aria-label={t('catalog.select_profile')} showSearch optionFilterProp="label" style={{width:'100%'}} value={productId} disabled={busy||conflict} options={products.map(p=>({value:p.id,label:[p.itemNumber,localizedContent(p.name,locale),p.id.slice(-8)].join(' · ')}))} onChange={id=>{
  const p=products.find(p=>p.id===id);if(!p)return;setProductId(id);setFacts({name:p.name['ja-JP']??'',itemNumber:p.itemNumber,...(p.catalogData?.supplierId&&p.catalogData.specification?.['ja-JP']?{referenceContext:{supplierKey:p.catalogData.supplierId,variantKey:p.catalogData.specification['ja-JP']}}:{})});changed();
 }}/>
 {product&&<>{(!Number.isSafeInteger(product.recordVersion)||(product.recordVersion??-1)<0)&&<Alert type="warning" message={t('rec.item.not_ready')}/>}<p>{t('rec.item.catalog_version',{version:product.recordVersion??'?'})}</p><p><strong>{t('rec.item.current_spec')}: </strong><span>{localizedContent(product.catalogData?.specification??{},locale)||t('rec.not_stated')}</span></p><FactsForm facts={facts} identityReadOnly disabled={busy||conflict} onChange={value=>{setFacts(value);changed();}}/><OfferInfo facts={facts}/>
 <Checkbox checked={reviewed} disabled={busy||conflict} onChange={e=>setReviewed(e.target.checked)}>{t('catalog.from_product_review')}</Checkbox>
 <Button type="primary" loading={busy} disabled={conflict||!reviewed||!!factsError(facts)||!Number.isSafeInteger(product.recordVersion)||(product.recordVersion??-1)<0} onClick={()=>void submit()}>{t('catalog.from_product_add')}</Button>
 <Button disabled={busy} onClick={()=>{setProductId(undefined);setReviewed(false);setConflict(false);setError('');attempt.current=undefined;}}>{t('common.cancel')}</Button></>}
 </section>;
}
