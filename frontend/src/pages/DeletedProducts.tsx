import {useEffect,useState} from 'react';
import {Alert,Button,Checkbox,Empty,Grid,Input,Space,Table} from 'antd';
import {productTrashApi,type ProductTrashRow} from '../api';
import {useI18n} from '../i18n';
import {useUserRole} from '../context/UserRoleContext';
import './productTrash.css';

export default function DeletedProducts(){
 const {t,locale}=useI18n();const {user}=useUserRole();const screens=Grid.useBreakpoint();
 const [rows,setRows]=useState<ProductTrashRow[]>([]),[cleanup,setCleanup]=useState(false),[selected,setSelected]=useState<React.Key[]>([]),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState('');
 const load=async(mode:boolean)=>{setBusy(true);setError('');setReviewed(false);setSelected([]);try{const data=await productTrashApi.list(!mode);setRows(mode?data.filter(r=>r.imageCount===0):data);}catch{setError(t('accounts.load_error'));}finally{setBusy(false);}};
 useEffect(()=>{if(user?.platformAdmin)void load(cleanup);},[cleanup,user?.platformAdmin]);
 if(!user?.platformAdmin)return <Alert type="error" message={t('trash.admin_only')}/>;
 const remove=async()=>{setBusy(true);setError('');try{await productTrashApi.remove(rows.filter(r=>selected.includes(r.id)).map(({id,version})=>({id,version})));await load(cleanup);}catch{setError(t('trash.conflict'));}finally{setBusy(false);}};
 const restore=async(row:ProductTrashRow)=>{setBusy(true);setError('');try{await productTrashApi.restore({id:row.id,version:row.version});await load(cleanup);}catch{setError(t('trash.conflict'));}finally{setBusy(false);}};
 const display=(row:ProductTrashRow)=>row.name[locale]||row.name['ja-JP']||row.id;
 const visible=rows.filter(r=>[display(r),r.itemNumber||'',r.id].some(s=>s.toLowerCase().includes(search.toLowerCase())));
 return <section><h1>{t('trash.title')}</h1><Alert type="info" message={t('trash.hint')} style={{marginBottom:16}}/>
 <Space wrap style={{marginBottom:16}}><Button disabled={busy} onClick={()=>setCleanup(false)} type={!cleanup?'primary':'default'}>{t('trash.deleted')}</Button><Button disabled={busy} onClick={()=>setCleanup(true)} type={cleanup?'primary':'default'}>{t('trash.no_images')}</Button><Button loading={busy} onClick={()=>void load(cleanup)}>{t('mail.reload')}</Button></Space>
 {error&&<Alert type="error" message={error} style={{marginBottom:16}}/>}
 <Input aria-label={t('trash.search')} placeholder={t('trash.search')} value={search} onChange={e=>{setSearch(e.target.value);setSelected([]);setReviewed(false);}} style={{marginBottom:16,maxWidth:500}}/>
 {screens.md?<Table rowKey="id" loading={busy} dataSource={visible} scroll={{x:720}} pagination={{pageSize:20}} rowSelection={cleanup?{selectedRowKeys:selected,onChange:keys=>{setSelected(keys);setReviewed(false);}}:undefined} columns={[
  {title:t('rec.name'),render:(_,r:ProductTrashRow)=><><strong>{display(r)}</strong><div style={{overflowWrap:'anywhere'}}>{r.id}</div></>},
  {title:t('rec.code'),dataIndex:'itemNumber'},
  {title:t('trash.references'),render:(_,r:ProductTrashRow)=><span>{r.recommendationIds.join(', ')||'—'}</span>},
  {title:t('trash.deleted_at'),render:(_,r:ProductTrashRow)=>r.deletedAt?new Date(r.deletedAt).toLocaleString():t('trash.active')},
  ...(!cleanup?[{title:t('trash.actions'),render:(_:unknown,r:ProductTrashRow)=><Button disabled={busy} onClick={()=>void restore(r)}>{t('trash.restore')}</Button>}]:[])
 ]}/>:<div className="product-trash-cards" aria-busy={busy}>{!visible.length&&!busy&&<Empty/>}{visible.map(row=><article className="product-trash-card" key={row.id} data-product-id={row.id}>
  <header>{cleanup&&<Checkbox disabled={busy} aria-label={display(row)} checked={selected.includes(row.id)} onChange={e=>{setSelected(prior=>e.target.checked?[...prior,row.id]:prior.filter(id=>id!==row.id));setReviewed(false);}}/>}<strong>{display(row)}</strong></header>
  <small>{row.id}</small><dl><dt>{t('rec.code')}</dt><dd>{row.itemNumber||'—'}</dd><dt>{t('trash.references')}</dt><dd>{row.recommendationIds.join(', ')||'—'}</dd><dt>{t('trash.deleted_at')}</dt><dd>{row.deletedAt?new Date(row.deletedAt).toLocaleString():t('trash.active')}</dd></dl>
  {!cleanup&&<Button block disabled={busy} onClick={()=>void restore(row)}>{t('trash.restore')}</Button>}
 </article>)}</div>}
 {cleanup&&<><Checkbox checked={reviewed} disabled={!selected.length||busy} onChange={e=>setReviewed(e.target.checked)}>{t('trash.review')}</Checkbox><div style={{marginTop:12}}><Button danger disabled={!reviewed||!selected.length||busy} loading={busy} onClick={()=>void remove()}>{t('trash.remove')} ({selected.length})</Button></div></>}
 </section>;
}
