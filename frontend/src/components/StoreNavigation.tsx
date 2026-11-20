import {useLayoutEffect,useRef,useState} from 'react';
import SidebarCategoryIcon from './SidebarCategoryIcon';
import CategoryImage from './CategoryImage';
import {Drawer} from 'antd';
import {CompassOutlined} from '@ant-design/icons';
import {Link,useLocation} from 'react-router-dom';
import {localizedContent,useI18n} from '../i18n';
import {scopedPath} from '../storeNavigation';
import type {BrowseFacet} from '../api';

export default function StoreNavigation({open,onClose,homePath='/products',categories=[],mobile=true}:{
 nodes:{id:number;name:string}[];node?:number;open:boolean;onClose:()=>void;
 onNodeChange:(id?:number)=>void;loading:boolean;homePath?:'/products'|'/recommendations'|null;
 categories?:BrowseFacet[];mobile?:boolean;
}) {
 const {t,locale}=useI18n(),location=useLocation();
 const pathname=location.pathname==='/'?homePath:location.pathname;
 const category=new URLSearchParams(location.search).get('category')??'';
 const visible=categories.filter(c=>c.id.startsWith('shop-')&&c.count>0);
 const roots=visible.filter(c=>!c.parentId);
 const selected=pathname==='/products'?visible.find(c=>c.id===category):undefined;
 const selectedRoot=roots.find(root=>root.id===(selected?.parentId??selected?.id));
 const [navigation,setNavigation]=useState<HTMLElement|null>(null);
 const positioning=useRef<{key:string;handled:boolean;manual:boolean}|null>(null);
 useLayoutEffect(()=>{
  if(!open){positioning.current=null;return;}
  if(!navigation)return;
  const key=JSON.stringify([mobile,pathname,category]);
  if(positioning.current?.key!==key)positioning.current={key,handled:false,manual:false};
  const attempt=positioning.current;
  const scroller=navigation.closest<HTMLElement>(mobile?'.ant-drawer-body':'.shopping-sidebar');
  if(!scroller)return;
  const manual=()=>{attempt.manual=true;};
  const events=['wheel','touchmove','pointerdown','keydown'] as const;
  events.forEach(event=>scroller.addEventListener(event,manual,{passive:true}));
  let frame=0;
  const reveal=()=>{
   if(attempt.handled||attempt.manual)return;
   const root=navigation.querySelector<HTMLElement>('[data-selected-root="true"]');
   if(!root)return;
   if(!scroller.clientHeight){frame=requestAnimationFrame(reveal);return;}
   attempt.handled=true;
   const item=root.getBoundingClientRect(),viewport=scroller.getBoundingClientRect();
   // Scroll this panel only; never move the document or steal keyboard focus.
   if(item.top<viewport.top+8||item.bottom>viewport.bottom-8)scroller.scrollTop+=item.top-viewport.top-8;
  };
  frame=requestAnimationFrame(reveal);
  return()=>{cancelAnimationFrame(frame);events.forEach(event=>scroller.removeEventListener(event,manual));};
 },[open,mobile,pathname,category,selectedRoot?.id,navigation]);
 const choose=()=>{if(mobile)onClose();};
 const target=(id:string)=>{
  const params=new URLSearchParams(location.search);params.set('category',id);params.delete('product');params.delete('item');
  return '/products?'+params.toString();
 };
 const contents=<nav ref={setNavigation} className="browse-links" aria-label={t('store.navigation')}>
  <Link className={pathname==='/products'&&!category?'active':undefined} aria-current={pathname==='/products'&&!category?'page':undefined} to={scopedPath('/products',location.search)} onClick={choose}><CompassOutlined aria-hidden="true"/><span>{t('store.catalog')}</span></Link>
  <div className="shopping-tree">{roots.map(root=><div key={root.id}>
   <Link to={target(root.id)} className="shopping-tree-root" data-selected-root={selectedRoot?.id===root.id?true:undefined} data-selected-ancestor={selectedRoot?.id===root.id&&selected?.id!==root.id?true:undefined} aria-current={selected?.id===root.id?'page':undefined} onClick={choose}>
    <CategoryImage src={root.imageUrl} className="shopping-category-image"/><span>{localizedContent(root.name,locale)}</span>
   </Link>
   {visible.filter(c=>c.parentId===root.id).map(c=><Link key={c.id} to={target(c.id)} className="shopping-tree-child" aria-current={selected?.id===c.id?'page':undefined} onClick={choose}><SidebarCategoryIcon category={c}/><span>{localizedContent(c.name,locale)}</span></Link>)}
  </div>)}</div>
 </nav>;
 if(!mobile)return open?<aside className="shopping-sidebar" aria-label={t('store.navigation')}><button className="shopping-sidebar-close" onClick={onClose} aria-label={t('app.close_menu')}>←</button>{contents}</aside>:null;
 return <Drawer className="browse-drawer" placement="left" title={t('store.navigation')} width="min(320px, 88vw)" open={open} onClose={onClose} rootStyle={{zIndex:1100}}>{open&&contents}</Drawer>;
}
