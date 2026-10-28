import { lazy, Suspense, useState } from 'react';
import { Button, Drawer, Menu, Spin, Tooltip } from 'antd';
import { MenuOutlined, LogoutOutlined, AppstoreOutlined, CalendarOutlined, ShoppingOutlined, InboxOutlined, ScanOutlined, CheckSquareOutlined, TagsOutlined, TeamOutlined, ShopOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useUserRole } from './context/UserRoleContext';
import Storefront from './pages/Storefront';
import './storefront.css';
import './merchant.css';
import { useI18n } from './i18n';
import LanguageSwitcher from './components/LanguageSwitcher';
import LegacyProductRoute from './components/LegacyProductRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trips = lazy(() => import('./pages/Trips'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDesk = lazy(() => import('./pages/OrderDesk'));
const ProcurementHUD = lazy(() => import('./pages/ProcurementHUD'));
const PickingMaster = lazy(() => import('./pages/PickingMaster'));
const ProductArchive = lazy(() => import('./pages/ProductArchive'));
const Recommendations = lazy(() => import('./pages/Recommendations'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const MerchantCustomers = lazy(() => import('./pages/MerchantCustomers'));
const ZenAuditView = lazy(() => import('./pages/ZenAuditView'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Users = lazy(() => import('./pages/Users'));
const MailSettings = lazy(() => import('./pages/MailSettings'));
const Currencies = lazy(() => import('./pages/Currencies'));

const adminPages = [
  ['dashboard', 'nav.dashboard', Dashboard, AppstoreOutlined], ['trips', 'nav.trips', Trips, CalendarOutlined], ['orders', 'nav.orders', Orders, ShoppingOutlined],
  ['order-desk', 'nav.order_desk', OrderDesk, ScanOutlined], ['procurement', 'nav.procurement', ProcurementHUD, InboxOutlined],
  ['picking', 'nav.picking', PickingMaster, CheckSquareOutlined], ['products', 'products.title', ProductArchive, TagsOutlined],
  ['recommendations', 'rec.title', Recommendations, ShopOutlined],
  ['suppliers', 'nav.suppliers', Suppliers, ShopOutlined], ['customers', 'nav.customers', MerchantCustomers, TeamOutlined],
  ['basic-data/currencies', 'currency.title', Currencies, TagsOutlined]
] as const;

function Admin() {
  const { isAuthenticated, isMerchant, logout, user } = useUserRole();
  const { t } = useI18n();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const pages = [...(isMerchant ? adminPages : []), ...(user?.platformAdmin&&!isMerchant?[['products', 'products.title', ProductArchive, TagsOutlined] as const]:[]), ...(user?.platformAdmin ? [['users', 'accounts.title', Users, TeamOutlined] as const, ['settings', 'mail.title', MailSettings, TagsOutlined] as const] : [])];
  const menuItems = pages.filter(([path]) => !path.startsWith('basic-data/')).map(([path, label, , Icon]) => ({
    key: `/admin/${path}`, icon: <Icon />, label: <Link to={`/admin/${path}`} onClick={() => setOpen(false)}>{t(label)}</Link>
  }));
  const menu = <Menu mode="inline" selectedKeys={[location.pathname]} items={[...menuItems, ...(isMerchant ? [{
    type: 'group' as const, key: 'basic-data', label: t('nav.basic_data'), children: [{
      key: '/admin/basic-data/currencies', icon: <TagsOutlined />, label: <Link to="/admin/basic-data/currencies" onClick={() => setOpen(false)}>{t('currency.title')}</Link>
    }]
  }] : [])]} />;
  if (!isAuthenticated) return <LoginPage />;
  if (!isMerchant && !user?.platformAdmin) return <Navigate to="/" replace />;
  const brand = <Link className="merchant-brand" to="/admin"><span className="brand-symbol">B<span /></span><strong>{t('app.brand')}</strong></Link>;
  const current = pages.find(([path]) => location.pathname === `/admin/${path}`);
  return <div className="merchant-shell">
    <aside className="merchant-sidebar">{brand}<div className="merchant-nav-label">{t('admin.workspace')}</div>{menu}
      <div className="merchant-identity"><span className="merchant-avatar"><ShopOutlined /></span><div><strong>{user?.name}</strong><small>{t('admin.merchant')}</small></div></div>
    </aside>
    <div className="merchant-workspace"><header className="merchant-header"><Button className="merchant-menu-toggle" icon={<MenuOutlined />} aria-label={t('app.open_menu')} onClick={() => setOpen(true)} />
      <div className="merchant-breadcrumb"><span>{t('admin.workspace')}</span><span>/</span><b className="merchant-mobile-brand">{t('app.brand')}</b>{current?.[0].startsWith('basic-data/')&&<><span>{t('nav.basic_data')}</span><span>/</span></>}<strong>{current ? t(current[1]) : t('zen_audit.scroll_title')}</strong></div>
      <div className="merchant-header-tools"><LanguageSwitcher /><Tooltip title={t('admin.storefront')}><Link className="merchant-store-link" to="/" aria-label={t('admin.storefront')}><ShopOutlined /><span>{t('admin.storefront')}</span><ArrowUpOutlined rotate={45} /></Link></Tooltip>
      <Tooltip title={t('auth.logout')}><Button className="merchant-header-logout" icon={<LogoutOutlined />} aria-label={t('auth.logout')} onClick={() => void logout()} /></Tooltip></div></header>
    <main className="merchant-content">
      <Routes><Route index element={<Navigate to={user?.platformAdmin ? 'users' : 'dashboard'} replace />} />
        {pages.map(([path, , Page]) => <Route key={path} path={path} element={<Page />} />)}
        <Route path="stock-master" element={<LegacyProductRoute/>}/><Route path="deleted-products" element={<LegacyProductRoute deleted/>}/>
        {isMerchant&&<><Route path="basic-data" element={<Navigate to="currencies" replace />} /><Route path="currencies" element={<Navigate to="/admin/basic-data/currencies" replace />} /></>}
        <Route path="audit/:tripId" element={<ZenAuditView />} />
        <Route path="*" element={<Navigate to="/admin" replace />} /></Routes>
    </main></div>
    <Drawer className="merchant-drawer" title={brand} placement="left" width={280} open={open} onClose={() => setOpen(false)}>{menu}
      <div className="merchant-identity"><span className="merchant-avatar"><ShopOutlined /></span><div><strong>{user?.name}</strong><small>{t('admin.merchant')}</small></div><Tooltip title={t('auth.logout')}><Button icon={<LogoutOutlined />} aria-label={t('auth.logout')} onClick={() => void logout()} /></Tooltip></div>
    </Drawer>
  </div>;
}

export default function App() {
  return <Suspense fallback={<div className="store-loading"><Spin /></div>}>
    <Routes><Route path="/admin/*" element={<Admin />} /><Route path="/*" element={<Storefront />} /></Routes>
  </Suspense>;
}
