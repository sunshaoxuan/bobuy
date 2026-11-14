import {useEffect,useState} from 'react';
import {Alert,Button,Checkbox,Collapse,Drawer,Input,InputNumber,Select} from 'antd';
import {productPricingApi,masterDataApi,type PricingSheet,type ProductSale} from '../api';
import {useI18n} from '../i18n';
import {formatMoney} from '../currency';
import PriceAdjustmentWorkspace from './PriceAdjustmentWorkspace';
import {priceDocumentText} from './priceDocumentText';
export {jstInput,jstInstant} from './PriceAdjustmentWorkspace';
import './productPricing.css';
export default function ProductPricingPanel({id,onClose,onSaved}:{id?:string;onClose:()=>void;onSaved:(sheet:PricingSheet)=>void}){
 const {locale,t}=useI18n(),c=priceDocumentText[locale];const [sheet,setSheet]=useState<PricingSheet>(),[regular,setRegular]=useState<ProductSale>({amount:0,currency:'JPY',unit:'',revision:0,enabled:true}),[codes,setCodes]=useState<{code:string;fractionDigits:number}[]>([]),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!id)return;let current=true;setBusy(true);setError('');setReason('');setConfirmed(false);void Promise.all([productPricingApi.get(id),masterDataApi.currencies()]).then(([value,currencies])=>{if(current){setSheet(value);setRegular(value.regular??{amount:0,currency:'JPY',unit:'',revision:0,enabled:true});setCodes(currencies);}}).catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setBusy(false);});return()=>{current=false;};},[id]);
 const missing=[!regular.amount&&t('pricing.missing_amount'),!regular.unit.trim()&&t('pricing.missing_unit'),!reason.trim()&&t('pricing.missing_reason'),!regular.enabled&&t('pricing.missing_enabled'),!confirmed&&t('pricing.missing_confirmation')].filter(Boolean) as string[];
 async function refresh(){if(!id)return;try{const value=await productPricingApi.get(id);setSheet(value);onSaved(value);}catch(e){setError((e as Error).message);}}
 async function save(){if(!id||busy||!reason.trim()||!confirmed)return;setBusy(true);setError('');try{const value=await productPricingApi.regular(id,{...regular,reason:reason.trim()});setSheet(value);setRegular(value.regular??regular);onSaved(value);setReason('');setConfirmed(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Drawer className="product-pricing-drawer" title={c.title} width="min(100vw,1120px)" open={!!id} onClose={()=>!busy&&onClose()} maskClosable={false} keyboard={!busy} closable={!busy} destroyOnClose>
  {error&&<Alert type="error" message={t(error)}/>}{sheet&&<div className="price-document-summary"><span>{t('pricing.current')}</span><strong>{sheet.effective?formatMoney(sheet.effective.amount,sheet.effective.currency,locale):t('sale.pending')}</strong>{sheet.effective?.unit&&<small>/ {sheet.effective.unit}</small>}</div>}
  <Collapse items={[{key:'regular',label:c.regular,children:<form className="price-document-form" onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy}><div className="price-document-grid">
   <label>{c.currency}<Select aria-label={c.currency} disabled={busy} value={regular.currency} options={codes.map(p=>({value:p.code,label:p.code}))} onChange={currency=>{setRegular({...regular,currency});setConfirmed(false);}}/></label>
   <label>{t('pricing.amount')}<InputNumber aria-label={t('pricing.amount')} min={0} max={1000000000} precision={codes.find(p=>p.code===regular.currency)?.fractionDigits??0} value={regular.amount||undefined} onChange={amount=>{setRegular({...regular,amount:amount??0});setConfirmed(false);}}/></label>
   <label>{c.unit}<Input aria-label={c.unit} maxLength={80} value={regular.unit} onChange={e=>{setRegular({...regular,unit:e.target.value});setConfirmed(false);}}/></label></div>
   <label>{c.regularReason}<Input.TextArea required aria-label={c.regularReason} maxLength={1000} autoSize={{minRows:3,maxRows:8}} value={reason} onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/></label>
   <Checkbox checked={regular.enabled} onChange={e=>{setRegular({...regular,enabled:e.target.checked});setConfirmed(false);}}>{t('pricing.regular_enabled')}</Checkbox>
   <Checkbox checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}>{c.confirm}</Checkbox></fieldset>
   {missing.length>0&&<Alert type="warning" showIcon message={t('pricing.missing_title')} description={<ul className="price-document-missing">{missing.map(item=><li key={item}>{item}</li>)}</ul>}/>}
   <div className="price-document-actions"><Button type="primary" htmlType="submit" disabled={busy||missing.length>0} loading={busy}>{t('pricing.save_regular')}</Button></div>
  </form>}]}/>{id&&<PriceAdjustmentWorkspace productId={id} onChanged={()=>void refresh()}/>}
 </Drawer>;
}
