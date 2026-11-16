import {localizedContent,useI18n} from '../i18n';
import type {BrowseFacet} from '../api';

export default function ShoppingNavigation({categories,category,onChoose}:{categories:BrowseFacet[];category:string;onChoose:(id:string)=>void}){
 const {t,locale}=useI18n();
 const current=categories.find(c=>c.id.startsWith('shop-')&&c.id===category);
 const parent=current?.parentId?categories.find(c=>c.id===current.parentId):undefined;
 return <nav className="shopping-toolbar" aria-label={t('shopping.parent')}>
  <button type="button" onClick={()=>onChoose('')}>{t('store.catalog')}</button>
  {parent&&<><span aria-hidden> / </span><button type="button" aria-label={t('shopping.parent')} onClick={()=>onChoose(parent.id)}>{localizedContent(parent.name,locale)}</button></>}
  {current&&<><span aria-hidden> / </span><strong aria-current="page">{localizedContent(current.name,locale)}</strong></>}
 </nav>;
}
