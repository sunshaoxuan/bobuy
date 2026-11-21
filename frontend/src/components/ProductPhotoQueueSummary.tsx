import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Tag } from 'antd';
import { photoIntakeApi, type PhotoQueueRow } from '../api';
import { useI18n } from '../i18n';
import './productPhotoIntake.css';

function queueState(job: PhotoQueueRow) {
  if (job.state === 'COMPLETED') return 'completed';
  if (job.reviewReady || job.failureCode === 'photo.confirm_required') return 'confirm';
  if (job.state === 'QUEUED' || job.state === 'RETRY_WAIT') return 'queued';
  if (job.state === 'FAILED' || job.state === 'NEEDS_INPUT' || job.state === 'CANCELLED') return 'failed';
  return 'running';
}

function PhotoQueueThumbnail({id}: {id:string}) {
  const target=useRef<HTMLSpanElement>(null);
  const [url,setUrl]=useState('');
  useEffect(()=>{
    const element=target.current;
    if(!element)return;
    let active=true;
    let photoUrl='';
    const load=()=>{
      void photoIntakeApi.photo(id).then(blob=>{
        if(!active)return;
        photoUrl=URL.createObjectURL(blob);
        setUrl(photoUrl);
      }).catch(()=>{/* Keep the queue row available if the thumbnail cannot be loaded. */});
    };
    const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();load();}
    }):undefined;
    if(observer)observer.observe(element);else load();
    return()=>{active=false;observer?.disconnect();if(photoUrl)URL.revokeObjectURL(photoUrl);};
  },[id]);
  return <span ref={target} className="photo-queue-thumbnail" aria-hidden>{url&&<img src={url} alt=""/>}</span>;
}

export default function ProductPhotoQueueSummary({ rows, failed, onRefresh, onOpen }: {
  rows: PhotoQueueRow[] | undefined;
  failed: boolean;
  onRefresh: () => void;
  onOpen: (row: PhotoQueueRow) => void;
}) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const jobs = rows?.map(row => ({ row, state: queueState(row) }));
  const first=jobs?.find(job=>job.state==='confirm')??jobs?.find(job=>job.state==='failed');
  const counts = { queued: 0, running: 0, confirm: 0 };
  jobs?.forEach(({ state }) => {
    if (state === 'queued' || state === 'running' || state === 'confirm') counts[state]++;
  });
  return <section className="photo-queue-summary" aria-label={t('photo.queue')}>
    <div className="photo-queue-summary-bar">
      <Button aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{t('photo.queue')}</Button>
      {jobs && <div className="photo-queue-summary-counts" aria-live="polite">
        <Tag>{t('photo.state.queued')} {counts.queued}</Tag>
        <Tag>{t('photo.state.running')} {counts.running}</Tag>
        <Tag>{t('photo.state.confirm')} {counts.confirm}</Tag>
      </div>}
    </div>
    {failed && <Alert type="warning" message={t('onboarding.read_failed')} action={<Button onClick={onRefresh}>{t('onboarding.refresh')}</Button>}/>}
    {(expanded||first) && ((expanded?jobs:first?[first]:[])?.length ? <ul className="photo-queue-summary-list">
      {(expanded?jobs:first?[first]:[])?.map(({ row, state }) => <li key={row.id} data-photo-job={row.id} data-photo-state={state}>
        <PhotoQueueThumbnail id={row.id}/>
        <div className="photo-queue-summary-meta">
          <Tag>{t('photo.state.' + state)}</Tag>
          {(row.candidate?.translatedNames?.[locale]||row.itemNumber)&&<strong>{row.candidate?.translatedNames?.[locale]||row.itemNumber}</strong>}
          <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString(locale)}</time>
        </div>
        <Button type={state === 'confirm' ? 'primary' : 'default'} onClick={() => onOpen(row)}>
          {t(state==='confirm'?'photo.queue_review':state==='failed'?'photo.queue_fix':'photo.reopen')}
        </Button>
      </li>)}
    </ul> : !failed && <p role="status">{t(rows ? 'photo.queue_empty' : 'onboarding.accepting')}</p>)}
  </section>;
}
