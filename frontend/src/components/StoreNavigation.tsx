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
 const choose=()=>{if(mobile)onClose();};
 const target=(id:string)=>{
  const params=new URLSearchParams(location.search);params.set('category',id);params.delete('product');params.delete('item');
  return '/products?'+params.toString();
 };
 const contents=<nav className="browse-links" aria-label={t('store.navigation')}>
  <Link className={pathname==='/products'&&!category?'active':undefined} aria-current={pathname==='/products'&&!category?'page':undefined} to={scopedPath('/products',location.search)} onClick={choose}><CompassOutlined aria-hidden="true"/><span>{t('store.catalog')}</span></Link>
  <div className="shopping-tree">{roots.map(root=><div key={root.id}>
   <Link to={target(root.id)} className="shopping-tree-root" aria-current={category===root.id?'page':undefined} onClick={choose}>
    <CategoryImage src={root.imageUrl} className="shopping-category-image"/><span>{localizedContent(root.name,locale)}</span>
   </Link>
   {visible.filter(c=>c.parentId===root.id).map(c=><Link key={c.id} to={target(c.id)} className="shopping-tree-child" aria-current={category===c.id?'page':undefined} onClick={choose}>{localizedContent(c.name,locale)}</Link>)}
  </div>)}</div>
 </nav>;
 if(!mobile)return open?<aside className="shopping-sidebar" aria-label={t('store.navigation')}><button className="shopping-sidebar-close" onClick={onClose} aria-label={t('app.close_menu')}>←</button>{contents}</aside>:null;
 return <Drawer className="browse-drawer" placement="left" title={t('store.navigation')} width="min(320px, 88vw)" open={open} onClose={onClose} rootStyle={{zIndex:1100}}>{open&&contents}</Drawer>;
}
