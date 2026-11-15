import {Drawer} from 'antd';
import BrandLogo from './BrandLogo';
import {CalendarOutlined,CheckCircleOutlined,CompassOutlined,FileTextOutlined,ShopOutlined,WalletOutlined} from '@ant-design/icons';
import {Link,useLocation} from 'react-router-dom';
import {useI18n} from '../i18n';
import {useUserRole} from '../context/UserRoleContext';
import {scopedPath} from '../storeNavigation';
import {storefrontFeatures} from '../storefrontFeatures';

export default function StoreNavigation({open,onClose,homePath='/products'}:{
  nodes:{id:number;name:string}[];node?:number;open:boolean;onClose:()=>void;
  onNodeChange:(id?:number)=>void;loading:boolean;homePath?:'/products'|'/recommendations'|null;
}) {
  const {t}=useI18n(),location=useLocation(),{isCustomer}=useUserRole();
  const entries=[...(storefrontFeatures.dealsBulletin?[['/recommendations','rec.title',ShopOutlined] as const]:[]),['/products','store.catalog',CompassOutlined] as const,
    ...(storefrontFeatures.trips?[['/trips','browse.bookable',CalendarOutlined] as const, ['/client/trips','browse.executed',CheckCircleOutlined] as const]:[]),
    ...(isCustomer?[['/client/orders','store.orders',FileTextOutlined],['/client/billing','store.billing',WalletOutlined]] as const:[]),
  ] as const;
  const pathname=location.pathname==='/'?homePath:location.pathname;
  const selected=(path:string)=>pathname===path||!!pathname?.startsWith(path+'/');
  const contents=()=><>
    <Link className="browse-brand" to={scopedPath('/',location.search)} onClick={onClose}><BrandLogo/></Link>
    <nav className="browse-links" aria-label={t('store.navigation')}>{entries.map(([path,key,Icon])=><Link
      key={path} className={selected(path)?'active':undefined} aria-current={selected(path)?'page':undefined} to={scopedPath(path,location.search)} onClick={onClose}><Icon aria-hidden="true"/><span>{t(key)}</span></Link>)}</nav>
  </>;
  return <Drawer className="browse-drawer" placement="left" title={t('store.navigation')} width="min(320px, 88vw)"
    open={open} onClose={onClose} rootStyle={{zIndex:1100}}>{open&&contents()}</Drawer>;
}
