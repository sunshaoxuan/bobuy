import { lazy, Suspense, useState } from 'react';
import { Button, Drawer, Layout, Menu, Spin } from 'antd';
import { MenuOutlined, LogoutOutlined } from '@ant-design/icons';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useUserRole } from './context/UserRoleContext';
import Storefront from './pages/Storefront';
import './storefront.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trips = lazy(() => import('./pages/Trips'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDesk = lazy(() => import('./pages/OrderDesk'));
const ProcurementHUD = lazy(() => import('./pages/ProcurementHUD'));
const PickingMaster = lazy(() => import('./pages/PickingMaster'));
const StockMaster = lazy(() => import('./pages/StockMaster'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const MerchantCustomers = lazy(() => import('./pages/MerchantCustomers'));
const ZenAuditView = lazy(() => import('./pages/ZenAuditView'));
const LoginPage = lazy(() => import('./pages/LoginPage'));

const adminPages = [
  ['dashboard', '概览', Dashboard], ['trips', '行程', Trips], ['orders', '订单', Orders],
  ['order-desk', '订单工作台', OrderDesk], ['procurement', '采购', ProcurementHUD],
  ['picking', '拣货', PickingMaster], ['stock-master', '商品', StockMaster],
  ['suppliers', '供应商', Suppliers], ['customers', '客户认可', MerchantCustomers]
] as const;

function Admin() {
  const { isAuthenticated, role, logout } = useUserRole();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menu = <Menu selectedKeys={[location.pathname]} items={adminPages.map(([path, label]) => ({
    key: `/admin/${path}`, label: <Link to={`/admin/${path}`} onClick={() => setOpen(false)}>{label}</Link>
  }))} />;
  if (!isAuthenticated) return <LoginPage />;
  if (role !== 'AGENT') return <Navigate to="/" replace />;
  return <Layout className="merchant-shell">
    <header className="merchant-header"><Button icon={<MenuOutlined />} aria-label="商家菜单" onClick={() => setOpen(true)} />
      <Link to="/admin">Bobuy 商家</Link><Link to="/">客户商城</Link>
      <Button icon={<LogoutOutlined />} aria-label="退出登录" onClick={() => void logout()} /></header>
    <Layout><aside className="merchant-sidebar">{menu}</aside><main className="merchant-content">
      <Routes><Route index element={<Navigate to="dashboard" replace />} />
        {adminPages.map(([path, , Page]) => <Route key={path} path={path} element={<Page />} />)}
        <Route path="audit/:tripId" element={<ZenAuditView />} />
        <Route path="*" element={<Navigate to="/admin" replace />} /></Routes>
    </main></Layout>
    <Drawer title="Bobuy 商家" placement="left" open={open} onClose={() => setOpen(false)}>{menu}</Drawer>
  </Layout>;
}

export default function App() {
  return <Suspense fallback={<div className="store-loading"><Spin /></div>}>
    <Routes><Route path="/admin/*" element={<Admin />} /><Route path="/*" element={<Storefront />} /></Routes>
  </Suspense>;
}
