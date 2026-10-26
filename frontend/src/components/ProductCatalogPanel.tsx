import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Checkbox,Drawer,Input,Select,Table,Tabs} from 'antd';
import {productCatalogApi,recommendationTaxonomyApi,type CatalogInput,type CatalogProposal,type RecommendationChoice} from '../api';
import {localizedContent,useI18n} from '../i18n';
import './productCatalog.css';

const languages=[{key:'ja-JP',label:'日本語'},{key:'zh-CN',label:'简体中文'},{key:'zh-TW',label:'繁體中文'},{key:'en-US',label:'English'}];
export default function ProductCatalogPanel({entries,id,onChoose,onSaved}:{entries:{key:string;name:string}[];id?:string;onChoose:(id?:string)=>void;onSaved:(rows:CatalogInput[])=>void}){
 const {t,locale}=useI18n();const [draft,setDraft]=useState<CatalogInput>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false),[canonical,setCanonical]=useState(false);
 const [options,setOptions]=useState<{categories:RecommendationChoice[];suppliers:RecommendationChoice[]}>({categories:[],suppliers:[]});
 const [bulk,setBulk]=useState(false),[json,setJson]=useState(''),[rows,setRows]=useState<CatalogProposal[]>([]),[validated,setValidated]=useState(false),[selected,setSelected]=useState<React.Key[]>([]);
 const [source,setSource]=useState(''),[imageReviewed,setImageReviewed]=useState(false);const fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!id)return;let active=true;setBusy(true);setDraft(undefined);setError('');setReviewed(false);void Promise.all([productCatalogApi.get(id),recommendationTaxonomyApi.options()]).then(([profile,choices])=>{if(active){setDraft(profile.value);setCanonical(profile.canonical);setOptions(choices);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[id]);
 function patch(value:Partial<CatalogInput>){setDraft(prior=>prior?{...prior,...value}:prior);setReviewed(false);}
 function text(field:'name'|'description'|'specification',language:string,value:string){if(draft)patch({[field]:{...draft[field],[language]:value}});}
 async function saveOne(){if(!draft||!reviewed)return;setBusy(true);setError('');try{await productCatalogApi.preview([draft]);const result=await productCatalogApi.save([draft]);setDraft(result[0].value);setCanonical(true);setReviewed(false);onSaved(result.map(row=>row.value));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function suggestions(){setBusy(true);setError('');setReviewed(false);setValidated(false);try{const proposals=(await productCatalogApi.proposals()).filter(row=>row.changes.length>0);setRows(proposals);setJson(JSON.stringify(proposals.map(row=>row.value),null,2));setSelected(proposals.map(row=>row.value.productId));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function preview(){setBusy(true);setError('');setReviewed(false);try{const values:CatalogInput[]=JSON.parse(json);if(!Array.isArray(values)||!values.length||values.length>500)throw Error(t('master.invalid'));const results=await productCatalogApi.preview(values);setRows(results.map(row=>({...row,warnings:rows.find(old=>old.value.productId===row.value.productId)?.warnings??[]})));setSelected(prior=>prior.filter(key=>values.some(value=>value.productId===key)));setValidated(true);}catch(e){setError((e as Error).message);setValidated(false);}finally{setBusy(false);}}
 async function saveBulk(){if(!validated||!reviewed)return;setBusy(true);setError('');try{const result=await productCatalogApi.save(rows.filter(row=>selected.includes(row.value.productId)).map(row=>row.value));onSaved(result.map(row=>row.value));const remaining=rows.filter(row=>!result.some(saved=>saved.value.productId===row.value.productId));setValidated(false);setReviewed(false);setRows(remaining);setJson(remaining.length?JSON.stringify(remaining.map(row=>row.value),null,2):'');setSelected([]);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function upload(files:File[]){if(!draft||!imageReviewed||!source)return;setBusy(true);setError('');try{const pictures=[...draft.gallery];for(const file of files){const picture=await productCatalogApi.upload(draft.productId,file,source,file.name);if(!pictures.some(p=>p.url===picture.url||(p.sha256&&p.sha256===picture.sha256)))pictures.push(picture);}patch({gallery:pictures});setImageReviewed(false);if(fileInput.current)fileInput.current.value='';}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function reorder(index:number,next:number){if(!draft)return;const gallery=[...draft.gallery];const [picture]=gallery.splice(index,1);gallery.splice(next,0,picture);patch({gallery});}
 const warning=(value:string)=>{const [key,detail]=value.split(':');return t(key)+(detail?' · '+detail:'');};
 return <section className="product-catalog-panel"><h2>{t('master.title')}</h2><p>{t('master.hint')}</p>
  <div className="product-catalog-actions"><Select aria-label={t('master.choose')} showSearch optionFilterProp="label" value={id} placeholder={t('master.choose')} onChange={onChoose} options={entries.map(row=>({value:row.key,label:row.name}))}/><Button onClick={()=>{setBulk(true);setError('');setReviewed(false);}}>{t('master.bulk')}</Button></div>
  <Drawer title={t('master.title')} width="min(100vw,850px)" open={!!id} onClose={()=>onChoose(undefined)} destroyOnClose>
   {error&&<Alert type="error" message={warning(error)}/>}<Alert type="info" message={t(canonical?'master.active':'master.not_adopted')}/>
   {draft&&<fieldset className="product-catalog-form" disabled={busy}>
    <p><strong>{t('rec.code')}: </strong>{draft.itemNumber||t('rec.not_stated')} · {draft.productId}</p>
    <label>{t('rec.code')}<Input value={draft.itemNumber??''} onChange={e=>patch({itemNumber:e.target.value||null})}/></label>
    <label>{t('stock.item.brand')}<Input value={draft.brand??''} onChange={e=>patch({brand:e.target.value||null})}/></label>
    <div className="product-catalog-pair"><label>{t('master.model')}<Input value={draft.model??''} onChange={e=>patch({model:e.target.value||null})}/></label><label>{t('master.packaging')}<Input value={draft.packaging??''} onChange={e=>patch({packaging:e.target.value||null})}/></label></div>
    <Tabs defaultActiveKey="ja-JP" items={languages.map(language=>({...language,children:<div className="product-catalog-language">
     <label>{t('master.names')}<Input aria-label={t('master.names')+' '+language.key} value={draft.name[language.key]??''} onChange={e=>text('name',language.key,e.target.value)}/></label>
     <label>{t('master.specifications')}<Input.TextArea rows={2} value={draft.specification[language.key]??''} onChange={e=>text('specification',language.key,e.target.value)}/></label>
     <label>{t('master.descriptions')}<Input.TextArea rows={4} value={draft.description[language.key]??''} onChange={e=>text('description',language.key,e.target.value)}/></label>
    </div>}))}/>
    <label>{t('master.categories')}<Select disabled={busy} aria-label={t('master.categories')} mode="multiple" value={draft.categoryIds} onChange={categoryIds=>patch({categoryIds})} options={options.categories.map(c=>({value:c.id,label:localizedContent(c.name,locale)}))}/></label>
    <label>{t('master.supplier')}<Select disabled={busy} aria-label={t('master.supplier')} allowClear value={draft.supplierId??undefined} onChange={supplierId=>patch({supplierId:supplierId??null})} options={options.suppliers.map(c=>({value:c.id,label:localizedContent(c.name,locale)}))}/></label>
    <Checkbox checked={draft.translationsReviewed} onChange={e=>patch({translationsReviewed:e.target.checked})}>{t('master.translations_reviewed')}</Checkbox>
    <h3>{t('gallery.manage')}</h3>{!draft.gallery.length&&<Alert message={t('gallery.pending')} type="info"/>}
    <div className="product-catalog-images">{draft.gallery.map((picture,index)=><div key={picture.url}>
     <img src={picture.url} alt={picture.title?.[locale]||picture.title?.['ja-JP']||draft.name['ja-JP']}/>
     <label>{t('gallery.sources')}<Input value={picture.sourceUrl??''} onChange={e=>patch({gallery:draft.gallery.map((p,i)=>i===index?{...p,sourceUrl:e.target.value}:p)})}/></label>
     <div className="product-catalog-actions"><Button disabled={!index} onClick={()=>reorder(index,0)}>{t(index?'gallery.set_main':'gallery.main')}</Button><Button aria-label={t('master.move_up')} disabled={!index} onClick={()=>reorder(index,index-1)}>↑</Button><Button aria-label={t('master.move_down')} disabled={index===draft.gallery.length-1} onClick={()=>reorder(index,index+1)}>↓</Button><Button danger onClick={()=>patch({gallery:draft.gallery.filter((_,i)=>i!==index)})}>{t('store.remove')}</Button></div>
    </div>)}</div>
    <label>{t('gallery.sources')}<Input value={source} onChange={e=>setSource(e.target.value)} placeholder="https://…"/></label>
    <Checkbox checked={imageReviewed} onChange={e=>setImageReviewed(e.target.checked)}>{t('gallery.ack')}</Checkbox>
    <input ref={fileInput} aria-label={t('gallery.files')} type="file" accept="image/png,image/jpeg" multiple disabled={!imageReviewed||!source||busy} onChange={e=>void upload(Array.from(e.target.files??[]))}/>
    <p>{t('master.upload_hint')}</p><Checkbox checked={reviewed} onChange={e=>setReviewed(e.target.checked)}>{t('master.review')}</Checkbox>
    <Button type="primary" loading={busy} disabled={!reviewed} onClick={()=>void saveOne()}>{t('master.save')}</Button>
   </fieldset>}
  </Drawer>
  <Drawer title={t('master.bulk')} open={bulk} width="min(100vw,1050px)" onClose={()=>setBulk(false)} destroyOnClose>
   <p>{t('master.bulk_hint')}</p>{error&&<Alert type="error" message={warning(error)}/>}<Button loading={busy} onClick={()=>void suggestions()}>{t('master.suggestions')}</Button>
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
