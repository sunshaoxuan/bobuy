import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,Button,Input,InputNumber,Modal,Popover,Rate,Spin} from 'antd';
import {productReviewApi,type ProductReviewValue,type ProductReviewSummary,type ProductReviewEntry} from '../api';
import {useI18n} from '../i18n';
import {useUserRole} from '../context/UserRoleContext';
import {Link} from 'react-router-dom';
import '../public-catalog.css';
import './productReviews.css';

export function validProductRating(value:number|null|undefined){return typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<=5;}
export function validReviewScore(value:number|null|undefined){return validProductRating(value)&&Number.isInteger(value!*2);}
const changed='product-review-updated';

export function ProductStars({value,productId,eager=false}:{value?:number|null;productId?:string|null;eager?:boolean}){
 const {t}=useI18n();const [state,setState]=useState<{id:string;summary?:ProductReviewSummary;error?:string}>(),[loading,setLoading]=useState(false),[open,setOpen]=useState(false),[dialog,setDialog]=useState(false);const epoch=useRef(0);
 const load=useCallback(async()=>{if(!productId)return;const request=++epoch.current;setLoading(true);try{const summary=await productReviewApi.summary(productId);if(epoch.current===request)setState({id:productId,summary});}catch(e){if(epoch.current===request)setState({id:productId,error:(e as Error).message});}finally{if(epoch.current===request)setLoading(false);}},[productId]);
 useEffect(()=>{setOpen(false);setDialog(false);if(eager)void load();const update=(event:Event)=>{if((event as CustomEvent).detail===productId)void load();};window.addEventListener(changed,update);return()=>{epoch.current++;window.removeEventListener(changed,update);};},[productId,eager,load]);
 const current=state?.id===productId?state:undefined,summary=current?.summary,average=summary?summary.average:value;
 const rated=validProductRating(average),label=rated?t('rating.value',{value:average!.toFixed(1)}):t('review.none');
 const stars=<><Rate aria-hidden="true" disabled allowHalf value={rated?Math.round(average!*2)/2:0}/>{rated&&<small>{average!.toFixed(1)} / 5</small>}</>;
 if(!productId)return <span className="product-rating" role="img" aria-label={label} data-unrated={!rated||undefined}>{stars}</span>;
 const content=<div className="review-distribution">{loading?<Spin/>:current?.error?<Alert type="error" message={t(current.error)} action={<Button onClick={()=>void load()}>{t('review.retry')}</Button>}/>:summary?<><strong>{t('review.count',{count:summary.count})}</strong>{[...summary.distribution].reverse().map(bin=><div className="review-bin" key={bin.stars}><span>{bin.stars}</span><span className="review-bin-track"><span style={{width:(summary.count?bin.count/summary.count*100:0)+'%'}}/></span><span>{bin.count}</span></div>)}</>:null}<Button onClick={()=>{setOpen(false);setDialog(true);}}>{t('review.read_write')}</Button></div>;
 return <><Popover content={content} trigger={['hover','click']} open={open} onOpenChange={next=>{setOpen(next);if(next)void load();}}><button type="button" data-card-action className="product-rating review-stars-button" aria-label={label} data-unrated={!rated||undefined} onClick={event=>event.stopPropagation()}>{stars}</button></Popover>{dialog&&<ReviewDialog id={productId} onClose={()=>setDialog(false)}/>}</>;
}
export function ProductReviewStars({productId}:{productId?:string|null}){return <ProductStars productId={productId} eager/>;}

function ReviewDialog({id,onClose}:{id:string;onClose:()=>void}){
 const {t,locale}=useI18n();const [items,setItems]=useState<ProductReviewEntry[]>([]),[page,setPage]=useState(0),[hasNext,setHasNext]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setBusy(true);setError('');void productReviewApi.comments(id,page).then(result=>{if(active){setItems(prior=>page===0?result.items:[...prior,...result.items]);setHasNext(result.hasNext);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[id,page,attempt]);
 return <Modal title={t('review.title')} open onCancel={onClose} footer={null} width={640} className="product-review-dialog"><ProductReviewEditor id={id} onSaved={()=>{setPage(0);setAttempt(n=>n+1);}}/>{error&&<Alert type="error" message={t(error)} action={<Button onClick={()=>setAttempt(n=>n+1)}>{t('review.retry')}</Button>}/>}<section aria-label={t('review.title')} className="review-comments">{items.map(item=><article key={item.id}><strong>{item.stars} / 5</strong><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString(locale)}</time>{item.comment&&<p>{item.comment}</p>}</article>)}{!busy&&!error&&!items.length&&<p>{t('review.none')}</p>}{busy&&<Spin/>}{hasNext&&!error&&<Button disabled={busy} onClick={()=>setPage(n=>n+1)}>{t('review.more')}</Button>}</section></Modal>;
}

export default function ProductReviewEditor({id,onDirtyChange,onBusyChange,onSaved}:{id:string;onDirtyChange?:(value:boolean)=>void;onBusyChange?:(value:boolean)=>void;onSaved?:()=>void}){
 const {t}=useI18n(),{isAuthenticated,user}=useUserRole();const [value,setValue]=useState<ProductReviewValue>(),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(false),[attempt,setAttempt]=useState(0);const epoch=useRef(0);const dirty=!!value&&JSON.stringify(value)!==saved;
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 useEffect(()=>{const request=++epoch.current;setValue(undefined);setError('');setNotice(false);if(isAuthenticated){setBusy(true);void productReviewApi.get(id).then(next=>{if(request===epoch.current){setValue(next);setSaved(JSON.stringify(next));}}).catch(e=>{if(request===epoch.current)setError(e.message);}).finally(()=>{if(request===epoch.current)setBusy(false);});}return()=>{epoch.current++;};},[id,isAuthenticated,user?.id,attempt]);
 async function save(){if(!value||!validReviewScore(value.stars)||busy)return;const request=epoch.current;setBusy(true);setError('');setNotice(false);try{const next=await productReviewApi.save(id,{stars:value.stars,comment:value.comment,version:value.version});if(request===epoch.current){setValue(next);setSaved(JSON.stringify(next));setNotice(true);window.dispatchEvent(new CustomEvent(changed,{detail:id}));onSaved?.();}}catch(e){if(request===epoch.current)setError((e as Error).message);}finally{if(request===epoch.current)setBusy(false);}}
 async function reread(){const request=epoch.current;setBusy(true);try{const next=await productReviewApi.get(id);if(request===epoch.current){setValue(prior=>prior?{...prior,version:next.version,updatedAt:next.updatedAt}:next);setSaved(JSON.stringify(next));setError('');}}catch(e){if(request===epoch.current)setError((e as Error).message);}finally{if(request===epoch.current)setBusy(false);}}
 if(!isAuthenticated)return <p><Link to="/login">{t('review.login')}</Link></p>;
 return <section className="product-review-editor" aria-label={t('review.write')}><h3>{t('review.write')}</h3>{error&&<Alert type="error" message={t(error)} action={<Button disabled={busy} onClick={()=>value?void reread():setAttempt(n=>n+1)}>{t(value?'review.reread':'review.retry')}</Button>}/>} {notice&&<p role="status">{t('review.saved')}</p>}{!value?busy?<Spin/>:null:<><label>{t('review.score')}<InputNumber aria-label={t('review.score')} min={1} max={5} step={0.5} value={value.stars} disabled={busy} onChange={stars=>{setValue({...value,stars});setNotice(false);}}/></label><label>{t('review.comment')}<Input.TextArea aria-label={t('review.comment')} rows={3} maxLength={2000} showCount value={value.comment} disabled={busy} onChange={e=>{setValue({...value,comment:e.target.value});setNotice(false);}}/></label><Button type="primary" loading={busy} disabled={!dirty||!validReviewScore(value.stars)||busy} onClick={()=>void save()}>{t('review.save')}</Button></>}</section>;
}
