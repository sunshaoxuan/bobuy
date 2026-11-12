import ProductReviewEditor from './ProductRating';
import {useEffect,useRef,useState,useMemo} from 'react';
import {Alert,Button,Checkbox,Drawer,Input,Select,Table,Tabs,Grid,Modal,Segmented,Tag,type InputRef} from 'antd';
import {productCatalogApi,recommendationTaxonomyApi,type CatalogInput,type CatalogMedia,type CatalogProposal,type RecommendationChoice} from '../api';
import {localizedContent,useI18n} from '../i18n';
import {PictureOutlined,UploadOutlined,CheckCircleOutlined,ArrowLeftOutlined,ArrowRightOutlined,DeleteOutlined,StarOutlined} from '@ant-design/icons';
import './productCatalog.css';
import {ImageLightbox} from './ImageLightbox';
import CatalogCategorySelect from './CatalogCategorySelect';
import {IMAGE_UPLOAD_ACCEPT,copyFileList,imageUploadSha256,prepareImageUpload,validCatalogImageSource} from '../imageUpload';
import {getStoredAccessToken,getStoredUser,getTestInjectedRole,getTestInjectedUser,subscribeToAuthChanges} from '../authStorage';

const languages=[{key:'ja-JP',label:'日本語'},{key:'zh-CN',label:'简体中文'},{key:'zh-TW',label:'繁體中文'},{key:'en-US',label:'English'}];
type PanelProps={entries:{key:string;name:string}[];id?:string;onChoose:(id?:string)=>void;onSaved:(rows:CatalogInput[],canonical?:boolean)=>void};
type UploadRow={key:number;name:string;status:'waiting'|'uploading'|'success'|'failed';sha256?:string;asset?:CatalogMedia;error?:string;reused?:boolean};
function uploadIdentity(){try{const user=getStoredUser();return JSON.stringify([user?.id??null,[...(user?.roles??[])].sort(),!!getStoredAccessToken(),getTestInjectedRole(),getTestInjectedUser()]);}catch{return 'storage-unavailable';}}
export default function ProductCatalogPanel(props:PanelProps){
 const [,refreshAuth]=useState(0),identity=uploadIdentity();const scope=useRef({id:props.id,identity,generation:0});
 if(scope.current.id!==props.id||scope.current.identity!==identity)scope.current={id:props.id,identity,generation:scope.current.generation+1};
 const expected=scope.current;const currentScope=()=>scope.current===expected&&uploadIdentity()===expected.identity;
 useEffect(()=>subscribeToAuthChanges(()=>{const next=uploadIdentity();if(next!==scope.current.identity)scope.current={...scope.current,identity:next,generation:scope.current.generation+1};refreshAuth(n=>n+1);}),[]);
 return <CatalogEditor key={expected.generation} {...props} currentScope={currentScope} onSaved={(rows,canonical)=>{if(currentScope())props.onSaved(rows,canonical);}}/>;
}
function CatalogEditor({entries,id,onChoose,onSaved,currentScope}:PanelProps&{currentScope:()=>boolean}){
 const {t,locale}=useI18n();const [draft,setDraft]=useState<CatalogInput>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false),[canonical,setCanonical]=useState(false);
 const [options,setOptions]=useState<{categories:RecommendationChoice[];suppliers:RecommendationChoice[]}>({categories:[],suppliers:[]});
 const [audit,setAudit]=useState('');
 const [recoveryId,setRecoveryId]=useState<string>(),[restoreOpen,setRestoreOpen]=useState(false),[sourceItems,setSourceItems]=useState<number[]>([]);
 const [bulk,setBulk]=useState(false),[json,setJson]=useState(''),[rows,setRows]=useState<CatalogProposal[]>([]),[validated,setValidated]=useState(false),[selected,setSelected]=useState<React.Key[]>([]);
 const [source,setSource]=useState(''),[imageReviewed,setImageReviewed]=useState(false);const fileInput=useRef<HTMLInputElement>(null);
 const [uploads,setUploads]=useState<UploadRow[]>([]);const uploadSequence=useRef(0),uploadedAssets=useRef(new Map<string,CatalogMedia>()),savedGallery=useRef<CatalogMedia[]>([]);
 const mounted=useRef(true),operation=useRef(0),uploadPending=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operation.current++;};},[]);
 function beginOperation(){const ticket=++operation.current;return()=>mounted.current&&currentScope()&&operation.current===ticket;}
 const sameAsset=(a:CatalogMedia,b:CatalogMedia)=>a.url===b.url||!!(a.sha256&&b.sha256&&a.sha256===b.sha256);
 const [activeImage,setActiveImage]=useState(0),[imageOpen,setImageOpen]=useState(false);const imageOpener=useRef<HTMLButtonElement>(null);
 const previewPictures=useMemo(()=>draft?.gallery.map(p=>({id:p.sha256||p.url,url:p.url,label:localizedContent(p.title??{},locale)}))??[],[draft?.gallery,locale]);
 useEffect(()=>setImageOpen(false),[id]);
 const narrow=Grid.useBreakpoint().md===false;
 const [editorTab,setEditorTab]=useState('identity'),[language,setLanguage]=useState('ja-JP');const nameInput=useRef<InputRef>(null);
 const [sheetHeight,setSheetHeight]=useState<number|string>('80dvh'),[discardOpen,setDiscardOpen]=useState(false);
 const savedValue=useRef<string>(),sheetHistory=useRef<{key:string;armed:boolean}>(),closeRef=useRef<()=>void>(()=>{});
 const [ratingDirty,setRatingDirty]=useState(false),[ratingBusy,setRatingBusy]=useState(false);
 const dirty=ratingDirty||!!draft&&JSON.stringify(draft)!==savedValue.current;
 function closeEditor(){if(busy||ratingBusy){keepEditing();return;}if(dirty)setDiscardOpen(true);else onChoose(undefined);}
 closeRef.current=closeEditor;
 useEffect(()=>{if(!narrow)return;const update=()=>setSheetHeight(window.visualViewport?Math.round(window.visualViewport.height*.8):'80dvh');update();window.visualViewport?.addEventListener('resize',update);window.addEventListener('resize',update);return()=>{window.visualViewport?.removeEventListener('resize',update);window.removeEventListener('resize',update);};},[narrow]);
 useEffect(()=>{if(!id||!narrow)return;const entry={key:'catalog-'+id+'-'+Date.now(),armed:true};sheetHistory.current=entry;window.history.pushState({...window.history.state,bobuyCatalogSheet:entry.key},'',window.location.href);const back=()=>{if(entry.armed&&window.history.state?.bobuyCatalogSheet!==entry.key){entry.armed=false;closeRef.current();}};window.addEventListener('popstate',back);return()=>{window.removeEventListener('popstate',back);if(entry.armed&&window.history.state?.bobuyCatalogSheet===entry.key)window.history.back();sheetHistory.current=undefined;};},[id,narrow]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 function keepEditing(){setDiscardOpen(false);const entry=sheetHistory.current;if(entry&&!entry.armed){window.history.pushState({...window.history.state,bobuyCatalogSheet:entry.key},'',window.location.href);entry.armed=true;}}
 useEffect(()=>{if(!id)return;let active=true;const current=beginOperation();setBusy(true);setActiveImage(0);setEditorTab('identity');setLanguage('ja-JP');setDraft(undefined);setRecoveryId(undefined);setRestoreOpen(false);setSourceItems([]);setError('');setReviewed(false);void Promise.all([productCatalogApi.get(id),recommendationTaxonomyApi.options()]).then(([profile,choices])=>{if(active&&current()){savedValue.current=JSON.stringify(profile.value);savedGallery.current=profile.value.gallery;setDraft(profile.value);setCanonical(profile.canonical);setRecoveryId(profile.recoveryId);setSourceItems(profile.sourceItemIds??[]);setOptions(choices);}}).catch(e=>{if(active&&current())setError(e.message);}).finally(()=>{if(active&&current())setBusy(false);});return()=>{active=false;};},[id]);
 function patch(value:Partial<CatalogInput>){setDraft(prior=>prior?{...prior,...value}:prior);setReviewed(false);setError('');}
 function text(field:'name'|'description'|'specification',language:string,value:string){if(draft)patch({[field]:{...draft[field],[language]:value}});}
 function validDraft(){if(!draft)return false;if(!draft.name['ja-JP']?.trim()){setEditorTab('copy');setLanguage('ja-JP');setError('master.japanese_required');return false;}for(const [key,value] of Object.entries(draft.name)){if(value.length>400||(key!=='ja-JP'&&value.endsWith('（'+draft.name['ja-JP']+'）'))){setEditorTab('copy');setLanguage(key);setError(value.length>400?'master.invalid':'master.pure_name');return false;}}for(let index=0;index<draft.gallery.length;index++){try{const url=new URL(draft.gallery[index].sourceUrl??'');if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.href.length>2048)throw Error();}catch{setEditorTab('media');setActiveImage(index);setError('master.image_source');return false;}}return true;}
 useEffect(()=>{if(error&&editorTab==='copy')nameInput.current?.focus();},[error,editorTab,language]);
 async function saveOne(){if(busy||ratingBusy||!draft||!reviewed||!validDraft())return;const current=beginOperation(),submitted=draft;setBusy(true);setError('');try{await productCatalogApi.preview([submitted]);if(!current())return;const result=await productCatalogApi.save([submitted]);if(!current())return;savedValue.current=JSON.stringify(result[0].value);savedGallery.current=result[0].value.gallery;setDraft(result[0].value);setCanonical(true);setRecoveryId(result[0].recoveryId);setSourceItems(result[0].sourceItemIds??[]);setReviewed(false);onSaved(result.map(row=>row.value));}catch(e){if(current())setError((e as Error).message);}finally{if(current())setBusy(false);}}
 async function suggestions(){if(busy)return;const current=beginOperation();setBusy(true);setError('');setReviewed(false);setValidated(false);try{const proposals=(await productCatalogApi.proposals()).filter(row=>row.changes.length>0);if(!current())return;setRows(proposals);setJson(JSON.stringify(proposals.map(row=>row.value),null,2));setSelected(proposals.map(row=>row.value.productId));}catch(e){if(current())setError((e as Error).message);}finally{if(current())setBusy(false);}}
 async function preview(){if(busy)return;const current=beginOperation();setBusy(true);setError('');setReviewed(false);try{const values:CatalogInput[]=JSON.parse(json);if(!Array.isArray(values)||!values.length||values.length>500)throw Error(t('master.invalid'));const results=await productCatalogApi.preview(values);if(!current())return;setRows(results.map(row=>({...row,warnings:rows.find(old=>old.value.productId===row.value.productId)?.warnings??[]})));setSelected(prior=>prior.filter(key=>values.some(value=>value.productId===key)));setValidated(true);}catch(e){if(current()){setError((e as Error).message);setValidated(false);}}finally{if(current())setBusy(false);}}
 async function restoreOne(){if(!draft||!recoveryId||dirty)return;const active=beginOperation();setBusy(true);setError('');try{const result=await productCatalogApi.restore(draft.productId,recoveryId,draft.version);if(!active())return;savedValue.current=JSON.stringify(result.value);savedGallery.current=result.value.gallery;setDraft(result.value);setCanonical(result.canonical);setRecoveryId(result.recoveryId);setSourceItems(result.sourceItemIds??[]);setReviewed(false);setRestoreOpen(false);onSaved([result.value],result.canonical);}catch(e){if(!active())return;setError((e as Error).message);try{const current=await productCatalogApi.get(draft.productId);if(!active())return;savedValue.current=JSON.stringify(current.value);savedGallery.current=current.value.gallery;setDraft(current.value);setCanonical(current.canonical);setRecoveryId(current.recoveryId);setSourceItems(current.sourceItemIds??[]);setRestoreOpen(false);onSaved([current.value],current.canonical);}catch{/* Preserve the original error and checkpoint; never resubmit automatically. */}}finally{if(active())setBusy(false);}}
 async function saveBulk(){if(busy||!validated||!reviewed)return;const current=beginOperation();setBusy(true);setError('');try{const result=await productCatalogApi.save(rows.filter(row=>selected.includes(row.value.productId)).map(row=>row.value));if(!current())return;onSaved(result.map(row=>row.value));const remaining=rows.filter(row=>!result.some(saved=>saved.value.productId===row.value.productId));setValidated(false);setReviewed(false);setRows(remaining);setJson(remaining.length?JSON.stringify(remaining.map(row=>row.value),null,2):'');setSelected([]);}catch(e){if(current())setError((e as Error).message);}finally{if(current())setBusy(false);}}
 async function readAudit(){if(busy)return;const current=beginOperation();setBusy(true);setError('');try{const rows=await productCatalogApi.audit();if(current())setAudit(JSON.stringify(rows,null,2));}catch(e){if(current())setError((e as Error).message);}finally{if(current())setBusy(false);}}
 async function upload(files:File[]){
  if(busy||uploadPending.current||!draft||!imageReviewed||!source||!files.length||!currentScope())return;
  const current=beginOperation(),productId=draft.productId,sourceUrl=source,pictures=[...draft.gallery];
  const batch:UploadRow[]=files.map(file=>({key:++uploadSequence.current,name:file.name,status:'waiting'}));
  const update=(key:number,change:Partial<UploadRow>)=>{if(current())setUploads(prior=>prior.map(row=>row.key===key?{...row,...change}:row));};
  uploadPending.current=true;setBusy(true);setError('');setUploads(prior=>[...prior,...batch]);
  try{
   if(!validCatalogImageSource(sourceUrl)){setError('master.image_source');setUploads(prior=>prior.map(row=>batch.some(item=>item.key===row.key)?{...row,status:'failed',error:'master.image_source'}:row));return;}
   for(let index=0;index<files.length;index++){
    const row=batch[index];if(!current())return;update(row.key,{status:'uploading'});
    try{
     const prepared=await prepareImageUpload(files[index]);if(!current())return;
     const sha256=await imageUploadSha256(prepared);if(!current())return;update(row.key,{sha256});
     const known=uploadedAssets.current.get(sha256)??pictures.find(p=>p.sha256===sha256);
     if(!known&&pictures.length>=100)throw new Error('gallery.invalid');
     const asset=known??await productCatalogApi.upload(productId,prepared,sourceUrl,files[index].name);if(!current())return;
     uploadedAssets.current.set(sha256,asset);if(asset.sha256)uploadedAssets.current.set(asset.sha256,asset);
     if(!pictures.some(p=>sameAsset(p,asset)))pictures.push(asset);
     setDraft(prior=>current()&&prior?.productId===productId?{...prior,gallery:[...pictures]}:prior);setReviewed(false);
     update(row.key,{status:'success',asset,reused:!!known});
    }catch(e){if(current()){const message=(e as Error).message;update(row.key,{status:'failed',error:message});setError(message);}break;}
   }
  }finally{uploadPending.current=false;if(current()){setBusy(false);setImageReviewed(false);}}
 }
 function reorder(index:number,next:number){if(!draft)return;const gallery=[...draft.gallery];const [picture]=gallery.splice(index,1);gallery.splice(next,0,picture);patch({gallery});}
 const warning=(value:string)=>{const [key,detail]=value.split(':');return t(key)+(detail?' · '+detail:'');};
 const cover=draft?.gallery[Math.min(activeImage,(draft?.gallery.length??1)-1)];
 return <section className="product-catalog-panel"><details className="catalog-utility-disclosure" open={!narrow}><summary><div className="catalog-utility-heading"><span className="catalog-utility-icon"><PictureOutlined/></span><div><h2>{t('master.title')}</h2><p>{t('master.hint')}</p></div></div></summary>
  <div className="product-catalog-actions"><Select aria-label={t('master.choose')} showSearch optionFilterProp="label" value={id} placeholder={t('master.choose')} onChange={onChoose} options={entries.map(row=>({value:row.key,label:row.name}))}/><Button onClick={()=>{setBulk(true);setError('');setReviewed(false);}}>{t('master.bulk')}</Button></div></details>
  <Drawer rootClassName={'catalog-editor'+(narrow?' catalog-editor-sheet':'')} title={t('master.title')} placement={narrow?'bottom':'right'} height={narrow?sheetHeight:undefined} width={narrow?undefined:1120} open={!!id} onClose={closeEditor} destroyOnClose footer={draft?<div className="catalog-review-bar"><Checkbox disabled={busy} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}>{t('master.review')}</Checkbox><Button type="primary" loading={busy} disabled={!reviewed||busy} onClick={()=>void saveOne()}>{t('master.save')}</Button>{recoveryId&&<Button disabled={busy||dirty} onClick={()=>setRestoreOpen(true)}>{t('master.restore')}</Button>}</div>:null}>
   {error&&!draft&&<Alert type="error" message={warning(error)}/>}<div className="catalog-state-strip"><CheckCircleOutlined/>{t(canonical?'master.active':'master.not_adopted')}</div>
   {draft&&<fieldset className="product-catalog-form" disabled={busy}>
    <header className="catalog-editor-heading catalog-editor-heading-compact"><h2>{localizedContent(draft.name,locale)}</h2><p>{t('rec.code')}: {draft.itemNumber||t('rec.not_stated')}</p></header>
    <div className="catalog-compact-gallery">
     <button ref={imageOpener} type="button" className="catalog-compact-cover" aria-label={t('gallery.fullscreen')} disabled={!cover||busy} onClick={()=>setImageOpen(true)}>{cover?<img src={cover.url} alt={cover.title?.[locale]||draft.name['ja-JP']}/>:<div className="record-no-image"><PictureOutlined/>{t('gallery.pending')}</div>}</button>
     <div className="catalog-compact-tools"><div className="catalog-filmstrip">{draft.gallery.map((picture,index)=><button key={picture.url} type="button" aria-label={t('products.preview_image',{number:String(index+1)})} aria-pressed={index===Math.min(activeImage,draft.gallery.length-1)} onClick={()=>setActiveImage(index)}><img src={picture.url} alt=""/>{index===0&&<span className="catalog-cover-dot"/>}</button>)}</div>
      <div className="catalog-image-actions"><Button icon={<StarOutlined/>} disabled={!cover||activeImage===0} onClick={()=>{reorder(activeImage,0);setActiveImage(0);}}>{t(activeImage?'gallery.set_main':'gallery.main')}</Button><Button icon={<ArrowLeftOutlined/>} aria-label={t('master.move_up')} disabled={!cover||activeImage===0} onClick={()=>{reorder(activeImage,activeImage-1);setActiveImage(activeImage-1);}}/><Button icon={<ArrowRightOutlined/>} aria-label={t('master.move_down')} disabled={!cover||activeImage>=draft.gallery.length-1} onClick={()=>{reorder(activeImage,activeImage+1);setActiveImage(activeImage+1);}}/><Button danger icon={<DeleteOutlined/>} aria-label={t('store.remove')} disabled={!cover} onClick={()=>{patch({gallery:draft.gallery.filter((_,i)=>i!==activeImage)});setActiveImage(0);}}/><Button icon={<UploadOutlined/>} onClick={()=>setEditorTab('media')}>{t('products.add_images')}</Button></div>
     </div>
    </div>
    <Tabs className="catalog-main-tabs" activeKey={editorTab} onChange={key=>{setEditorTab(key);}} items={[
     {key:'identity',label:t('products.details_tab'),children:<div className="catalog-tab-content">{error&&editorTab==='identity'&&<Alert type="error" message={warning(error)}/>}<div className="catalog-identity-grid">
      <label>{t('rec.code')}<Input maxLength={100} value={draft.itemNumber??''} onChange={e=>patch({itemNumber:e.target.value||null})}/></label>
      <label>{t('stock.item.brand')}<Input maxLength={200} value={draft.brand??''} onChange={e=>patch({brand:e.target.value||null})}/></label>
      <label>{t('master.model')}<Input maxLength={300} value={draft.model??''} onChange={e=>patch({model:e.target.value||null})}/></label>
      <label>{t('master.packaging')}<Input maxLength={1000} value={draft.packaging??''} onChange={e=>patch({packaging:e.target.value||null})}/></label>
      <label>{t('master.categories')}<CatalogCategorySelect key={draft.productId} disabled={busy} choices={options.categories} value={draft.categoryIds} onChange={categoryIds=>patch({categoryIds})}/></label>
      <label>{t('master.supplier')}<Select disabled={busy} aria-label={t('master.supplier')} allowClear value={draft.supplierId??undefined} onChange={supplierId=>patch({supplierId:supplierId??null})} options={options.suppliers.map(c=>({value:c.id,label:localizedContent(c.name,locale)}))}/></label>
     </div><small className="catalog-internal-id">{draft.productId}</small><small>{t('master.version')}: {draft.version}</small><details><summary>{t('master.references')} ({sourceItems.length})</summary><p>{sourceItems.join(', ')||t('rec.not_stated')}</p></details></div>},
     {key:'rating',label:t('review.title'),children:<ProductReviewEditor key={draft.productId} id={draft.productId} onDirtyChange={setRatingDirty} onBusyChange={setRatingBusy}/>},
     {key:'copy',label:t('products.language_copy'),children:<div className="catalog-tab-content">{error&&editorTab==='copy'&&<Alert type="error" message={warning(error)}/>}<Segmented className="catalog-language-switch" aria-label={t('products.language_copy')} value={language} onChange={value=>setLanguage(String(value))} options={languages.map(l=>({value:l.key,label:l.label}))}/><div className="product-catalog-language">
      <label>{t('master.names')}<Input ref={nameInput} maxLength={400} aria-label={t('master.names')+' '+language} aria-invalid={error==='master.japanese_required'&&language==='ja-JP'} value={draft.name[language]??''} onChange={e=>text('name',language,e.target.value)}/></label>
      <label>{t('master.specifications')}<Input.TextArea rows={2} maxLength={1000} value={draft.specification[language]??''} onChange={e=>text('specification',language,e.target.value)}/></label>
      <label>{t('master.descriptions')}<Input.TextArea rows={3} maxLength={8000} value={draft.description[language]??''} onChange={e=>text('description',language,e.target.value)}/></label>
     </div><Checkbox checked={draft.translationsReviewed} onChange={e=>patch({translationsReviewed:e.target.checked})}>{t('master.translations_reviewed')}</Checkbox></div>},
     {key:'media',label:t('products.media_tab'),children:<div className="catalog-tab-content">{error&&editorTab==='media'&&<Alert type="error" message={warning(error)}/>}<p className="catalog-image-guidance">{t('products.original_images')}</p>
      {cover&&<label>{t('gallery.sources')}<Input value={cover.sourceUrl??''} onChange={e=>patch({gallery:draft.gallery.map((p,i)=>i===activeImage?{...p,sourceUrl:e.target.value}:p)})}/></label>}
      <div className="catalog-upload-group"><strong>{t('products.add_images')}</strong><label>{t('gallery.sources')}<Input value={source} onChange={e=>setSource(e.target.value)} placeholder="https://…"/></label><Checkbox checked={imageReviewed} onChange={e=>setImageReviewed(e.target.checked)}>{t('gallery.ack')}</Checkbox>
       <p className="catalog-image-guidance">{t('gallery.format_hint')}</p><input hidden className="catalog-file-input" ref={fileInput} aria-label={t('gallery.files')} type="file" accept={IMAGE_UPLOAD_ACCEPT} multiple disabled={!imageReviewed||!source||busy} onChange={e=>{const input=e.currentTarget,files=copyFileList(input.files);void upload(files).finally(()=>{input.value='';});}}/>
       <Button icon={<UploadOutlined aria-hidden="true"/>} disabled={!imageReviewed||!source||busy} onClick={()=>fileInput.current?.click()}>{t('gallery.files')}</Button><p className="catalog-image-guidance">{t('master.upload_hint')}</p>
       {!!uploads.length&&<div className="catalog-upload-feedback" aria-live="polite" aria-atomic="false"><strong className="catalog-upload-heading">{t('master.upload_status')} ({uploads.length})</strong><ul aria-label={t('master.upload_status')}>{uploads.map(row=>{const saved=!!row.asset&&savedGallery.current.some(p=>sameAsset(p,row.asset!));return <li key={row.key}><div className="catalog-upload-row"><strong className="catalog-upload-filename" title={row.name}>{row.name}</strong><Tag color={row.status==='success'?'success':row.status==='failed'?'error':row.status==='uploading'?'processing':undefined}>{t(row.status==='success'?(saved?'master.upload_saved':row.reused?'master.upload_reused':'master.upload_success'):'master.upload_'+row.status)}</Tag></div><details><summary>{t('master.upload_details')}</summary><div className="catalog-upload-record"><span>{t('master.upload_filename')}: {row.name}</span>{row.error&&<span>{warning(row.error)}</span>}{row.asset&&<><span>{t('master.upload_asset')}</span><code>{row.asset.url}</code><code>{row.sha256}</code></>}</div></details></li>;})}</ul>{uploads.some(row=>row.asset&&draft.gallery.some(p=>sameAsset(p,row.asset!))&&!savedGallery.current.some(p=>sameAsset(p,row.asset!)))&&<p role="status">{t('master.upload_unsaved')}</p>}{uploads.some(row=>row.status==='failed')&&<p>{t('master.upload_retry_hint')}</p>}</div>}
      </div></div>}
    ]}/>
   </fieldset>}
  </Drawer>
  <ImageLightbox pictures={previewPictures} index={Math.min(activeImage,Math.max(0,previewPictures.length-1))} open={imageOpen&&!!id} name={draft?localizedContent(draft.name,locale):''} onIndexChange={setActiveImage} onClose={()=>setImageOpen(false)} returnFocus={imageOpener}/>
  <Modal zIndex={1200} title={t('master.restore')} open={restoreOpen} onOk={()=>void restoreOne()} onCancel={()=>setRestoreOpen(false)} confirmLoading={busy} okButtonProps={{disabled:dirty}}><p>{t('master.restore_hint')}</p></Modal>
  <Modal title={t('products.unsaved')} open={discardOpen} onOk={()=>{setDiscardOpen(false);onChoose(undefined);}} onCancel={keepEditing} okText={t('products.discard')} cancelText={t('products.keep_editing')} zIndex={1200}>{t('products.unsaved_hint')}</Modal>
  <Drawer rootClassName="catalog-editor catalog-bulk-editor" title={t('master.bulk')} open={bulk} width={1050} onClose={()=>setBulk(false)} destroyOnClose>
   <p>{t('master.bulk_hint')}</p><Button onClick={()=>void readAudit()} disabled={busy}>{t('master.audit')}</Button>{audit&&<Input.TextArea readOnly aria-label={t('master.audit')} rows={8} value={audit}/>}{error&&<Alert type="error" message={warning(error)}/>}<Button loading={busy} onClick={()=>void suggestions()}>{t('master.suggestions')}</Button>
   <Input.TextArea disabled={busy} aria-label={t('master.json')} rows={9} value={json} onChange={e=>{setJson(e.target.value);setValidated(false);setReviewed(false);}}/>
   <Button loading={busy} disabled={!json.trim()} onClick={()=>void preview()}>{t('rec.batch_preview')}</Button>
   {!!rows.length&&<Table rowKey={row=>row.value.productId} dataSource={rows} scroll={{x:700}} pagination={{pageSize:10}} rowSelection={{selectedRowKeys:selected,onChange:setSelected}} columns={[
    {title:t('rec.code'),render:(_,row)=>row.value.itemNumber||t('rec.not_stated')},
    {title:t('rec.name'),render:(_,row)=><><strong>{localizedContent(row.value.name,locale)}</strong><small>{row.value.productId}</small></>},
    {title:t('master.preview_summary'),render:(_,row)=><>{row.value.categoryIds.length} · {row.value.supplierId||'—'} · {row.value.gallery.length} {t('gallery.count')}<p>{row.value.specification[locale]||row.value.specification['ja-JP']}</p>{row.changes.map(key=><small key={key}>{warning(key)}</small>)}{row.warnings.map(key=><Alert key={key} type="warning" message={warning(key)}/>)}</>}
   ]}/>}
   <Checkbox checked={reviewed} disabled={!validated} onChange={e=>setReviewed(e.target.checked)}>{t('master.review')}</Checkbox><Button type="primary" loading={busy} disabled={!validated||!reviewed||!selected.length} onClick={()=>void saveBulk()}>{t('master.save')} ({selected.length})</Button>
  </Drawer>
 </section>;
}
