import {Button} from 'antd';
import {useEffect} from 'react';
import {supportedLocales,translate,useI18n} from '../i18n';
import './maintenance-notice.css';

export function isMaintenanceError(error:string){
 const normalized=error.trim().toLowerCase();
 return /\b(502|503|504)\b/.test(normalized)||normalized.includes('release maintenance')||normalized.includes('failed to fetch')||normalized.includes('network error')||supportedLocales.some(locale=>normalized===translate(locale,'maintenance.title').toLowerCase());
}

export default function MaintenanceNotice({retry}:{retry:()=>void}){
 const {t}=useI18n();
 useEffect(()=>{const timer=window.setInterval(retry,20_000);return()=>window.clearInterval(timer);},[retry]);
 return <section className="maintenance-notice" role="status" aria-live="polite">
  <span className="maintenance-brand" aria-hidden="true">B</span>
  <div><p className="maintenance-wordmark">{t('app.brand')}</p><h1>{t('maintenance.title')}</h1><p>{t('maintenance.description')}</p><Button onClick={retry}>{t('maintenance.retry')}</Button></div>
 </section>;
}
