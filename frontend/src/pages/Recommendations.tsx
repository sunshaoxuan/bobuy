import RecommendationList from '../components/RecommendationList';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Input, Modal, Pagination, Spin, Tag, Tooltip } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SendOutlined, UploadOutlined } from '@ant-design/icons';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { recommendationApi as api, type RecommendationDetail, type RecommendationSummary, type RecommendationFacts, type RecommendationItem, type RecommendationPublicationInput } from '../api';
import {getStoredAccessToken,getStoredUser,subscribeToAuthChanges} from '../authStorage';
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
const publicationIdentity=()=>JSON.stringify([getStoredUser()?.id,getStoredUser()?.roles,getStoredAccessToken()]);
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
  const [publicationReviews,setPublicationReviews]=useState<Record<number,string>>({});
  const [publicationRetries,setPublicationRetries]=useState<Set<number>>(new Set());
  const [publicationConflicts,setPublicationConflicts]=useState<Set<number>>(new Set());
  const [authEpoch,setAuthEpoch]=useState(0);
  const publicationAttempts=useRef(new Map<number,RecommendationPublicationInput>()),publicationInFlight=useRef(false),currentPost=useRef(id);
  currentPost.current=id;
  const urls = useRef(new Set<string>());
  const nextKey = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = !!detail && (title !== detail.post.title || body !== detail.body);
  const published = detail?.post.published;
  const isItemPublic=(item:RecommendationItem)=>item.publicationState?item.publicationState==='PUBLISHED':!!detail?.post.published;
  const publicationSignature=(item:RecommendationItem)=>JSON.stringify([detail?.post.id,detail?.post.version,item.publicationReviewHash,item.publicationProductVersion]);
  const publicationReady=(item:RecommendationItem)=>!!item.publicationReviewHash&&/^[0-9a-f]{64}$/.test(item.publicationReviewHash)&&Number.isSafeInteger(item.publicationProductVersion)&&(item.publicationProductVersion??-1)>=0;
  const editableDetail=detail?{...detail,items:detail.items.filter(item=>!isItemPublic(item))}:undefined;
  const publicationBlocked=busy||writing||preparing||editingItem!==undefined||!!batch.trim()||classificationPending||fromProductPending||articlePending||issueDatePending||serviceOpen||dirty||!title.trim()||!body.trim();
  useEffect(()=>{let prior=publicationIdentity();return subscribeToAuthChanges(()=>{const next=publicationIdentity();if(next!==prior){prior=next;selectionEpoch.current++;setAuthEpoch(value=>value+1);}});},[]);
  const identity = (item: RecommendationDetail['items'][number]) => item.productId || 'recommendation:'+item.id;
  function receiveProductDetail(next:RecommendationDetail){
    const current=editorRef.current.detail;return current&&currentPost.current===next.post.id&&current.post.id===next.post.id&&Number.isSafeInteger(next.post.version)&&next.post.version>=current.post.version?setDetail(next):false;
  }
  const products = [...new Map(detail?.items.map(item => [identity(item), item])).values()];
  const pending = preparing || queue.some(item => item.status !== 'done') || editingItem !== undefined || !!batch.trim() || classificationPending || fromProductPending||articlePending||issueDatePending||serviceOpen||publicationRetries.size>0||publicationConflicts.size>0;
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
    if(reset){selectionEpoch.current++;setPreparing(false);urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();setQueue([]);setQueuePage(1);setItemPage(1);setGenerated('');setPrompt('');setEditingItem(undefined);setBatch('');setPreview(false);setClassificationPending(false);setArticlePending(false);setIssueDatePending(false);setFromProductPending(false);setBusy(false);setWriting(false);setList([]);setLoading(true);setDetail(undefined);setPublicationReviews({});setPublicationRetries(new Set());setPublicationConflicts(new Set());publicationAttempts.current.clear();publicationInFlight.current=false;}
    if(!reset){selectionEpoch.current++;publicationInFlight.current=false;setPublicationReviews({});setBusy(false);setWriting(false);}setError('');setNotice('');
    const request=id?api.get(id):api.list(page);
    void request.then(value=>{if(!active||!scopeCurrent())return;if(Array.isArray(value))setList(value);else if(setDetail(value))setSelected([...new Set(value.items.map(identity))]);}).catch(e=>{if(active&&scopeCurrent())setError((e as Error).message);}).finally(()=>{if(active&&scopeCurrent())setLoading(false);});
    return()=>{active=false;};
  }, [id,page,session.actorKey,session.token,session.generation,authEpoch]);

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
  async function publishItem(item:RecommendationItem){
    if(!detail||publicationBlocked||publicationInFlight.current||publicationConflicts.has(item.id)||isItemPublic(item))return;
    const ready=publicationReady(item);
    if(!ready||(!publicationRetries.has(item.id)&&publicationReviews[item.id]!==publicationSignature(item)))return;
    const postId=detail.post.id,epoch=selectionEpoch.current,owner=publicationIdentity();
    const isCurrent=()=>currentPost.current===postId&&epoch===selectionEpoch.current&&owner===publicationIdentity();
    const prior=publicationAttempts.current.get(item.id);
    if(prior&&(prior.version!==detail.post.version||prior.sourceHash!==item.publicationReviewHash||prior.productVersion!==item.publicationProductVersion)){
      setPublicationConflicts(values=>new Set([...values,item.id]));setError(t('rec.item.conflict'));return;
    }
    const input=prior??{requestId:crypto.randomUUID(),version:detail.post.version,productVersion:item.publicationProductVersion!,sourceHash:item.publicationReviewHash!,reviewed:true as const};
    publicationAttempts.current.set(item.id,input);publicationInFlight.current=true;setBusy(true);setError('');setNotice('');
    try{
      const next=await api.publishItem(postId,item.id,input);
      if(next.post.id!==postId||next.post.published!==true||!Number.isSafeInteger(next.post.version)||next.post.version<input.version||!next.items.some(value=>value.id===item.id&&value.publicationState==='PUBLISHED'))throw new Error(t('rec.item.unconfirmed'));
      if(isCurrent()){
        if(!setDetail(next)){setError(t('rec.item.conflict'));return;}setNotice(t('rec.item.published_notice'));publicationAttempts.current.delete(item.id);
        setPublicationRetries(values=>{const next=new Set(values);next.delete(item.id);return next;});setPublicationReviews({});
      }
    }catch(e){if(isCurrent()){
      const status=(e as {status?:number}).status;
      if(status===409){setPublicationConflicts(values=>new Set([...values,item.id]));setError(t('rec.item.conflict'));}
      else{setError((e as Error).message);if(status===undefined||status>=500)setPublicationRetries(values=>new Set([...values,item.id]));else{publicationAttempts.current.delete(item.id);setPublicationReviews({});}}
    }}finally{if(isCurrent()){publicationInFlight.current=false;setBusy(false);}}
  }
  async function reloadLatest(){
    const postId=id,epoch=selectionEpoch.current,owner=publicationIdentity();
    await run(async()=>{
      if(postId){const value=await api.get(postId);if(epoch!==selectionEpoch.current||owner!==publicationIdentity()||currentPost.current!==postId)return;if(!setDetail(value))return;publicationAttempts.current.clear();setPublicationReviews({});setPublicationRetries(new Set());setPublicationConflicts(new Set());}
      else setList(await api.list(page));
    });
  }
  if (loading||editor.actorKey!==session.actorKey) return <div className="rec-loading"><Spin /></div>;
  return <div className={'recommendations' + (detail ? ' rec-editing' : ' rec-managing')}>
    <Modal open={navigation.state==='blocked'} title={t('rec.leave')} okText={t('article.leave_discard')} cancelText={t('article.leave_stay')}
      onOk={()=>{if(navigation.state==='blocked')navigation.proceed();}} onCancel={()=>{if(navigation.state==='blocked')navigation.reset();}} />
    <header className="rec-heading"><div><h1>{t('rec.title')}</h1>{detail && <Tag color={published ? 'green' : undefined}>{t(published ? 'rec.published' : 'rec.draft')}{dirty ? ' *' : ''}</Tag>}</div>
      {!id && <div className="rec-action-group"><Button onClick={()=>setServiceOpen(true)}>{t('service.kind')}</Button><Button type="primary" icon={<PlusOutlined />} loading={busy} onClick={() => void run(async () => { const post = await api.create(); setParams({ post: String(post.post.id) }); })}>{t('rec.new')}</Button></div>}
    </header>
    {error && <Alert type="error" showIcon message={error} action={<Button aria-label={t('rec.reload')} disabled={busy} icon={<ReloadOutlined aria-hidden/>} onClick={()=>void reloadLatest()}>{t('rec.reload')}</Button>} />}
    {notice && <Alert type="success" showIcon message={notice} />}
    {!id ? <><RecommendationList posts={list} hasError={!!error} pending={busy} />
      <div className="rec-pagination"><Button disabled={!page} icon={<ArrowLeftOutlined />} onClick={() => setPage(page - 1)}>{t('rec.previous')}</Button><span>{page + 1}</span><Button disabled={list.length < 20} onClick={() => setPage(page + 1)}>{t('rec.next')}</Button></div></> : detail && <>
      <div className="rec-actions"><Button aria-label={t('rec.back')} disabled={busy || writing} icon={<ArrowLeftOutlined />} onClick={back}>{t('rec.back')}</Button>
        <div className="rec-action-group">{published ? <><Link to={'/recommendations/' + id} target="_blank"><Button icon={<EyeOutlined />}>{t('rec.view')}</Button></Link>{detail.serviceOffer&&<Button icon={<EditOutlined />} disabled={busy||articlePending||issueDatePending||dirty} onClick={() => void run(async () => { setDetail(await api.publish(id, detail.post.version, false)); })}>{t('rec.withdraw')}</Button>}</> : <>
          {detail.serviceOffer?<Button onClick={()=>setServiceOpen(true)}>{t('service.edit')}</Button>:<Button icon={<SaveOutlined />} loading={busy} disabled={writing||articlePending} onClick={() => void run(async () => { await save(); setNotice(t('rec.saved')); })}>{t('rec.save')}</Button>}
          {detail.serviceOffer&&<Button type="primary" icon={<SendOutlined />} disabled={busy || writing || pending || !title.trim() || !body.trim()} onClick={() => void publish()}>{t('rec.publish')}</Button>}</>}
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
      {!detail.serviceOffer && <section className="rec-uploads"><div className="rec-section-heading"><h2>{t('rec.uploads')}</h2><div className="rec-action-group"><input ref={fileInput} type="file" multiple accept={IMAGE_UPLOAD_ACCEPT} hidden disabled={preparing} onChange={e => void choose(e.target.files)} /><Button icon={<PlusOutlined />} loading={preparing} disabled={busy || writing || preparing} onClick={() => fileInput.current?.click()}>{t('rec.choose')}</Button><Button icon={<UploadOutlined />} disabled={busy || writing || preparing || !pending} onClick={() => void upload(queue)}>{t('rec.register_all')}</Button></div></div>
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
      {!detail.serviceOffer&&<><RecommendationFromProduct detail={detail} onChange={receiveProductDetail} onPendingChange={setFromProductPending}/>
      {!!editableDetail?.items.length&&<><RecommendationClassification detail={editableDetail} onChanged={setDetail} onPendingChange={setClassificationPending} />
      <RecommendationCatalog detail={editableDetail} onChange={setDetail}/>
      <RecommendationLocalization detail={editableDetail} onChange={setDetail}/>
      <RecommendationGallery detail={editableDetail} onChange={setDetail}/></>}</>}
      <Button icon={<EyeOutlined />} onClick={() => setPreview(value => !value)}>{t('rec.draft_preview')}</Button>
      {preview && <RecommendationPreview key={detail.post.id} detail={{...detail,post:{...detail.post,title},body}}/>}
      {!detail.serviceOffer&&<><Alert type="info" message={t(published?'rec.item.append_hint':'rec.item.first_hint')} />{dirty&&<Alert type="warning" message={t('rec.item.save_article')}/>}<section className="rec-linked"><div className="rec-section-heading"><h2>{t('rec.products')} <span>({detail.items.length})</span></h2></div><div className="rec-product-grid">{detail.items.slice((itemPage - 1) * 12, itemPage * 12).map(item => <article key={item.id} className="rec-product"><img src={item.imageUrl} alt={item.name} /><div><h3>{item.name}</h3><small>{item.itemNumber}</small><OfferInfo facts={item} /><ReferenceQuoteHistory post={id} item={item.id}/>
        <Tag color={isItemPublic(item)?'green':'orange'}>{t(isItemPublic(item)?'rec.item.public':'rec.item.pending')}</Tag>
        {!isItemPublic(item)&&<div className="rec-item-publication">
          {!publicationReady(item)?<Alert type="warning" message={t('rec.item.not_ready')}/>:<small>{t('rec.item.catalog_version',{version:item.publicationProductVersion!})}</small>}
          <Checkbox aria-label={t('rec.item.review')+': '+item.name} disabled={publicationBlocked||publicationRetries.has(item.id)||publicationConflicts.has(item.id)} checked={publicationReviews[item.id]===publicationSignature(item)} onChange={e=>setPublicationReviews(values=>({...values,[item.id]:e.target.checked?publicationSignature(item):''}))}>{t('rec.item.review')}</Checkbox>
          <Button type="primary" icon={<SendOutlined/>} aria-label={t(publicationRetries.has(item.id)?'rec.item.retry':'rec.item.publish')+': '+item.name} disabled={publicationBlocked||publicationConflicts.has(item.id)||!publicationReady(item)||(!publicationRetries.has(item.id)&&publicationReviews[item.id]!==publicationSignature(item))} onClick={()=>void publishItem(item)}>{t(publicationRetries.has(item.id)?'rec.item.retry':'rec.item.publish')}</Button>
          {publicationConflicts.has(item.id)&&<Alert type="warning" message={t('rec.item.conflict')}/>}
        </div>}
        {editingItem === item.id && !isItemPublic(item) && <>{item.catalogDriven&&<Alert type="info" message={t('master.use_profile')}/>}<FactsForm facts={editFacts} onChange={setEditFacts} disabled={busy} identityReadOnly={item.catalogDriven}/><Button loading={busy} onClick={() => void run(async () => { const error = factsError(editFacts); if(error) throw new Error(t(error)); setDetail(await api.editItem(id,item.id,editFacts,detail.post.version)); setEditingItem(undefined); })}>{t('rec.save_item')}</Button><Button onClick={() => setEditingItem(undefined)}>{t('rec.cancel_edit')}</Button></>}
        </div>{!isItemPublic(item) && <div><Button aria-label={t('rec.edit_item')+': '+item.name} icon={<EditOutlined />} disabled={busy || writing} onClick={() => {setEditingItem(item.id);setEditFacts({...Object.fromEntries(factFields.map(key => [key,({...item,...item.sourceFacts})[key] ?? null])),referenceContext:item.referenceContext} as RecommendationFacts);}} />
        <Tooltip title={t('rec.unlink')}><Button aria-label={t('rec.unlink')} icon={<DeleteOutlined />} disabled={busy || writing} onClick={() => void run(async () => { const next = await api.remove(id, item.id, detail.post.version); setDetail(next); setSelected(ids => ids.filter(key => next.items.some(value => identity(value) === key))); setItemPage(1); })} /></Tooltip></div>}</article>)}</div>
        {!detail.items.length && <Empty description={t('rec.no_products')} />}{detail.items.length > 12 && <Pagination current={itemPage} pageSize={12} total={detail.items.length} showSizeChanger={false} onChange={setItemPage} />}
      </section></>}
    </>}
    {serviceOpen&&<RecommendationServiceEditor key={detail?.post.id??'new-service'} detail={detail?.serviceOffer?detail:undefined} onClose={()=>setServiceOpen(false)} onSaved={next=>{setServiceOpen(false);setDetail(next,true);if(!id)setParams({post:String(next.post.id)});}}/>}
  </div>;
}
