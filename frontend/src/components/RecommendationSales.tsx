import {useState,useEffect} from 'react';
import {Alert,Button,Checkbox,Input,InputNumber,Modal,Table,Tag} from 'antd';
import {recommendationApi,type ProductSale,type RecommendationDetail,type SaleReview} from '../api';
import {useI18n} from '../i18n';
import {formatMoney} from '../currency';
export type SaleProduct={id:string;visibilityStatus?:string;sale?:ProductSale;currency?:string;basePrice?:number;orderMethod?:string};
export default function RecommendationSales({detail,products,onChange,onReload}:{detail:RecommendationDetail;products:SaleProduct[];onChange:(v:RecommendationDetail)=>void;onReload:()=>Promise<void>}){
 const {t,locale}=useI18n();const [selected,setSelected]=useState<React.Key[]>([]),[rows,setRows]=useState<SaleReview[]>([]),[open,setOpen]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[bulkUnit,setBulkUnit]=useState('');
 const [currencyList,setCurrencyList]=useState<{code:string;symbol:string;fractionDigits:number;name:string;saleEnabled:boolean}[]>([]);
 useEffect(()=>{let active=true;void recommendationApi.currencies().then(values=>{if(active)setCurrencyList(values);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 const product=(id?:string|null)=>products.find(value=>value.id===id);
 function prepare(){setRows(detail.items.filter(item=>selected.includes(item.id)).map(item=>{const prior=product(item.productId)?.sale;return {itemId:item.id,amount:prior?.amount??item.referencePrice??0,currency:'JPY',unit:prior?.unit??item.priceUnit??'',validFrom:prior?.validFrom??item.offerStart,validThrough:prior?.validThrough??item.offerEnd,revision:prior?.revision??0,replaceExisting:false,enabled:prior?.enabled??true};}));setConfirmed(false);setError('');setOpen(true);}
 function patch(id:number,value:Partial<SaleReview>){setRows(previous=>previous.map(row=>row.itemId===id?{...row,...value}:row));}
 async function save(){setBusy(true);setError('');try{onChange(await recommendationApi.sales(detail.post.id,{reviews:rows,version:detail.post.version,confirmedPreorder:confirmed}));await onReload();setOpen(false);setSelected([]);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="rec-sale-review"><h3>{t('sale.title')}</h3><Alert type="info" showIcon message={t('sale.hint')}/>
  <details><summary>{t('sale.currencies')}</summary><Table rowKey="code" size="small" pagination={false} dataSource={currencyList} columns={[{title:t('sale.currency'),dataIndex:'code'},{title:t('sale.symbol'),dataIndex:'symbol'},{title:t('sale.digits'),dataIndex:'fractionDigits'},{title:t('sale.status'),render:(_,c)=><Tag>{t(c.saleEnabled?'sale.enabled':'sale.future')}</Tag>}]}/></details>
  <Table rowKey="id" size="small" pagination={{pageSize:12,showSizeChanger:false}} dataSource={detail.items} rowSelection={{selectedRowKeys:selected,onChange:setSelected,getCheckboxProps:item=>({disabled:!item.productId||product(item.productId)?.orderMethod!=='PRE_ORDER'})}} columns={[
   {title:t('rec.name'),render:(_,item)=><>{item.name}<small>{item.itemNumber}</small></>},
   {title:t('sale.actual'),render:(_,item)=>{const sale=product(item.productId)?.sale;return sale?<>{formatMoney(sale.amount,sale.currency,locale)} / {sale.unit}<Tag>{t(sale.enabled?'sale.enabled':'sale.disabled')}</Tag><small>{sale.validFrom||'…'} — {sale.validThrough||'…'}</small>{product(item.productId)?.visibilityStatus!=='PUBLIC'&&<Tag color="orange">{t('sale.private')}</Tag>}</>:<Tag>{t('sale.pending')}</Tag>;}}
  ]}/><Button disabled={!selected.length} onClick={prepare}>{t('sale.prepare',{count:selected.length})}</Button>
  <Modal width={1100} title={t('sale.title')} open={open} onCancel={()=>!busy&&setOpen(false)} footer={<Button type="primary" disabled={!confirmed||!rows.length||rows.some(row=>!row.amount||!row.unit.trim())} loading={busy} onClick={()=>void save()}>{t('sale.confirm')}</Button>}>
   <Alert type="warning" message={t('sale.review_hint')} showIcon/>{error&&<Alert type="error" message={error}/>}
   <div className="rec-bulk-unit"><Input aria-label={t('sale.unit')} value={bulkUnit} maxLength={80} onChange={e=>setBulkUnit(e.target.value)}/><Button disabled={!bulkUnit.trim()} onClick={()=>setRows(previous=>previous.map(row=>row.unit.trim()?row:{...row,unit:bulkUnit.trim()}))}>{t('sale.fill_unit')}</Button></div>
   <Table rowKey="itemId" pagination={false} scroll={{x:950,y:440}} dataSource={rows} columns={[
    {title:t('rec.name'),width:220,render:(_,row)=>{const item=detail.items.find(i=>i.id===row.itemId)!;return <>{item.name}<small>{t('rec.fact.referencePrice')}: {item.referencePrice==null?'—':formatMoney(item.referencePrice,'JPY',locale)} / {item.priceUnit||'—'}</small></>;}},
    {title:t('sale.actual'),render:(_,row)=><InputNumber aria-label={t('sale.actual')+': '+row.itemId} min={1} max={1000000000} precision={0} prefix="JPY ¥" value={row.amount||undefined} onChange={value=>patch(row.itemId,{amount:value??0})}/>},
    {title:t('sale.unit'),render:(_,row)=><Input aria-label={t('sale.unit')+': '+row.itemId} maxLength={80} value={row.unit} onChange={e=>patch(row.itemId,{unit:e.target.value})}/>},
    {title:t('sale.period'),render:(_,row)=><><Input aria-label={t('rec.fact.offerStart')+': '+row.itemId} type="date" value={row.validFrom??''} onChange={e=>patch(row.itemId,{validFrom:e.target.value||null})}/><Input aria-label={t('rec.fact.offerEnd')+': '+row.itemId} type="date" value={row.validThrough??''} onChange={e=>patch(row.itemId,{validThrough:e.target.value||null})}/></>},
    {title:t('sale.replace'),render:(_,row)=><Checkbox checked={row.replaceExisting} onChange={e=>patch(row.itemId,{replaceExisting:e.target.checked})}>{t('sale.replace')}</Checkbox>},
    {title:t('sale.status'),render:(_,row)=><Checkbox checked={row.enabled} onChange={e=>patch(row.itemId,{enabled:e.target.checked})}>{t('sale.enabled')}</Checkbox>}
   ]}/><Checkbox checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}>{t('sale.ack')}</Checkbox>
  </Modal>
 </section>;
}
