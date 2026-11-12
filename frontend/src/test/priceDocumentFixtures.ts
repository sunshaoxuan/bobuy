import type {PriceChangeView} from '../api';
/** Canonical server projection fixtures. Source-fact dates are intentionally unrelated. */
export function priceChange(overrides:Partial<PriceChangeView>={}):PriceChangeView{return {documentId:1,documentNumber:'PC-SYNTHETIC-1',type:'PROMOTION',state:'ACTIVE',startsAt:'2026-10-01T15:00:00Z',endsAt:'2026-10-26T15:00:00Z',amount:400,beforeAmount:500,effectiveAmount:400,promotion:true,...overrides};}
