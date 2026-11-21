import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Checkbox,Input,Modal,Select,Space,Typography} from 'antd';
import {api,categoryTreeApi,masterDataApi,photoIntakeApi,type CategoryTreeNode,type CostcoOnboardingJobView,type MobileSupplier,type PhotoReview,type PhotoStorageCondition} from '../api';
import {prepareProductPhotoUpload} from '../productPhotoUpload';
import {getStoredUser} from '../authStorage';
import {useI18n} from '../i18n';
import CategoryTreePicker from './CategoryTreePicker';
import ProductPhotoSave from './ProductPhotoSave';
import ProductPhotoQueue,{photoCanRetry,photoFailure,photoRetryFailure,photoState} from './ProductPhotoQueue';
import './productPhotoIntake.css';

type Props={open:boolean;queue?:CostcoOnboardingJobView[];onReview?:(job:CostcoOnboardingJobView)=>void;onQueueChanged?:()=>void;job?:CostcoOnboardingJobView;onClose:()=>void;onQueued:(job:CostcoOnboardingJobView)=>void;onSaved:(id:string)=>void;onConfirmed?:()=>void};
const terminal=(j:CostcoOnboardingJobView)=>['NEEDS_INPUT','FAILED','COMPLETED','CANCELLED'].includes(j.state);
const storageOptions=['AMBIENT','FRESH','CHILLED','FROZEN'] as const;
type Upload = {file:File;requestId:string;supplierId:string;error?:string};
export default function ProductPhotoIntakeModal({open,job:initial,queue,onReview,onQueueChanged,onClose,onQueued,onSaved,onConfirmed}:Props){
 const{t,locale}=useI18n();const generation=useRef(0),reviewEpoch=useRef(0),upload=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null);
 const[suppliers,setSuppliers]=useState<MobileSupplier[]>([]),[supplier,setSupplier]=useState(''),[supplierError,setSupplierError]=useState(false),[suppliersLoaded,setSuppliersLoaded]=useState(false);
 const[tree,setTree]=useState<CategoryTreeNode[]>([]),[currencies,setCurrencies]=useState<{code:string}[]>([]);
 const[configurationIssue,setConfigurationIssue]=useState<string|null>(null);
 const[original,setOriginal]=useState<File>(),[stored,setStored]=useState<File>();
 const[uploads,setUploads]=useState<Upload[]>([]),[preview,setPreview]=useState(''),[job,setJob]=useState(initial),[review,setReview]=useState<PhotoReview>();
 const[pollAttempt,setPollAttempt]=useState(0);
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[item,setItem]=useState(''),[selected,setSelected]=useState('');
 const[names,setNames]=useState<Record<string,string>>({}),[spec,setSpec]=useState(''),[brand,setBrand]=useState(''),[model,setModel]=useState(''),[packaging,setPackaging]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState<string|null>(null);
 const[amount,setAmount]=useState(''),[currency,setCurrency]=useState(''),[unit,setUnit]=useState(''),[conditions,setConditions]=useState(''),[inStock,setInStock]=useState(false),[identity,setIdentity]=useState(false),[priceConfirmed,setPriceConfirmed]=useState(false);
 const[observedAt,setObservedAt]=useState(()=>new Date().toISOString().slice(0,16)),[saved,setSaved]=useState<PhotoReview['saved']>(null);
 const[officialPreview,setOfficialPreview]=useState(''),[useOfficialImage,setUseOfficialImage]=useState(false);
 const frozen=useRef<object>();
 const[storageCondition,setStorageCondition]=useState<PhotoStorageCondition|null>(null);
 const archiveDraft=useRef<{item:string|null;edited:Set<'description'|'category'|'storage'>}>({item:null,edited:new Set()});
 const applyReview=(r:PhotoReview)=>{setReview(r);setItem(r.itemNumber||'');setSelected(r.status==='MATCH'?r.matches[0].id:'');setSaved(r.saved);setIdentity(false);setPriceConfirmed(false);setUseOfficialImage(false);frozen.current=undefined;
  const c=r.candidate;setNames(c?.translatedNames||{});setSpec(c?.specification||'');setBrand(c?.brand||'');setModel(c?.model||'');setPackaging(c?.packaging||'');
  if(archiveDraft.current.item!==r.itemNumber)archiveDraft.current={item:r.itemNumber,edited:new Set()};
  const {edited}=archiveDraft.current;
  if(!edited.has('description'))setDescription(r.archiveDetails?.descriptionJa??'');
  if(!edited.has('category'))setCategory(r.archiveDetails?.categoryNodeId??null);
  if(!edited.has('storage'))setStorageCondition(r.archiveDetails?.storageCondition??null);
  const p=r.photoFacts;setAmount(p?.priceKind==='WAREHOUSE'&&p.amount!=null?String(p.amount):'');setCurrency(p?.currency||'');setUnit(p?.unit||'');setConditions(p?.conditions||'');setInStock(false);
 };
 const loadSuppliers=async()=>{const g=generation.current;setSupplierError(false);try{const rows=await api.suppliers();if(g!==generation.current)return;setSuppliers(rows);setSuppliersLoaded(true);if(rows.length===1)setSupplier(rows[0].id);}catch{if(g===generation.current){setSupplierError(true);setSuppliersLoaded(true);}}};
 const loadStatus=async()=>{const g=generation.current;try{const s=await api.costcoOnboarding.status();if(g===generation.current){setConfigurationIssue(s.photoConfigurationIssue??null);}}catch{if(g===generation.current)setError(t('onboarding.read_failed'));}};
 useEffect(()=>{if(!open)return;const g=++generation.current;void loadSuppliers();void loadStatus();
  void categoryTreeApi.list().then(r=>{if(g===generation.current)setTree(r);}).catch(()=>{if(g===generation.current)setError(t('photo.reference_failed'));});
  void masterDataApi.currencies().then(r=>{if(g===generation.current)setCurrencies(r);}).catch(()=>{if(g===generation.current)setError(t('photo.reference_failed'));});
  return()=>{generation.current++;};
 },[open]);
 const selectedId=initial?.id;
 const selectedIdRef=useRef(selectedId);
 selectedIdRef.current=selectedId;
 useEffect(()=>{
  let active=true;const epoch=++reviewEpoch.current;
  setPollAttempt(0);setJob(initial);setPreview('');setStored(undefined);setReview(undefined);setSaved(null);setBusy(false);
  archiveDraft.current={item:null,edited:new Set()};
  setDescription('');setCategory(null);setStorageCondition(null);setError('');
  setObservedAt(new Date().toISOString().slice(0,16));
  if(initial?.supplierId)setSupplier(current=>current||initial.supplierId||'');
  if(selectedId)void photoIntakeApi.photo(selectedId).then(blob=>{
   if(active){
    setPreview(URL.createObjectURL(blob));
    const extension=blob.type==='image/jpeg'?'jpg':blob.type.split('/')[1]||'img';
    setStored(new File([blob],'product-photo.'+extension,{type:blob.type}));
   }
  }).catch(()=>{if(active)setError(t('photo.evidence_failed'));});
  return()=>{active=false;if(reviewEpoch.current===epoch)reviewEpoch.current++;};
 },[selectedId]);
 useEffect(()=>{let active=true;setOfficialPreview('');if(review?.officialImageAvailable&&review.status==='NEW'){void photoIntakeApi.image(review.jobId).then(blob=>{if(active)setOfficialPreview(URL.createObjectURL(blob));}).catch(()=>{if(active)setError(t('photo.official_unavailable'));});}return()=>{active=false;};},[review?.jobId,review?.officialImageAvailable]);
 useEffect(()=>()=>{if(officialPreview)URL.revokeObjectURL(officialPreview);},[officialPreview]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 useEffect(()=>{if(!open||!job||job.id!==selectedId)return;const g=generation.current;let disposed=false;let timer:ReturnType<typeof setTimeout>;
  const read=async()=>{try{const next=await api.costcoOnboarding.get(job.id);if(disposed||g!==generation.current)return;setJob(next);if(terminal(next)){const r=await photoIntakeApi.review(next.id);if(!disposed&&g===generation.current)applyReview(r);}else timer=setTimeout(()=>void read(),2500);}catch{if(!disposed&&g===generation.current){setError(t('onboarding.read_failed'));timer=setTimeout(()=>void read(),5000);}}};
  void read();return()=>{disposed=true;clearTimeout(timer);};
 },[open,selectedId,job?.id,pollAttempt]);
 const submit=async(entry:Upload)=>{
  const g=generation.current,owner=getStoredUser()?.id;
  setUploads(rows=>[...rows.filter(row=>row.requestId!==entry.requestId),{...entry,error:undefined}]);
  try{
   const prepared=await prepareProductPhotoUpload(entry.file);
   if(owner!==getStoredUser()?.id)return;
   const next=await api.costcoOnboarding.photo({requestId:entry.requestId,supplierId:entry.supplierId,market:'JP'},prepared);
   if(g!==generation.current)return;
   setUploads(rows=>rows.filter(row=>row.requestId!==entry.requestId));
   onQueued(next);
  }catch(e){
   if(g!==generation.current)return;
   const key=(e as Error).message;
   const error=key.startsWith('gallery.')||key==='error.recommendation.image'?'photo.file_type':key==='onboarding.evidence_quota'?key:'photo.upload_failed';
   setUploads(rows=>rows.map(row=>row.requestId===entry.requestId?{...row,error}:row));
  }
 };
 const pick=(files:FileList|null)=>{
  if(!files)return;
  const selectedFiles=Array.from(files);
  setOriginal(selectedFiles[selectedFiles.length-1]);
  if(!supplier)return;
  for(const file of selectedFiles)void submit({file,supplierId:supplier,requestId:crypto.randomUUID()});
 };
 const applyRetry=(next:CostcoOnboardingJobView)=>{
  if(selectedIdRef.current!==next.id)return;
  setJob(next);setError('');setReview(undefined);setSaved(null);setPollAttempt(n=>n+1);
 };
 const retryRecognition=async()=>{
  if(!job)return;
  const g=reviewEpoch.current;setBusy(true);
  try{
   const next=await photoIntakeApi.retry(job.id,job.revision);
   if(g!==reviewEpoch.current)return;
   applyRetry(next);onQueued(next);
  }catch(e){if(g===reviewEpoch.current)setError(t(photoRetryFailure(e)));}
  finally{if(g===reviewEpoch.current)setBusy(false);}
 };
 const reload=async()=>{if(!job)return;if(!terminal(job)){setError('');setPollAttempt(n=>n+1);return;}const g=reviewEpoch.current;setBusy(true);try{const r=await photoIntakeApi.review(job.id,item);if(g===reviewEpoch.current){applyReview(r);setError('');}}catch(e){if(g===reviewEpoch.current)setError(t((e as Error).message));}finally{if(g===reviewEpoch.current)setBusy(false);}};
 const edit=()=>{frozen.current=undefined;};
 const chosen=review?.matches.find(m=>m.id===selected),isNew=review?.status==='NEW';
 const missing=!identity?t('photo.identity_confirm'):!isNew&&!chosen?.eligible?t('photo.choose_match'):isNew&&!names['ja-JP']?.trim()?t('master.japanese_required'):amount&&(!priceConfirmed||!currency||!unit.trim())?t('photo.price_confirm'):!amount&&!inStock?t('photo.observation_required'):'';
 const save=async()=>{if(!job||!review||missing)return;const g=reviewEpoch.current;setBusy(true);setError('');try{
  const input=frozen.current??{revision:review.revision,itemNumber:review.itemNumber,productId:isNew?null:selected,productVersion:chosen?.version??null,previousId:review.history.find(o=>o.productId===selected)?.id??null,identityConfirmed:identity,priceConfirmed,amount:amount||null,currency:currency||null,unit:unit||null,conditions,inStock,observedAt:new Date(observedAt+'Z').toISOString(),model,packaging,useOfficialImage,product:isNew?{requestId:job.id,name:names,specification:{'ja-JP':spec},brand,description:{'ja-JP':description},categoryNodeId:category,storageCondition}:null};frozen.current=input;
  const receipt=await photoIntakeApi.confirm(job.id,input);if(g!==reviewEpoch.current)return;setSaved(receipt);onConfirmed?.();
 }catch(e){if(g===reviewEpoch.current)setError(t((e as Error).message));}finally{if(g===reviewEpoch.current)setBusy(false);}};
 const selectedQueueRow=queue?.find(row=>row.id===job?.id&&row.revision===job.revision);
 const latest=review?.history.find(o=>o.productId===selected&&o.amount!=null&&o.currency===currency&&o.unit===unit);
 return <Modal open={open} title={t('photo.title')} onCancel={onClose} footer={null} width={760} rootClassName="product-photo-intake" destroyOnClose>
  <p>{t('photo.help')}</p>
  {error&&<Alert type="error" message={error} action={<Button onClick={()=>job?void reload():void loadSuppliers()}>{t('onboarding.refresh')}</Button>}/>}
  {supplierError?<Alert type="error" message={t('photo.suppliers_failed')} action={<Button onClick={()=>void loadSuppliers()}>{t('onboarding.refresh')}</Button>}/>:suppliersLoaded&&!suppliers.length?<Alert type="warning" message={t('photo.no_suppliers')}/>:null}
  <label>{t('onboarding.supplier')}<Select aria-label={t('onboarding.supplier')}  value={supplier||undefined} loading={!suppliersLoaded} options={suppliers.map(s=>({value:s.id,label:s.name[locale]||s.name['ja-JP']}))} onChange={setSupplier}/></label>
  <Space wrap><Button disabled={!supplier} onClick={()=>camera.current?.click()}>{t('photo.camera')}</Button><Button disabled={!supplier} onClick={()=>upload.current?.click()}>{t('photo.upload')}</Button></Space>
  {!supplier&&<p role="status">{t('photo.select_supplier')}</p>}
  <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e=>{pick(e.target.files);e.target.value='';}}/>
  <input ref={upload} type="file" accept="image/*" multiple hidden onChange={e=>{pick(e.target.files);e.target.value='';}}/>
  {original&&<ProductPhotoSave key={original.name} file={original} stored={false}/>}
  {uploads.map(entry=><div key={entry.requestId} role="status">
   {entry.file.name} · {t(entry.error||'photo.uploading')}
   {entry.error&&<Space wrap>{entry.error!=='photo.file_type'&&<Button onClick={()=>void submit(entry)}>{t('photo.retry_upload')}</Button>}
    <Button onClick={()=>setUploads(rows=>rows.filter(row=>row.requestId!==entry.requestId))}>{t('onboarding.close')}</Button></Space>}
  </div>)}
  {queue&&onReview&&onQueueChanged&&<ProductPhotoQueue jobs={queue} onReview={onReview} onChanged={next=>{applyRetry(next);return onQueueChanged();}}/>}
  {preview&&<img className="photo-evidence" src={preview} alt={t('photo.evidence')}/>}
  {stored&&<ProductPhotoSave key={job?.id} file={stored} stored/>}
  {!job&&configurationIssue&&<Alert type="warning" message={t(photoFailure(configurationIssue))}/>}
  {job&&<p role="status">{t(saved?'photo.state.completed':photoState(selectedQueueRow??job))} {photoCanRetry(job)&&!saved&&t(photoFailure(job.failureCode))}</p>}
  {job&&photoCanRetry(job)&&!saved&&<Button loading={busy} onClick={()=>void retryRecognition()}>{t('photo.retry_recognition')}</Button>}
  {review&&!saved&&<section>
   <Typography.Title level={4}>{t('photo.review')}</Typography.Title><p>{t('photo.suggestions')}</p>
   {!!review.sources?.length&&<details><summary>{t('photo.sources')}</summary>{review.sources.map(source=><p key={source.sha256}><a href={source.canonicalUrl} target="_blank" rel="noopener noreferrer">{source.canonicalUrl}</a></p>)}</details>}
   {!!review.candidate?.unknownFields?.length&&<p>{t('photo.unknown_fields')}</p>}
   {isNew&&officialPreview&&<><img className="photo-evidence" src={officialPreview} alt={t('photo.official_image')}/><Checkbox checked={useOfficialImage} onChange={e=>{setUseOfficialImage(e.target.checked);edit();}}>{t('photo.use_official_image')}</Checkbox></>}

   <label>{t('onboarding.item')}<Input value={item} onChange={e=>{setItem(e.target.value);setIdentity(false);edit();}}/></label><Button onClick={()=>void reload()} disabled={busy}>{t('photo.find')}</Button>
   {review.status==='DELETED'||review.status==='IDENTITY_REQUIRED'?<Alert type="warning" message={t(review.status==='DELETED'?'photo.deleted':'photo.identity_required')}/>:<>
    {!isNew&&<><label>{t('photo.choose_match')}<Select aria-label={t('photo.choose_match')} value={selected||undefined} options={review.matches.map(m=>({value:m.id,label:(m.name[locale]||m.name['ja-JP'])+' · '+Object.values(m.specification||{}).join(' / ')+' · '+(m.packaging||''),disabled:!m.eligible}))} onChange={id=>{setSelected(id);setIdentity(false);edit();}}/></label>{review.matches.some(m=>!m.eligible)&&<Alert type="warning" message={t('photo.legacy')}/>}</>}
    {isNew&&<><Typography.Title level={5}>{t('photo.new')}</Typography.Title>{['ja-JP','zh-CN','zh-TW','en-US'].map(l=><label key={l}>{t('onboarding.name')} ({l})<Input value={names[l]||''} onChange={e=>{setNames({...names,[l]:e.target.value});edit();}}/></label>)}
     <label>{t('onboarding.brand')}<Input value={brand} onChange={e=>{setBrand(e.target.value);edit();}}/></label><label>{t('onboarding.model')}<Input value={model} onChange={e=>{setModel(e.target.value);edit();}}/></label><label>{t('onboarding.specification')}<Input value={spec} onChange={e=>{setSpec(e.target.value);edit();}}/></label><label>{t('onboarding.packaging')}<Input value={packaging} onChange={e=>{setPackaging(e.target.value);edit();}}/></label>
     <label>{t('photo.description')}<Input.TextArea value={description} onChange={e=>{archiveDraft.current.edited.add('description');setDescription(e.target.value);edit();}}/></label>
     <CategoryTreePicker nodes={tree} value={category} onChange={c=>{archiveDraft.current.edited.add('category');setCategory(c);edit();}}/>
     <label>{t('stock.item.storage_condition')}<Select aria-label={t('stock.item.storage_condition')} value={storageCondition??undefined} allowClear placeholder={t('photo.unknown')} options={storageOptions.map(value=>({value,label:t('stock.storage.'+value.toLowerCase())}))} onChange={(value:PhotoStorageCondition|undefined)=>{archiveDraft.current.edited.add('storage');setStorageCondition(value??null);edit();}}/></label></>}
    <Checkbox checked={identity} disabled={item!==review.itemNumber} onChange={e=>{setIdentity(e.target.checked);edit();}}>{t('photo.identity_confirm')}</Checkbox>
    <Typography.Title level={5}>{t('photo.price')}</Typography.Title>
    <p>{t('photo.previous')}: {latest?`${latest.amount} ${latest.currency} / ${latest.unit}`:t('photo.unknown')}{latest&&amount&&<span> · {t('photo.difference')}: {Number(amount)-Number(latest.amount)}</span>}</p>
    {review.photoFacts&&<p>{t('photo.detected')}: {review.photoFacts.amount??t('photo.unknown')} {review.photoFacts.currency} / {review.photoFacts.unit} · {t('photo.kind.'+review.photoFacts.priceKind)} {review.photoFacts.conditions}</p>}
    <div className="photo-price-fields"><label>{t('photo.amount')}<Input inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setPriceConfirmed(false);edit();}}/></label><label>{t('photo.currency')}<Select aria-label={t('photo.currency')} value={currency||undefined} options={currencies.map(c=>({value:c.code,label:c.code}))} onChange={c=>{setCurrency(c);setPriceConfirmed(false);edit();}}/></label><label>{t('photo.unit')}<Input value={unit} onChange={e=>{setUnit(e.target.value);setPriceConfirmed(false);edit();}}/></label></div>
    <label>{t('photo.conditions')}<Input value={conditions} onChange={e=>{setConditions(e.target.value);setPriceConfirmed(false);edit();}}/></label><Checkbox checked={priceConfirmed} onChange={e=>{setPriceConfirmed(e.target.checked);edit();}}>{t('photo.price_confirm')}</Checkbox>
    <label>{t('photo.observed_at')} (UTC)<Input type="datetime-local" value={observedAt} onChange={e=>{setObservedAt(e.target.value);edit();}}/></label><Checkbox checked={inStock} onChange={e=>{setInStock(e.target.checked);edit();}}>{t('photo.in_stock')}</Checkbox>
    <p role="status">{missing||t('photo.ready')}</p><Button type="primary" loading={busy} disabled={!!missing} onClick={()=>void save()}>{t(isNew?'photo.create':'photo.save')}</Button>
   </>}
  </section>}
  {saved&&<Alert type="success" message={t('photo.saved')} description={<><p>{saved.amount==null?t('photo.price_not_updated'):t(saved.priceChanged?'photo.price_updated':'photo.price_unchanged')} {saved.amount} {saved.currency} {saved.unit}</p>{saved.inStock&&<p>{t('photo.available')} · {new Date(saved.observedAt).toLocaleString(locale)}</p>}<Button onClick={()=>{onClose();onSaved(saved.productId);}}>{t('onboarding.open_product')}</Button></>}/>}
  <Button onClick={onClose}>{t('onboarding.close')}</Button>
 </Modal>;
}
