export type Cart = { tripId: number | null; requestId: string; items: Record<string, number> };
export const CART_KEY = 'bobuy.cart.v1';
export function emptyCart(): Cart { return { tripId: null, requestId: crypto.randomUUID(), items: {} }; }
export function readCart(): Cart {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || 'null');
    if (!value || !/^[0-9a-f-]{36}$/i.test(value.requestId) || (value.tripId !== null && !Number.isSafeInteger(value.tripId)) ||
      !value.items || typeof value.items !== 'object' || Array.isArray(value.items)) return emptyCart();
    const items: Record<string, number> = Object.fromEntries(Object.entries(value.items).filter(([key, qty]) => key.length <= 255 && Number.isInteger(qty) && Number(qty) > 0 && Number(qty) <= 99).map(([key, qty]) => [key, Number(qty)]));
    return { tripId: value.tripId, requestId: value.requestId, items };
  } catch { return emptyCart(); }
}
export function changeQuantity(cart: Cart, id: string, quantity: number): Cart {
  const items = { ...cart.items };
  if (quantity <= 0) delete items[id]; else items[id] = Math.min(99, Math.floor(quantity));
  return { ...cart, requestId: crypto.randomUUID(), items };
}
