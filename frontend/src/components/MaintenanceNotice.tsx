import {Button} from 'antd';
import {supportedLocales,translate,useI18n} from '../i18n';
import './maintenance-notice.css';

export function isMaintenanceError(error:string){
 return error==='Release maintenance in progress'||supportedLocales.some(locale=>error===translate(locale,'maintenance.title'));
}

export default function MaintenanceNotice({retry}:{retry:()=>void}){
 const {t}=useI18n();
 return <section className="maintenance-notice" role="status" aria-live="polite">
  <span className="maintenance-brand" aria-hidden="true">B</span>
  <div><p className="maintenance-wordmark">{t('app.brand')}</p><h1>{t('maintenance.title')}</h1><p>{t('maintenance.description')}</p><Button onClick={retry}>{t('maintenance.retry')}</Button></div>
 </section>;
}
