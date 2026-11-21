import {useEffect,useRef,useState} from 'react';
import {Button,Upload,Alert} from 'antd';
import {productCatalogApi,type CatalogInput} from '../api';
import {useI18n} from '../i18n';
export default function CatalogFileTransfer({ids,getExportIds,disabled,onLoad}:{ids:string[];getExportIds?:()=>Promise<{ids:string[];limitExceeded:boolean}>;disabled:boolean;onLoad:(text:string)=>void}){
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const {t}=useI18n();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 function download(values:CatalogInput[],name:string){if(!active.current)return;const url=URL.createObjectURL(new Blob([JSON.stringify(values,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function exportCurrent(){
  setBusy(true);setError('');
  try {
   const selection=getExportIds?await getExportIds():{ids,limitExceeded:ids.length>500};
   if(!active.current)return;
   if(selection.limitExceeded)throw Error(t('products.archive_export_limit'));
   const values:CatalogInput[]=[];
   for(const id of [...new Set(selection.ids)]){
    if(!active.current)return;
    values.push((await productCatalogApi.get(id)).value);
   }
   download(values,'product-records.json');
  } catch(e){if(active.current)setError((e as Error).message);}
  finally{if(active.current)setBusy(false);}
 }
 async function load(file:File){setBusy(true);setError('');try{if(file.size>2_000_000)throw Error(t('catalogTransfer.invalid'));const text=await file.text();const rows=JSON.parse(text);if(!Array.isArray(rows)||!rows.length||rows.length>500)throw Error(t('catalogTransfer.invalid'));const seen=new Set();for(const row of rows){if(!row||typeof row.productId!=='string'||!row.productId.trim()||seen.has(row.productId))throw Error(t('catalogTransfer.invalid'));seen.add(row.productId);}if(active.current)onLoad(text);}catch(e){if(active.current)setError((e as Error).message);}finally{if(active.current)setBusy(false);}}
 return <div><p>{t('catalogTransfer.help')}</p><div className="product-catalog-actions">
 <Button disabled={disabled||busy} onClick={()=>download([{productId:'REPLACE_WITH_EXISTING_ID',version:0,name:{'ja-JP':''},description:{},itemNumber:null,brand:null,specification:{},model:null,packaging:null,categoryIds:[],supplierId:null,gallery:[],translationsReviewed:false}],'product-records-template.json')}>{t('catalogTransfer.template')}</Button>
 <Button disabled={disabled||busy||(!getExportIds&&(!ids.length||ids.length>500))} loading={busy} onClick={()=>void exportCurrent()}>{t('catalogTransfer.export')}</Button>
 <Upload accept=".json,application/json" showUploadList={false} disabled={disabled||busy} beforeUpload={file=>{void load(file);return false;}}><Button disabled={disabled||busy}>{t('catalogTransfer.load')}</Button></Upload></div>{error&&<Alert type="error" message={error}/>}</div>;
}
