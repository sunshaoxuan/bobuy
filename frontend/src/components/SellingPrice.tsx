import {type StoreProduct} from '../api';
import {useI18n} from '../i18n';
import {formatMoney} from '../currency';
export default function SellingPrice({product}:{product:StoreProduct}){
 const {t,locale}=useI18n();
 const date=(value:string)=>new Date(value).toLocaleString(locale,{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 return <div className="rec-sale-actual"><strong>{t('sale.actual')}: {formatMoney(product.price,product.currency,locale)}{product.saleUnit&&' / '+product.saleUnit}</strong>
  {product.priceAdjustmentId&&<><small>{t('pricing.regular')}: <del>{formatMoney(product.regularPrice??product.price,product.currency,locale)}</del></small><small>{t('pricing.period')}: {product.priceValidFrom&&date(product.priceValidFrom)} → {product.priceValidUntil&&date(product.priceValidUntil)} JST · {t('pricing.end_exclusive')}</small></>}
 </div>;
}
