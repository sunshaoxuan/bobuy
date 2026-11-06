import {useEffect,useState} from 'react';
import {Alert,Button,Checkbox,Drawer,Input,InputNumber,Modal,Popconfirm,Select,Spin,Table,Tooltip} from 'antd';
import {EditOutlined,PlusOutlined,ReloadOutlined,SaveOutlined,TagsOutlined} from '@ant-design/icons';
import {productMarkerApi,type ProductMarkerDefinition,type ProductMarkerInput} from '../api';
import {localizedContent,useI18n} from '../i18n';
import {useUserRole} from '../context/UserRoleContext';
import {MARKER_COLORS,MARKER_LOCALES,orderedMarkers,validMarkerBadge} from '../productMarkers';
import ProductMarkerBadges from '../components/ProductMarkerBadges';
import '../product-markers.css';
const empty=():ProductMarkerInput=>({code:'',badge:'',name:Object.fromEntries(MARKER_LOCALES.map(key=>[key,''])),description:{},color:'green',sortOrder:0,enabled:true});
export default function ProductMarkers(){const {isMerchant}=useUserRole();return isMerchant?<MarkerManagement/>:null;}
function MarkerManagement(){
 const {t,locale}=useI18n();const [rows,setRows]=useState<ProductMarkerDefinition[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[success,setSuccess]=useState(false);
 const [draft,setDraft]=useState<ProductMarkerInput>(),[original,setOriginal]=useState<ProductMarkerDefinition>(),[initial,setInitial]=useState(''),[formError,setFormError]=useState('');
 const dirty=!!draft&&JSON.stringify(draft)!==initial;
 useEffect(()=>{let active=true;setLoading(true);setError('');void productMarkerApi.list().then(result=>{if(active)setRows(orderedMarkers(result));}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[attempt]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 function open(marker?:ProductMarkerDefinition){const value:ProductMarkerInput=marker?{code:marker.code,badge:marker.badge,name:{...marker.name},description:{...marker.description},color:marker.color,sortOrder:marker.sortOrder,enabled:marker.enabled}:empty();setOriginal(marker);setDraft(value);setInitial(JSON.stringify(value));setFormError('');setSuccess(false);}
 function close(){if(busy)return;if(dirty){Modal.confirm({title:t('marker.discard'),onOk:()=>setDraft(undefined)});}else setDraft(undefined);}
 function change(patch:Partial<ProductMarkerInput>){setDraft(value=>value?{...value,...patch}:value);setFormError('');}
 async function defaults(){setBusy(true);setError('');setSuccess(false);try{setRows(orderedMarkers(await productMarkerApi.defaults()));setSuccess(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function save(){if(!draft||busy)return;if(!/^[a-z][a-z0-9_-]{0,39}$/.test(draft.code)||!validMarkerBadge(draft.badge)||!Number.isInteger(draft.sortOrder)||draft.sortOrder<0||draft.sortOrder>10000||MARKER_LOCALES.some(key=>!draft.name[key]?.trim()||draft.name[key].length>80)||Object.values(draft.description).some(text=>text.length>1000)){setFormError('marker.validation');return;}
  setBusy(true);setFormError('');try{const result=original?await productMarkerApi.update(original.id,{...draft,version:original.version}):await productMarkerApi.create(draft);setRows(values=>orderedMarkers([...values.filter(value=>value.id!==result.id),result]));setDraft(undefined);setSuccess(true);}catch(e){setFormError((e as Error).message);}finally{setBusy(false);}}
 return <section className="marker-management"><header className="marker-heading"><h1>{t('marker.title')}</h1><div className="marker-actions"><Popconfirm title={t('marker.defaults_confirm')} onConfirm={()=>void defaults()}><Button icon={<TagsOutlined aria-hidden/>} disabled={busy||loading||!!draft}>{t('marker.defaults')}</Button></Popconfirm><Button type="primary" icon={<PlusOutlined aria-hidden/>} disabled={busy||loading} onClick={()=>open()}>{t('marker.create')}</Button><Tooltip title={t('marker.reload')}><Button icon={<ReloadOutlined aria-hidden/>} aria-label={t('marker.reload')} disabled={busy||!!draft} onClick={()=>setAttempt(v=>v+1)}/></Tooltip></div></header>
  {error&&<Alert showIcon type="error" message={t(error)}/>}{success&&<Alert showIcon type="success" message={t('marker.saved')}/>}
  {loading?<Spin/>:<Table rowKey="id" dataSource={rows} scroll={{x:650}} pagination={{pageSize:20}} columns={[
   {title:t('marker.badge'),key:'badge',render:(_,row)=><ProductMarkerBadges markers={[{...row,enabled:true}]}/>},
   {title:t('marker.name'),key:'name',render:(_,row)=><><strong>{localizedContent(row.name,locale)}</strong><small className="marker-code">{row.code}</small></>},
   {title:t('marker.order'),dataIndex:'sortOrder',key:'sortOrder'},
   {title:t('marker.enabled'),key:'enabled',render:(_,row)=>t(row.enabled?'marker.enabled':'marker.disabled')},
   {title:t('marker.edit'),key:'edit',render:(_,row)=><Tooltip title={t('marker.edit')}><Button icon={<EditOutlined aria-hidden/>} aria-label={t('marker.edit')+' '+localizedContent(row.name,locale)} disabled={busy} onClick={()=>open(row)}/></Tooltip>}
  ]}/>}
  <Drawer className="marker-drawer" width="min(100vw,680px)" title={t(original?'marker.edit':'marker.create')} open={!!draft} onClose={close} maskClosable={false} destroyOnClose>
   {draft&&<form className="marker-form" onSubmit={event=>{event.preventDefault();void save();}}>
    {formError&&<Alert showIcon type="error" message={t(formError)} description={t('marker.save_error_hint')}/>}
    <fieldset disabled={busy}><label>{t('marker.code')}<Input aria-label={t('marker.code')} required value={draft.code} disabled={!!original} maxLength={40} onChange={event=>change({code:event.target.value})}/></label>
    <div className="marker-form-row"><label>{t('marker.badge')}<Input aria-label={t('marker.badge')} required value={draft.badge} onChange={event=>change({badge:event.target.value})}/></label><label>{t('marker.color')}<Select disabled={busy} aria-label={t('marker.color')} value={draft.color} onChange={color=>change({color})} options={MARKER_COLORS.map(color=>({value:color,label:<span className="marker-color-option"><span className={'marker-swatch marker-color-'+color}/>{t('marker.color.'+color)}</span>}))}/></label><label>{t('marker.order')}<InputNumber aria-label={t('marker.order')} min={0} max={10000} precision={0} value={draft.sortOrder} onChange={value=>change({sortOrder:value??0})}/></label></div>
    {MARKER_LOCALES.map(language=><div className="marker-locale" key={language}><h2>{language}</h2><label>{t('marker.name')}<Input aria-label={t('marker.name')+' '+language} required maxLength={80} value={draft.name[language]??''} onChange={event=>change({name:{...draft.name,[language]:event.target.value}})}/></label><label>{t('marker.description')}<Input.TextArea aria-label={t('marker.description')+' '+language} rows={2} maxLength={1000} value={draft.description[language]??''} onChange={event=>change({description:{...draft.description,[language]:event.target.value}})}/></label></div>)}
    <Checkbox checked={draft.enabled} onChange={event=>change({enabled:event.target.checked})}>{t('marker.enabled')}</Checkbox>
    </fieldset><div className="marker-actions"><Button type="primary" htmlType="submit" icon={<SaveOutlined aria-hidden/>} loading={busy}>{t('marker.save')}</Button><Button disabled={busy} onClick={close}>{t('common.cancel')}</Button>{original&&<Popconfirm title={t('marker.discard')} onConfirm={()=>{setDraft(undefined);setAttempt(v=>v+1);}}><Button disabled={busy} icon={<ReloadOutlined aria-hidden/>}>{t('marker.reload')}</Button></Popconfirm>}</div>
   </form>}
  </Drawer>
 </section>;
}
