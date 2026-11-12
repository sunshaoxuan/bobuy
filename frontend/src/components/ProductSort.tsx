import {useI18n} from '../i18n';
export const productSorts=['default','price-asc','price-desc','rating-asc','rating-desc','heat-desc','heat-asc'] as const;
export default function ProductSort({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const {t}=useI18n();return <select className="product-sort" aria-label={t('sort.label')} value={value} onChange={event=>onChange(event.target.value)}>{productSorts.map(value=><option key={value} value={value}>{t('sort.'+value)}</option>)}</select>;
}
