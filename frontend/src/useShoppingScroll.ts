import {useEffect,useRef} from 'react';
import {useLocation,useNavigationType} from 'react-router-dom';

/** Product drawers share the underlying browsing position. */
export function useShoppingScroll(ready:boolean,busy:boolean,hasNext:boolean,next:()=>void){
 const location=useLocation(),navigation=useNavigationType();
 const params=new URLSearchParams(location.search);params.delete('product');params.delete('productSection');
 const key='bobuy-shopping-scroll:'+location.pathname+'?'+params.toString();
 const restore=useRef<{key:string;y:number;done:boolean}>({key:'',y:0,done:false});
 if(restore.current.key!==key){let y=0;try{if(navigation==='POP')y=Number(sessionStorage.getItem(key)||0);}catch{}restore.current={key,y:Number.isFinite(y)?y:0,done:false};}
 useEffect(()=>{const save=()=>{if(restore.current.done)try{sessionStorage.setItem(key,String(window.scrollY));}catch{}};window.addEventListener('scroll',save,{passive:true});return()=>window.removeEventListener('scroll',save);},[key]);
 useEffect(()=>{const state=restore.current;if(!ready||busy||state.done)return;const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);if(max<state.y&&hasNext){next();return;}window.scrollTo(0,Math.min(state.y,max));state.done=true;},[key,ready,busy,hasNext,next]);
}
