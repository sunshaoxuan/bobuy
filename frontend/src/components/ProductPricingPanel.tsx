import {useEffect,useState} from 'react';
import {Alert,Button,Checkbox,Collapse,Drawer,Input,InputNumber,Modal,Select,Table,Tag} from 'antd';
import {productPricingApi,masterDataApi,type PriceAdjustment,type PricingInput,type PricingSheet,type ProductSale} from '../api';
import {useI18n} from '../i18n';
import {formatMoney} from '../currency';
import './productPricing.css';

export function jstInput(value:string){return new Date(Date.parse(value)+9*60*60*1000).toISOString().slice(0,19);}
export function jstInstant(value:string){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))throw new Error('pricing.invalid');const date=new Date(value+(value.length===16?':00':'')+'+09:00');if(!Number.isFinite(date.getTime()))throw new Error('pricing.invalid');return date.toISOString();}
export default function ProductPricingPanel({id,onClose,onSaved}:{id?:string;onClose:()=>void;onSaved:(sheet:PricingSheet)=>void}){
 const {t,locale}=useI18n();const [sheet,setSheet]=useState<PricingSheet>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [currencies,setCurrencies]=useState<{code:string;fractionDigits:number;saleEnabled:boolean}[]>([]);
 const [draft,setDraft]=useState<{id?:number;version:number;currency:string;amount?:number;start:string;end:string;sourceNote:string}>({version:0,currency:'JPY',start:'',end:'',sourceNote:''});
 const [regular,setRegular]=useState<ProductSale>({amount:0,currency:'JPY',unit:'',revision:0,enabled:false});const [reviewed,setReviewed]=useState(false);
 const [action,setAction]=useState<{kind:'approve'|'cancel';entry:PriceAdjustment}>(),[confirmed,setConfirmed]=useState(false);
 function accept(value:PricingSheet){setSheet(value);onSaved(value);setReviewed(false);setRegular(value.regular??{amount:0,currency:'JPY',unit:'',revision:0,enabled:false});}
 useEffect(()=>{if(!id)return;let active=true;setBusy(true);setError('');setSheet(undefined);setAction(undefined);setReviewed(false);setDraft({version:0,currency:'JPY',start:'',end:'',sourceNote:''});
  void Promise.all([productPricingApi.get(id),masterDataApi.currencies()]).then(([value,codes])=>{if(active){setSheet(value);setCurrencies(codes);setRegular(value.regular??{amount:0,currency:'JPY',unit:'',revision:0,enabled:false});}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[id]);
 async function run(task:()=>Promise<PricingSheet>){setBusy(true);setError('');try{const result=await task();accept(result);return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}}
 const date=(value:string)=>new Date(value).toLocaleString(locale,{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 function edit(value:PriceAdjustment){setDraft({id:value.id,version:value.version,currency:value.currency,amount:value.amount,start:jstInput(value.startsAt),end:jstInput(value.endsAt),sourceNote:value.sourceNote});}
 function reset(){setDraft({version:0,currency:sheet?.regular?.currency??'JPY',start:'',end:'',sourceNote:''});}
 const controls=(row:PricingSheet['history'][number])=><div className="product-catalog-actions">{row.state==='DRAFT'&&<><Button disabled={busy} onClick={()=>edit(row.value)}>{t('pricing.edit')}</Button><Button disabled={busy} onClick={()=>{setAction({kind:'approve',entry:row.value});setConfirmed(false);setError('');}}>{t('pricing.approve')}</Button></>}{['DRAFT','SCHEDULED','ACTIVE'].includes(row.state)&&<Button disabled={busy} onClick={()=>{setAction({kind:'cancel',entry:row.value});setConfirmed(false);setError('');}}>{t('pricing.cancel')}</Button>}</div>;
 const currencyOptions=currencies.map(c=>({value:c.code,label:c.code}));
 return <Drawer title={t('pricing.title')} width="min(100vw,1000px)" open={!!id} onClose={()=>{if(!busy)onClose();}} maskClosable={!busy} keyboard={!busy} closable={!busy} destroyOnClose>
  <Alert type="info" message={t('pricing.boundary')}/><div className="product-catalog-actions"><p>{id}</p><Button disabled={busy} onClick={()=>id&&void run(()=>productPricingApi.get(id))}>{t('rec.reload')}</Button></div>{error&&<Alert type="error" message={t(error)}/>}
  {sheet&&<><p>{t('pricing.current')}: {sheet.effective?formatMoney(sheet.effective.amount,sheet.effective.currency,locale):t('sale.pending')}</p><p>{t('pricing.visibility')}: {sheet.visibility}</p>
   <Collapse items={[{key:'regular',label:t('pricing.regular'),children:<fieldset className="product-catalog-form" disabled={busy}>
    <Alert message={t('pricing.regular_hint')} type="info"/>
    <label>{t('pricing.currency')}<Select disabled={busy} aria-label={t('pricing.currency')} value={regular.currency} options={currencyOptions} onChange={currency=>{setRegular({...regular,currency});setReviewed(false);}}/></label>
    <label>{t('pricing.amount')}<InputNumber aria-label={t('pricing.amount')} min={0} max={1000000000} precision={currencies.find(c=>c.code===regular.currency)?.fractionDigits??0} value={regular.amount||undefined} onChange={value=>{setRegular({...regular,amount:value??0});setReviewed(false);}}/></label>
    <label>{t('pricing.unit')}<Input value={regular.unit} onChange={e=>{setRegular({...regular,unit:e.target.value});setReviewed(false);}}/></label>
    <label>{t('pricing.available_from')}<Input type="date" value={regular.validFrom??''} onChange={e=>{setRegular({...regular,validFrom:e.target.value||null});setReviewed(false);}}/></label>
    <label>{t('pricing.available_through')}<Input type="date" value={regular.validThrough??''} onChange={e=>{setRegular({...regular,validThrough:e.target.value||null});setReviewed(false);}}/></label>
    <Checkbox checked={regular.enabled} onChange={e=>{setRegular({...regular,enabled:e.target.checked});setReviewed(false);}}>{t('pricing.regular_enabled')}</Checkbox>
    <Checkbox checked={reviewed} onChange={e=>setReviewed(e.target.checked)}>{t('pricing.regular_ack')}</Checkbox>
    <Button disabled={!reviewed||busy||sheet.orderMethod!=='PRE_ORDER'} loading={busy} onClick={()=>id&&void run(()=>productPricingApi.regular(id,regular))}>{t('pricing.save_regular')}</Button>
   </fieldset>}]}/>
   <h2>{t('pricing.draft')}</h2><fieldset className="product-catalog-form" disabled={busy}>
    <p>{t('pricing.channel')}: {t('pricing.storefront')}</p>
    <label>{t('pricing.adjusted_amount')}<InputNumber aria-label={t('pricing.adjusted_amount')} min={0} max={1000000000} precision={currencies.find(c=>c.code===draft.currency)?.fractionDigits??0} value={draft.amount} onChange={value=>setDraft({...draft,amount:value??undefined})}/></label>
    <label>{t('pricing.currency')}<Select disabled={busy} aria-label={t('pricing.currency')} value={draft.currency} options={currencyOptions} onChange={currency=>setDraft({...draft,currency})}/></label>
    <div className="product-catalog-pair"><label>{t('pricing.starts')}<Input type="datetime-local" step={1} value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label><label>{t('pricing.ends')}<Input type="datetime-local" step={1} value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label></div>
    <label>{t('pricing.source')}<Input.TextArea aria-label={t('pricing.source')} rows={2} maxLength={1000} value={draft.sourceNote} onChange={e=>setDraft({...draft,sourceNote:e.target.value})}/></label>
    <div className="product-catalog-actions"><Button loading={busy} disabled={busy||!draft.amount||!draft.start||!draft.end} onClick={()=>{if(id)void run(()=>{const value:PricingInput={channel:'STOREFRONT',currency:draft.currency,amount:draft.amount!,startsAt:jstInstant(draft.start),endsAt:jstInstant(draft.end),sourceNote:draft.sourceNote,version:draft.version};return productPricingApi.draft(id,value,draft.id);}).then(saved=>{if(saved)reset();});}}>{t(draft.id?'pricing.save_draft':'pricing.create_draft')}</Button><Button disabled={busy} onClick={reset}>{t('pricing.new')}</Button></div>
   </fieldset>
   <h2>{t('pricing.history')}</h2><div className="pricing-history-table"><Table rowKey={row=>row.value.id} dataSource={sheet.history} scroll={{x:700}} pagination={{pageSize:8}} columns={[
    {title:'ID',render:(_,row)=>row.value.id},{title:t('pricing.adjusted_amount'),render:(_,row)=>formatMoney(row.value.amount,row.value.currency,locale)},
    {title:t('pricing.period'),render:(_,row)=><>{date(row.value.startsAt)} → {date(row.value.endsAt)} JST</>},
    {title:t('pricing.state'),render:(_,row)=><Tag>{t('pricing.state.'+row.state)}</Tag>},
    {title:t('pricing.source'),render:(_,row)=><>{row.value.sourceNote}<small>{t('pricing.created')}: {date(row.value.createdAt)}</small>{row.value.approvedAt&&<small>{t('pricing.approved')}: {date(row.value.approvedAt)}</small>}</>},
    {title:t('stock.table.action'),render:(_,row)=>controls(row)}
   ]}/></div><div className="pricing-history-cards">{sheet.history.map(row=><article key={row.value.id} data-adjustment-id={row.value.id}><div><strong>#{row.value.id} · {formatMoney(row.value.amount,row.value.currency,locale)}</strong><Tag>{t('pricing.state.'+row.state)}</Tag></div><p>{date(row.value.startsAt)} → {date(row.value.endsAt)} JST</p><p>{row.value.sourceNote}</p><small>{t('pricing.created')}: {date(row.value.createdAt)}</small>{controls(row)}</article>)}</div>
  </>}
  <Modal title={t('pricing.confirm_title')} open={!!action} onCancel={()=>{if(!busy)setAction(undefined);}} cancelButtonProps={{disabled:busy}} closable={!busy} maskClosable={!busy} keyboard={!busy} confirmLoading={busy} okButtonProps={{disabled:!confirmed||busy}} onOk={()=>{if(id&&action)void run(()=>productPricingApi[action.kind](id,action.entry)).then(ok=>{if(ok)setAction(undefined);});}}>
   {action&&<>{error&&<Alert type="error" message={t(error)}/>}<strong>{t('pricing.'+action.kind)} · #{action.entry.id} · {formatMoney(action.entry.amount,action.entry.currency,locale)} / {sheet?.regular?.unit}</strong><p>{date(action.entry.startsAt)} → {date(action.entry.endsAt)} JST</p><p>{action.entry.sourceNote}</p><Checkbox checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}>{t('pricing.action_ack')}</Checkbox></>}
  </Modal>
 </Drawer>;
}
