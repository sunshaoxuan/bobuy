import {useEffect,useState} from 'react';
import {Alert,Button} from 'antd';
import {photoIntakeApi,api,type PhotoObservation} from '../api';
import {useI18n} from '../i18n';
export default function ProductPhotoHistory({id}:{id:string}){
 const{t,locale}=useI18n();const[rows,setRows]=useState<PhotoObservation[]>([]),[suppliers,setSuppliers]=useState<Record<string,string>>({}),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setRows([]);void Promise.all([photoIntakeApi.history(id),api.suppliers()]).then(([r,s])=>{if(live){setRows(r);setSuppliers(Object.fromEntries(s.map(x=>[x.id,x.name[locale]||x.name['ja-JP']])));setError(false);}}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[id,retry,locale]);
 if(error)return <Alert type="warning" message={t('onboarding.read_failed')} action={<Button onClick={()=>setRetry(n=>n+1)}>{t('onboarding.refresh')}</Button>}/>;
 if(!rows.length)return null;
 return <details className="photo-history"><summary>{t('photo.history')}</summary>{rows.map(r=><p key={r.id}>{suppliers[r.supplierId]} · {r.market} · {new Date(r.observedAt).toLocaleString(locale)} · {r.inStock?t('photo.available'):''} · {r.amount==null?t('photo.price_not_updated'):`${r.amount} ${r.currency} / ${r.unit}`} {r.conditions} · {r.amount!=null?t(r.priceChanged?'photo.price_updated':'photo.price_unchanged'):''}</p>)}</details>;
}
