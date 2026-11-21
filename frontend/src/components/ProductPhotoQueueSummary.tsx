import { useState } from 'react';
import { Alert, Button, Tag } from 'antd';
import type { PhotoQueueRow } from '../api';
import { useI18n } from '../i18n';
import {photoState} from './ProductPhotoQueue';
import './productPhotoIntake.css';

export default function ProductPhotoQueueSummary({ rows, failed, onRefresh, onOpen }: {
  rows: PhotoQueueRow[] | undefined;
  failed: boolean;
  onRefresh: () => void;
  onOpen: (row: PhotoQueueRow) => void;
}) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const jobs = rows?.map(row => ({ row, state: photoState(row) }));
  const counts = { queued: 0, running: 0, confirm: 0 };
  jobs?.forEach(({ state }) => {
    if (state === 'photo.state.queued') counts.queued++;
    if (state === 'photo.state.running') counts.running++;
    if (state === 'photo.state.confirm') counts.confirm++;
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
    {expanded && (jobs?.length ? <ul className="photo-queue-summary-list">
      {jobs.map(({ row, state }) => <li key={row.id} data-photo-job={row.id}>
        <div className="photo-queue-summary-meta">
          <Tag>{t(state)}</Tag>
          {row.itemNumber && <span>{row.itemNumber}</span>}
          <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString(locale)}</time>
        </div>
        <Button type={state === 'photo.state.confirm' ? 'primary' : 'default'} onClick={() => onOpen(row)}>
          {t(state === 'photo.state.confirm' ? 'photo.queue_review' : 'photo.reopen')}
        </Button>
      </li>)}
    </ul> : !failed && <p role="status">{t(rows ? 'photo.queue_empty' : 'onboarding.accepting')}</p>)}
  </section>;
}
