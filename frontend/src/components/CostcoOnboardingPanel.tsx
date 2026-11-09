import React,{useEffect,useRef,useState} from 'react';
import { Alert,Button,Select,Space,Tag,Typography } from 'antd';
import {api,type MobileSupplier,type CostcoOnboardingJobView} from '../api';
import {getStoredUser,subscribeToAuthChanges} from '../authStorage';
import {useI18n} from '../i18n';
import CostcoNumberOnboardingModal from './CostcoNumberOnboardingModal';
import AiQuickAddModal from './AiQuickAddModal';

type Props={suppliers:MobileSupplier[];photoOpen:boolean;onPhotoClose:()=>void;onOpenProduct:(id:string)=>void};
const identity=()=>{const user=getStoredUser();return user?.roles.includes('AGENT')?String(user.id):'';};
/** Both inputs queue the same durable pipeline. Polling reads owned task state, never invents progress. */
export default function CostcoOnboardingPanel({suppliers,photoOpen,onPhotoClose,onOpenProduct}:Props){
 const{t,locale}=useI18n();const[subject,setSubject]=useState(identity);const[supplier,setSupplier]=useState('');
 const[numberOpen,setNumberOpen]=useState(false);const[jobs,setJobs]=useState<CostcoOnboardingJobView[]>([]);const[error,setError]=useState(false);
 const[workerEnabled,setWorkerEnabled]=useState(false);const[statusLoaded,setStatusLoaded]=useState(false);
 const epoch=useRef(0);const photoIntents=useRef(new Map<string,string>());
 useEffect(()=>subscribeToAuthChanges(()=>{epoch.current++;setSubject(identity());setSupplier('');setJobs([]);setNumberOpen(false);setWorkerEnabled(false);setStatusLoaded(false);photoIntents.current.clear();onPhotoClose();}),[onPhotoClose]);
 const refresh=async()=>{const generation=epoch.current;if(!subject)return;try{const result=await api.costcoOnboarding.list();if(generation===epoch.current){setJobs(result);setError(false);}}catch{if(generation===epoch.current)setError(true);}};
 useEffect(()=>{epoch.current++;if(!subject)return;let closed=false;const generation=epoch.current;
  const read=async()=>{try{const[result,status]=await Promise.all([api.costcoOnboarding.list(),api.costcoOnboarding.status()]);if(!closed&&generation===epoch.current){setJobs(result);setWorkerEnabled(status.workerEnabled);setStatusLoaded(true);setError(false);}}catch{if(!closed&&generation===epoch.current)setError(true);}};
  void read();const timer=setInterval(()=>{void read();},5000);return()=>{closed=true;epoch.current++;clearInterval(timer);};
 },[subject]);
 const queued=(job:CostcoOnboardingJobView)=>{setJobs(previous=>[job,...previous.filter(x=>x.id!==job.id)]);};
 if(!subject)return null;
 const selected=suppliers.some(s=>s.id===supplier);
 const labels={title:t('onboarding.number_title'),itemNumber:t('onboarding.item'),submit:t('onboarding.start'),close:t('onboarding.close'),invalid:t('onboarding.one_item_required'),failed:t('onboarding.retry_attempt'),queued:t('onboarding.queued'),pending:t('onboarding.accepting'),newTask:t('onboarding.new_task')};
 return <section aria-label={t('onboarding.title')}>
  <Space wrap><Typography.Text strong>{t('onboarding.title')}</Typography.Text>
   <Select aria-label={t('onboarding.supplier')} placeholder={t('onboarding.supplier')} value={supplier||undefined} style={{minWidth:180,maxWidth:'100%'}}
    onChange={value=>{setSupplier(value);photoIntents.current.clear();}} options={suppliers.map(s=>({value:s.id,label:s.name[locale]||s.name['ja-JP']||s.id}))}/>
   <Button disabled={!selected||!workerEnabled} onClick={()=>setNumberOpen(true)}>{t('onboarding.number_title')}</Button><Button onClick={()=>void refresh()}>{t('onboarding.refresh')}</Button>
  </Space>
  {error&&<Alert type="warning" message={t('onboarding.read_failed')}/>}
  {statusLoaded&&!workerEnabled&&<Alert type="info" message={t('onboarding.worker_disabled')}/>}
  {jobs.slice(0,8).map(job=><div key={job.id}><Tag>{t('onboarding.state.'+job.state)}</Tag>{job.itemNumber&&<span>{job.itemNumber} </span>}
   {job.state==='NEEDS_INPUT'&&<Typography.Text>{t(job.failureCode==='onboarding.new_master_needs_price_policy'?'onboarding.master_pending':['onboarding.pending_quota','onboarding.daily_quota','onboarding.evidence_quota'].includes(job.failureCode||'')?job.failureCode!:'onboarding.needs_input')}</Typography.Text>}
   {job.candidate&&<details><summary>{t('onboarding.saved_details')}</summary><dl>
    <dt>{t('onboarding.name')}</dt><dd>{job.candidate.translatedNames?.[locale]||job.candidate.name}</dd>
    {job.candidate.brand&&<><dt>{t('onboarding.brand')}</dt><dd>{job.candidate.brand}</dd></>}
    {job.candidate.model&&<><dt>{t('onboarding.model')}</dt><dd>{job.candidate.model}</dd></>}
    {job.candidate.specification&&<><dt>{t('onboarding.specification')}</dt><dd>{job.candidate.specification}</dd></>}
    {job.candidate.packaging&&<><dt>{t('onboarding.packaging')}</dt><dd>{job.candidate.packaging}</dd></>}
   </dl>{job.candidate.referencePrices?.map((quote,index)=><p key={index}>{t('onboarding.reference_facts')} · {t('onboarding.reference_kind.'+quote.kind)} {quote.currency} {String(quote.amount)} {quote.quantityBasis}{' '}
    {quote.channel&&<span>{t('onboarding.channel')}: {quote.channel} </span>}{quote.taxStatus&&<span>{t('onboarding.tax')}: {quote.taxStatus} </span>}{quote.validFrom} {quote.validUntil}{' '}
    {quote.timeZone&&<span>{t('onboarding.timezone')}: {quote.timeZone} </span>}{quote.conditions}{' '}
    {quote.sourceUrl.startsWith('https://')&&<a href={quote.sourceUrl} target="_blank" rel="noopener noreferrer">{t('onboarding.source')}</a>}</p>)}</details>}
   {job.state==='COMPLETED'&&job.productId&&<Button onClick={()=>onOpenProduct(job.productId!)}>{t('onboarding.open_product')}</Button>}
  </div>)}
  <CostcoNumberOnboardingModal open={numberOpen&&selected&&workerEnabled} subject={subject} supplierId={supplier} market="JP" labels={labels}
   enqueue={api.costcoOnboarding.number} onQueued={queued} onClose={()=>setNumberOpen(false)}/>
  <AiQuickAddModal key={subject+':'+supplier} visible={photoOpen} onCancel={onPhotoClose} onSuccess={()=>{}}
   durable={{ready:selected&&workerEnabled,enqueuePhoto:async(file)=>{
    if(!selected)throw Error(t('onboarding.supplier'));
    const generation=epoch.current;const data=new Uint8Array(await file.arrayBuffer());const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');
    if(generation!==epoch.current)throw Error(t('onboarding.retry_attempt'));
    const identity=JSON.stringify([supplier,'JP',digest]);let requestId=photoIntents.current.get(identity);if(!requestId){requestId=crypto.randomUUID();photoIntents.current.set(identity,requestId);}
    const result=await api.costcoOnboarding.photo({requestId,supplierId:supplier,market:'JP'},file);if(generation!==epoch.current)throw Error(t('onboarding.retry_attempt'));return result;
   },onQueued:queued}}/>
 </section>;
}
