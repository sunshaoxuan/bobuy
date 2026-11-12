import {Drawer} from 'antd';
import {CalendarOutlined,CheckCircleOutlined,CompassOutlined,FileTextOutlined,ShopOutlined,UserOutlined,WalletOutlined} from '@ant-design/icons';
import {Link,useLocation} from 'react-router-dom';
import {useI18n} from '../i18n';
import {useUserRole} from '../context/UserRoleContext';
import {scopedPath} from '../storeNavigation';

export default function StoreNavigation({open,onClose,homePath='/products'}:{
  nodes:{id:number;name:string}[];node?:number;open:boolean;onClose:()=>void;
  onNodeChange:(id?:number)=>void;loading:boolean;homePath?:'/products'|'/recommendations'|null;
}) {
  const {t}=useI18n(),location=useLocation(),{isCustomer}=useUserRole();
  const entries=[['/recommendations','rec.title',ShopOutlined],['/products','store.catalog',CompassOutlined],['/trips','browse.bookable',CalendarOutlined],
    ['/client/trips','browse.executed',CheckCircleOutlined],
    ...(isCustomer?[['/client/orders','store.orders',FileTextOutlined],['/client/billing','store.billing',WalletOutlined]] as const:[]),
    ['/account','store.account',UserOutlined]] as const;
  const pathname=location.pathname==='/'?homePath:location.pathname;
  const selected=(path:string)=>pathname===path||!!pathname?.startsWith(path+'/');
  const contents=()=><>
    <Link className="browse-brand" to={scopedPath('/',location.search)} onClick={onClose}><span className="browse-brand-mark">B</span><span className="browse-brand-label"><strong>{t('app.brand')}</strong><span className="browse-brand-domain">bobuy.cc</span></span></Link>
    <nav className="browse-links" aria-label={t('store.navigation')}>{entries.map(([path,key,Icon])=><Link
      key={path} className={selected(path)?'active':undefined} aria-current={selected(path)?'page':undefined} to={scopedPath(path,location.search)} onClick={onClose}><Icon aria-hidden="true"/><span>{t(key)}</span></Link>)}</nav>
  </>;
  return <><aside className="browse-sidebar">{contents()}</aside><Drawer className="browse-drawer" placement="left"
    title={t('store.navigation')} width="min(320px, 88vw)" open={open} onClose={onClose} rootStyle={{zIndex:1100}}>{open&&contents()}</Drawer></>;
}
