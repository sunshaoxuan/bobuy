import { beforeEach, describe, expect, it } from 'vitest';
import { CART_KEY, changeQuantity, emptyCart, readCart } from './cart';
describe('guest cart', () => {
  beforeEach(() => localStorage.clear());
  it('retains cart and idempotency key across reloads', () => {
    const cart = changeQuantity({ ...emptyCart(), tripId: 2000 }, 'prd-1000', 2);
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    expect(readCart()).toEqual(cart);
  });
  it('rotates request ID only when cart changes and removes zero quantities', () => {
    const cart = emptyCart(); const next = changeQuantity(cart, 'item', 3);
    expect(next.requestId).not.toBe(cart.requestId);
    expect(changeQuantity(next, 'item', 0).items).toEqual({});
    expect(changeQuantity(next, 'item', 100).items.item).toBe(99);
  });
  it('rejects malformed storage and unsafe quantities', () => {
    localStorage.setItem(CART_KEY, '{broken'); expect(readCart().items).toEqual({});
    localStorage.setItem(CART_KEY, JSON.stringify({ ...emptyCart(), items: { bad: -1, overflow: 100, ok: 2 } }));
    expect(readCart().items).toEqual({ ok: 2 });
  });
});
