import RecommendationList from '../components/RecommendationList';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Input, Modal, Pagination, Spin, Tag, Tooltip } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SendOutlined, UploadOutlined } from '@ant-design/icons';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { recommendationApi as api, type RecommendationDetail, type RecommendationSummary, type RecommendationFacts } from '../api';
import { FactsForm, OfferInfo, factsError, parseBatch, factFields } from '../components/RecommendationFacts';
import {RecommendationPreview} from './PublicRecommendations';
import RecommendationCatalog from '../components/RecommendationCatalog';
import RecommendationFromProduct from '../components/RecommendationFromProduct';
import RecommendationLocalization from '../components/RecommendationLocalization';
import RecommendationGallery from '../components/RecommendationGallery';
import ReferenceQuoteHistory from '../components/ReferenceQuoteHistory';
import ArticleLanguages from '../components/ArticleLanguages';
import {mergeArticleEditor,readArticleSession,useArticleSession,type ArticleEditorState} from '../components/PublishedArticleRevision';
import RecommendationServiceEditor from '../components/RecommendationServiceEditor';
import RecommendationIssueDatePanel,{applyRecommendationIssueDate} from '../components/RecommendationIssueDatePanel';
import '../browse.css';
import RecommendationClassification from '../components/RecommendationClassification';
import { useI18n } from '../i18n';
import { IMAGE_UPLOAD_ACCEPT, prepareImageUpload } from '../imageUpload';
import '../recommendations.css';

type PendingImage = { key: number; file?: File; imageUrl?: string; preview: string; facts: RecommendationFacts; status: 'waiting' | 'uploading' | 'done' | 'failed'; error?: string; result?: string };
const PAGE_SIZE = 6;
export default function Recommendations() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const id = Number(params.get('post')) || undefined;
  const [list, setList] = useState<RecommendationSummary[]>([]);
  const [page, setPage] = useState(0);
  const session=useArticleSession();
  const [editor,setEditor]=useState<ArticleEditorState&{actorKey:string}>({actorKey:session.actorKey,title:'',body:''});
  const editorRef=useRef(editor),alive=useRef(true),loadScope=useRef<{id?:number;page:number;actorKey:string}>();
  const stamp=JSON.stringify([id,page,session.actorKey,session.token,session.generation]),currentStamp=useRef(stamp);currentStamp.current=stamp;
  const scopeCurrent=()=>alive.current&&currentStamp.current===stamp&&readArticleSession().actorKey===session.actorKey&&readArticleSession().token===session.token&&session.currentGeneration()===session.generation;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const detail=editor.actorKey===session.actorKey?editor.detail:undefined,title=editor.title,body=editor.body;
  const setDetail=useCallback((next:RecommendationDetail|undefined,syncSource=false)=>{
    if(!scopeCurrent()||(next&&id!==undefined&&next.post.id!==id))return false;
    const prior=editorRef.current,owned=prior.actorKey===session.actorKey?prior:{title:'',body:''};
    const value=next?mergeArticleEditor(owned,next,syncSource):{title:'',body:''};if(value===prior)return false;
    const accepted={...value,actorKey:session.actorKey};editorRef.current=accepted;setEditor(accepted);return true;
  },[stamp]);
  const setTitle=useCallback((value:string)=>{if(scopeCurrent()){const next={...editorRef.current,title:value};editorRef.current=next;setEditor(next);}},[stamp]);
  const setBody=useCallback((value:string)=>{if(scopeCurrent()){const next={...editorRef.current,body:value};editorRef.current=next;setEditor(next);}},[stamp]);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const selectionEpoch = useRef(0);
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
  const [articlePending,setArticlePending]=useState(false);
  const [issueDatePending,setIssueDatePending]=useState(false);
  const activePostId=useRef(id);activePostId.current=id;
  const [serviceOpen,setServiceOpen]=useState(false);
  const [editingItem, setEditingItem] = useState<number>();
  const [editFacts, setEditFacts] = useState<RecommendationFacts>({name:''});
  const urls = useRef(new Set<string>());
  const nextKey = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = !!detail && (title !== detail.post.title || body !== detail.body);
  const published = detail?.post.published;
  const identity = (item: RecommendationDetail['items'][number]) => item.productId || 'recommendation:'+item.id;
  const products = [...new Map(detail?.items.map(item => [identity(item), item])).values()];
  const pending = preparing || queue.some(item => item.status !== 'done') || editingItem !== undefined || !!batch.trim() || classificationPending || fromProductPending||articlePending||issueDatePending||serviceOpen;
  const navigation = useBlocker(({currentLocation,nextLocation}) => !!detail && (dirty || pending) &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(()=>{if(!detail&&navigation.state==='blocked')navigation.reset();},[detail,navigation]);
  useEffect(() => () => { selectionEpoch.current++; urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    if (!dirty && !pending) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, pending]);
  useEffect(() => {
    let active=true;const prior=loadScope.current,reset=!prior||prior.id!==id||prior.page!==page||prior.actorKey!==session.actorKey;loadScope.current={id,page,actorKey:session.actorKey};
    if(reset){selectionEpoch.current++;setPreparing(false);urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();setQueue([]);setQueuePage(1);setItemPage(1);setGenerated('');setPrompt('');setEditingItem(undefined);setBatch('');setPreview(false);setClassificationPending(false);setArticlePending(false);setIssueDatePending(false);setFromProductPending(false);setBusy(false);setWriting(false);setList([]);setLoading(true);setDetail(undefined);}
    if(!reset){setBusy(false);setWriting(false);}setError('');setNotice('');
    const request=id?api.get(id):api.list(page);
    void request.then(value=>{if(!active||!scopeCurrent())return;if(Array.isArray(value))setList(value);else if(setDetail(value))setSelected([...new Set(value.items.map(identity))]);}).catch(e=>{if(active&&scopeCurrent())setError((e as Error).message);}).finally(()=>{if(active&&scopeCurrent())setLoading(false);});
    return()=>{active=false;};
  }, [id,page,session.actorKey,session.token,session.generation]);

  async function run(action: () => Promise<void>) {
    if(!scopeCurrent())return;setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { if(scopeCurrent())setError((e as Error).message); } finally { if(scopeCurrent())setBusy(false); }
  }
  // Route-scoped cleanup runs only after navigation is accepted, never on Cancel.
  function back() { setParams({}); }
  function change(key: number, value: Partial<PendingImage>) { setQueue(current => current.map(item => item.key === key ? { ...item, ...value } : item)); }
  async function choose(files: FileList | null) {
    if (!files) return;
    const epoch = selectionEpoch.current;
    const originals = Array.from(files);
    if (fileInput.current) fileInput.current.value = '';
    setPreparing(true);
    const additions: PendingImage[] = [];
    for (const original of originals) {
      let file = original; let error: string | undefined;
      try { file = await prepareImageUpload(original); }
      catch (failure) { error = t(failure instanceof Error ? failure.message : 'gallery.invalid'); }
      if (epoch !== selectionEpoch.current) {
        additions.forEach(item => { URL.revokeObjectURL(item.preview); urls.current.delete(item.preview); });
        return;
      }
      const preview = URL.createObjectURL(file); urls.current.add(preview);
      additions.push({key:nextKey.current++,file,preview,facts:{name:original.name.replace(/\.[^.]+$/, '').slice(0,200)},status:error?'failed':'waiting',error});
    }
    setQueue(current => [...current,...additions]); setPreparing(false);
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
          current = result.detail; if(!setDetail(current))return;
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
    if(!setDetail(saved,true))throw Error(t('article.revision_newer_response'));return saved;
  }
  async function publish() {
    await run(async () => {
      const saved = dirty ? await save() : detail;
      if (!saved) return;
      if(setDetail(await api.publish(saved.post.id, saved.post.version, true),true))setNotice(t('rec.published'));
    });
  }
  if (loading||editor.actorKey!==session.actorKey) return <div className="rec-loading"><Spin /></div>;
  return <div className={'recommendations' + (detail ? ' rec-editing' : ' rec-managing')}>
    <Modal open={navigation.state==='blocked'} title={t('rec.leave')} okText={t('article.leave_discard')} cancelText={t('article.leave_stay')}
      onOk={()=>{if(navigation.state==='blocked')navigation.proceed();}} onCancel={()=>{if(navigation.state==='blocked')navigation.reset();}} />
    <header className="rec-heading"><div><h1>{t('rec.title')}</h1>{detail && <Tag color={published ? 'green' : undefined}>{t(published ? 'rec.published' : 'rec.draft')}{dirty ? ' *' : ''}</Tag>}</div>
      {!id && <div className="rec-action-group"><Button onClick={()=>setServiceOpen(true)}>{t('service.kind')}</Button><Button type="primary" icon={<PlusOutlined />} loading={busy} onClick={() => void run(async () => { const post = await api.create(); setParams({ post: String(post.post.id) }); })}>{t('rec.new')}</Button></div>}
    </header>
    {error && <Alert type="error" showIcon message={error} action={<Button aria-label={t('rec.reload')} icon={<ReloadOutlined aria-hidden/>} onClick={() => void run(async () => {
      if (id) { const value = await api.get(id); setDetail(value); }
      else setList(await api.list(page));
    })}>{t('rec.reload')}</Button>} />}
    {notice && <Alert type="success" showIcon message={notice} />}
    {!id ? <><RecommendationList posts={list} hasError={!!error} pending={busy} />
      <div className="rec-pagination"><Button disabled={!page} icon={<ArrowLeftOutlined />} onClick={() => setPage(page - 1)}>{t('rec.previous')}</Button><span>{page + 1}</span><Button disabled={list.length < 20} onClick={() => setPage(page + 1)}>{t('rec.next')}</Button></div></> : detail && <>
      <div className="rec-actions"><Button aria-label={t('rec.back')} disabled={busy || writing} icon={<ArrowLeftOutlined />} onClick={back}>{t('rec.back')}</Button>
        <div className="rec-action-group">{published ? <><Link to={'/recommendations/' + id} target="_blank"><Button icon={<EyeOutlined />}>{t('rec.view')}</Button></Link><Button icon={<EditOutlined />} disabled={busy||articlePending||dirty} onClick={() => void run(async () => { setDetail(await api.publish(id, detail.post.version, false)); })}>{t('rec.withdraw')}</Button></> : <>
          {detail.serviceOffer?<Button onClick={()=>setServiceOpen(true)}>{t('service.edit')}</Button>:<Button icon={<SaveOutlined />} loading={busy} disabled={writing||articlePending} onClick={() => void run(async () => { await save(); setNotice(t('rec.saved')); })}>{t('rec.save')}</Button>}
          <Button type="primary" icon={<SendOutlined />} disabled={busy || writing || pending || (!detail.serviceOffer&&!detail.items.length) || !title.trim() || !body.trim()} onClick={() => void publish()}>{t('rec.publish')}</Button></>}
        </div></div>
      {detail.post.publishedAt && <div className="rec-publication rec-publication-editor"><span>{t('rec.publisher')}: {detail.post.publisherName}</span><time dateTime={detail.post.publishedAt}>{t('rec.published_date')}: {new Date(detail.post.publishedAt).toLocaleString(locale)}</time></div>}
      <RecommendationIssueDatePanel post={detail.post} disabled={busy||writing||preparing||classificationPending||fromProductPending||articlePending||serviceOpen}
        onPendingChange={value=>{if(activePostId.current===detail.post.id)setIssueDatePending(value);}}
        onVersionConflict={()=>{if(activePostId.current===detail.post.id)setError(t('issueDate.parentConflict'));}}
        onSaved={(value,expectedVersion)=>{if(activePostId.current!==detail.post.id)return;const current=editorRef.current.detail;
          if(current){const next=applyRecommendationIssueDate(current,detail.post.id,expectedVersion,value);if(next)setDetail(next);}}}/>
      <div className="rec-editor-layout"><section className="rec-article"><h2>{t('rec.article')}</h2>{detail.serviceOffer?<div className="rec-public-body"><Tag>{t('service.kind')}</Tag>{body.split(/\n\s*\n/).map((p,i)=><p key={i}>{p}</p>)}</div>:<ArticleLanguages key={detail.post.id} detail={detail} title={title} body={body} sourceDirty={dirty} disabled={busy} onTitle={setTitle} onBody={setBody} onChanged={next=>setDetail(next,true)} onPending={setArticlePending}/>}
        {published && <div className="rec-public-link"><Link to={'/recommendations/' + id}>{t('rec.view')}</Link><Tooltip title={t('rec.copy')}><Button icon={<CopyOutlined />} aria-label={t('rec.copy')} onClick={() => void run(async () => { await navigator.clipboard.writeText(location.origin + '/recommendations/' + id); setNotice(t('rec.copied')); })} /></Tooltip></div>}
      </section></div>
      {!published && !detail.serviceOffer && <section className="rec-uploads"><div className="rec-section-heading"><h2>{t('rec.uploads')}</h2><div className="rec-action-group"><input ref={fileInput} type="file" multiple accept={IMAGE_UPLOAD_ACCEPT} hidden disabled={preparing} onChange={e => void choose(e.target.files)} /><Button icon={<PlusOutlined />} loading={preparing} disabled={busy || writing || preparing} onClick={() => fileInput.current?.click()}>{t('rec.choose')}</Button><Button icon={<UploadOutlined />} disabled={busy || writing || preparing || !pending} onClick={() => void upload(queue)}>{t('rec.register_all')}</Button></div></div>
        <p>{t('gallery.format_hint')}</p>
        <p>{t('rec.batch_help')}</p><label htmlFor="rec-batch">{t('rec.batch_label')}</label><Input.TextArea id="rec-batch" rows={5} value={batch} onChange={e => setBatch(e.target.value)} disabled={busy} />
        <Button disabled={busy || !batch.trim()} onClick={() => { try {
          const rows = parseBatch(batch);
          const additions = rows.map(row => { const fileEntry = row.fileName ? queue.find(entry => entry.file?.name === row.fileName && entry.status !== 'done') : undefined;
            if (!row.imageUrl && !fileEntry) throw new Error(t('rec.batch_image')+': '+row.fileName);
            const facts = Object.fromEntries(factFields.map(key => [key,row[key] ?? null])) as unknown as RecommendationFacts;
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
      {!detail.serviceOffer&&<><RecommendationFromProduct detail={detail} onChange={setDetail} onPendingChange={setFromProductPending}/>
      <RecommendationClassification detail={detail} onChanged={setDetail} onPendingChange={setClassificationPending} />
      <RecommendationCatalog detail={detail} onChange={setDetail}/>
      <RecommendationLocalization detail={detail} onChange={setDetail}/>
      <RecommendationGallery detail={detail} onChange={setDetail}/></>}
      <Button icon={<EyeOutlined />} onClick={() => setPreview(value => !value)}>{t('rec.draft_preview')}</Button>
      {preview && <RecommendationPreview key={detail.post.id} detail={{...detail,post:{...detail.post,title},body}}/>}
      {!detail.serviceOffer&&<section className="rec-linked"><div className="rec-section-heading"><h2>{t('rec.products')} <span>({detail.items.length})</span></h2></div><div className="rec-product-grid">{detail.items.slice((itemPage - 1) * 12, itemPage * 12).map(item => <article key={item.id} className="rec-product"><img src={item.imageUrl} alt={item.name} /><div><h3>{item.name}</h3><small>{item.itemNumber}</small><OfferInfo facts={item} /><ReferenceQuoteHistory post={id} item={item.id}/>
        {editingItem === item.id && <>{item.catalogDriven&&<Alert type="info" message={t('master.use_profile')}/>}<FactsForm facts={editFacts} onChange={setEditFacts} disabled={busy} identityReadOnly={item.catalogDriven}/><Button loading={busy} onClick={() => void run(async () => { const error = factsError(editFacts); if(error) throw new Error(t(error)); setDetail(await api.editItem(id,item.id,editFacts,detail.post.version)); setEditingItem(undefined); })}>{t('rec.save_item')}</Button><Button onClick={() => setEditingItem(undefined)}>{t('rec.cancel_edit')}</Button></>}
        </div>{!published && <div><Button aria-label={t('rec.edit_item')+': '+item.name} icon={<EditOutlined />} disabled={busy || writing} onClick={() => {setEditingItem(item.id);setEditFacts({...Object.fromEntries(factFields.map(key => [key,({...item,...item.sourceFacts})[key] ?? null])),referenceContext:item.referenceContext} as RecommendationFacts);}} />
        <Tooltip title={t('rec.unlink')}><Button aria-label={t('rec.unlink')} icon={<DeleteOutlined />} disabled={busy || writing} onClick={() => void run(async () => { const next = await api.remove(id, item.id, detail.post.version); setDetail(next); setSelected(ids => ids.filter(key => next.items.some(value => identity(value) === key))); setItemPage(1); })} /></Tooltip></div>}</article>)}</div>
        {!detail.items.length && <Empty description={t('rec.no_products')} />}{detail.items.length > 12 && <Pagination current={itemPage} pageSize={12} total={detail.items.length} showSizeChanger={false} onChange={setItemPage} />}
      </section>}
    </>}
    {serviceOpen&&<RecommendationServiceEditor key={detail?.post.id??'new-service'} detail={detail?.serviceOffer?detail:undefined} onClose={()=>setServiceOpen(false)} onSaved={next=>{setServiceOpen(false);setDetail(next,true);if(!id)setParams({post:String(next.post.id)});}}/>}
  </div>;
}
