import {useRef,useState} from 'react';
import {Alert,Button,Checkbox,Input,Popconfirm,Select,Table} from 'antd';
import {recommendationApi,type RecommendationDetail} from '../api';
import {useI18n} from '../i18n';
type Row={itemId:number;itemNumber:string|null;mode:'append'|'replace';images:{fileName:string;sourceUrl:string;assetKey:string;label?:string}[]};
export default function RecommendationGallery({detail,onChange}:{detail:RecommendationDetail;onChange:(v:RecommendationDetail)=>void}){
 const {t}=useI18n();const [files,setFiles]=useState<File[]>([]),[json,setJson]=useState(''),[rows,setRows]=useState<Row[]>([]),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[current,setCurrent]=useState<number>(detail.items[0]?.id);const input=useRef<HTMLInputElement>(null);
 function preview(){setError('');try{const values=JSON.parse(json) as Row[];const seen=new Set<number>();if(!Array.isArray(values)||!values.length||values.length>200)throw Error(t('gallery.invalid'));
  for(const row of values){const item=detail.items.find(i=>i.id===row.itemId);if(!item||seen.has(row.itemId)||row.itemNumber!==(item.itemNumber??null)||!['append','replace'].includes(row.mode)||!Array.isArray(row.images)||!row.images.length||row.images.length>100)throw Error(t('gallery.invalid'));seen.add(row.itemId);
   const keys=new Set<string>();for(const image of row.images){const matches=files.filter(f=>f.name===image.fileName);const url=new URL(image.sourceUrl);if(matches.length!==1||!['image/jpeg','image/png'].includes(matches[0].type)||matches[0].size>8*1024*1024||url.protocol!=='https:'||url.search||url.hash||url.username||!image.assetKey?.trim()||keys.has(image.assetKey))throw Error(t('gallery.invalid'));keys.add(image.assetKey);}}
  setRows(values);setVerified(false);
 }catch(e){setRows([]);setError((e as Error).message);}}
 async function upload(){setBusy(true);setError('');let next=detail;
  try{for(const row of rows){const originals=(next.items.find(i=>i.id===row.itemId)?.gallery??[]).map(p=>p.id);const ordered:string[]=[];
    for(const image of row.images){next=await recommendationApi.galleryUpload(next.post.id,row.itemId,files.find(f=>f.name===image.fileName)!,{version:next.post.version,sourceUrl:image.sourceUrl,assetKey:image.assetKey,label:image.label??'',itemNumber:row.itemNumber,verified});onChange(next);
     const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await files.find(f=>f.name===image.fileName)!.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');const match=next.items.find(i=>i.id===row.itemId)?.gallery?.find(p=>p.assetKey===image.assetKey||p.hash===digest);if(match&&!ordered.includes(match.id))ordered.push(match.id);
    }
    const ids=row.mode==='replace'?ordered:[...originals,...ordered.filter(id=>!originals.includes(id))];
    next=await recommendationApi.galleryOrder(next.post.id,row.itemId,ids,next.post.version);onChange(next);
   }setRows([]);setJson('');setFiles([]);setVerified(false);if(input.current)input.current.value='';
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function reorder(ids:string[]){setBusy(true);setError('');try{onChange(await recommendationApi.galleryOrder(detail.post.id,current,ids,detail.post.version));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const item=detail.items.find(i=>i.id===current),gallery=item?.gallery??[];
 return <section className="rec-gallery-admin"><h2>{t('gallery.title')}</h2><Alert type="info" showIcon message={t('gallery.hint')}/>
  <Button onClick={()=>setJson(JSON.stringify(detail.items.map(item=>({itemId:item.id,itemNumber:item.itemNumber??null,mode:'append',images:[]})),null,2))}>{t('gallery.export')}</Button>
  <input ref={input} type="file" multiple accept="image/png,image/jpeg" aria-label={t('gallery.files')} onChange={e=>{setFiles(Array.from(e.target.files??[]));setRows([]);}} disabled={busy}/>
  <Input.TextArea aria-label={t('gallery.json')} value={json} rows={7} onChange={e=>{setJson(e.target.value);setRows([]);setVerified(false);}}/>
  <Button disabled={!files.length||!json.trim()||busy} onClick={preview}>{t('rec.batch_preview')}</Button>{error&&<Alert type="error" message={error}/>}
  {!!rows.length&&<><Table rowKey="itemId" pagination={{pageSize:8}} dataSource={rows} columns={[{title:'ID',dataIndex:'itemId'},{title:t('rec.code'),dataIndex:'itemNumber'},{title:t('gallery.mode'),dataIndex:'mode'},{title:t('gallery.count'),render:(_,row)=>row.images.length}]}/><Checkbox checked={verified} onChange={e=>setVerified(e.target.checked)}>{t('gallery.ack')}</Checkbox><Button type="primary" disabled={!verified} loading={busy} onClick={()=>void upload()}>{t('gallery.save')}</Button></>}
  <h3>{t('gallery.manage')}</h3><Select aria-label={t('gallery.select')} value={current} showSearch optionFilterProp="label" onChange={setCurrent} options={detail.items.map(i=>({value:i.id,label:`${i.id} · ${i.itemNumber??'—'} · ${i.name}`}))}/>
  {!gallery.length&&<p>{t('gallery.pending')}</p>}<div className="rec-gallery-thumbs">{gallery.map((picture,index)=><div key={picture.id}><img src={picture.url} alt={picture.label||item?.name}/><small>{picture.label}</small>{index===0?<strong>{t('gallery.main')}</strong>:<Button disabled={busy} onClick={()=>void reorder([picture.id,...gallery.filter(p=>p.id!==picture.id).map(p=>p.id)])}>{t('gallery.set_main')}</Button>}<Popconfirm title={t('gallery.remove_confirm')} onConfirm={()=>void reorder(gallery.filter(p=>p.id!==picture.id).map(p=>p.id))}><Button disabled={busy}>{t('store.remove')}</Button></Popconfirm></div>)}</div>
  {item?.imageUrl&&<details><summary>{t('gallery.original')}</summary><img className="rec-source-evidence" src={item.imageUrl} alt={item.name}/></details>}
 </section>;
}
