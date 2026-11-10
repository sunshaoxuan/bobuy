import{act,renderHook,waitFor}from'@testing-library/react';
import{beforeEach,expect,it}from'vitest';
import{CART_KEY,cartStorageKey,changeQuantity,commitDraft,emptyCart,mergeCarts,readDraft,withCartLock,type Cart}from'./cart';
import{useCartDraft}from'./useCartDraft';
import{installCartLocks}from'./test/cartLock';
const make=(qty=2):Cart=>({...changeQuantity(emptyCart(),'p',qty),tripId:11,currency:'JPY',quotes:{p:{price:12,currency:'JPY',revision:1,token:'q1'}}});
beforeEach(()=>{localStorage.clear();installCartLocks();});
it('migrates the shared key only as guest; accounts stay separate through logout and A→B→A',async()=>{
 const guest=make();localStorage.setItem(CART_KEY,JSON.stringify(guest));
 const{result,rerender}=renderHook(({scope})=>useCartDraft(scope),{initialProps:{scope:'guest' as string|null}});
 await waitFor(()=>expect(result.current.ready).toBe(true));expect(result.current.cart.items.p).toBe(2);
 rerender({scope:'user:7'});await waitFor(()=>expect(result.current.guestPending).toBe(true));expect(result.current.cart.items).toEqual({});
 await act(()=>result.current.resolveGuest('guest'));expect(result.current.cart.items.p).toBe(2);expect(result.current.guestPending).toBe(false);
 rerender({scope:'user:8'});await waitFor(()=>expect(result.current.ready).toBe(true));expect(result.current.cart.items).toEqual({});expect(result.current.guestPending).toBe(true);
 await act(()=>result.current.resolveGuest('own'));expect(result.current.cart.items).toEqual({});
 rerender({scope:null});expect(result.current.cart.items).toEqual({});
 rerender({scope:'user:7'});await waitFor(()=>expect(result.current.cart.items.p).toBe(2));expect(result.current.guestPending).toBe(false);
 rerender({scope:'guest'});await waitFor(()=>expect(result.current.cart.requestId).toBe(guest.requestId));
});
it('explicit merge cannot add the same guest revision twice, even after reload',async()=>{
 commitDraft('guest','',make(3));commitDraft('user:7','',make(2));
 const{result,unmount}=renderHook(()=>useCartDraft('user:7'));await waitFor(()=>expect(result.current.guestPending).toBe(true));
 await act(()=>result.current.resolveGuest('merge'));expect(result.current.cart.items.p).toBe(5);expect(result.current.guestPending).toBe(false);unmount();
 const second=renderHook(()=>useCartDraft('user:7'));await waitFor(()=>expect(second.result.current.ready).toBe(true));expect(second.result.current.cart.items.p).toBe(5);expect(second.result.current.guestPending).toBe(false);
});
it('rechecks the same guest decision inside the lock for queued duplicate merge and retry',async()=>{
 commitDraft('guest','',make(3));commitDraft('user:7','',make(2));
 const{result}=renderHook(()=>useCartDraft('user:7'));await waitFor(()=>expect(result.current.guestPending).toBe(true));
 let release!:()=>void;const held=withCartLock(()=>new Promise<void>(done=>{release=done;}));await Promise.resolve();
 let first!:Promise<void>,second!:Promise<void>;act(()=>{const resolve=result.current.resolveGuest;first=resolve('merge');second=resolve('merge');});
 await act(async()=>{release();await held;await Promise.all([first,second]);});
 expect(readDraft('user:7').cart.items.p).toBe(5);expect(readDraft('guest').cart.items.p).toBe(3);
 const revision=readDraft('user:7').revision;await act(()=>result.current.resolveGuest('merge'));expect(readDraft('user:7').cart.items.p).toBe(5);expect(readDraft('user:7').revision).toBe(revision);
});
it('permits one explicit merge of a new guest revision and independent consumption by another account',async()=>{
 commitDraft('guest','',make(3));commitDraft('user:7','',make(2));commitDraft('user:8','',make(1));
 const{result,rerender}=renderHook(({scope})=>useCartDraft(scope),{initialProps:{scope:'user:7'}});await waitFor(()=>expect(result.current.guestPending).toBe(true));await act(()=>result.current.resolveGuest('merge'));
 const guest=readDraft('guest');commitDraft('guest',guest.revision,make(4));act(()=>window.dispatchEvent(new StorageEvent('storage',{key:cartStorageKey('guest'),storageArea:localStorage})));
 await waitFor(()=>expect(result.current.guestPending).toBe(true));await act(()=>result.current.resolveGuest('merge'));expect(readDraft('user:7').cart.items.p).toBe(9);
 rerender({scope:'user:8'});await waitFor(()=>expect(result.current.guestPending).toBe(true));await act(()=>result.current.resolveGuest('merge'));expect(readDraft('user:8').cart.items.p).toBe(5);expect(readDraft('user:7').cart.items.p).toBe(9);expect(readDraft('guest').cart.items.p).toBe(4);
});
it.each([{tripId:12},{currency:'USD'},{items:{p:99}},{quotes:{p:{price:1,currency:'JPY',revision:2,token:'q2'}}}])('rejects incompatible merge %j without mutating either source',difference=>{
 const own=make(),guest={...make(),...difference};expect(()=>mergeCarts(own,guest)).toThrow('store.cart_merge_conflict');expect(own.items.p).toBe(2);
});
it('caps distinct lines and rotates the operation only on a real quantity change',()=>{
 const cart=make();expect(changeQuantity(cart,'p',2)).toBe(cart);expect(changeQuantity(cart,'p',NaN)).toBe(cart);
 const full={...cart,items:Object.fromEntries(Array.from({length:50},(_,i)=>['p'+i,1]))};expect(()=>changeQuantity(full,'extra',1)).toThrow('store.cart_limit');expect(changeQuantity(cart,'p',0).quotes?.p).toBeUndefined();
});
it('detects another tab before writes even when storage event delivery is late; local draft survives',async()=>{
 commitDraft('user:7','',make());const{result}=renderHook(()=>useCartDraft('user:7'));await waitFor(()=>expect(result.current.ready).toBe(true));
 const old=result.current.revision;await withCartLock(()=>commitDraft('user:7',old,make(6)));
 await act(()=>result.current.update(cart=>changeQuantity(cart,'p',3)));expect(result.current.conflict).toBe(true);expect(result.current.cart.items.p).toBe(2);expect(readDraft('user:7').cart.items.p).toBe(6);
 act(()=>result.current.reload());expect(result.current.cart.items.p).toBe(6);
});
it('storage events require an explicit choice instead of silently replacing the draft',async()=>{
 commitDraft('user:7','',make());const{result}=renderHook(()=>useCartDraft('user:7'));await waitFor(()=>expect(result.current.ready).toBe(true));
 commitDraft('user:7',result.current.revision,make(8));act(()=>window.dispatchEvent(new StorageEvent('storage',{key:cartStorageKey('user:7'),storageArea:localStorage})));
 expect(result.current.cart.items.p).toBe(2);expect(result.current.conflict).toBe(true);
 await act(()=>result.current.update(cart=>({...cart}),{replaceConflict:true}));expect(readDraft('user:7').cart.items.p).toBe(2);expect(result.current.conflict).toBe(false);
});
it('never persists an old queued edit after account round trip or unmount',async()=>{
 let release!:()=>void;const lock=withCartLock(()=>new Promise<void>(done=>{release=done;}));await Promise.resolve();
 const{result,rerender}=renderHook(({scope})=>useCartDraft(scope),{initialProps:{scope:'user:7'}});await waitFor(()=>expect(result.current.ready).toBe(true));
 let edit!:Promise<boolean>;act(()=>{edit=result.current.update(()=>make());});rerender({scope:'user:8'});rerender({scope:'user:7'});
 await act(async()=>{release();await lock;await edit;});expect(readDraft('user:7').cart.items).toEqual({});
});
it('recovers corrupt storage only by explicit reset and saves no injected private fields',async()=>{
 localStorage.setItem(cartStorageKey('user:7'),'{broken');const{result}=renderHook(()=>useCartDraft('user:7'));await waitFor(()=>expect(result.current.conflict).toBe(true));
 await act(()=>result.current.reset());expect(result.current.conflict).toBe(false);
 await act(()=>result.current.update(()=>({...make(),password:'secret',defaultAddress:{city:'private'}})));
 const raw=localStorage.getItem(cartStorageKey('user:7'))!;expect(raw).not.toContain('secret');expect(raw).not.toContain('private');
});
it('fails visibly without a safe cross-tab lock instead of writing unsafely',async()=>{
 Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});const{result}=renderHook(()=>useCartDraft('user:7'));await waitFor(()=>expect(result.current.ready).toBe(true));await act(()=>result.current.update(()=>make()));expect(result.current.error).toBe('store.cart_lock_unavailable');expect(localStorage.getItem(cartStorageKey('user:7'))).toBeNull();
});
