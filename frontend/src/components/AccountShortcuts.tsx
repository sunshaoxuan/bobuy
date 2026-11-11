import {FileTextOutlined, ShopOutlined, UserOutlined} from '@ant-design/icons';
import {NavLink} from 'react-router-dom';
import {useI18n} from '../i18n';

export default function AccountShortcuts({canManage,ordersPath}: {canManage:boolean;ordersPath?:'/client/orders'|'/admin/orders'}) {
  const {t}=useI18n();
  return <nav className="account-shortcuts" aria-label={t('profile.shortcuts')}>
    <NavLink to="/account" end><UserOutlined/><span>{t('profile.title')}</span></NavLink>
    {ordersPath&&<NavLink to={ordersPath}><FileTextOutlined/><span>{t('store.orders')}</span></NavLink>}
    {canManage&&<NavLink to="/admin"><ShopOutlined/><span>{t('store.admin')}</span></NavLink>}
  </nav>;
}
