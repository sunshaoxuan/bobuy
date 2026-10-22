import { lazy, Suspense, useEffect, useState } from 'react';
import { Alert, Badge, Button, Drawer, Empty, Form, Input, Modal, Segmented, Spin, Tag } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CalendarOutlined, CheckCircleOutlined, CloseOutlined, DeleteOutlined,
  LogoutOutlined, MailOutlined, MinusOutlined, PlusOutlined, SearchOutlined, ShoppingCartOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, storefrontApi, type StoreProduct, type StoreTrip } from '../api';
import { storeAuthSession } from '../authStorage';
import { useUserRole } from '../context/UserRoleContext';
import { CART_KEY, changeQuantity, emptyCart, readCart, type Cart } from '../cart';
import ProtectedRoute from '../components/ProtectedRoute';

const ClientOrders = lazy(() => import('./ClientOrders'));
const ClientBilling = lazy(() => import('./ClientBilling'));
const ClientChat = lazy(() => import('./ClientChat'));
const text = (value: Record<string, string>) => value['zh-CN'] || value.zh || Object.values(value)[0] || '';
const money = (value: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'JPY', maximumFractionDigits: 2 }).format(value);

function AccountForm({ afterLogin }: { afterLogin: () => void }) {
  const { login } = useUserRole();
  const [mode, setMode] = useState('注册');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(values: { username: string; password: string; email: string }) {
    setBusy(true); setError('');
    try {
      if (mode === '注册') storeAuthSession(await api.auth.register(values));
      else await login(values.username, values.password);
      afterLogin();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="account-form"><h2>{mode === '注册' ? '创建客户账户' : '登录账户'}</h2>
    <Segmented block value={mode} options={['注册', '登录']} onChange={v => { setMode(String(v)); setError(''); }} />
    {error && <Alert type="error" message={error} />}
    <Form key={mode} layout="vertical" onFinish={submit} requiredMark={false}>
      <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' },
        ...(mode === '注册' ? [{ pattern: /^[a-zA-Z0-9_]{3,40}$/, message: '3 至 40 位字母、数字或下划线' }] : [])]}>
        <Input autoComplete="username" size="large" /></Form.Item>
      {mode === '注册' && <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
        <Input type="email" autoComplete="email" size="large" /></Form.Item>}
      <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' },
        ...(mode === '注册' ? [{ min: 8, max: 72, message: '密码需要 8 至 72 个字符' }] : [])]}>
        <Input.Password autoComplete={mode === '注册' ? 'new-password' : 'current-password'} size="large" /></Form.Item>
      <Button type="primary" htmlType="submit" block size="large" loading={busy}>{mode === '注册' ? '注册并继续' : '登录并继续'}</Button>
    </Form>
  </section>;
}

function EmailVerification() {
  const { user } = useUserRole();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const id = window.setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(id); }, [cooldown]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(success); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (user?.emailVerified) return <Alert type="success" message="邮箱已验证" showIcon />;
  return <section className="verification"><h2><MailOutlined /> 邮箱验证</h2><p>{user?.email}</p>
    <p className="muted">验证码 10 分钟内有效。暂不验证也可提交待确认订单。</p>
    {notice && <Alert type="success" message={notice} />}{error && <Alert type="error" message={error} />}
    <Form layout="vertical" onFinish={({ code }) => void run(async () => {
      await storefrontApi.verify(code);
      const current = await api.auth.me();
      const { getStoredAccessToken, getStoredAccessTokenExpiresAt, getStoredRefreshTokenExpiresAt } = await import('../authStorage');
      storeAuthSession({ accessToken: getStoredAccessToken()!, accessTokenExpiresAt: getStoredAccessTokenExpiresAt(), refreshTokenExpiresAt: getStoredRefreshTokenExpiresAt(), user: current });
    }, '验证成功')}>
      <Form.Item label="邮箱验证码" name="code" rules={[{ required: true, pattern: /^[0-9]{6}$/, message: '请输入六位验证码' }]}>
        <Input inputMode="numeric" maxLength={6} autoComplete="one-time-code" size="large" /></Form.Item>
      <div className="action-row"><Button type="primary" htmlType="submit" loading={busy}>验证邮箱</Button>
        <Button disabled={cooldown > 0 || busy} onClick={() => void run(async () => { await storefrontApi.resend(); setCooldown(60); }, '验证码已发送')}>
          {cooldown > 0 ? `${cooldown} 秒后重发` : '重新发送'}</Button></div>
    </Form></section>;
}

export default function Storefront() {
  const { user, isAuthenticated, logout } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [cart, setCart] = useState<Cart>(readCart);
  const [trips, setTrips] = useState<StoreTrip[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<StoreProduct>();
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ orderId: number; total: number }>();
  async function load() {
    setLoading(true); setError('');
    try {
      const [nextTrips, nextProducts] = await Promise.all([storefrontApi.trips(), storefrontApi.products()]);
      setTrips(nextTrips); setProducts(nextProducts);
      setCart(prior => prior.tripId === null && nextTrips.length ? { ...prior, tripId: nextTrips[0].id } : prior);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { setError('浏览器无法保存购物车，请检查存储权限'); } }, [cart]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === CART_KEY) setCart(readCart()); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  const trip = trips.find(t => t.id === cart.tripId);
  const cartEntries = Object.entries(cart.items);
  const quantity = cartEntries.reduce((sum, [, value]) => sum + value, 0);
  const available = products.filter(p => p.merchantId === trip?.merchantId);
  const shown = available.filter(p => `${text(p.name)} ${p.brand} ${text(p.description)}`.toLowerCase().includes(search.toLowerCase()));
  const total = cartEntries.reduce((sum, [id, qty]) => sum + (products.find(p => p.id === id)?.price || 0) * qty, 0);
  const invalidCart = !trip || cartEntries.some(([id]) => !available.some(p => p.id === id));
  function change(id: string, value: number) { setCart(prior => changeQuantity(prior, id, value)); setReceipt(undefined); }
  function choose(next: StoreTrip) {
    const apply = () => setCart(prior => ({ ...prior, tripId: next.id, requestId: crypto.randomUUID(), items: trip?.merchantId === next.merchantId ? prior.items : {} }));
    if (quantity && trip?.merchantId !== next.merchantId) Modal.confirm({ title: '更换商家并清空购物车？', okText: '更换商家', cancelText: '保留购物车', onOk: apply });
    else apply();
  }
  async function checkout() {
    if (!trip || invalidCart || !quantity) return;
    setBusy(true); setError('');
    try {
      const result = await storefrontApi.checkout({ requestId: cart.requestId, tripId: trip.id, items: cartEntries.map(([productId, qty]) => ({ productId, quantity: qty })) });
      setReceipt(result); setCart({ ...emptyCart(), tripId: trip.id });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function stepper(product: StoreProduct, count: number) {
    return <div className="quantity-control"><Button icon={count === 1 ? <DeleteOutlined /> : <MinusOutlined />} aria-label={`减少${text(product.name)}`} onClick={() => change(product.id, count - 1)} />
      <output aria-label={`${text(product.name)}数量`}>{count}</output><Button icon={<PlusOutlined />} disabled={count >= 99} aria-label={`增加${text(product.name)}`} onClick={() => change(product.id, count + 1)} /></div>;
  }
  function image(product: StoreProduct) {
    return product.images[0] ? <img src={product.images[0]} alt={text(product.name)} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <ShopOutlined aria-label="暂无商品图" />;
  }
  const basket = <section className="basket"><div className="section-heading"><h1>购物车 <small>{quantity} 件</small></h1><Link to="/">继续选购 <ArrowRightOutlined /></Link></div>
    {quantity === 0 ? <Empty description="购物车还是空的"><Link to="/"><Button type="primary">浏览商品</Button></Link></Empty> : <>
      {trip && <div className="basket-trip"><CalendarOutlined /><div><strong>{trip.origin} <ArrowRightOutlined /> {trip.destination}</strong><p>{trip.departDate} · {trip.merchantName}</p></div></div>}
      {invalidCart && <Alert type="warning" message="行程或商品已不可用，请移除失效商品或重新选择行程" />}
      <div className="basket-lines">{cartEntries.map(([id, qty]) => {
        const product = products.find(p => p.id === id);
        return product ? <article className="basket-line" key={id}><div className="basket-photo">{image(product)}</div><div><h2>{text(product.name)}</h2><p>{money(product.price)}</p>{stepper(product, qty)}</div><strong>{money(product.price * qty)}</strong></article> :
          <article key={id} className="basket-line"><span>已下架商品</span><Button icon={<DeleteOutlined />} onClick={() => change(id, 0)}>移除</Button></article>;
      })}</div>
      <div className="basket-total"><span>商品合计 <small>JPY</small></span><strong>{money(total)}</strong></div>
      <p className="muted">提交后由商家确认采购与交付。当前无需付款。</p>
      {location.pathname !== '/checkout' && <Button block size="large" type="primary" disabled={invalidCart} onClick={() => navigate('/checkout')}>确认下单 <ArrowRightOutlined /></Button>}
    </>}
  </section>;
  const catalog = <>
    <section className="trip-section"><div className="section-heading"><div><p className="eyebrow">下一程，带回所需</p><h1>跟着行程选好物</h1></div><CalendarOutlined /></div>
      <div className="trip-list" role="group" aria-label="选择采购行程">{trips.map(t => <button key={t.id} className={`trip-choice ${cart.tripId === t.id ? 'selected' : ''}`} onClick={() => choose(t)} aria-pressed={cart.tripId === t.id}>
        <span className="trip-date">{t.departDate.slice(5).replace('-', '/')}<small>出发</small></span><span className="trip-route"><strong>{t.origin} <ArrowRightOutlined /> {t.destination}</strong><small>{t.merchantName}</small></span>
        {cart.tripId === t.id && <CheckCircleOutlined />}</button>)}</div>
      {!trips.length && !loading && <Empty description="暂无可预订行程" />}
    </section>
    <section className="catalog"><div className="section-heading"><h2>本程好物 <small>{available.length} 款</small></h2><span className="muted">{trip?.merchantName}</span></div>
      <Input prefix={<SearchOutlined />} aria-label="搜索商品" placeholder="搜索商品或品牌" allowClear value={search} onChange={e => setSearch(e.target.value)} size="large" />
      <div className="product-grid">{shown.map(product => <article className="store-product" key={product.id}>
        <button className="product-photo" aria-label={`查看${text(product.name)}`} onClick={() => setDetail(product)}>{image(product)}</button>
        <div className="product-body"><small>{product.brand}</small><button className="product-name" onClick={() => setDetail(product)}><h3>{text(product.name)}</h3></button>
          <p>{text(product.description)}</p><strong className="product-price">{money(product.price)}<small> JPY</small></strong>
          {cart.items[product.id] ? stepper(product, cart.items[product.id]) : <Button block icon={<PlusOutlined />} onClick={() => change(product.id, 1)}>加入购物车</Button>}
        </div></article>)}</div>
      {!shown.length && !loading && <Empty description={search ? '没有匹配商品' : '本程暂无商品'} />}
    </section></>;
  return <div className="storefront"><header className="store-header"><Link className="store-brand" to="/">bobuy<span>随行好物</span></Link>
    <div className="store-header-actions"><Link to="/account" aria-label="我的账户"><UserOutlined /></Link><Badge count={quantity} size="small"><Link to="/cart" aria-label={`购物车 ${quantity} 件`}><ShoppingCartOutlined /></Link></Badge></div></header>
    <main className="store-main">{error && <Alert type="error" message={error} action={<Button onClick={() => void load()}>重试</Button>} closable onClose={() => setError('')} />}
      {loading ? <div className="store-loading"><Spin /></div> : <Suspense fallback={<Spin />}><Routes>
        <Route index element={catalog} /><Route path="cart" element={basket} />
        <Route path="checkout" element={<div className="checkout-layout">{receipt ? <section className="order-success"><CheckCircleOutlined /><h1>订单已提交</h1><p>订单 #{receipt.orderId} · {money(receipt.total)}</p><Tag color="gold">待商家确认</Tag><div className="action-row"><Link to="/client/orders"><Button type="primary">查看订单</Button></Link><Link to="/"><Button>继续选购</Button></Link></div></section> : <>{basket}{quantity > 0 && <section className="checkout-account">{!isAuthenticated ? <AccountForm afterLogin={() => {}} /> : user?.role !== 'CUSTOMER' ? <Alert type="warning" message="请使用客户账户下单" action={<Button onClick={() => void logout()}>切换账户</Button>} /> : <><h2>确认订单</h2><p>{user.name} · {user.email}</p>{!user.emailVerified && <Alert type="info" message="邮箱尚未验证，可先提交待确认订单" />}<Button type="primary" size="large" block loading={busy} disabled={invalidCart} onClick={() => void checkout()}>提交订单 · {money(total)}</Button><Link to="/account">验证邮箱</Link></>}</section>}</>}</div>} />
        <Route path="login" element={isAuthenticated ? <Navigate to="/account" replace /> : <AccountForm afterLogin={() => navigate('/account')} />} />
        <Route path="account" element={isAuthenticated ? <section className="account-page"><h1>我的账户</h1><p>{user?.name}</p>{user?.role === 'CUSTOMER' && <EmailVerification />}<div className="account-links"><Link to="/client/orders">我的订单 <ArrowRightOutlined /></Link><Link to="/client/billing">我的账单 <ArrowRightOutlined /></Link>{user?.role === 'AGENT' && <Link to="/admin">商家维护 <ArrowRightOutlined /></Link>}<Button icon={<LogoutOutlined />} onClick={() => void logout()}>退出登录</Button></div></section> : <AccountForm afterLogin={() => {}} />} />
        <Route path="client/orders" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><ClientOrders /></ProtectedRoute>} />
        <Route path="client/billing" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><ClientBilling /></ProtectedRoute>} />
        <Route path="client/chat" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><ClientChat /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>}
    </main>
    <nav className="store-bottom" aria-label="客户导航"><Link className={location.pathname === '/' ? 'active' : ''} to="/"><ShopOutlined /><span>选好物</span></Link><Link className={location.pathname === '/cart' ? 'active' : ''} to="/cart"><Badge count={quantity} size="small"><ShoppingCartOutlined /></Badge><span>购物车</span></Link><Link className={location.pathname === '/account' ? 'active' : ''} to="/account"><UserOutlined /><span>我的</span></Link></nav>
    {location.pathname === '/' && quantity > 0 && <div className="cart-bar"><div><strong>{money(total)}</strong><span>{quantity} 件商品</span></div><Button type="primary" onClick={() => navigate('/cart')}>去结算 <ArrowRightOutlined /></Button></div>}
    <Drawer className="product-detail" title="商品详情" placement="right" width="min(100vw, 480px)" open={!!detail} onClose={() => setDetail(undefined)} closeIcon={<CloseOutlined />}>
      {detail && <><div className="detail-photo">{image(detail)}</div><small>{detail.brand}</small><h2>{text(detail.name)}</h2><p>{text(detail.description)}</p><h3>{money(detail.price)} <small>JPY</small></h3>{cart.items[detail.id] ? stepper(detail, cart.items[detail.id]) : <Button type="primary" size="large" block icon={<PlusOutlined />} onClick={() => change(detail.id, 1)}>加入购物车</Button>}</>}
    </Drawer>
  </div>;
}
