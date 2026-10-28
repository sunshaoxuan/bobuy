import {useEffect,useState} from 'react';
import {Alert,Button,Table,Tag} from 'antd';
import {masterDataApi,type CurrencyDefinition} from '../api';
import {useI18n} from '../i18n';

export default function Currencies(){
 const {t}=useI18n();
 const [rows,setRows]=useState<CurrencyDefinition[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setBusy(true);setError('');void masterDataApi.currencies().then(value=>{if(active)setRows(value);}).catch(e=>{if(active)setError((e as Error).message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[reload]);
 return <section className="currency-master"><h1>{t('currency.title')}</h1>
  <Alert type="info" showIcon message={t('currency.hint')}/>
  <Button onClick={()=>setReload(value=>value+1)} loading={busy}>{t('currency.reload')}</Button>
  {error&&<Alert type="error" message={error}/>}
  <Table rowKey="code" loading={busy} pagination={false} dataSource={rows} scroll={{x:480}} columns={[
   {title:t('sale.currency'),dataIndex:'code'},
   {title:t('sale.symbol'),dataIndex:'symbol'},
   {title:t('sale.digits'),dataIndex:'fractionDigits'},
   {title:t('currency.status'),render:(_,value)=><Tag>{t(value.saleEnabled?'currency.enabled':'currency.reserved')}</Tag>}
  ]}/>
 </section>;
}
