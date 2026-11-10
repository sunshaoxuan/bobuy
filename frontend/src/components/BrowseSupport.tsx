import {Alert,Button} from 'antd';
import {localizedContent,useI18n} from '../i18n';
import type {BrowsePage} from '../api';
export function BrowseFilters<T>({page,category,onChoose}:{page?:BrowsePage<T>;category:string;onChoose:(value:string)=>void}){
 const {t,locale}=useI18n();if(!page)return null;
 return <nav className="rec-category-filters" aria-label={t('class.filters')}><button type="button" aria-pressed={!category} onClick={()=>onChoose('')}>{t('class.all')} ({page.scopeTotal})</button>{page.categories.map(value=><button type="button" key={value.id} aria-pressed={category===value.id} onClick={()=>onChoose(value.id)}>{localizedContent(value.name,locale)} ({value.count})</button>)}{!!page.unclassified&&<button type="button" aria-pressed={category==='__unclassified'} onClick={()=>onChoose('__unclassified')}>{t('class.unclassified')} ({page.unclassified})</button>}{category&&category!=='__unclassified'&&!page.categories.some(value=>value.id===category)&&<button type="button" aria-pressed="true">{t('class.selected_filter')}</button>}</nav>;
}
export function BrowseError({error,changed,retry,refresh}:{error:string;changed?:boolean;retry:()=>void;refresh:()=>void}){const {t}=useI18n();return error?<Alert type="error" message={t(changed?'browse.changed':error)} action={<Button onClick={changed?refresh:retry}>{t(changed?'browse.refresh':'catalog.retry')}</Button>}/>:null;}
