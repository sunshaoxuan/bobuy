import { useEffect, useRef, useState } from 'react';

export type CostcoOnboardingState = 'QUEUED' | 'AI_INTAKE' | 'EVIDENCE_FETCH' | 'AI_REVIEW' | 'COMMITTING'
  | 'COMPLETED' | 'NEEDS_INPUT' | 'RETRY_WAIT' | 'FAILED' | 'CANCELLED';
export type CostcoOnboardingJobView = { id: string; state: CostcoOnboardingState; revision: number };
export type CostcoNumberLabels = Record<'title' | 'itemNumber' | 'submit' | 'close' | 'invalid' | 'failed' | 'queued' | 'pending', string>&{newTask?:string};
type Props = {
  open: boolean; subject: string; supplierId: string; market: string; labels: CostcoNumberLabels;
  enqueue: (input: { requestId: string; supplierId: string; market: string; itemNumber: string }) => Promise<CostcoOnboardingJobView>;
  onQueued: (job: CostcoOnboardingJobView) => void; onClose: () => void;
};

/** Unwired AGENT input. The server must derive the authenticated merchant and authorize supplier scope. */
export default function CostcoNumberOnboardingModal(props: Props) {
  return <ScopedModal key={JSON.stringify([props.subject, props.supplierId, props.market])} {...props} />;
}
function ScopedModal({ open, supplierId, market, labels, enqueue, onQueued, onClose }: Props) {
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [job, setJob] = useState<CostcoOnboardingJobView>();
  const mounted = useRef(true);
  const pending = useRef(false);
  const retry = useRef<{ payload: string; requestId: string }>();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Remain mounted while closed: an uncertain attempt retains its request key for an explicit retry.
  if (!open) return null;
  const itemNumber = raw.normalize('NFKC').trim();
  const valid = /^[0-9]{1,12}$/.test(itemNumber) && supplierId.length > 0 && supplierId.length <= 100 && /^[A-Z]{2}$/.test(market);
  return <div role="dialog" aria-modal="true" aria-label={labels.title} onKeyDown={event => {
    if (event.key === 'Escape' && !pending.current) { event.stopPropagation(); onClose(); }
  }}>
    <h2>{labels.title}</h2>
    <form onSubmit={async event => {
      event.preventDefault();
      if (pending.current || job) return;
      if (!valid) { setMessage(labels.invalid); return; }
      const payload = JSON.stringify({ supplierId, market, itemNumber });
      if (retry.current?.payload !== payload) retry.current = { payload, requestId: crypto.randomUUID() };
      pending.current = true; setBusy(true); setMessage('');
      try {
        const result = await enqueue({ requestId: retry.current.requestId, supplierId, market, itemNumber });
        if (!mounted.current) return;
        setJob(result); setMessage(labels.queued); onQueued(result);
      } catch {
        if (mounted.current) setMessage(labels.failed);
      } finally {
        pending.current = false; if (mounted.current) setBusy(false);
      }
    }}>
      <label>{labels.itemNumber}<input aria-label={labels.itemNumber} inputMode="numeric" value={raw} maxLength={40}
        disabled={busy || !!job} onChange={event => { setRaw(event.currentTarget.value); setMessage(''); }} /></label>
      <button type="submit" disabled={busy || !!job}>{labels.submit}</button>
      <button type="button" disabled={busy} onClick={onClose}>{labels.close}</button>
    </form>
    {busy && <p role="status">{labels.pending}</p>}
    {message && <p role="status">{message}</p>}
    {job && <output aria-label="job">{job.id} · {job.state}</output>}
    {job&&<button type="button" onClick={()=>{setRaw('');setJob(undefined);setMessage('');retry.current=undefined;}}>{labels.newTask||labels.submit}</button>}
  </div>;
}
