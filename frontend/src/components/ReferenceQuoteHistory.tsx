import {useState} from 'react';
import {Alert,Button,Modal,Spin} from 'antd';
import {recommendationApi} from '../api';
import {useI18n} from '../i18n';
export default function ReferenceQuoteHistory({post,item}:{post:number;item:number}){
 const {t,locale}=useI18n();const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[rows,setRows]=useState<{id:number;recordedAt:string;facts:Record<string,unknown>}[]>([]);
 return <><Button onClick={()=>{setOpen(true);setRows([]);setError('');setBusy(true);void recommendationApi.referenceHistory(post,item).then(setRows).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>{t('ref.history')}</Button><Modal title={t('ref.history')} open={open} onCancel={()=>setOpen(false)} footer={null}>{busy?<Spin/>:error?<Alert type="error" message={error}/>:rows.length?rows.map(row=><article key={row.id}><strong>#{row.id} · {new Date(row.recordedAt).toLocaleString(locale)}</strong><p>{String(row.facts.referencePrice??'？')} JPY / {String(row.facts.priceUnit??'？')}</p><p>{String(row.facts.offerStart??'？')} – {String(row.facts.offerEnd??'？')}</p><p>{String(row.facts.offerNotes??'')}</p></article>):<p>{t('ref.history_empty')}</p>}</Modal></>;
}
