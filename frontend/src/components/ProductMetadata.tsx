import {useI18n} from '../i18n';

/** Structured identity is displayed separately; never strip words from historical names. */
export function ProductBrand({brand}:{brand?:string|null}){
 const {t}=useI18n();
 return brand?.trim()?<small className="product-brand" aria-label={t('stock.item.brand')}>{brand}</small>:null;
}
export function ProductVariant({model,packaging}:{model?:string|null;packaging?:string|null}){
 const {t}=useI18n();
 return <>{model&&<p className="product-model">{t('master.model')}: {model}</p>}{packaging&&<p className="product-packaging">{t('master.packaging')}: {packaging}</p>}</>;
}
