import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Space,Tag} from 'antd';
import {photoIntakeApi,type CostcoOnboardingJobView} from '../api';
import {useI18n} from '../i18n';
import './productPhotoIntake.css';

export function photoCanRetry(job:CostcoOnboardingJobView) {
 return job.failureCode!=='photo.confirm_required'&&['FAILED','NEEDS_INPUT','CANCELLED','RETRY_WAIT'].includes(job.state);
}

export function photoState(job:CostcoOnboardingJobView&{reviewReady?:boolean}) {
 if(job.state==='COMPLETED')return 'photo.state.completed';
 if(job.reviewReady||job.failureCode==='photo.confirm_required')return 'photo.state.confirm';
 if(photoCanRetry(job))return 'photo.state.failed';
 if(job.state==='QUEUED')return 'photo.state.queued';
 return 'photo.state.running';
}

export function photoFailure(code?:string) {
 if(code==='ai.pinned_endpoint')return 'photo.ai_endpoint';
 if(code==='ai.pinned_credentials_missing')return 'photo.ai_credentials';
 if(['ai.pinned_provider_or_model','ai.pinned_model_unavailable','ai.pinned_vision_unattested'].includes(code??''))return 'photo.ai_model';
 if(code?.startsWith('ai.'))return 'photo.ai_unavailable';
 if(code==='onboarding.retry_exhausted')return 'photo.recognition_timeout';
 if(code==='error.auth.forbidden'||code==='onboarding.scope_changed')return 'photo.scope_failed';
 if(code==='onboarding.evidence_missing')return 'photo.sources_missing';
 return 'photo.recognition_failed';
}

export function photoRetryFailure(error:unknown) {
 const key=error instanceof Error?error.message:'';
 return ['onboarding.worker_disabled','photo.evidence_failed'].includes(key)?key:'photo.retry_failed';
}

function Thumbnail({id}:{id:string}) {
 const {t}=useI18n();
 const target=useRef<HTMLDivElement>(null);
 const [url,setUrl]=useState('');
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let live=true,objectUrl:string|undefined;
  const load=()=>{
   void photoIntakeApi.photo(id).then(blob=>{
    if(live){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}
   }).catch(()=>{if(live)setFailed(true);});
  };
  const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();load();}
  });
  if(observer&&target.current)observer.observe(target.current);
  else load();
  return()=>{live=false;observer?.disconnect();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[id]);
 return <div className="photo-queue-thumbnail" ref={target}>
  {url?<img src={url} alt={t('photo.evidence')}/>:failed?<span aria-label={t('photo.evidence_failed')}>—</span>:null}
 </div>;
}

type QueueProps={jobs:CostcoOnboardingJobView[];onReview:(job:CostcoOnboardingJobView)=>void;onChanged:(job:CostcoOnboardingJobView)=>void};
export default function ProductPhotoQueue({jobs,onReview,onChanged}:QueueProps){
 const {t}=useI18n();
 const [retrying,setRetrying]=useState<string[]>([]);
 const [failed,setFailed]=useState<Record<string,string>>({});
 const retry=async({id,revision}:CostcoOnboardingJobView)=>{
  setRetrying(ids=>[...ids,id]);setFailed(errors=>({...errors,[id]:''}));
  try{const next=await photoIntakeApi.retry(id,revision);await onChanged(next);}
  catch(error){setFailed(errors=>({...errors,[id]:photoRetryFailure(error)}));}
  finally{setRetrying(ids=>ids.filter(value=>value!==id));}
 };
 if(!jobs.length)return null;
 return <section className="photo-queue" aria-label={t('photo.queue')}>
  <strong>{t('photo.queue')}</strong>
  <ul>
   {jobs.map(job=>{
    const state=photoState(job);
    return <li key={job.id} data-photo-job={job.id}>
     <Thumbnail id={job.id}/>
     <div className="photo-queue-info">
      <Tag>{t(state)}</Tag>{job.itemNumber&&<span>{job.itemNumber}</span>}
      {photoCanRetry(job)&&<p>{t(photoFailure(job.failureCode))}</p>}
      {failed[job.id]&&<Alert type="error" message={t(failed[job.id])}/>}
      <Space wrap>
       <Button onClick={()=>onReview(job)}>{t('photo.reopen')}</Button>
       {photoCanRetry(job)&&<Button loading={retrying.includes(job.id)} onClick={()=>void retry(job)}>{t('photo.retry_recognition')}</Button>}
      </Space>
     </div>
    </li>;
   })}
  </ul>
 </section>;
}
