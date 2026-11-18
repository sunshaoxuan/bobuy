import {useEffect,useState} from 'react';
import {Alert,Button,Checkbox,Collapse,Drawer,Input,InputNumber,Select,Modal} from 'antd';
import {api,productPricingApi,masterDataApi,type PricingSheet,type ProductSale} from '../api';
import {useI18n} from '../i18n';
import {formatMoney} from '../currency';
import PriceAdjustmentWorkspace from './PriceAdjustmentWorkspace';
import {priceDocumentText} from './priceDocumentText';
export {jstInput,jstInstant} from './PriceAdjustmentWorkspace';
import './productPricing.css';
export default function ProductPricingPanel({id,onClose,onSaved}:{id?:string;onClose:()=>void;onSaved:(sheet:PricingSheet)=>void}){
 const {locale,t}=useI18n(),c=priceDocumentText[locale];const [sheet,setSheet]=useState<PricingSheet>(),[regular,setRegular]=useState<ProductSale>({amount:0,currency:'JPY',unit:'',revision:0,enabled:true}),[codes,setCodes]=useState<{code:string;fractionDigits:number}[]>([]),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!id)return;let current=true;setBusy(true);setError('');setReason('');setConfirmed(false);void Promise.all([productPricingApi.get(id),masterDataApi.currencies()]).then(([value,currencies])=>{if(current){setSheet(value);setRegular(value.regular??{amount:0,currency:'JPY',unit:'',revision:0,enabled:true});setCodes(currencies);}}).catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setBusy(false);});return()=>{current=false;};},[id]);
 const [publishing,setPublishing]=useState(false),[publishConfirmed,setPublishConfirmed]=useState(false),[unitOpen,setUnitOpen]=useState(false),[unit,setUnit]=useState(''),[unitReason,setUnitReason]=useState(''),[unitConfirmed,setUnitConfirmed]=useState(false),[historyKey,setHistoryKey]=useState(0);
 const affected=sheet?.history.filter(r=>r.value.channel==='STOREFRONT'&&['ACTIVE','SCHEDULED'].includes(r.state))??[];
 const missing=[!regular.amount&&t('pricing.missing_amount'),!regular.unit.trim()&&t('pricing.missing_unit'),!reason.trim()&&t('pricing.missing_reason'),!regular.enabled&&t('pricing.missing_enabled'),!confirmed&&t('pricing.missing_confirmation')].filter(Boolean) as string[];
 async function refresh(){if(!id)return;try{const value=await productPricingApi.get(id);setSheet(value);setRegular(value.regular??regular);onSaved(value);}catch(e){setError((e as Error).message);}}
 async function save(){if(!id||busy||!reason.trim()||!confirmed)return;setBusy(true);setError('');try{const value=await productPricingApi.regular(id,{...regular,reason:reason.trim()});setSheet(value);setRegular(value.regular??regular);onSaved(value);setReason('');setConfirmed(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function publish(){if(!id||busy||!publishConfirmed)return;setBusy(true);setError('');try{await api.patchProduct(id,{visibilityStatus:'PUBLIC'});await refresh();setPublishing(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function correctUnit(){if(!id||!sheet?.regular||busy||!unitConfirmed||!unitReason.trim())return;setBusy(true);setError('');try{const value=await productPricingApi.correctUnit(id,{revision:sheet.regular.revision,amount:sheet.regular.amount,currency:sheet.regular.currency,unit:unit.trim(),reason:unitReason.trim(),documents:Object.fromEntries(affected.map(r=>[r.value.id,r.value.version]))});setSheet(value);setRegular(value.regular!);onSaved(value);setUnitOpen(false);setHistoryKey(v=>v+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Drawer className="product-pricing-drawer" title={c.title} width="min(100vw,1120px)" open={!!id} onClose={()=>!busy&&onClose()} maskClosable={false} keyboard={!busy} closable={!busy} destroyOnClose>
  {error&&<Alert type="error" message={t(error)}/>}{sheet&&<div className="price-document-summary"><span>{sheet.visibility==='PUBLIC'?t('pricing.current'):c.internal}</span><strong>{sheet.effective?formatMoney(sheet.effective.amount,sheet.effective.currency,locale):t('sale.pending')}</strong>{sheet.effective?.unit&&<small>/ {sheet.effective.unit}</small>}</div>}
  {sheet&&sheet.visibility!=='PUBLIC'&&<Alert showIcon type="warning" message={c.privatePrice} action={<Button disabled={busy} onClick={()=>{setError('');setPublishConfirmed(false);setPublishing(true);}}>{c.publish}</Button>}/>}
  {sheet?.regular&&<div className="price-document-actions"><Button disabled={busy} onClick={()=>{setError('');setUnit(sheet.regular!.unit);setUnitReason('');setUnitConfirmed(false);setUnitOpen(true);}}>{c.unitCorrection}</Button></div>}
  <Collapse items={[{key:'regular',label:c.regular,children:<form className="price-document-form" onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy}><div className="price-document-grid">
   <label>{c.currency}<Select aria-label={c.currency} disabled={busy} value={regular.currency} options={codes.map(p=>({value:p.code,label:p.code}))} onChange={currency=>{setRegular({...regular,currency});setConfirmed(false);}}/></label>
   <label>{t('pricing.amount')}<InputNumber aria-label={t('pricing.amount')} min={0} max={1000000000} precision={codes.find(p=>p.code===regular.currency)?.fractionDigits??0} value={regular.amount||undefined} onChange={amount=>{setRegular({...regular,amount:amount??0});setConfirmed(false);}}/></label>
   <label>{c.unit}<Input aria-label={c.unit} maxLength={80} value={regular.unit} onChange={e=>{setRegular({...regular,unit:e.target.value});setConfirmed(false);}}/></label></div>
   <label>{c.regularReason}<Input.TextArea required aria-label={c.regularReason} maxLength={1000} autoSize={{minRows:3,maxRows:8}} value={reason} onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/></label>
   <Checkbox checked={regular.enabled} onChange={e=>{setRegular({...regular,enabled:e.target.checked});setConfirmed(false);}}>{t('pricing.regular_enabled')}</Checkbox>
   <Checkbox checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}>{c.confirm}</Checkbox></fieldset>
   {missing.length>0&&<Alert type="warning" showIcon message={t('pricing.missing_title')} description={<ul className="price-document-missing">{missing.map(item=><li key={item}>{item}</li>)}</ul>}/>}
   <div className="price-document-actions"><Button type="primary" htmlType="submit" disabled={busy||missing.length>0} loading={busy}>{t('pricing.save_regular')}</Button></div>
  </form>}]}/>{id&&<PriceAdjustmentWorkspace key={historyKey} productId={id} onChanged={()=>void refresh()}/>}
 <Modal className="price-document-confirm" title={c.publish} open={publishing} onCancel={()=>!busy&&setPublishing(false)} onOk={()=>void publish()} confirmLoading={busy} okButtonProps={{disabled:busy||!publishConfirmed}} cancelButtonProps={{disabled:busy}} maskClosable={false}>
  <p>{c.publishHelp}</p>{error&&<Alert type="error" message={t(error)}/>}<Checkbox disabled={busy} checked={publishConfirmed} onChange={e=>setPublishConfirmed(e.target.checked)}>{c.publishConfirm}</Checkbox>
 </Modal>
 <Modal className="price-document-confirm" title={c.unitCorrection} open={unitOpen} onCancel={()=>!busy&&setUnitOpen(false)} onOk={()=>void correctUnit()} confirmLoading={busy} okButtonProps={{disabled:busy||!unitConfirmed||!unitReason.trim()||!unit.trim()||unit.trim()===sheet?.regular?.unit}} cancelButtonProps={{disabled:busy}} maskClosable={false}>
  <p>{c.unitHelp}</p>{error&&<Alert type="error" message={t(error)}/>}<p>{sheet?.regular&&formatMoney(sheet.regular.amount,sheet.regular.currency,locale)} / {sheet?.regular?.unit}</p><ul>{affected.map(r=><li key={r.value.id}>{r.value.documentNumber} · {c[r.state as 'ACTIVE']}</li>)}</ul>
  <div className="price-document-form"><label>{c.unitNew}<Input disabled={busy} maxLength={80} value={unit} onChange={e=>{setUnit(e.target.value);setUnitConfirmed(false);}}/></label><label>{c.unitReason}<Input.TextArea disabled={busy} maxLength={1000} value={unitReason} onChange={e=>{setUnitReason(e.target.value);setUnitConfirmed(false);}}/></label><Checkbox disabled={busy} checked={unitConfirmed} onChange={e=>setUnitConfirmed(e.target.checked)}>{c.unitConfirm}</Checkbox><p>{c.required}</p></div>
 </Modal>
 </Drawer>;
}
