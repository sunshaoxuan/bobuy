import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Input, Pagination, Popconfirm, Spin, Tag, Tooltip } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SendOutlined, UploadOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { recommendationApi as api, type RecommendationDetail, type RecommendationSummary, type RecommendationFacts } from '../api';
import { FactsForm, OfferInfo, factsError, parseBatch, factFields } from '../components/RecommendationFacts';
import {RecommendationPreview} from './PublicRecommendations';
import RecommendationCatalog from '../components/RecommendationCatalog';
import RecommendationFromProduct from '../components/RecommendationFromProduct';
import RecommendationLocalization from '../components/RecommendationLocalization';
import RecommendationGallery from '../components/RecommendationGallery';
import '../browse.css';
import RecommendationClassification from '../components/RecommendationClassification';
import { useI18n } from '../i18n';
import '../recommendations.css';

type PendingImage = { key: number; file?: File; imageUrl?: string; preview: string; facts: RecommendationFacts; status: 'waiting' | 'uploading' | 'done' | 'failed'; error?: string; result?: string };
const PAGE_SIZE = 6;
export default function Recommendations() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const id = Number(params.get('post')) || undefined;
  const [list, setList] = useState<RecommendationSummary[]>([]);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<RecommendationDetail>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [queue, setQueue] = useState<PendingImage[]>([]);
  const [queuePage, setQueuePage] = useState(1);
  const [itemPage, setItemPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generated, setGenerated] = useState('');
  const [writing, setWriting] = useState(false);
  const [batch, setBatch] = useState('');
  const [preview, setPreview] = useState(false);
  const [classificationPending,setClassificationPending]=useState(false);
  const [fromProductPending,setFromProductPending]=useState(false);
  const [editingItem, setEditingItem] = useState<number>();
  const [editFacts, setEditFacts] = useState<RecommendationFacts>({name:''});
  const urls = useRef(new Set<string>());
  const nextKey = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = !!detail && (title !== detail.post.title || body !== detail.body);
  const published = detail?.post.published;
  const identity = (item: RecommendationDetail['items'][number]) => item.productId || 'recommendation:'+item.id;
  const products = [...new Map(detail?.items.map(item => [identity(item), item])).values()];
  const pending = queue.some(item => item.status !== 'done') || editingItem !== undefined || !!batch.trim() || classificationPending || fromProductPending;
  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    if (!dirty && !pending) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, pending]);
  useEffect(() => {
    let active = true;
    urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear();
    setQueue([]); setQueuePage(1); setItemPage(1); setGenerated(''); setPrompt('');
    setEditingItem(undefined); setBatch(''); setPreview(false);
    setClassificationPending(false);
    setLoading(true); setError(''); setNotice(''); setDetail(undefined);
    const request = id ? api.get(id) : api.list(page);
    void request.then(value => {
      if (!active) return;
      if (Array.isArray(value)) setList(value);
      else { setDetail(value); setTitle(value.post.title); setBody(value.body); setSelected([...new Set(value.items.map(identity))]); }
    }).catch(e => { if (active) setError((e as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, page]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function clearQueue() { queue.forEach(item => { URL.revokeObjectURL(item.preview); urls.current.delete(item.preview); }); setQueue([]); setQueuePage(1); }
  function back() { clearQueue(); setGenerated(''); setPrompt(''); setParams({}); }
  function change(key: number, value: Partial<PendingImage>) { setQueue(current => current.map(item => item.key === key ? { ...item, ...value } : item)); }
  function choose(files: FileList | null) {
    if (!files) return;
    const additions: PendingImage[] = Array.from(files).map(file => {
      const preview = URL.createObjectURL(file); urls.current.add(preview);
      const invalid = !['image/jpeg', 'image/png'].includes(file.type) || file.size > 8 * 1024 * 1024 || file.size === 0;
      return { key: nextKey.current++, file, preview, facts:{name: file.name.replace(/\.[^.]+$/, '').slice(0, 200)},
        status: invalid ? 'failed' : 'waiting', error: invalid ? t('rec.image_rule') : undefined };
    });
    setQueue(current => [...current, ...additions]);
    if (fileInput.current) fileInput.current.value = '';
  }
  async function upload(entries: PendingImage[]) {
    if (!detail) return;
    let current = detail;
    await run(async () => {
      for (const entry of entries.filter(item => item.status !== 'done')) {
        const invalid = factsError(entry.facts);
        if (invalid) {
          change(entry.key, { status: 'failed', error: t(invalid) }); continue;
        }
        if (entry.file && (!['image/jpeg', 'image/png'].includes(entry.file.type) || entry.file.size > 8 * 1024 * 1024 || !entry.file.size)) {
          change(entry.key, { status: 'failed', error: t('rec.image_rule') }); continue;
        }
        change(entry.key, { status: 'uploading', error: undefined });
        try {
          const result = entry.file
            ? await api.upload(current.post.id, entry.file, entry.facts.name.trim(), entry.facts.itemNumber?.trim() || '', entry.facts.referencePrice ?? null, current.post.version,entry.facts)
            : await api.sourceImage(current.post.id,entry.imageUrl!,entry.facts,current.post.version);
          current = result.detail; setDetail(current);
          const linked = current.items.find(item => (item.itemNumber || '') === (entry.facts.itemNumber?.trim() || '') && item.name === entry.facts.name.trim());
          if (linked) setSelected(ids => [...new Set([...ids, identity(linked)])]);
          change(entry.key, { status: 'done', result: [t('rec.facts_registered'), ...(result.imageReused ? [t('rec.image_reused')] : [])].join(' · ') });
        } catch (e) { change(entry.key, { status: 'failed', error: (e as Error).message }); }
      }
    });
  }
  async function save() {
    if (!detail) return undefined;
    const saved = await api.save(detail.post.id, title, body, detail.post.version);
    setDetail(saved); setTitle(saved.post.title); setBody(saved.body); return saved;
  }
  async function publish() {
    await run(async () => {
      const saved = dirty ? await save() : detail;
      if (!saved) return;
      setDetail(await api.publish(saved.post.id, saved.post.version, true)); setNotice(t('rec.published'));
    });
  }
  if (loading) return <div className="rec-loading"><Spin /></div>;
  return <div className={'recommendations' + (detail ? ' rec-editing' : '')}>
    <header className="rec-heading"><div><h1>{t('rec.title')}</h1>{detail && <Tag color={published ? 'green' : undefined}>{t(published ? 'rec.published' : 'rec.draft')}{dirty ? ' *' : ''}</Tag>}</div>
      {!id && <Button type="primary" icon={<PlusOutlined />} loading={busy} onClick={() => void run(async () => { const post = await api.create(); setParams({ post: String(post.post.id) }); })}>{t('rec.new')}</Button>}
    </header>
    {error && <Alert type="error" showIcon message={error} action={<Button icon={<ReloadOutlined />} onClick={() => void run(async () => {
      if (id) { const value = await api.get(id); setDetail(value); if (!dirty) { setTitle(value.post.title); setBody(value.body); } }
      else setList(await api.list(page));
    })}>{t('rec.reload')}</Button>} />}
    {notice && <Alert type="success" showIcon message={notice} />}
    {!id ? <><div className="rec-list">{list.map(post => <Link key={post.id} to={'?post=' + post.id} className="rec-list-row"><EditOutlined /><div><h2>{post.title || t('rec.untitled')}</h2><time>{new Date(post.updatedAt).toLocaleString(locale)}</time>{post.publishedAt && <div className="rec-publication"><span>{t('rec.publisher')}: {post.publisherName}</span><time dateTime={post.publishedAt}>{t('rec.published_date')}: {new Date(post.publishedAt).toLocaleString(locale)}</time></div>}</div><Tag color={post.published ? 'green' : undefined}>{t(post.published ? 'rec.published' : 'rec.draft')}</Tag></Link>)}{!list.length && !error && <Empty description={t('rec.empty')} />}</div>
      <div className="rec-pagination"><Button disabled={!page} icon={<ArrowLeftOutlined />} onClick={() => setPage(page - 1)}>{t('rec.previous')}</Button><span>{page + 1}</span><Button disabled={list.length < 20} onClick={() => setPage(page + 1)}>{t('rec.next')}</Button></div></> : detail && <>
      <div className="rec-actions"><Popconfirm disabled={!dirty && !pending} title={t('rec.leave')} onConfirm={back}><Button aria-label={t('rec.back')} disabled={busy || writing} icon={<ArrowLeftOutlined />} onClick={() => { if (!dirty && !pending) back(); }}>{t('rec.back')}</Button></Popconfirm>
        <div className="rec-action-group">{published ? <><Link to={'/recommendations/' + id} target="_blank"><Button icon={<EyeOutlined />}>{t('rec.view')}</Button></Link><Button icon={<EditOutlined />} disabled={busy} onClick={() => void run(async () => { setDetail(await api.publish(id, detail.post.version, false)); })}>{t('rec.withdraw')}</Button></> : <>
          <Button icon={<SaveOutlined />} loading={busy} disabled={writing} onClick={() => void run(async () => { await save(); setNotice(t('rec.saved')); })}>{t('rec.save')}</Button>
          <Button type="primary" icon={<SendOutlined />} disabled={busy || writing || pending || !detail.items.length || !title.trim() || !body.trim()} onClick={() => void publish()}>{t('rec.publish')}</Button></>}
        </div></div>
      {detail.post.publishedAt && <div className="rec-publication rec-publication-editor"><span>{t('rec.publisher')}: {detail.post.publisherName}</span><time dateTime={detail.post.publishedAt}>{t('rec.published_date')}: {new Date(detail.post.publishedAt).toLocaleString(locale)}</time></div>}
      <div className="rec-editor-layout"><section className="rec-article"><h2>{t('rec.article')}</h2><label htmlFor="rec-title">{t('rec.article_title')}</label><Input id="rec-title" value={title} maxLength={200} disabled={published || busy} onChange={e => setTitle(e.target.value)} />
        <label htmlFor="rec-body">{t('rec.body')}</label><Input.TextArea id="rec-body" value={body} maxLength={100000} rows={15} disabled={published || busy} onChange={e => setBody(e.target.value)} />
        {published && <div className="rec-public-link"><Link to={'/recommendations/' + id}>{t('rec.view')}</Link><Tooltip title={t('rec.copy')}><Button icon={<CopyOutlined />} aria-label={t('rec.copy')} onClick={() => void run(async () => { await navigator.clipboard.writeText(location.origin + '/recommendations/' + id); setNotice(t('rec.copied')); })} /></Tooltip></div>}
      </section></div>
      {!published && <section className="rec-uploads"><div className="rec-section-heading"><h2>{t('rec.uploads')}</h2><div className="rec-action-group"><input ref={fileInput} type="file" multiple accept="image/png,image/jpeg" hidden onChange={e => choose(e.target.files)} /><Button icon={<PlusOutlined />} disabled={busy || writing} onClick={() => fileInput.current?.click()}>{t('rec.choose')}</Button><Button icon={<UploadOutlined />} disabled={busy || writing || !pending} onClick={() => void upload(queue)}>{t('rec.register_all')}</Button></div></div>
        <p>{t('rec.batch_help')}</p><label htmlFor="rec-batch">{t('rec.batch_label')}</label><Input.TextArea id="rec-batch" rows={5} value={batch} onChange={e => setBatch(e.target.value)} disabled={busy} />
        <Button disabled={busy || !batch.trim()} onClick={() => { try {
          const rows = parseBatch(batch);
          const additions = rows.map(row => { const fileEntry = row.fileName ? queue.find(entry => entry.file?.name === row.fileName && entry.status !== 'done') : undefined;
            if (!row.imageUrl && !fileEntry) throw new Error(t('rec.batch_image')+': '+row.fileName);
            const facts = Object.fromEntries(factFields.map(key => [key,row[key] ?? null])) as RecommendationFacts;
            return {...fileEntry,key:fileEntry?.key ?? nextKey.current++,preview:fileEntry?.preview ?? row.imageUrl!,imageUrl:row.imageUrl,facts,status:'waiting' as const,error:undefined}; });
          setQueue(current => [...current.filter(entry => !additions.some(value => value.key === entry.key)),...additions]); setQueuePage(1); setBatch(''); setError(''); setNotice(t('rec.batch_ready'));
        } catch(e) { setError(t('rec.batch_invalid')+' '+(e as Error).message.replace(/rec\.[a-z_]+/g,key => t(key))); } }}>{t('rec.batch_preview')}</Button>
        <div className="rec-queue">{queue.slice((queuePage - 1) * PAGE_SIZE, queuePage * PAGE_SIZE).map(item => <div className="rec-upload-row" key={item.key}><img src={item.preview} alt={item.facts.name} /><div className="rec-upload-fields">
          <FactsForm facts={item.facts} disabled={busy || item.status === 'done'} onChange={facts => change(item.key,{facts,status:'waiting',error:undefined})} />
          <OfferInfo facts={item.facts} />
          <div className="rec-upload-status" role="status">{item.status === 'done' ? <span className="rec-success"><CheckOutlined /> {item.result}</span> : item.status === 'uploading' ? <Spin size="small" /> : <span className={item.error ? 'rec-error' : ''}>{item.error || t('rec.waiting')}</span>}</div></div>
          <div className="rec-upload-actions"><Tooltip title={t(item.status === 'failed' ? 'rec.retry' : 'rec.register')}><Button disabled={busy || item.status === 'done'} icon={item.status === 'failed' ? <ReloadOutlined /> : <UploadOutlined />} aria-label={t(item.status === 'failed' ? 'rec.retry' : 'rec.register')} onClick={() => void upload([item])} /></Tooltip><Tooltip title={t('rec.remove')}><Button disabled={busy} icon={<DeleteOutlined />} aria-label={t('rec.remove')} onClick={() => { URL.revokeObjectURL(item.preview); urls.current.delete(item.preview); setQueue(q => q.filter(value => value.key !== item.key)); setQueuePage(1); }} /></Tooltip></div></div>)}</div>
        {queue.length > PAGE_SIZE && <Pagination size="small" current={queuePage} pageSize={PAGE_SIZE} total={queue.length} showSizeChanger={false} onChange={setQueuePage} />}
      </section>}
      <RecommendationFromProduct detail={detail} onChange={setDetail} onPendingChange={setFromProductPending}/>
      <RecommendationClassification detail={detail} onChanged={setDetail} onPendingChange={setClassificationPending} />
      <RecommendationCatalog detail={detail} onChange={setDetail}/>
      <RecommendationLocalization detail={detail} onChange={setDetail}/>
      <RecommendationGallery detail={detail} onChange={setDetail}/>
      <Button icon={<EyeOutlined />} onClick={() => setPreview(value => !value)}>{t('rec.draft_preview')}</Button>
      {preview && <RecommendationPreview key={detail.post.id} detail={{...detail,post:{...detail.post,title},body}}/>}
      <section className="rec-linked"><div className="rec-section-heading"><h2>{t('rec.products')} <span>({detail.items.length})</span></h2></div><div className="rec-product-grid">{detail.items.slice((itemPage - 1) * 12, itemPage * 12).map(item => <article key={item.id} className="rec-product"><img src={item.imageUrl} alt={item.name} /><div><h3>{item.name}</h3><small>{item.itemNumber}</small><OfferInfo facts={item} />
        {editingItem === item.id && <>{item.catalogDriven&&<Alert type="info" message={t('master.use_profile')}/>}<FactsForm facts={editFacts} onChange={setEditFacts} disabled={busy} identityReadOnly={item.catalogDriven}/><Button loading={busy} onClick={() => void run(async () => { const error = factsError(editFacts); if(error) throw new Error(t(error)); setDetail(await api.editItem(id,item.id,editFacts,detail.post.version)); setEditingItem(undefined); })}>{t('rec.save_item')}</Button><Button onClick={() => setEditingItem(undefined)}>{t('rec.cancel_edit')}</Button></>}
        </div>{!published && <div><Button aria-label={t('rec.edit_item')+': '+item.name} icon={<EditOutlined />} disabled={busy || writing} onClick={() => {setEditingItem(item.id);setEditFacts(Object.fromEntries(factFields.map(key => [key,({...item,...item.sourceFacts})[key] ?? null])) as RecommendationFacts);}} />
        <Tooltip title={t('rec.unlink')}><Button aria-label={t('rec.unlink')} icon={<DeleteOutlined />} disabled={busy || writing} onClick={() => void run(async () => { const next = await api.remove(id, item.id, detail.post.version); setDetail(next); setSelected(ids => ids.filter(key => next.items.some(value => identity(value) === key))); setItemPage(1); })} /></Tooltip></div>}</article>)}</div>
        {!detail.items.length && <Empty description={t('rec.no_products')} />}{detail.items.length > 12 && <Pagination current={itemPage} pageSize={12} total={detail.items.length} showSizeChanger={false} onChange={setItemPage} />}
      </section>
    </>}
  </div>;
}
