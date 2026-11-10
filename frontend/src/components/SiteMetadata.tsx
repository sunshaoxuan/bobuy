import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {useI18n} from '../i18n';
import {HOME_STRUCTURED_DATA,publicCanonical,SITE_DESCRIPTION,SITE_TITLE} from '../seo';
export default function SiteMetadata(){
 const {pathname}=useLocation(),{locale}=useI18n();
 useEffect(()=>{
  const canonical=publicCanonical(pathname),home=pathname==='/';
  const title=document.querySelector('title')??document.head.appendChild(document.createElement('title'));
  title.setAttribute('data-bobuy-page-title','');document.title=home?SITE_TITLE:canonical?'宝宝败 Bobuy | 随行好物':'宝宝败 Bobuy | 账户与管理';
  function meta(name:string,content:string){const m=document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)??document.head.appendChild(document.createElement('meta'));m.name=name;m.content=content;m.setAttribute('data-bobuy-seo','');}
  meta('description',SITE_DESCRIPTION);meta('robots',canonical?'index,follow':'noindex,nofollow');
  document.querySelector('link[rel="canonical"]')?.remove();
  if(canonical){const l=document.createElement('link');l.rel='canonical';l.href=canonical;l.setAttribute('data-bobuy-seo','');document.head.appendChild(l);}
  document.getElementById('bobuy-home-structured-data')?.remove();
  if(home){const s=document.createElement('script');s.type='application/ld+json';s.id='bobuy-home-structured-data';s.setAttribute('data-bobuy-seo','');s.textContent=JSON.stringify(HOME_STRUCTURED_DATA);document.head.appendChild(s);}
  return()=>{document.querySelectorAll('[data-bobuy-seo]').forEach(e=>e.remove());title.removeAttribute('data-bobuy-page-title');};
 },[pathname,locale]);
 return null;
}
