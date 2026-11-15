import {useState} from 'react';
import {Drawer} from 'antd';
import {localizedContent,useI18n} from '../i18n';
import type {BrowseFacet} from '../api';

export default function ShoppingNavigation({categories,category,onChoose}:{categories:BrowseFacet[];category:string;onChoose:(id:string)=>void}){
 // Rolling deployments must never reinterpret legacy/source category IDs as shopping entries.
 categories=categories.filter(c=>c.id.startsWith('shop-'));
 const {t,locale}=useI18n();const [open,setOpen]=useState(false);
 const current=categories.find(c=>c.id===category),parent=current?.parentId?categories.find(c=>c.id===current.parentId):current;
 const roots=categories.filter(c=>!c.parentId),children=categories.filter(c=>c.parentId===parent?.id);
 const name=(c:BrowseFacet)=>localizedContent(c.name,locale);
 const choose=(id:string)=>{onChoose(id);setOpen(false);};
 return <div className={`shopping-navigation ${parent?'has-parent':''}`}>
  <div className="shopping-toolbar">
   {category&&<button type="button" onClick={()=>choose(current?.parentId??'')} aria-label={t('shopping.parent')}><span aria-hidden>←</span> {current?.parentId?name(parent!):t('class.all')}</button>}
   <strong>{parent?name(parent):t('store.catalog')}</strong>
   <button type="button" aria-expanded={open} onClick={()=>setOpen(true)}><span aria-hidden>☰</span> {t('shopping.directory')}</button>
  </div>
  <nav className="shopping-roots" aria-label={t('shopping.directory')}>
   <button type="button" aria-pressed={!category} onClick={()=>choose('')}><span aria-hidden>◉</span>{t('class.all')}</button>
   {roots.map(c=><button type="button" key={c.id} aria-pressed={parent?.id===c.id} onClick={()=>choose(c.id)}><span aria-hidden>{c.icon}</span>{name(c)}</button>)}
  </nav>
  {parent&&<nav className="shopping-children" aria-label={name(parent)}><button type="button" aria-pressed={category===parent.id} onClick={()=>choose(parent.id)}>{t('class.all')}</button>{children.map(c=><button type="button" key={c.id} aria-pressed={category===c.id} onClick={()=>choose(c.id)}>{name(c)}</button>)}</nav>}
  <Drawer placement="left" width="min(340px,90vw)" className="shopping-drawer" title={t('shopping.directory')} open={open} onClose={()=>setOpen(false)}>
   <nav aria-label={t('shopping.directory')}><button type="button" aria-current={!category?'page':undefined} onClick={()=>choose('')}>{t('class.all')}</button>{roots.map(root=><div key={root.id}><button type="button" className="shopping-drawer-root" aria-current={category===root.id?'page':undefined} onClick={()=>choose(root.id)}>{root.icon} {name(root)}</button>{categories.filter(c=>c.parentId===root.id).map(c=><button type="button" key={c.id} className="shopping-drawer-child" aria-current={category===c.id?'page':undefined} onClick={()=>choose(c.id)}>{name(c)} <small>{c.count}</small></button>)}</div>)}</nav>
  </Drawer>
 </div>;
}
