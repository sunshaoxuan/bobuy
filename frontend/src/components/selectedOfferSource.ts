import type {StoreProduct} from '../api';
import type {OfferPeriodSource} from './offerPeriodText';

/** Same precedence as CompactProductCard's displayed price. */
export function selectedOfferSource(quote:StoreProduct|undefined,pending:boolean,reference:OfferPeriodSource|null|undefined):OfferPeriodSource[]{
  const source=!pending&&quote?quote.priceChange:reference;
  return source?[source]:[];
}
