import {useRef,useState} from 'react';
import {Alert,Button,Checkbox,Table,Upload} from 'antd';
import {authenticatedDownload,authenticatedFormPost} from '../api';
import {useI18n} from '../i18n';
type Preview={revision:string;fileHash:string;valid:boolean;rows:{row:number;id:string;parentId:string|null;name:Record<string,string>;sortOrder:number;imageUrl:string|null;action:string;errors:string[]}[]};
export default function CategoryStructureTransfer({onSaved}:{onSaved:()=>Promise<void>}){
 const {t}=useI18n();const [file,setFile]=useState<File>(),[preview,setPreview]=useState<Preview>(),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);const generation=useRef(0);
 function select(file?:File){generation.current++;setFile(file);setPreview(undefined);setConfirmed(false);setError('');setDone(false);}
 async function run(commit=false){if(!file||busy||commit&&(!preview?.valid||!confirmed))return;const version=generation.current;setBusy(true);setError('');setDone(false);
  try{const form=new FormData();form.append('file',file);if(commit&&preview){form.append('revision',preview.revision);form.append('fileHash',preview.fileHash);form.append('confirmed','true');}
   const result=await authenticatedFormPost<Preview>('/api/category-tree/import/'+(commit?'confirm':'preview'),form);if(version!==generation.current)return;
   setPreview(result);setConfirmed(false);if(commit){setDone(true);setPreview(undefined);await onSaved();}
  }catch(e){if(version===generation.current)setError((e as Error).message);}finally{setBusy(false);}
 }
 async function download(template:boolean){try{await authenticatedDownload('/api/category-tree/export.csv?template='+template,template?'category-structure-template.csv':'category-structure.csv');}catch(e){setError((e as Error).message);}}
 return <div className="category-structure-transfer"><h2>{t('categoryTransfer.title')}</h2><p>{t('categoryTransfer.help')}</p>
  <div className="category-tree-actions"><Button disabled={busy} onClick={()=>void download(true)}>{t('categoryImport.template')}</Button><Button disabled={busy} onClick={()=>void download(false)}>{t('categoryTransfer.export')}</Button>
  <Upload accept=".csv" maxCount={1} disabled={busy} beforeUpload={f=>{select(f);return false;}} onRemove={()=>select()}><Button disabled={busy}>{t('categoryImport.choose')}</Button></Upload>
  <Button disabled={!file||busy} onClick={()=>void run()}>{t('categoryImport.preview')}</Button></div>
  {error&&<Alert type="error" showIcon message={error}/>} {done&&<Alert type="success" message={t('categoryTransfer.done')}/>}
  {preview&&<><Table rowKey="row" pagination={{pageSize:10}} scroll={{x:700}} dataSource={preview.rows} columns={[{title:t('categoryImport.row'),dataIndex:'row'},{title:'ID',dataIndex:'id'},{title:t('categoryTree.parent'),dataIndex:'parentId'},{title:t('categoryTree.name.ja-JP'),render:(_,r)=>r.name['ja-JP']},{title:t('categoryTransfer.order'),dataIndex:'sortOrder'},{title:t('categoryImport.result'),render:(_,r)=>r.errors.join('; ')||t(r.action==='CREATE'?'categoryTransfer.create':'categoryTransfer.update')}]}/>
  <p>{t(!preview.valid?'categoryImport.resolveErrors':confirmed?'categoryImport.ready':'categoryImport.checkRequired')}</p>
  <Checkbox disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}>{t('categoryTransfer.confirm')}</Checkbox>
  <Button type="primary" disabled={!preview.valid||!confirmed||busy} onClick={()=>void run(true)}>{t('categoryImport.confirm')}</Button></>}
 </div>;
}
