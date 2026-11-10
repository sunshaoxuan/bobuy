import{useEffect,useRef,useState}from'react';
import{CART_KEY,cartStorageKey,commitDraft,emptyCart,GUEST_SCOPE,mergeCarts,readDraft,resetCorruptDraft,withCartLock,type Cart,type CartDraft}from'./cart';

export function useCartDraft(scope:string|null){
  type State={scope:string|null;draft:CartDraft;error:string;conflict:boolean};
  const blank=():CartDraft=>({version:2,revision:'',cart:emptyCart()});
  const[state,setState]=useState<State>(()=>({scope:null,draft:blank(),error:'',conflict:false}));
  const[guest,setGuest]=useState<CartDraft>();
  const life=useRef(true),active=useRef(scope),latest=useRef(state);active.current=scope;latest.current=state;
  const lastScope=useRef(scope),epoch=useRef(0);if(lastScope.current!==scope){lastScope.current=scope;epoch.current++;}
  const publish=(next:State)=>{latest.current=next;setState(next);};
  function reload(){
    if(!scope)return;
    try{const own=readDraft(scope);publish({scope,draft:own,error:'',conflict:false});try{setGuest(scope===GUEST_SCOPE?undefined:readDraft(GUEST_SCOPE));}catch{setGuest(undefined);publish({scope,draft:own,error:'store.cart_guest_invalid',conflict:false});}}
    catch(e){publish({scope,draft:blank(),error:(e as Error).message,conflict:true});}
  }
  useEffect(()=>{life.current=true;reload();return()=>{life.current=false;};},[scope]);
  useEffect(()=>{const sync=(event:StorageEvent)=>{
    if(!scope||event.storageArea&&event.storageArea!==localStorage)return;
    if(event.key===null||event.key===cartStorageKey(scope)||scope===GUEST_SCOPE&&event.key===CART_KEY){
      try{const next=readDraft(scope);if(next.revision!==latest.current.draft.revision)publish({...latest.current,error:'store.cart_conflict',conflict:true});}
      catch{publish({...latest.current,error:'store.cart_storage_invalid',conflict:true});}
    }
    if(scope!==GUEST_SCOPE&&(event.key===null||event.key===cartStorageKey(GUEST_SCOPE)||event.key===CART_KEY))try{setGuest(readDraft(GUEST_SCOPE));}catch{setGuest(undefined);publish({...latest.current,error:'store.cart_guest_invalid'});}
  };window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[scope]);
  const visible=scope!==null&&state.scope===scope;
  const draft=visible?state.draft:blank();
  async function update(change:(prior:Cart)=>Cart,options?:{replaceConflict?:boolean;guestDecision?:string;expectedGuest?:string}){
    const selected=scope,generation=epoch.current;if(!selected||!visible||latest.current.scope!==selected)return false;
    try{return await withCartLock(()=>{
      if(!life.current||active.current!==selected||latest.current.scope!==selected||generation!==epoch.current)return false;
      const prior=latest.current;if(prior.conflict&&!options?.replaceConflict)throw Error('store.cart_conflict');
      const stored=readDraft(selected);
      if(options?.expectedGuest!==undefined&&readDraft(GUEST_SCOPE).revision!==options.expectedGuest)throw Error('store.cart_conflict');
      const expected=options?.replaceConflict?stored.revision:prior.draft.revision;
      if(stored.revision!==expected)throw Error('store.cart_conflict');
      // Recheck consumption at the actual locked write point, including queued clicks.
      if(options?.guestDecision&&stored.guestDecision===options.guestDecision)return true;
      const next=change(prior.draft.cart);if(next===prior.draft.cart&&!options?.guestDecision)return true;
      const saved=commitDraft(selected,expected,next,options?.guestDecision??prior.draft.guestDecision);publish({scope:selected,draft:saved,error:'',conflict:false});return true;
    });}catch(e){if(life.current&&active.current===selected)publish({...latest.current,error:(e as Error).message,conflict:(e as Error).message==='store.cart_conflict'||latest.current.conflict});return false;}
  }
  async function resolveGuest(choice:'own'|'guest'|'merge'){
    if(!guest||!scope||scope===GUEST_SCOPE)return;
    await update(own=>choice==='own'?{...own}:choice==='guest'?{...guest.cart,requestId:crypto.randomUUID()}:mergeCarts(own,guest.cart),{guestDecision:guest.revision||'legacy',expectedGuest:guest.revision});
  }
  const guestPending=visible&&scope!==GUEST_SCOPE&&!!guest&&Object.keys(guest.cart.items).length>0&&state.draft.guestDecision!==(guest.revision||'legacy');
  async function reset(){if(!scope)return;const selected=scope,generation=epoch.current,raw=localStorage.getItem(cartStorageKey(scope));try{await withCartLock(()=>{if(!life.current||active.current!==selected||epoch.current!==generation)return;const next=resetCorruptDraft(selected,raw);publish({scope:selected,draft:next,error:'',conflict:false});});}catch(e){if(active.current===selected)publish({...latest.current,error:(e as Error).message,conflict:true});}}
  return{cart:draft.cart,revision:draft.revision,ready:visible,error:visible?state.error:'',conflict:visible&&state.conflict,guestPending,guestCart:guest?.cart,update,reload,resolveGuest,reset};
}
