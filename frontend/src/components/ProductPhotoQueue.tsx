import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Space,Tag} from 'antd';
import {photoIntakeApi,type CostcoOnboardingJobView} from '../api';
import {useI18n} from '../i18n';
import './productPhotoIntake.css';

export function photoState(job:CostcoOnboardingJobView) {
 if(job.state==='COMPLETED')return 'photo.state.completed';
 if(job.failureCode==='photo.confirm_required')return 'photo.state.confirm';
 if(['FAILED','NEEDS_INPUT','CANCELLED','RETRY_WAIT'].includes(job.state))return 'photo.state.failed';
 if(job.state==='QUEUED')return 'photo.state.queued';
 return 'photo.state.running';
}

export function photoFailure(job:CostcoOnboardingJobView) {
 const code=job.failureCode;
 if(code?.startsWith('ai.'))return 'photo.ai_unavailable';
 if(code==='onboarding.retry_exhausted')return 'photo.recognition_timeout';
 if(code==='error.auth.forbidden'||code==='onboarding.scope_changed')return 'photo.scope_failed';
 if(code==='onboarding.evidence_missing')return 'photo.sources_missing';
 return 'photo.recognition_failed';
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

type QueueProps={jobs:CostcoOnboardingJobView[];onReview:(job:CostcoOnboardingJobView)=>void;onChanged:()=>void};
export default function ProductPhotoQueue({jobs,onReview,onChanged}:QueueProps){
 const {t}=useI18n();
 const [retrying,setRetrying]=useState<string[]>([]);
 const [failed,setFailed]=useState<string[]>([]);
 const retry=async(id:string)=>{
  setRetrying(ids=>[...ids,id]);setFailed(ids=>ids.filter(value=>value!==id));
  try{await photoIntakeApi.retry(id);await onChanged();}
  catch{setFailed(ids=>[...ids,id]);}
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
      {state==='photo.state.failed'&&<p>{t(photoFailure(job))}</p>}
      {failed.includes(job.id)&&<Alert type="error" message={t('photo.retry_failed')}/>}
      <Space wrap>
       <Button onClick={()=>onReview(job)}>{t('photo.reopen')}</Button>
       {state==='photo.state.failed'&&<Button loading={retrying.includes(job.id)} onClick={()=>void retry(job.id)}>{t('photo.retry_recognition')}</Button>}
      </Space>
     </div>
    </li>;
   })}
  </ul>
 </section>;
}
