import {productFactText} from '../productFactText';
import {ConsumerDetail} from '../components/ConsumerDetail';
import SellingPrice from '../components/SellingPrice';
import {liveReservationQuote} from '../components/ReservationAdd';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Drawer, Empty, Form, Input, InputNumber, Modal, Segmented, Spin, Tag } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CalendarOutlined, CheckCircleOutlined, CloseOutlined, DeleteOutlined,
  LogoutOutlined, MailOutlined, MenuOutlined, MinusOutlined, PlusOutlined, SearchOutlined, ShoppingCartOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, recommendationApi, storefrontApi, type StoreProduct, type StoreTrip } from '../api';
import { getStoredAccessToken, storeAuthSession } from '../authStorage';
import { useUserRole } from '../context/UserRoleContext';
import {cartScope,changeQuantity,emptyCart,readDraft,withCartLock,type Cart} from '../cart';
import {useCartDraft} from '../useCartDraft';
import CheckoutAddress from './CheckoutAddress';
import ProtectedRoute from '../components/ProtectedRoute';

import LanguageSwitcher from '../components/LanguageSwitcher';
import { localizedContent, useI18n } from '../i18n';
import '../product-feed.css';
import StoreNavigation from '../components/StoreNavigation';
import StoreMobileNavigation from '../components/StoreMobileNavigation';
import {scopedPath,selectedNode} from '../storeNavigation';
import '../browse.css';
import {formatMoney} from '../currency';
import MaintenanceNotice,{isMaintenanceError} from '../components/MaintenanceNotice';
import {AccountProfile} from './AccountProfile';
import AccountShortcuts from '../components/AccountShortcuts';

const ClientOrders = lazy(() => import('./ClientOrders'));
const PublicRecommendations = lazy(() => import('./PublicRecommendations'));
const PublicProductCatalog = lazy(() => import('./PublicProductCatalog'));
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

export function EmailVerification({refresh}: {refresh:()=>Promise<void>}) {
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
      await refresh();
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
  const { user, isAuthenticated, isCustomer, logout, loading:authLoading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const searchable=location.pathname==='/'||location.pathname==='/products'||location.pathname==='/trips'||location.pathname.startsWith('/recommendations');
  const node = selectedNode(location.search);
  const currentNode=useRef(node);currentNode.current=node;
  const contextLife=useRef(true),bookableGeneration=useRef(0),activeGeneration=useRef(0);
  useEffect(()=>{contextLife.current=true;return()=>{contextLife.current=false;bookableGeneration.current++;activeGeneration.current++;};},[]);
  const [navigationOpen,setNavigationOpen] = useState(false);
  const [cartConfirmationOpen,setCartConfirmationOpen] = useState(false);
  const [publicNodes,setPublicNodes] = useState<{id:number;name:string}[]>();
  const [nodeNameError,setNodeNameError]=useState(false);
  const needsNodeNames=node!==undefined||navigationOpen;
  const [privateNodes,setPrivateNodes]=useState<{userId?:number;ids:number[]}>({ids:[]});
  const scope=authLoading?null:cartScope(isAuthenticated?user?.id:undefined);
  const draft=useCartDraft(scope),cart=draft.cart;
  const setCart=(change:(prior:Cart)=>Cart)=>{void draft.update(change);};
  const sessionIdentity=JSON.stringify([scope,getStoredAccessToken(),isAuthenticated]);
  const currentIdentity=useRef(sessionIdentity);currentIdentity.current=sessionIdentity;
  const submitTicket=useRef<{identity:string;revision:string;requestId:string}|null>(null);
  if(submitTicket.current?.identity!==sessionIdentity)submitTicket.current=null;
  const[addressReady,setAddressReady]=useState<string>();
  const [trips, setTrips] = useState<StoreTrip[]>([]);
  const [activeTrips, setActiveTrips] = useState<StoreTrip[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [browseLoaded, setBrowseLoaded] = useState(false);
  const [error, setError] = useState('');
  const search=new URLSearchParams(location.search).get('query')??'';
  function setSearch(value:string){const params=new URLSearchParams(location.search);if(value)params.set('query',value);else params.delete('query');navigate({pathname:location.pathname,search:params.toString()},{replace:true});}
  const [tripsReady,setTripsReady]=useState(false),[cartPricesReady,setCartPricesReady]=useState(false),[cartPriceAttempt,setCartPriceAttempt]=useState(0);
  const needsCart=location.pathname==='/cart'||location.pathname==='/checkout';
  const shoppingContext=location.pathname==='/'||location.pathname==='/products'||location.pathname.startsWith('/recommendations')||location.pathname==='/trips'||needsCart;
  const authKey=JSON.stringify([user?.id,user?.roles,isAuthenticated,authLoading]);
  const receiveSales=useCallback((values:StoreProduct[])=>setProducts(previous=>{const next=new Map(previous.map(product=>[product.id,product]));values.forEach(value=>next.set(value.id,value));return [...next.values()];}),[]);
  const [detail, setDetail] = useState<StoreProduct>();
  const [quantityProduct, setQuantityProduct] = useState<StoreProduct>();
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [tripPicker, setTripPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt,setReceipt]=useState<{identity:string;orderId:number;total:number;currency?:string}>();
  const visibleReceipt=receipt?.identity===sessionIdentity?receipt:undefined;
  useEffect(()=>{setBusy(false);setReceipt(undefined);setError('');setDetail(undefined);setQuantityProduct(undefined);setAddressReady(undefined);},[sessionIdentity]);
  async function load() {
    const generation=++bookableGeneration.current;setError('');setTripsReady(false);
    try {const nextTrips=await storefrontApi.trips();if(!contextLife.current||generation!==bookableGeneration.current)return;setTrips(nextTrips);setTripsReady(true);const preferred=nextTrips.find(value=>currentNode.current===undefined||value.merchantId===currentNode.current);setCart(prior=>prior.tripId===null&&preferred?{...prior,tripId:preferred.id}:prior);}catch(error){if(contextLife.current&&generation===bookableGeneration.current)setError(t((error as Error).message));}
  }
  async function loadActive(){const generation=++activeGeneration.current;setLoading(true);setBrowseLoaded(false);try{const values=await storefrontApi.activeTrips();if(contextLife.current&&generation===activeGeneration.current){setActiveTrips(values);setBrowseLoaded(true);}}catch(error){if(contextLife.current&&generation===activeGeneration.current)setError(t((error as Error).message));}finally{if(contextLife.current&&generation===activeGeneration.current)setLoading(false);}}
  useEffect(()=>{if(shoppingContext){void load();void loadActive();}},[shoppingContext]);
  useEffect(()=>{if(!needsNodeNames||publicNodes!==undefined)return;let active=true;setNodeNameError(false);void recommendationApi.nodes().then(values=>{if(active)setPublicNodes(values);}).catch(error=>{if(active){setNodeNameError(true);setError(t(error.message));}});return()=>{active=false;};},[needsNodeNames]);
  const nameChoices=new Map([...trips,...activeTrips].map(value=>[value.merchantId,value.merchantName]));
  publicNodes?.forEach(value=>nameChoices.set(value.id,value.name||t('browse.node_number',{id:value.id})));
  const merchantName=(journey:StoreTrip)=>nameChoices.get(journey.merchantId)??journey.merchantName;
  const nodes=[...nameChoices].map(([id,name])=>({id,name}));
  const visibleNodes=[...nodes,...(privateNodes.userId===user?.id?privateNodes.ids:[]).filter(id=>!nodes.some(value=>value.id===id)).map(id=>({id,name:t('browse.node_number',{id})}))];
  const cartIds=JSON.stringify(Object.keys(cart.items).sort());
  useEffect(()=>{if(!needsCart)return;let active=true;setCartPricesReady(false);const ids=JSON.parse(cartIds) as string[];void (async()=>{const values:StoreProduct[]=[];for(let offset=0;offset<ids.length;offset+=24)values.push(...await storefrontApi.productSales(ids.slice(offset,offset+24)));if(active){setProducts(previous=>[...previous.filter(value=>!ids.includes(value.id)),...values]);setCartPricesReady(true);}})().catch(error=>{if(active)setError(t(error.message));});return()=>{active=false;};},[needsCart,cartIds,authKey,cartPriceAttempt]);
  useEffect(()=>{setDetail(prior=>prior?products.find(p=>p.id===prior.id):prior);setQuantityProduct(prior=>prior?products.find(p=>p.id===prior.id):prior);},[products]);
  useEffect(()=>{
    const now=Date.now(),boundaries=products.map(p=>Date.parse(p.priceValidUntil??'')).filter(value=>Number.isFinite(value)&&value>now);
    if(!needsCart||!boundaries.length)return;
    const timer=window.setTimeout(()=>{setCartPriceAttempt(value=>value+1);},Math.min(2147483647,Math.max(100,Math.min(...boundaries)-now+100)));
    return()=>window.clearTimeout(timer);
  },[products,needsCart]);
  useEffect(()=>{
    let active=true;setPrivateNodes({userId:user?.id,ids:[]});
    if(!authLoading&&isAuthenticated&&isCustomer&&(navigationOpen||location.pathname.startsWith('/client/')))void api.customerTrips().then(values=>{if(active)setPrivateNodes({userId:user?.id,ids:[...new Set(values.map(value=>value.agentId))]});}).catch(()=>{ /* Public browsing stays available; private pages show their own errors. */ });
    return()=>{active=false;};
  },[user?.id,isCustomer,isAuthenticated,authLoading,navigationOpen,location.pathname]);
  useEffect(() => {setNavigationOpen(false);setDetail(undefined);setQuantityProduct(undefined);setTripPicker(false);},[location.pathname,node]);
  useEffect(()=>{if(draft.ready&&tripsReady&&cart.tripId===null&&!draft.conflict&&!draft.guestPending){const preferred=trips.find(value=>node===undefined||value.merchantId===node);if(preferred)setCart(prior=>({...prior,tripId:preferred.id,requestId:crypto.randomUUID()}));}},[draft.ready,tripsReady,cart.tripId,scope,draft.conflict,draft.guestPending]);
  const trip = trips.find(t => t.id === cart.tripId);
  const scopedTrips = trips.filter(value=>node===undefined||value.merchantId===node);
  const scopedActiveTrips = activeTrips.filter(value=>node===undefined||value.merchantId===node);
  const showHomeRecommendations=browseLoaded&&!scopedActiveTrips.length;
  const homeNavigationPath=loading?null:showHomeRecommendations?'/recommendations':'/products';
  const viewTrip = scopedActiveTrips.find(value=>value.id===cart.tripId)??scopedActiveTrips[0];
  const cartEntries = Object.entries(cart.items);
  const quantity = cartEntries.reduce((sum, [, value]) => sum + value, 0);
  const canBookProduct=(product:StoreProduct)=>draft.ready&&!draft.conflict&&!draft.guestPending&&!authLoading&&tripsReady&&liveReservationQuote(product)&&trips.some(journey=>journey.merchantId===product.merchantId);
  const canBuyRecommendation=(product:StoreProduct)=>canBookProduct(product)&&product.recommendationReady===true;
  const canBuyRootProduct=(product:StoreProduct)=>canBookProduct(product)&&product.merchantId===(node??viewTrip?.merchantId);
  const total = cartEntries.reduce((sum,[id,qty])=>sum+(cart.quotes?.[id]?.price??products.find(p=>p.id===id)?.price??0)*qty,0);
  const totalKnown=cartEntries.every(([id])=>Number.isFinite(cart.quotes?.[id]?.price)||products.some(value=>value.id===id));
  const totalText=totalKnown?money(total,cart.currency):t(cartPricesReady?'rec.not_stated':'browse.sales_pending');
  const invalidCart = !draft.ready || draft.conflict || draft.guestPending || !tripsReady || needsCart&&!cartPricesReady || !trip || cartEntries.some(([id]) => !products.some(p => p.id === id && p.merchantId === trip.merchantId && (p.currency??'JPY')===(cart.currency??'JPY') && (!p.priceToken||cart.quotes?.[id]?.token===p.priceToken) && (!(p.priceRevision??0)||(cart.quotes?.[id]?.revision===p.priceRevision&&cart.quotes?.[id]?.price===p.price&&cart.quotes?.[id]?.currency===p.currency))));
  function change(id:string,value:number){const product=products.find(p=>p.id===id);if(!product&&value>0)return;
    setCart(prior=>{const next=changeQuantity(prior,id,value);if(next===prior)return prior;if(value>0&&prior.items[id]&&prior.quotes?.[id]&&JSON.stringify(prior.quotes[id])!==JSON.stringify({price:product!.price,currency:product!.currency??'JPY',revision:product!.priceRevision??0,token:product!.priceToken}))throw Error('pricing.quote_changed');if(value>0&&Object.keys(prior.items).length&&(product!.currency??'JPY')!==(prior.currency??'JPY'))throw Error('sale.mixed_currency');const quotes={...prior.quotes};if(value<=0)delete quotes[id];else quotes[id]={price:product!.price,currency:product!.currency??'JPY',revision:product!.priceRevision??0,token:product!.priceToken};return {...next,currency:product?.currency??prior.currency??'JPY',quotes};});setReceipt(undefined);
  }
  function addRecommendation(product:StoreProduct){
    if(!canBuyRecommendation(product))return;
    if(product.merchantId!==trip?.merchantId){setTripPicker(true);return;}
    setCart(prior=>{if(Object.keys(prior.items).length&&(prior.currency??'JPY')!==(product.currency??'JPY'))return prior;
      if(prior.items[product.id]&&prior.quotes?.[product.id]&&JSON.stringify(prior.quotes[product.id])!==JSON.stringify({price:product.price,currency:product.currency??'JPY',revision:product.priceRevision??0,token:product.priceToken}))throw Error('pricing.quote_changed');
      const next=changeQuantity(prior,product.id,(prior.items[product.id]??0)+1);
      return {...next,currency:product.currency??'JPY',quotes:{...prior.quotes,[product.id]:{price:product.price,currency:product.currency??'JPY',revision:product.priceRevision??0,token:product.priceToken}}};});setReceipt(undefined);
  }
  function configureQuantity(product: StoreProduct) {
    if(!canBookProduct(product))return;
    if (product.merchantId !== trip?.merchantId) { setDetail(undefined); setTripPicker(true); return; }
    setDraftQuantity(cart.items[product.id] || 1); setQuantityProduct(product); setDetail(undefined);
  }
  function choose(next: StoreTrip, after?:()=>void) {
    const apply = () => {setCart(prior => ({ ...prior, tripId: next.id, requestId: crypto.randomUUID(), items: trip?.merchantId === next.merchantId ? prior.items : {}, quotes:trip?.merchantId === next.merchantId?prior.quotes:{},currency:trip?.merchantId === next.merchantId?prior.currency:undefined }));after?.();};
    if (quantity && trip?.merchantId !== next.merchantId) {setCartConfirmationOpen(true);Modal.confirm({ title: t('store.change_merchant_confirm'), okText: t('store.change_merchant'), cancelText: t('store.keep_cart'), onOk: apply,afterClose:()=>setCartConfirmationOpen(false) });}
    else apply();
  }
  function changeNode(next?:number) {
    if(next===node)return;
    const apply=()=>{const params=new URLSearchParams(location.search);if(next===undefined)params.delete('node');else params.set('node',String(next));params.delete('category');navigate({pathname:location.pathname,search:params.toString()});};
    const nextTrip=trips.find(value=>value.id===cart.tripId&&(next===undefined||value.merchantId===next))??trips.find(value=>next===undefined||value.merchantId===next);
    if(nextTrip&&nextTrip.id!==cart.tripId)choose(nextTrip,apply);else apply();
  }
  async function checkout() {
    if(!scope||!trip||invalidCart||!quantity||!isAuthenticated||!isCustomer||addressReady!==sessionIdentity||submitTicket.current)return;
    const ticket={identity:sessionIdentity,revision:draft.revision,requestId:cart.requestId},accessToken=getStoredAccessToken();submitTicket.current=ticket;setBusy(true);setError('');
    const payload={requestId:cart.requestId,tripId:trip.id,currency:cart.currency??'JPY',items:cartEntries.map(([productId,qty])=>({productId,quantity:qty,priceRevision:cart.quotes?.[productId]?.revision,currency:cart.quotes?.[productId]?.currency,priceToken:cart.quotes?.[productId]?.token}))};
    const current=()=>contextLife.current&&currentIdentity.current===ticket.identity&&submitTicket.current===ticket&&getStoredAccessToken()===accessToken;
    try{
      const valid=await withCartLock(()=>current()&&readDraft(scope).revision===ticket.revision);if(!valid){await draft.update(prior=>prior);throw Error('store.cart_conflict');}
      if(!current())return;
      const result=await storefrontApi.checkout(payload);
      if(!current())return;
      setReceipt({...result,identity:ticket.identity});
      await draft.update(prior=>prior.requestId===ticket.requestId?{...emptyCart(),tripId:payload.tripId}:prior);
    }catch(e){if(current()){setError(t((e as Error).message));setCartPriceAttempt(value=>value+1);}}
    finally{if(current()){submitTicket.current=null;setBusy(false);}}
  }
  function stepper(product: StoreProduct, count: number) {
    return <div className="quantity-control"><Button icon={count === 1 ? <DeleteOutlined /> : <MinusOutlined />} aria-label={t('store.decrease',{name:text(product.name)})} onClick={() => change(product.id, count - 1)} />
      <output aria-label={t('store.product_quantity',{name:text(product.name)})}>{count}</output><Button icon={<PlusOutlined />} disabled={count >= 99} aria-label={t('store.increase',{name:text(product.name)})} onClick={() => change(product.id, count + 1)} /></div>;
  }
  function image(product: StoreProduct) {
    return product.images[0] ? <img src={product.images[0]} alt={text(product.name)} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <ShopOutlined aria-label={t('store.no_image')} />;
  }
  const cartNotices=<>
    {draft.error&&<Alert type="warning" message={t(draft.error)} action={draft.conflict?<div className="action-row"><Button onClick={draft.reload}>{t('store.cart_reload')}</Button>{draft.error==='store.cart_storage_invalid'?<Button onClick={()=>void draft.reset()}>{t('store.cart_reset')}</Button>:<Button onClick={()=>void draft.update(prior=>({...prior}),{replaceConflict:true})}>{t('store.cart_keep_local')}</Button>}</div>:undefined}/>}
    {draft.guestPending&&<Alert type="info" message={t('store.cart_guest_choice')} description={<><p>{t('store.cart_guest_counts',{guest:Object.values(draft.guestCart?.items??{}).reduce((n,q)=>n+q,0),own:quantity})}</p><div className="action-row"><Button onClick={()=>void draft.resolveGuest('own')}>{t('store.cart_keep_account')}</Button><Button onClick={()=>void draft.resolveGuest('guest')}>{t('store.cart_use_guest')}</Button><Button onClick={()=>void draft.resolveGuest('merge')}>{t('store.cart_merge')}</Button></div></>}/>}
    {visibleReceipt&&quantity>0&&<Alert type="success" message={t('checkout.submitted_kept')} description={<Link to="/client/orders">{t('store.order_number',{id:visibleReceipt.orderId})}</Link>}/>}
  </>;
  const basket = <section className="basket">{cartNotices}<div className="section-heading"><h1>{t('store.cart')} <small>{t('store.item_count',{count:quantity})}</small></h1><Link to="/">{t('store.continue')} <ArrowRightOutlined /></Link></div>
    {quantity === 0 ? <Empty description={t('store.cart_empty')}><Link to="/"><Button type="primary">{t('store.browse')}</Button></Link></Empty> : <>
      {trip && <div className="basket-trip"><CalendarOutlined /><div><strong>{trip.deliveryArea}</strong><p>{trip.deliveryDate} · {merchantName(trip)}</p></div></div>}
      {invalidCart && <Alert type="warning" message={t(!cartPricesReady||!tripsReady?'browse.sales_pending':'store.cart_invalid')} action={<Button disabled={!cartPricesReady||!tripsReady} onClick={()=>{setCart(prior=>({...prior,requestId:crypto.randomUUID(),quotes:Object.fromEntries(products.filter(p=>prior.items[p.id]&&(p.currency??'JPY')===(prior.currency??'JPY')).map(p=>[p.id,{price:p.price,currency:p.currency??'JPY',revision:p.priceRevision??0,token:p.priceToken}]))}));}}>{t('sale.refresh_cart')}</Button>}/>}
      <div className="basket-lines">{cartEntries.map(([id, qty]) => {
        const product = products.find(p => p.id === id);
        return product ? <article className="basket-line" key={id}><div className="basket-photo">{image(product)}</div><div><h2>{text(product.name)}</h2><p>{money(cart.quotes?.[id]?.price??product.price,product.currency)} / {productFactText(product.saleUnit,locale)}</p>{stepper(product, qty)}</div><strong>{money((cart.quotes?.[id]?.price??product.price)*qty,product.currency)}</strong></article> :
          <article key={id} className="basket-line"><span>{t(cartPricesReady?'store.unavailable':'browse.sales_pending')}</span><Button icon={<DeleteOutlined />} onClick={() => change(id, 0)}>{t('store.remove')}</Button></article>;
      })}</div>
      <div className="basket-total"><span>{t('store.total')} <small>{cart.currency??'JPY'}</small></span><strong>{totalText}</strong></div>
      <p className="muted">{t('store.payment_hint')}</p>
      {location.pathname !== '/checkout' && <Button block size="large" type="primary" disabled={invalidCart} onClick={() => navigate('/checkout')}>{t('store.checkout')} <ArrowRightOutlined /></Button>}
    </>}
  </section>;
  const tripChoices = <div className="trip-list" role="group" aria-label={t('store.choose_trip')}>{scopedTrips.map(journey => <button key={journey.id} className={`trip-choice ${cart.tripId === journey.id ? 'selected' : ''}`} onClick={() => { choose(journey); setTripPicker(false); }} aria-pressed={cart.tripId === journey.id}>
        <span className="trip-date">{journey.deliveryDate.slice(5).replace('-', '/')}<small>{t('store.delivery_date')}</small></span><span className="trip-route"><strong>{journey.deliveryArea}</strong><small>{merchantName(journey)}</small></span>
        {cart.tripId === journey.id && <CheckCircleOutlined />}</button>)}</div>;
  const bookable=<section className="browse-trip-page"><header className="browse-page-heading"><span>{t('browse.plan')}</span><h1>{t('browse.bookable')}</h1><p>{t('browse.bookable_hint')}</p></header>
    {scopedTrips.length?<div className="browse-trip-grid">{scopedTrips.filter(journey=>(journey.deliveryArea+' '+merchantName(journey)+' '+journey.deliveryDate).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(journey=><article className="browse-trip-card" key={journey.id}><CalendarOutlined/><time dateTime={journey.deliveryDate}>{journey.deliveryDate}</time><h2>{journey.deliveryArea}</h2><p>{merchantName(journey)}</p><Button onClick={()=>choose(journey,()=>navigate('/products?'+new URLSearchParams({node:String(journey.merchantId)})))}>{t('store.browse')}<ArrowRightOutlined/></Button></article>)}</div>:<Empty description={t('store.no_trips')}/>}
  </section>;
  const rootCatalog=<><section className="journey-strip"><button className="journey-trigger" onClick={()=>setTripPicker(true)} aria-label={t('store.choose_trip')}><CalendarOutlined/><span><small>{viewTrip?viewTrip.deliveryDate+' · '+merchantName(viewTrip):t('store.trip')}</small><strong>{viewTrip?viewTrip.deliveryArea:t('store.no_trips')}</strong></span><ArrowRightOutlined/></button></section><PublicProductCatalog query={search} products={products} quantities={cart.items} onAdd={configureQuantity} canBuy={canBuyRootProduct} merchantId={node??viewTrip?.merchantId} purchasePending={!tripsReady||authLoading} onSales={receiveSales} autoPaused={navigationOpen||tripPicker||!!detail||!!quantityProduct||cartConfirmationOpen}/></>;
  const maintenance=isMaintenanceError(error);
  const retryBrowse=()=>{setError('');void load();void loadActive();setCartPriceAttempt(value=>value+1);};
  return <div className={`storefront browse-shell ${(location.pathname === '/' || location.pathname === '/products' || location.pathname.startsWith('/recommendations')) ? 'storefront-catalog' : ''}`}>
    <StoreNavigation nodes={visibleNodes} node={node} loading={loading} homePath={homeNavigationPath} open={navigationOpen} onClose={()=>setNavigationOpen(false)} onNodeChange={changeNode}/>
    <div className="browse-workspace"><header className="store-header"><div className="browse-context"><Button className="browse-menu-toggle" icon={<MenuOutlined/>} aria-label={t('app.open_menu')} aria-expanded={navigationOpen} onClick={()=>setNavigationOpen(value=>!value)}/><Link className="browse-mobile-brand" to={scopedPath('/',location.search)}><strong>{t('app.brand')}</strong><span className="browse-brand-domain">bobuy.cc</span></Link><span className="browse-context-node">{node===undefined?t('browse.all_nodes'):visibleNodes.find(value=>value.id===node)?.name??t(needsNodeNames&&publicNodes===undefined&&!nodeNameError?'browse.node_loading':'browse.unavailable_node')}</span></div>
    {searchable&&<Input className="browse-search" prefix={<SearchOutlined/>} aria-label={t('store.search')} placeholder={t('store.search')} allowClear value={search} onChange={event=>setSearch(event.target.value)}/>}
    <div className="store-header-actions"><LanguageSwitcher /><Link to={scopedPath('/account',location.search)} aria-label={t('store.account')}><UserOutlined /></Link><Badge count={quantity} size="small"><Link to={scopedPath('/cart',location.search)} aria-label={t('store.cart_label',{count:quantity})}><ShoppingCartOutlined /></Link></Badge></div></header>
    <main className="store-main">{maintenance?<MaintenanceNotice retry={retryBrowse}/>:error && <Alert type="error" message={error} action={<Button onClick={retryBrowse}>{t('store.retry')}</Button>} closable onClose={() => setError('')} />}
      {!needsCart&&cartNotices}
      {!maintenance&&(location.pathname==='/'&&loading ? <div className="store-loading"><Spin /></div> : <Suspense fallback={<Spin />}><Routes>
        <Route index element={<>{showHomeRecommendations?<PublicRecommendations query={search} products={products} quantities={cart.items} onDetail={setDetail} onAdd={addRecommendation} canBuy={canBuyRecommendation} onSales={receiveSales} purchasePending={!tripsReady||authLoading} authKey={authKey} autoPaused={navigationOpen||tripPicker||!!detail||!!quantityProduct||cartConfirmationOpen}/>:rootCatalog}</>} /><Route path="products" element={<PublicProductCatalog query={search} products={products} quantities={cart.items} onAdd={addRecommendation} canBuy={canBuyRecommendation} onSales={receiveSales} purchasePending={!tripsReady||authLoading} autoPaused={navigationOpen||tripPicker||!!detail||!!quantityProduct||cartConfirmationOpen}/>}/><Route path="trips" element={tripsReady?bookable:<Spin/>}/><Route path="client/trips" element={<ClientTrips node={node}/>}/><Route path="cart" element={basket} />
        <Route path="checkout" element={<div className="checkout-layout">{visibleReceipt&&quantity===0 ? <section className="order-success"><CheckCircleOutlined /><h1>{t('store.submitted')}</h1><p>{t('store.order_number',{id:visibleReceipt.orderId})} · {money(visibleReceipt.total,visibleReceipt.currency)}</p><Tag color="gold">{t('store.pending')}</Tag><div className="action-row"><Link to="/client/orders"><Button type="primary">{t('store.view_order')}</Button></Link><Link to="/"><Button>{t('store.continue')}</Button></Link></div></section> : <>{basket}{quantity > 0 && <section className="checkout-account">{!isAuthenticated ? <AccountForm checkout afterLogin={() => {}} /> : !user?.roles.includes('CUSTOMER') ? <Alert type="warning" message={t('store.customer_only')} action={<Button onClick={() => void logout()}>{t('store.switch_account')}</Button>} /> : <><h2>{t('store.confirm')}</h2><p>{user.name} · {user.email}</p>{!user.emailVerified && <Alert type="info" message={t('store.unverified_hint')} />}<CheckoutAddress key={sessionIdentity} userId={user.id} identity={sessionIdentity} onReady={(identity,ready)=>{if(currentIdentity.current===identity)setAddressReady(ready?identity:undefined);}}/><Button type="primary" size="large" block loading={busy} disabled={invalidCart||addressReady!==sessionIdentity} onClick={() => void checkout()}>{t('store.submit')} · {totalText}</Button><Link to="/account">{t('store.verify')}</Link></>}</section>}</>}</div>} />
        <Route path="login" element={isAuthenticated ? <Navigate to="/account" replace /> : <AccountForm afterLogin={() => navigate('/account')} />} />
        <Route path="account" element={isAuthenticated ? <section className="account-page">
          <header className="account-heading"><div><h1>{t('store.account')}</h1><p>{user?.name}</p></div>
            <div className="account-utilities">{isCustomer&&<Link to="/client/billing">{t('store.billing')}</Link>}<Button type="text" icon={<LogoutOutlined />} onClick={() => void logout()}>{t('store.logout')}</Button></div>
          </header>
          <AccountShortcuts canManage={!!(user?.roles.includes('AGENT')||user?.platformAdmin)} ordersPath={isCustomer?'/client/orders':user?.roles.includes('AGENT')?'/admin/orders':undefined}/>
          {user&&<AccountProfile key={user.id} userId={user.id} verification={(refresh,profile)=><EmailVerification key={profile.email} refresh={refresh}/>}/>}</section> : <AccountForm afterLogin={() => {}} />} />
        <Route path="recommendations" element={<PublicRecommendations query={search} products={products} quantities={cart.items} onDetail={setDetail} onAdd={addRecommendation} canBuy={canBuyRecommendation} onSales={receiveSales} purchasePending={!tripsReady||authLoading} authKey={authKey} autoPaused={navigationOpen||tripPicker||!!detail||!!quantityProduct||cartConfirmationOpen}/>} />
        <Route path="recommendations/:id" element={<PublicRecommendations query={search} products={products} quantities={cart.items} onDetail={setDetail} onAdd={addRecommendation} canBuy={canBuyRecommendation} onSales={receiveSales} purchasePending={!tripsReady||authLoading} authKey={authKey} autoPaused={navigationOpen||tripPicker||!!detail||!!quantityProduct||cartConfirmationOpen}/>} />
        <Route path="client/orders" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><ClientOrders key={String(node)+':'+user?.id} node={node}/></ProtectedRoute>} />
        <Route path="client/billing" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><ClientBilling key={String(node)+':'+user?.id} node={node}/></ProtectedRoute>} />
        <Route path="client/chat" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><ClientChat /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>)}
    </main></div>
    <StoreMobileNavigation quantity={quantity} homePath={homeNavigationPath}/>
    <Drawer className="product-detail consumer-detail-drawer" title={t('store.details')} placement="right" width="min(1120px,100vw)" open={!!detail} onClose={() => setDetail(undefined)} closeIcon={<CloseOutlined />}>
      {detail && <ConsumerDetail media={<div className="detail-photo">{image(detail)}</div>}><small>{detail.brand}</small><h1>{text(detail.name)}</h1>{locale!=='ja-JP'&&detail.name['ja-JP']&&detail.name['ja-JP']!==text(detail.name)&&<p lang="ja">（{detail.name['ja-JP']}）</p>}<SellingPrice product={detail}/><section><h2>{t('detail.description')}</h2><p>{text(detail.description)}</p></section><Button type="primary" size="large" block disabled={!trips.some(journey => journey.merchantId === detail.merchantId)} icon={detail.merchantId === trip?.merchantId ? <PlusOutlined /> : <CalendarOutlined />} onClick={() => configureQuantity(detail)}>{t(detail.merchantId === trip?.merchantId ? 'store.set_quantity' : 'store.choose_trip')}</Button></ConsumerDetail>}
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
