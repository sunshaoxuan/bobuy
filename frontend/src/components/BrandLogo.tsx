import {useI18n} from '../i18n';
import './brand-logo.css';

export default function BrandLogo({compact=false}:{compact?:boolean}){
 const {t,locale}=useI18n();
 return <span lang={locale} className={'brand-lockup'+(compact?' brand-lockup-compact':'')}>
  <span className="brand-lockup-mark" aria-hidden="true">B</span>
  <span className="brand-lockup-label browse-brand-label"><strong className="brand-lockup-name">{t('app.brand')}</strong><span className="brand-lockup-domain browse-brand-domain" aria-label="bobuy.cc">{Array.from('bobuy.cc').map((letter,index)=><span aria-hidden="true" key={index}>{letter}</span>)}</span></span>
 </span>;
}
