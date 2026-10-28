import {Alert,Tabs} from 'antd';
import {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useUserRole} from '../context/UserRoleContext';
import {useI18n} from '../i18n';
import StockMaster from './StockMaster';
import DeletedProducts from './DeletedProducts';

/** One product entity workspace. Status is URL state; server authorization remains authoritative. */
export default function ProductArchive(){
 const {isMerchant,user}=useUserRole();const {t}=useI18n();const [params,setParams]=useSearchParams();
 const deleted=params.get('view')==='deleted';const admin=!!user?.platformAdmin;
 const [activeRevision,setActiveRevision]=useState(0),[deletedRevision,setDeletedRevision]=useState(0);
 const key=deleted?'deleted':isMerchant?'active':'deleted';
 const items=[...(isMerchant?[{key:'active',label:t('products.active'),children:<StockMaster embedded refreshKey={activeRevision} onDeleted={()=>setDeletedRevision(value=>value+1)}/>}]:[]),...(admin?[{key:'deleted',label:t('trash.deleted'),children:<DeletedProducts embedded refreshKey={deletedRevision} onRestored={()=>setActiveRevision(value=>value+1)}/>}]:[])];
 return <section aria-label={t('products.title')}><h1>{t('products.title')}</h1>
  <Tabs activeKey={key} items={items} onChange={value=>{const next=new URLSearchParams(params);if(value==='deleted')next.set('view','deleted');else next.delete('view');setParams(next);}}/>
  {deleted&&!admin&&<Alert type="error" message={t('trash.admin_only')}/>}
 </section>;
}
