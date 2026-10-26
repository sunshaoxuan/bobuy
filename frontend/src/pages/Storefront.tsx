import { lazy, Suspense, useEffect, useState } from 'react';
import { Alert, Badge, Button, Drawer, Empty, Form, Input, InputNumber, Modal, Segmented, Spin, Tag } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CalendarOutlined, CheckCircleOutlined, CloseOutlined, DeleteOutlined,
  LogoutOutlined, MailOutlined, MenuOutlined, MinusOutlined, PlusOutlined, SearchOutlined, ShoppingCartOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, recommendationApi, storefrontApi, type StoreProduct, type StoreTrip } from '../api';
import { storeAuthSession } from '../authStorage';
import { useUserRole } from '../context/UserRoleContext';
import { CART_KEY, changeQuantity, emptyCart, readCart, type Cart } from '../cart';
import ProtectedRoute from '../components/ProtectedRoute';
import ProductFeed from '../components/ProductFeed';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { localizedContent, useI18n } from '../i18n';
import '../product-feed.css';
import StoreNavigation from '../components/StoreNavigation';
import {scopedPath,selectedNode} from '../storeNavigation';
import '../browse.css';
import {formatMoney} from '../currency';

const ClientOrders = lazy(() => import('./ClientOrders'));
const PublicRecommendations = lazy(() => import('./PublicRecommendations'));
const ClientBilling = lazy(() => import('./ClientBilling'));
const ClientChat = lazy(() => import('./ClientChat'));
const ClientTrips = lazy(() => import('./ClientTrips'));

export function AccountForm({ afterLogin, checkout = false }: { afterLogin: () => void; checkout?: boolean }) {
  const { t } = useI18n();
  const { login } = useUserRole();
  const [mode, setMode] = useState('register');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(values: { username: string; password: string; email: string }) {
    setBusy(true); setError('');
    try {
      if (mode === 'register') {
        const account = { username: values.username, password: values.password, email: values.email };
        storeAuthSession(await (checkout ? api.auth.register(account) : api.registerAccount(account)));
      }
      else await login(values.username, values.password);
      afterLogin();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="account-form"><h2>{mode === 'register' ? t('store.create_account') : t('store.signin')}</h2>
    <Segmented block value={mode} options={[{value:'register',label:t('store.register')},{value:'login',label:t('store.login')}]} onChange={v => { setMode(String(v)); setError(''); }} />
    {error && <Alert type="error" message={error} />}
    <Form key={mode} layout="vertical" onFinish={submit} requiredMark={false}>
      <Form.Item label={t('store.username')} name="username" rules={[{ required: true, message: t('store.username_required') },
        ...(mode === 'register' ? [{ pattern: /^[a-zA-Z0-9_]{3,40}$/, message: t('store.username_rule') }] : [])]}>
        <Input autoComplete="username" size="large" /></Form.Item>
      {mode === 'register' && <Form.Item label={t('store.email')} name="email" rules={[{ required: true, type: 'email', message: t('store.email_required') }]}>
        <Input type="email" autoComplete="email" size="large" /></Form.Item>}
      <Form.Item label={t('store.password')} name="password" rules={[{ required: true, message: t('store.password_required') },
        ...(mode === 'register' ? [{ min: 8, max: 72, message: t('store.password_rule') }] : [])]}>
        <Input.Password autoComplete={mode === 'register' ? 'new-password' : 'current-password'} size="large" /></Form.Item>
      <Button type="primary" htmlType="submit" block size="large" loading={busy}>{mode === 'register' ? t('store.register_continue') : t('store.login_continue')}</Button>
    </Form>
  </section>;
}

function EmailVerification() {
  const { t } = useI18n();
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
  if (user?.emailVerified) return <Alert type="success" message={t('store.verified')} showIcon />;
  return <section className="verification"><h2><MailOutlined />  {t('store.verification')}</h2><p>{user?.email}</p>
    <p className="muted">{t('store.verification_hint')}</p>
    {notice && <Alert type="success" message={notice} />}{error && <Alert type="error" message={error} />}
    <Form layout="vertical" onFinish={({ code }) => void run(async () => {
      await storefrontApi.verify(code);
      const current = await api.auth.me();
      const { getStoredAccessToken, getStoredAccessTokenExpiresAt, getStoredRefreshTokenExpiresAt } = await import('../authStorage');
      storeAuthSession({ accessToken: getStoredAccessToken()!, accessTokenExpiresAt: getStoredAccessTokenExpiresAt(), refreshTokenExpiresAt: getStoredRefreshTokenExpiresAt(), user: current });
    }, t('store.verify_success'))}>
      <Form.Item label={t('store.code')} name="code" rules={[{ required: true, pattern: /^[0-9]{6}$/, message: t('store.code_required') }]}>
        <Input inputMode="numeric" maxLength={6} autoComplete="one-time-code" size="large" /></Form.Item>
      <div className="action-row"><Button type="primary" htmlType="submit" loading={busy}>{t('store.verify')}</Button>
        <Button disabled={cooldown > 0 || busy} onClick={() => void run(async () => { await storefrontApi.resend(); setCooldown(60); }, t('store.code_sent'))}>
          {cooldown > 0 ? t('store.resend_wait', { count: cooldown }) : t('store.resend')}</Button></div>
    </Form></section>;
}

export default function Storefront() {
  const { t, locale } = useI18n();
  const text = (value: Record<string,string>) => localizedContent(value,locale);
  const money = (value: number,currency='JPY') => formatMoney(value,currency,locale);
  const { user, isAuthenticated, isCustomer, logout } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const searchable=location.pathname==='/'||location.pathname==='/trips'||location.pathname.startsWith('/recommendations');
  const node = selectedNode(location.search);
  const [navigationOpen,setNavigationOpen] = useState(false);
  const [nodes,setNodes] = useState<{id:number;name:string}[]>([]);
  const [privateNodes,setPrivateNodes]=useState<{userId?:number;ids:number[]}>({ids:[]});
  const visibleNodes=[...nodes,...(privateNodes.userId===user?.id?privateNodes.ids:[]).filter(id=>!nodes.some(value=>value.id===id)).map(id=>({id,name:t('browse.node_number',{id})}))];
  const [cart, setCart] = useState<Cart>(readCart);
  const [trips, setTrips] = useState<StoreTrip[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<StoreProduct>();
  const [quantityProduct, setQuantityProduct] = useState<StoreProduct>();
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [tripPicker, setTripPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ orderId: number; total: number;currency?:string }>();
  async function load() {
    setLoading(true); setError('');
    try {
      const [nextTrips, nextProducts, recommendationNodes] = await Promise.all([storefrontApi.trips(), storefrontApi.products(), recommendationApi.nodes()]);
      setTrips(nextTrips); setProducts(nextProducts);
      const choices=new Map(recommendationNodes.map(value=>[value.id,value.name]));
      nextTrips.forEach(value=>choices.set(value.merchantId,value.merchantName));
      setNodes([...choices].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name)));
      const preferred=nextTrips.find(value=>node===undefined||value.merchantId===node);
      setCart(prior => prior.tripId === null && preferred ? { ...prior, tripId: preferred.id } : prior);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(()=>{setDetail(prior=>prior?products.find(p=>p.id===prior.id):prior);setQuantityProduct(prior=>prior?products.find(p=>p.id===prior.id):prior);},[products]);
  useEffect(()=>{
    const now=Date.now(),boundaries=products.map(p=>Date.parse(p.priceValidUntil??'')).filter(value=>Number.isFinite(value)&&value>now);
    if(!boundaries.length)return;
    const timer=window.setTimeout(()=>{void storefrontApi.products().then(setProducts).catch(e=>setError((e as Error).message));},Math.min(2147483647,Math.max(100,Math.min(...boundaries)-now+100)));
    return()=>window.clearTimeout(timer);
  },[products]);
  useEffect(()=>{
    let active=true;setPrivateNodes({userId:user?.id,ids:[]});
    if(isCustomer)void api.customerTrips().then(values=>{if(active)setPrivateNodes({userId:user?.id,ids:[...new Set(values.map(value=>value.agentId))]});}).catch(()=>{ /* Public browsing stays available; private pages show their own errors. */ });
    return()=>{active=false;};
  },[user?.id,isCustomer]);
  useEffect(() => {setNavigationOpen(false);setSearch('');setDetail(undefined);setQuantityProduct(undefined);setTripPicker(false);},[location.pathname,node]);
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { setError(t('store.storage_error')); } }, [cart]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === CART_KEY) setCart(readCart()); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  const trip = trips.find(t => t.id === cart.tripId);
  const scopedTrips = trips.filter(value=>node===undefined||value.merchantId===node);
  const viewTrip = scopedTrips.find(value=>value.id===cart.tripId)??scopedTrips[0];
  const cartEntries = Object.entries(cart.items);
  const quantity = cartEntries.reduce((sum, [, value]) => sum + value, 0);
  const available = products.filter(p => p.merchantId === (node??viewTrip?.merchantId));
  const shown = available.filter(p => `${text(p.name)} ${p.brand} ${text(p.description)}`.toLowerCase().includes(search.toLowerCase()));
  const canBuyRecommendation=(product:StoreProduct)=>product.recommendationReady===true&&trips.some(journey=>journey.merchantId===product.merchantId);
  const total = cartEntries.reduce((sum,[id,qty])=>sum+(cart.quotes?.[id]?.price??products.find(p=>p.id===id)?.price??0)*qty,0);
  const invalidCart = !trip || cartEntries.some(([id]) => !products.some(p => p.id === id && p.merchantId === trip.merchantId && (p.currency??'JPY')===(cart.currency??'JPY') && (!p.priceToken||cart.quotes?.[id]?.token===p.priceToken) && (!(p.priceRevision??0)||(cart.quotes?.[id]?.revision===p.priceRevision&&cart.quotes?.[id]?.price===p.price&&cart.quotes?.[id]?.currency===p.currency))));
  function change(id:string,value:number){const product=products.find(p=>p.id===id);if(!product&&value>0)return;
    setCart(prior=>{const next=changeQuantity(prior,id,value);const quotes={...prior.quotes};if(value<=0)delete quotes[id];else quotes[id]={price:product!.price,currency:product!.currency??'JPY',revision:product!.priceRevision??0,token:product!.priceToken};return {...next,currency:product?.currency??prior.currency??'JPY',quotes};});setReceipt(undefined);
  }
  function addRecommendation(product:StoreProduct){
    if(!canBuyRecommendation(product))return;
    if(product.merchantId!==trip?.merchantId){setTripPicker(true);return;}
    setCart(prior=>{if(Object.keys(prior.items).length&&(prior.currency??'JPY')!==(product.currency??'JPY'))return prior;
      const next=changeQuantity(prior,product.id,(prior.items[product.id]??0)+1);
      return {...next,currency:product.currency??'JPY',quotes:{...prior.quotes,[product.id]:{price:product.price,currency:product.currency??'JPY',revision:product.priceRevision??0,token:product.priceToken}}};});setReceipt(undefined);
  }
  function configureQuantity(product: StoreProduct) {
    if (product.merchantId !== trip?.merchantId) { setDetail(undefined); setTripPicker(true); return; }
    setDraftQuantity(cart.items[product.id] || 1); setQuantityProduct(product); setDetail(undefined);
  }
  function choose(next: StoreTrip, after?:()=>void) {
    const apply = () => {setCart(prior => ({ ...prior, tripId: next.id, requestId: crypto.randomUUID(), items: trip?.merchantId === next.merchantId ? prior.items : {} }));after?.();};
    if (quantity && trip?.merchantId !== next.merchantId) Modal.confirm({ title: t('store.change_merchant_confirm'), okText: t('store.change_merchant'), cancelText: t('store.keep_cart'), onOk: apply });
    else apply();
  }
  function changeNode(next?:number) {
    if(next===node)return;
    const apply=()=>{const params=new URLSearchParams(location.search);if(next===undefined)params.delete('node');else params.set('node',String(next));params.delete('category');navigate({pathname:location.pathname,search:params.toString()});};
    const nextTrip=trips.find(value=>value.id===cart.tripId&&(next===undefined||value.merchantId===next))??trips.find(value=>next===undefined||value.merchantId===next);
    if(nextTrip&&nextTrip.id!==cart.tripId)choose(nextTrip,apply);else apply();
  }
  async function checkout() {
    if (!trip || invalidCart || !quantity) return;
    setBusy(true); setError('');
    try {
      const result = await storefrontApi.checkout({ requestId: cart.requestId, tripId: trip.id,currency:cart.currency??'JPY', items: cartEntries.map(([productId, qty]) => ({ productId, quantity: qty,priceRevision:cart.quotes?.[productId]?.revision,currency:cart.quotes?.[productId]?.currency,priceToken:cart.quotes?.[productId]?.token })) });
      setReceipt(result); setCart({ ...emptyCart(), tripId: trip.id });
    } catch (e) { setError(t((e as Error).message));void storefrontApi.products().then(setProducts).catch(()=>{}); } finally { setBusy(false); }
  }
  function stepper(product: StoreProduct, count: number) {
    return <div className="quantity-control"><Button icon={count === 1 ? <DeleteOutlined /> : <MinusOutlined />} aria-label={t('store.decrease',{name:text(product.name)})} onClick={() => change(product.id, count - 1)} />
      <output aria-label={t('store.product_quantity',{name:text(product.name)})}>{count}</output><Button icon={<PlusOutlined />} disabled={count >= 99} aria-label={t('store.increase',{name:text(product.name)})} onClick={() => change(product.id, count + 1)} /></div>;
  }
  function image(product: StoreProduct) {
    return product.images[0] ? <img src={product.images[0]} alt={text(product.name)} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <ShopOutlined aria-label={t('store.no_image')} />;
  }
  const basket = <section className="basket"><div className="section-heading"><h1>{t('store.cart')} <small>{t('store.item_count',{count:quantity})}</small></h1><Link to="/">{t('store.continue')} <ArrowRightOutlined /></Link></div>
    {quantity === 0 ? <Empty description={t('store.cart_empty')}><Link to="/"><Button type="primary">{t('store.browse')}</Button></Link></Empty> : <>
      {trip && <div className="basket-trip"><CalendarOutlined /><div><strong>{trip.deliveryArea}</strong><p>{trip.deliveryDate} · {trip.merchantName}</p></div></div>}
      {invalidCart && <Alert type="warning" message={t('store.cart_invalid')} action={<Button onClick={()=>{setCart(prior=>({...prior,requestId:crypto.randomUUID(),quotes:Object.fromEntries(products.filter(p=>prior.items[p.id]&&(p.currency??'JPY')===(prior.currency??'JPY')).map(p=>[p.id,{price:p.price,currency:p.currency??'JPY',revision:p.priceRevision??0,token:p.priceToken}]))}));}}>{t('sale.refresh_cart')}</Button>}/>}
      <div className="basket-lines">{cartEntries.map(([id, qty]) => {
        const product = products.find(p => p.id === id);
        return product ? <article className="basket-line" key={id}><div className="basket-photo">{image(product)}</div><div><h2>{text(product.name)}</h2><p>{money(cart.quotes?.[id]?.price??product.price,product.currency)} / {product.saleUnit}</p>{stepper(product, qty)}</div><strong>{money((cart.quotes?.[id]?.price??product.price)*qty,product.currency)}</strong></article> :
          <article key={id} className="basket-line"><span>{t('store.unavailable')}</span><Button icon={<DeleteOutlined />} onClick={() => change(id, 0)}>{t('store.remove')}</Button></article>;
      })}</div>
      <div className="basket-total"><span>{t('store.total')} <small>{cart.currency??'JPY'}</small></span><strong>{money(total,cart.currency)}</strong></div>
      <p className="muted">{t('store.payment_hint')}</p>
      {location.pathname !== '/checkout' && <Button block size="large" type="primary" disabled={invalidCart} onClick={() => navigate('/checkout')}>{t('store.checkout')} <ArrowRightOutlined /></Button>}
    </>}
  </section>;
  const tripChoices = <div className="trip-list" role="group" aria-label={t('store.choose_trip')}>{scopedTrips.map(journey => <button key={journey.id} className={`trip-choice ${cart.tripId === journey.id ? 'selected' : ''}`} onClick={() => { choose(journey); setTripPicker(false); }} aria-pressed={cart.tripId === journey.id}>
        <span className="trip-date">{journey.deliveryDate.slice(5).replace('-', '/')}<small>{t('store.delivery_date')}</small></span><span className="trip-route"><strong>{journey.deliveryArea}</strong><small>{journey.merchantName}</small></span>
        {cart.tripId === journey.id && <CheckCircleOutlined />}</button>)}</div>;
  const catalog = <div className="catalog-experience"><section className="journey-strip">
      <button className="journey-trigger" onClick={() => setTripPicker(true)} aria-label={t('store.choose_trip')}><CalendarOutlined /><span><small>{viewTrip ? `${viewTrip.deliveryDate.slice(5).replace('-', '.')} ${t('store.delivery_date')} · ${viewTrip.merchantName}` : t('store.trip')}</small><strong>{viewTrip ? <>{viewTrip.deliveryArea}</> : t('store.no_trips')}</strong></span><ArrowRightOutlined /></button>
    </section>
    <section className="catalog" aria-label={t('store.catalog')}><div className="catalog-toolbar"><h1>{t('store.catalog')}<span>{t('store.product_count',{count:available.length})}</span></h1>
      </div>
      <ProductFeed products={shown} quantities={cart.items} onAdd={configureQuantity} onDetail={setDetail} />
      {!shown.length && !loading && <Empty description={search ? t('store.no_matches') : t('store.no_products')} />}
    </section></div>;
  const bookable=<section className="browse-trip-page"><header className="browse-page-heading"><span>{t('browse.plan')}</span><h1>{t('browse.bookable')}</h1><p>{t('browse.bookable_hint')}</p></header>
    {scopedTrips.length?<div className="browse-trip-grid">{scopedTrips.filter(journey=>(journey.deliveryArea+' '+journey.merchantName+' '+journey.deliveryDate).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(journey=><article className="browse-trip-card" key={journey.id}><CalendarOutlined/><time dateTime={journey.deliveryDate}>{journey.deliveryDate}</time><h2>{journey.deliveryArea}</h2><p>{journey.merchantName}</p><Button onClick={()=>choose(journey,()=>navigate('/?'+new URLSearchParams({node:String(journey.merchantId)})))}>{t('store.browse')}<ArrowRightOutlined/></Button></article>)}</div>:<Empty description={t('store.no_trips')}/>}
  </section>;
  return <div className={`storefront browse-shell ${(location.pathname === '/' || location.pathname.startsWith('/recommendations')) ? 'storefront-catalog' : ''}`}>
    <StoreNavigation nodes={visibleNodes} node={node} loading={loading} open={navigationOpen} onClose={()=>setNavigationOpen(false)} onNodeChange={changeNode}/>
    <div className="browse-workspace"><header className="store-header"><div className="browse-context"><Button className="browse-menu-toggle" icon={<MenuOutlined/>} aria-label={t('app.open_menu')} aria-expanded={navigationOpen} onClick={()=>setNavigationOpen(value=>!value)}/><Link className="browse-mobile-brand" to={scopedPath('/',location.search)}>{t('app.brand')}</Link><span className="browse-context-node">{node===undefined?t('browse.all_nodes'):visibleNodes.find(value=>value.id===node)?.name??t('browse.unavailable_node')}</span></div>
    {searchable&&<Input className="browse-search" prefix={<SearchOutlined/>} aria-label={t('store.search')} placeholder={t('store.search')} allowClear value={search} onChange={event=>setSearch(event.target.value)}/>}
    <div className="store-header-actions"><LanguageSwitcher /><Link to={scopedPath('/account',location.search)} aria-label={t('store.account')}><UserOutlined /></Link><Badge count={quantity} size="small"><Link to={scopedPath('/cart',location.search)} aria-label={t('store.cart_label',{count:quantity})}><ShoppingCartOutlined /></Link></Badge></div></header>
    <main className="store-main">{error && <Alert type="error" message={error} action={<Button onClick={() => void load()}>{t('store.retry')}</Button>} closable onClose={() => setError('')} />}
      {loading ? <div className="store-loading"><Spin /></div> : <Suspense fallback={<Spin />}><Routes>
        <Route index element={catalog} /><Route path="trips" element={bookable}/><Route path="client/trips" element={<ClientTrips node={node}/>}/><Route path="cart" element={basket} />
        <Route path="checkout" element={<div className="checkout-layout">{receipt ? <section className="order-success"><CheckCircleOutlined /><h1>{t('store.submitted')}</h1><p>{t('store.order_number',{id:receipt.orderId})} · {money(receipt.total)}</p><Tag color="gold">{t('store.pending')}</Tag><div className="action-row"><Link to="/client/orders"><Button type="primary">{t('store.view_order')}</Button></Link><Link to="/"><Button>{t('store.continue')}</Button></Link></div></section> : <>{basket}{quantity > 0 && <section className="checkout-account">{!isAuthenticated ? <AccountForm checkout afterLogin={() => {}} /> : !user?.roles.includes('CUSTOMER') ? <Alert type="warning" message={t('store.customer_only')} action={<Button onClick={() => void logout()}>{t('store.switch_account')}</Button>} /> : <><h2>{t('store.confirm')}</h2><p>{user.name} · {user.email}</p>{!user.emailVerified && <Alert type="info" message={t('store.unverified_hint')} />}<Button type="primary" size="large" block loading={busy} disabled={invalidCart} onClick={() => void checkout()}>{t('store.submit')} · {money(total)}</Button><Link to="/account">{t('store.verify')}</Link></>}</section>}</>}</div>} />
        <Route path="login" element={isAuthenticated ? <Navigate to="/account" replace /> : <AccountForm afterLogin={() => navigate('/account')} />} />
        <Route path="account" element={isAuthenticated ? <section className="account-page"><h1>{t('store.account')}</h1><p>{user?.name}</p><EmailVerification /><div className="account-links"><Link to="/client/orders">{t('store.orders')} <ArrowRightOutlined /></Link><Link to="/client/billing">{t('store.billing')} <ArrowRightOutlined /></Link>{(user?.roles.includes('AGENT') || user?.platformAdmin) && <Link to="/admin">{t('store.admin')} <ArrowRightOutlined /></Link>}<Button icon={<LogoutOutlined />} onClick={() => void logout()}>{t('store.logout')}</Button></div></section> : <AccountForm afterLogin={() => {}} />} />
        <Route path="recommendations" element={<PublicRecommendations query={search} products={products} quantities={cart.items} onDetail={setDetail} onAdd={addRecommendation} canBuy={canBuyRecommendation} />} />
        <Route path="recommendations/:id" element={<PublicRecommendations query={search} products={products} quantities={cart.items} onDetail={setDetail} onAdd={addRecommendation} canBuy={canBuyRecommendation} />} />
        <Route path="client/orders" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><ClientOrders key={String(node)+':'+user?.id} node={node}/></ProtectedRoute>} />
        <Route path="client/billing" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><ClientBilling key={String(node)+':'+user?.id} node={node}/></ProtectedRoute>} />
        <Route path="client/chat" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><ClientChat /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>}
    </main></div>
    <Drawer className="product-detail" title={t('store.details')} placement="right" width="min(100vw, 480px)" open={!!detail} onClose={() => setDetail(undefined)} closeIcon={<CloseOutlined />}>
      {detail && <><div className="detail-photo">{image(detail)}</div><small>{detail.brand}</small><h2>{text(detail.name)}</h2><p>{text(detail.description)}</p><h3>{money(detail.price,detail.currency)} <small>{detail.saleUnit}</small></h3><Button type="primary" size="large" block disabled={!trips.some(journey => journey.merchantId === detail.merchantId)} icon={detail.merchantId === trip?.merchantId ? <PlusOutlined /> : <CalendarOutlined />} onClick={() => configureQuantity(detail)}>{t(detail.merchantId === trip?.merchantId ? 'store.set_quantity' : 'store.choose_trip')}</Button></>}
    </Drawer>
    <Drawer className="journey-picker" title={t('store.trip')} placement="bottom" height="auto" open={tripPicker} onClose={() => setTripPicker(false)}>{tripChoices}{!scopedTrips.length && <Empty description={t('store.no_trips')} />}</Drawer>
    <Drawer className="quantity-sheet" title={t('store.quantity_title')} placement="bottom" height="auto" open={!!quantityProduct} onClose={() => setQuantityProduct(undefined)} destroyOnClose>
      {quantityProduct && <div className="quantity-sheet-content"><div className="quantity-product"><div>{image(quantityProduct)}</div><section><small>{quantityProduct.brand}</small><h2>{text(quantityProduct.name)}</h2><strong>{money(quantityProduct.price,quantityProduct.currency)} <small>{t('store.each')}</small></strong></section></div>
        <div className="quantity-selection"><span>{t('store.quantity')}</span><div className="quantity-control"><Button icon={<MinusOutlined />} aria-label={t('store.quantity_minus')} disabled={draftQuantity <= 1} onClick={() => setDraftQuantity(value => value - 1)} /><InputNumber aria-label={t('store.quantity_title')} min={1} max={99} precision={0} controls={false} value={draftQuantity} onChange={value => setDraftQuantity(value ?? 1)} /><Button icon={<PlusOutlined />} aria-label={t('store.quantity_plus')} disabled={draftQuantity >= 99} onClick={() => setDraftQuantity(value => value + 1)} /></div></div>
        <div className="quantity-subtotal"><span>{t('store.subtotal')}</span><strong>{money(quantityProduct.price * draftQuantity,quantityProduct.currency)}</strong></div>
        <Button type="primary" block aria-label={cart.items[quantityProduct.id] ? t('store.update_cart') : t('store.add_cart')} onClick={() => { change(quantityProduct.id, draftQuantity); setQuantityProduct(undefined); }}>{cart.items[quantityProduct.id] ? t('store.update_cart') : t('store.add_cart')} <ShoppingCartOutlined /></Button></div>}
    </Drawer>
  </div>;
}
