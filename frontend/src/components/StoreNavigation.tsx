import {Drawer,Select} from 'antd';
import {CalendarOutlined,CheckCircleOutlined,CompassOutlined,FileTextOutlined,ShopOutlined,UserOutlined,WalletOutlined} from '@ant-design/icons';
import {Link,NavLink,useLocation} from 'react-router-dom';
import {useI18n} from '../i18n';
import {useUserRole} from '../context/UserRoleContext';
import {scopedPath} from '../storeNavigation';

export default function StoreNavigation({nodes,node,open,onClose,onNodeChange,loading}:{
  nodes:{id:number;name:string}[];node?:number;open:boolean;onClose:()=>void;
  onNodeChange:(id?:number)=>void;loading:boolean;
}) {
  const {t}=useI18n(),location=useLocation(),{isCustomer}=useUserRole();
  const entries=[['/','browse.home',CompassOutlined],['/trips','browse.bookable',CalendarOutlined],
    ['/client/trips','browse.executed',CheckCircleOutlined],['/recommendations','rec.title',ShopOutlined],
    ...(isCustomer?[['/client/orders','store.orders',FileTextOutlined],['/client/billing','store.billing',WalletOutlined]] as const:[]),
    ['/account','store.account',UserOutlined]] as const;
  const contents=(mobile:boolean)=><>
    <Link className="browse-brand" to={scopedPath('/',location.search)} onClick={onClose}><span className="browse-brand-mark">B</span><strong>{t('app.brand')}</strong></Link>
    <section className="browse-node"><label htmlFor={mobile?'mobile-browse-node':'desktop-browse-node'}>{t('browse.node')}</label>
      <Select id={mobile?'mobile-browse-node':'desktop-browse-node'} aria-label={t('browse.node')} value={node??0} loading={loading}
        optionFilterProp="label" showSearch onChange={value=>onNodeChange(value||undefined)}
        options={[{value:0,label:t('browse.all_nodes')},...nodes.map(value=>({value:value.id,label:value.name})),
          ...(node!==undefined&&!nodes.some(value=>value.id===node)?[{value:node,label:t('browse.unavailable_node'),disabled:true}]:[])]}/>
      <p>{t('browse.node_hint')}</p>
    </section>
    <nav className="browse-links" aria-label={t('store.navigation')}>{entries.map(([path,key,Icon])=><NavLink
      key={path} end={path==='/'} to={scopedPath(path,location.search)} onClick={onClose}><Icon aria-hidden="true"/><span>{t(key)}</span></NavLink>)}</nav>
  </>;
  return <><aside className="browse-sidebar">{contents(false)}</aside><Drawer className="browse-drawer" placement="left"
    title={t('store.navigation')} width="min(320px, 88vw)" open={open} onClose={onClose} rootStyle={{zIndex:1100}}>{open&&contents(true)}</Drawer></>;
}
