import {useI18n} from '../i18n';
import {ProductBrand,ProductVariant} from './ProductMetadata';
export type OrderIdentity={itemName:string;names?:Record<string,string>;brand?:string|null;model?:string|null;packaging?:string|null;spec?:string;saleUnit?:string|null;specifications?:Record<string,string>};
export function OrderSpecification({line}:{line:OrderIdentity}){
 const {locale,t}=useI18n();const translated=line.specifications?.[locale],original=line.specifications?.['ja-JP'];
 return <>{translated||original||line.spec||'-'}{!translated&&original&&locale!=='ja-JP'&&<small>{t('article.field_source',{fields:t('master.specifications')})}</small>}{line.saleUnit&&(translated||original)&&<small> · {line.saleUnit}</small>}</>;
}
export function OrderProductIdentity({line,includeSpecification=false}:{line:OrderIdentity;includeSpecification?:boolean}){
 const {locale}=useI18n();return <><ProductBrand brand={line.brand}/><div>{line.names?.[locale]||line.itemName}</div><ProductVariant model={line.model} packaging={line.packaging}/>{includeSpecification&&<div><OrderSpecification line={line}/></div>}</>;
}
