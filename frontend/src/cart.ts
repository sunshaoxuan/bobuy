export type Cart = { tripId: number | null; requestId: string; items: Record<string, number>; currency?:string;quotes?:Record<string,{price:number;currency:string;revision:number;token?:string}> };
export const CART_KEY = 'bobuy.cart.v1';
export function emptyCart(): Cart { return { tripId: null, requestId: crypto.randomUUID(), items: {},currency:'JPY',quotes:{} }; }
export function readCart(): Cart {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || 'null');
    if (!value || !/^[0-9a-f-]{36}$/i.test(value.requestId) || (value.tripId !== null && !Number.isSafeInteger(value.tripId)) ||
      !value.items || typeof value.items !== 'object' || Array.isArray(value.items)) return emptyCart();
    const items: Record<string, number> = Object.fromEntries(Object.entries(value.items).filter(([key, qty]) => key.length <= 255 && Number.isInteger(qty) && Number(qty) > 0 && Number(qty) <= 99).map(([key, qty]) => [key, Number(qty)]));
    const quotes:NonNullable<Cart['quotes']>={};
    for(const id of Object.keys(items)){const q=value.quotes?.[id];if(q&&Number.isFinite(q.price)&&q.price>0&&typeof q.currency==='string'&&/^[A-Z]{3}$/.test(q.currency)&&Number.isSafeInteger(q.revision)&&q.revision>=0)quotes[id]=q;}
    return { tripId: value.tripId, requestId: value.requestId, items,currency:typeof value.currency==='string'?value.currency:'JPY',quotes };
  } catch { return emptyCart(); }
}
export function changeQuantity(cart: Cart, id: string, quantity: number): Cart {
  const items = { ...cart.items };
  if (quantity <= 0) delete items[id]; else items[id] = Math.min(99, Math.floor(quantity));
  return { ...cart, requestId: crypto.randomUUID(), items };
}
