export type CartQuote={price:number;currency:string;revision:number;token?:string};
export type Cart={tripId:number|null;requestId:string;items:Record<string,number>;currency?:string;quotes?:Record<string,CartQuote>};
export type CartDraft={version:2;revision:string;cart:Cart;guestDecision?:string};
export const CART_KEY='bobuy.cart.v1'; // Legacy shared key is a guest draft only.
export const CART_PREFIX='bobuy.cart.v2:';
export const GUEST_SCOPE='guest';
export const MAX_CART_LINES=50;
const uuid=()=>crypto.randomUUID();
const validUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const validDecision=(v:unknown):v is string=>validUuid(v)||typeof v==='string'&&v.startsWith('legacy:')&&validUuid(v.slice(7));
export function cartScope(userId?:number|null){return userId==null?GUEST_SCOPE:'user:'+userId;}
export function cartStorageKey(scope:string){if(scope!==GUEST_SCOPE&&!/^user:[1-9]\d*$/.test(scope))throw Error('store.storage_error');return CART_PREFIX+scope;}
export function emptyCart():Cart{return{tripId:null,requestId:uuid(),items:{},currency:'JPY',quotes:{}};}
export function parseCart(value:unknown):Cart|undefined{
  if(!value||typeof value!=='object')return;
  const v=value as Cart;
  if(!validUuid(v.requestId)||(v.tripId!==null&&(!Number.isSafeInteger(v.tripId)||v.tripId!<=0))||!v.items||typeof v.items!=='object'||Array.isArray(v.items))return;
  const entries=Object.entries(v.items);if(entries.length>MAX_CART_LINES)return;
  const items=Object.fromEntries(entries.filter(([id,qty])=>id.length>0&&id.length<=255&&Number.isInteger(qty)&&qty>0&&qty<=99));
  const quotes:Record<string,CartQuote>={};
  for(const id of Object.keys(items)){const q=v.quotes?.[id];if(q&&Number.isFinite(q.price)&&q.price>0&&/^[A-Z]{3}$/.test(q.currency)&&Number.isSafeInteger(q.revision)&&q.revision>=0&&(q.token===undefined||typeof q.token==='string'&&q.token.length<=64))quotes[id]={price:q.price,currency:q.currency,revision:q.revision,...(q.token===undefined?{}:{token:q.token})};}
  return{tripId:v.tripId,requestId:v.requestId,items,currency:typeof v.currency==='string'&&/^[A-Z]{3}$/.test(v.currency)?v.currency:'JPY',quotes};
}
export function readCart():Cart{try{return parseCart(JSON.parse(localStorage.getItem(CART_KEY)||'null'))??emptyCart();}catch{return emptyCart();}}
export function readDraft(scope:string):CartDraft{
  const raw=localStorage.getItem(cartStorageKey(scope));
  if(raw){try{const v=JSON.parse(raw),cart=parseCart(v.cart);if(v.version===2&&validUuid(v.revision)&&cart)return{version:2,revision:v.revision,cart,...(validDecision(v.guestDecision)?{guestDecision:v.guestDecision}:{})};}catch{/* Preserve malformed storage for explicit recovery. */}throw Error('store.cart_storage_invalid');}
  // Empty revision is stable across readers. The first write initializes it under the lock.
  if(scope===GUEST_SCOPE){const legacy=localStorage.getItem(CART_KEY);if(legacy){let cart:Cart|undefined;try{cart=parseCart(JSON.parse(legacy));}catch{}if(!cart)throw Error('store.cart_storage_invalid');return{version:2,revision:'legacy:'+cart.requestId,cart};}}
  return{version:2,revision:'',cart:emptyCart()};
}
export function changeQuantity(cart:Cart,id:string,quantity:number):Cart{
  if(!id||id.length>255||!Number.isFinite(quantity))return cart;
  const next=Math.max(0,Math.min(99,Math.floor(quantity)));
  if((cart.items[id]??0)===next)return cart;
  if(next>0&&!Object.prototype.hasOwnProperty.call(cart.items,id)&&Object.keys(cart.items).length>=MAX_CART_LINES)throw Error('store.cart_limit');
  const items={...cart.items},quotes={...cart.quotes};if(next===0){delete items[id];delete quotes[id];}else items[id]=next;
  return{...cart,requestId:uuid(),items,quotes};
}
export function mergeCarts(own:Cart,guest:Cart):Cart{
  if(!Object.keys(own.items).length)return{...guest,requestId:uuid()};
  if(!Object.keys(guest.items).length)return own;
  if(own.tripId!==guest.tripId||(own.currency??'JPY')!==(guest.currency??'JPY'))throw Error('store.cart_merge_conflict');
  const items={...own.items},quotes={...own.quotes};
  for(const[id,qty]of Object.entries(guest.items)){const a=own.quotes?.[id],b=guest.quotes?.[id];if(items[id]&&JSON.stringify(a)!==JSON.stringify(b))throw Error('store.cart_merge_conflict');if((items[id]??0)+qty>99)throw Error('store.cart_merge_conflict');items[id]=(items[id]??0)+qty;if(b)quotes[id]=b;}
  if(Object.keys(items).length>MAX_CART_LINES)throw Error('store.cart_limit');return{...own,requestId:uuid(),items,quotes};
}
export async function withCartLock<T>(work:()=>T|Promise<T>):Promise<T>{
  // No unsafe cross-tab read-then-write fallback when Web Locks is unavailable.
  if(!navigator.locks?.request)throw Error('store.cart_lock_unavailable');
  return navigator.locks.request(CART_PREFIX+'write',work);
}
export function commitDraft(scope:string,expected:string,cart:Cart,guestDecision?:string):CartDraft{
  const current=readDraft(scope);if(current.revision!==expected)throw Error('store.cart_conflict');
  const clean=parseCart(cart);if(!clean||Object.keys(clean.items).length!==Object.keys(cart.items).length)throw Error('store.cart_storage_invalid');
  const next:CartDraft={version:2,revision:uuid(),cart:clean,...(validDecision(guestDecision)?{guestDecision}:{})};
  // Whitelist excludes passwords, tokens, profile and delivery address.
  localStorage.setItem(cartStorageKey(scope),JSON.stringify(next));return next;
}
export function resetCorruptDraft(scope:string,expectedRaw:string|null):CartDraft{
  if(localStorage.getItem(cartStorageKey(scope))!==expectedRaw)throw Error('store.cart_conflict');
  const next:CartDraft={version:2,revision:uuid(),cart:emptyCart()};
  localStorage.setItem(cartStorageKey(scope),JSON.stringify(next));return next;
}
