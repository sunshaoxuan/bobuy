import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Checkbox,InputNumber,Rate,Spin} from 'antd';
import {productRatingApi,type ProductRatingValue} from '../api';
import {useI18n} from '../i18n';

export function validProductRating(value:number|null|undefined){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=5&&Number.isInteger(value*2);}
export function ProductStars({value}:{value?:number|null}){
 const {t}=useI18n();if(!validProductRating(value))return null;
 return <span className="product-rating" role="img" aria-label={t('rating.value',{value:String(value)})}><Rate disabled allowHalf value={value!}/><small aria-hidden="true">{value} / 5</small></span>;
}
/** Separate, explicit archive save. Unrated defaults stay null and hidden; never synthesize a review count. */
export default function ProductRatingEditor({id,onDirtyChange,onBusyChange}:{id:string;onDirtyChange:(dirty:boolean)=>void;onBusyChange:(busy:boolean)=>void}){
 const {t}=useI18n();const [value,setValue]=useState<ProductRatingValue>(),[saved,setSaved]=useState(''),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[savedNotice,setSavedNotice]=useState(false);
 const scope=useRef(0);
 const dirty=!!value&&JSON.stringify(value)!==saved;
 useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
 useEffect(()=>{const request=++scope.current;setBusy(true);setValue(undefined);setError('');setReviewed(false);setSavedNotice(false);void productRatingApi.get(id).then(next=>{if(request===scope.current){setValue(next);setSaved(JSON.stringify(next));}}).catch(e=>{if(request===scope.current)setError(e.message);}).finally(()=>{if(request===scope.current)setBusy(false);});return()=>{scope.current++;};},[id]);
 function patch(next:Partial<ProductRatingValue>){setValue(prior=>prior?{...prior,...next}:prior);setReviewed(false);setError('');setSavedNotice(false);}
 async function save(){if(!value||!reviewed||busy)return;if(value.stars!==null&&!validProductRating(value.stars)||value.publicVisible&&value.stars===null){setError('rating.invalid');return;}const owned=scope.current;setBusy(true);setError('');try{const next=await productRatingApi.save(id,value);if(scope.current===owned){setValue(next);setSaved(JSON.stringify(next));setReviewed(false);setSavedNotice(true);}}catch(e){if(scope.current===owned)setError((e as Error).message);}finally{if(scope.current===owned)setBusy(false);}}
 return <section aria-label={t('rating.title')} className="product-rating-editor">
  <p>{t('rating.hint')}</p>{error&&<Alert type="error" message={t(error)}/>} {savedNotice&&<p role="status">{t('rating.saved')}</p>}
  {!value?busy?<Spin/>:null:<>
   <label>{t('rating.title')}<InputNumber aria-label={t('rating.title')} min={0} max={5} step={0.5} value={value.stars} disabled={busy} onChange={stars=>patch({stars,publicVisible:stars===null?false:value.publicVisible})}/></label>
   <Checkbox disabled={busy||value.stars===null} checked={value.publicVisible} onChange={e=>patch({publicVisible:e.target.checked})}>{t('rating.visible')}</Checkbox>
   <Checkbox disabled={busy} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}>{t('rating.review')}</Checkbox>
   <Button disabled={!dirty||!reviewed||busy} loading={busy} onClick={()=>void save()}>{t('rating.save')}</Button>
  </>}
 </section>;
}
