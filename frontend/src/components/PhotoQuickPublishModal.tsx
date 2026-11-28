import {Alert,Button,Input,Modal,Select,Tag} from 'antd';
import {CameraOutlined,PlusOutlined} from '@ant-design/icons';
import {useEffect,useRef,useState} from 'react';
import {photoQuickPublishApi,recommendationTaxonomyApi,type QuickPublishBatch,type RecommendationChoice} from '../api';
import {localizedContent,useI18n} from '../i18n';
import {IMAGE_UPLOAD_ACCEPT,copyFileList} from '../imageUpload';

type UploadRow={key:string;files:File[]};
export default function PhotoQuickPublishModal(){
 const {t,locale}=useI18n(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [suppliers,setSuppliers]=useState<RecommendationChoice[]>([]),[supplier,setSupplier]=useState<string>(),[market,setMarket]=useState('JP');
 const [rows,setRows]=useState<UploadRow[]>([{key:crypto.randomUUID(),files:[]}]),[batch,setBatch]=useState<QuickPublishBatch>();
 const poll=useRef<number>();
 useEffect(()=>()=>window.clearInterval(poll.current),[]);
 useEffect(()=>{if(!open||suppliers.length)return;void recommendationTaxonomyApi.options().then(value=>setSuppliers(value.suppliers)).catch(e=>setError((e as Error).message));},[open,suppliers.length]);
 const update=(key:string,files:File[])=>setRows(current=>current.map(row=>row.key===key?{...row,files:files.slice(0,2)}:row));
 async function submit(){if(busy||!supplier||rows.some(row=>!row.files.length))return;setBusy(true);setError('');try{let current=await photoQuickPublishApi.create({requestKey:crypto.randomUUID(),supplierId:supplier,market});for(const row of rows)current=await photoQuickPublishApi.add(current.id,row.key,row.files);current=await photoQuickPublishApi.seal(current.id);setBatch(current);poll.current=window.setInterval(()=>void photoQuickPublishApi.get(current.id).then(next=>{setBatch(next);if(next.state==='PUBLISHED')window.clearInterval(poll.current);}).catch(e=>setError((e as Error).message)),2500);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function close(){window.clearInterval(poll.current);setOpen(false);}
 return <>
  <Button icon={<CameraOutlined/>} onClick={()=>setOpen(true)}>{t('quickPublish.title')}</Button>
  <Modal className="photo-quick-publish" open={open} title={t('quickPublish.title')} onCancel={close} footer={null} destroyOnClose={false}>
   <p>{t('quickPublish.hint')}</p>{error&&<Alert type="error" message={error}/>} {!batch?<>
    <div className="quick-publish-scope"><label>{t('master.supplier')}<Select value={supplier} onChange={setSupplier} options={suppliers.map(row=>({value:row.id,label:localizedContent(row.name,locale)}))}/></label><label>{t('quickPublish.market')}<Input maxLength={2} value={market} onChange={e=>setMarket(e.target.value.toUpperCase())}/></label></div>
    <div className="quick-publish-rows">{rows.map((row,index)=><div className="quick-publish-row" key={row.key}><strong>{t('quickPublish.product')} {index+1}</strong><input aria-label={`${t('quickPublish.product')} ${index+1}`} type="file" accept={IMAGE_UPLOAD_ACCEPT} multiple onChange={e=>update(row.key,copyFileList(e.currentTarget.files))}/><span>{t('quickPublish.photoCount',{count:String(row.files.length)})}</span>{rows.length>1&&<Button onClick={()=>setRows(value=>value.filter(x=>x.key!==row.key))}>{t('store.remove')}</Button>}</div>)}</div>
    <Button icon={<PlusOutlined/>} onClick={()=>setRows(value=>[...value,{key:crypto.randomUUID(),files:[]}])}>{t('quickPublish.addProduct')}</Button>
    <p className="quick-publish-requirements">{!supplier?t('quickPublish.chooseSupplier'):rows.some(row=>!row.files.length)?t('quickPublish.choosePhotos'):t('quickPublish.ready')}</p>
    <Button type="primary" loading={busy} disabled={!supplier||rows.some(row=>!row.files.length)||!market.match(/^[A-Z]{2}$/)} onClick={()=>void submit()}>{t('quickPublish.start')}</Button>
   </>:<><div className="quick-publish-counts" role="status"><span>{t('quickPublish.total')}: {batch.total}</span><span>{t('quickPublish.processing')}: {batch.processing}</span><span>{t('quickPublish.published')}: {batch.published}</span><span>{t('quickPublish.needsInfo')}: {batch.needsInformation}</span></div><ul>{batch.items.map(item=><li key={item.id}><Tag>{t(`quickPublish.state.${item.state}`)}</Tag><span>{item.issueCode?t(item.issueCode):item.productId}</span>{item.productId&&<a href={`/products?product=${encodeURIComponent(item.productId)}`}>{t('quickPublish.storefront')}</a>}</li>)}</ul><Button onClick={close}>{t('common.close')}</Button></>}
  </Modal>
 </>;
}
