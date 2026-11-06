import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Checkbox,Popconfirm,Spin} from 'antd';
import {ClearOutlined,ReloadOutlined,SaveOutlined} from '@ant-design/icons';
import {Link} from 'react-router-dom';
import {productMarkerApi,type ProductMarkerAssignment,type ProductMarkerDefinition} from '../api';
import {localizedContent,useI18n} from '../i18n';
import {useUserRole} from '../context/UserRoleContext';
import {orderedMarkers} from '../productMarkers';
import ProductMarkerBadges from './ProductMarkerBadges';
import '../product-markers.css';
type Props={productId:string;onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void;onSaved?:(assignment:ProductMarkerAssignment)=>void};
export default function ProductMarkerEditor(props:Props){
 const {isMerchant}=useUserRole();return isMerchant?<AssignmentEditor key={props.productId} {...props}/>:null;
}
function AssignmentEditor({productId,onDirtyChange,onBusyChange,onSaved}:Props){
 const {t,locale}=useI18n();
 const [definitions,setDefinitions]=useState<ProductMarkerDefinition[]>([]),[saved,setSaved]=useState<ProductMarkerAssignment>(),[selected,setSelected]=useState<string[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[success,setSuccess]=useState(false);
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const savingRef=useRef(false);
 const dirty=!!saved&&(saved.markerIds.length!==selected.length||selected.some(id=>!saved.markerIds.includes(id)));
 useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
 useEffect(()=>{onBusyChange?.(saving);},[saving,onBusyChange]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 useEffect(()=>{let active=true;setLoading(true);setError('');setSuccess(false);void Promise.all([productMarkerApi.list(),productMarkerApi.assignment(productId)]).then(([rows,assignment])=>{
  if(!active)return;if(assignment.productId!==productId)throw new Error('marker.invalid_response');
  setDefinitions(orderedMarkers(rows));setSaved(assignment);setSelected(assignment.markerIds);
 }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[productId,attempt]);
 async function save(){if(!saved||savingRef.current)return;savingRef.current=true;setSaving(true);onBusyChange?.(true);setError('');setSuccess(false);try{const result=await productMarkerApi.assign(productId,{markerIds:selected,version:saved.version});if(mounted.current){if(result.productId!==productId)throw new Error('marker.invalid_response');setSaved(result);setSelected(result.markerIds);setSuccess(true);onSaved?.(result);}}catch(e){if(mounted.current)setError((e as Error).message);}finally{savingRef.current=false;if(mounted.current){setSaving(false);onBusyChange?.(false);}}}
 const reload=<Button icon={<ReloadOutlined aria-hidden/>} disabled={saving} onClick={()=>setAttempt(v=>v+1)}>{t('marker.reload')}</Button>;
 return <section className="marker-assignment" aria-label={t('marker.assigned')} aria-busy={loading||saving}>
  {error&&<Alert type="error" showIcon message={t(error)} description={t('marker.save_error_hint')}/>}
  {success&&<Alert type="success" showIcon message={t('marker.saved')}/>}
  {loading?<Spin/>:<>{saved&&<fieldset disabled={saving} className="marker-selection"><legend>{t('marker.assigned')}</legend>
   {definitions.map(marker=><div className="marker-choice" key={marker.id}><Checkbox checked={selected.includes(marker.id)} disabled={!selected.includes(marker.id)&&selected.length>=50} onChange={e=>{setSuccess(false);setSelected(ids=>e.target.checked?[...ids,marker.id]:ids.filter(id=>id!==marker.id));}} aria-label={localizedContent(marker.name,locale)}/><ProductMarkerBadges markers={[{...marker,enabled:true}]}/><span>{localizedContent(marker.name,locale)}{!marker.enabled&&<small>{t('marker.disabled')}</small>}</span></div>)}
   {!definitions.length&&<Link to="/admin/product-markers">{t('marker.title')}</Link>}
  </fieldset>}
  <div className="marker-actions"><Button icon={<ClearOutlined aria-hidden/>} disabled={!saved||saving||!selected.length} onClick={()=>{setSelected([]);setSuccess(false);}}>{t('marker.clear')}</Button><Button type="primary" icon={<SaveOutlined aria-hidden/>} loading={saving} disabled={!dirty||loading} onClick={()=>void save()}>{t('marker.save')}</Button>{dirty?<Popconfirm title={t('marker.discard')} onConfirm={()=>setAttempt(v=>v+1)}><Button icon={<ReloadOutlined aria-hidden/>} disabled={saving}>{t('marker.reload')}</Button></Popconfirm>:reload}</div>
  </>}
 </section>;
}
