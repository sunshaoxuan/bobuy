import type {RecommendationFacts} from './api';
import {japanDate} from './recommendationSchedule';
/** Display dates are projections of the ERP document. Source dates never provide a fallback. */
export function resolvedOfferWindow(facts:RecommendationFacts){const d=facts.priceChange;return {start:d?.startsAt?japanDate(new Date(d.startsAt)):null,end:d?.endsAt?japanDate(new Date(Date.parse(d.endsAt)-1)):null};}
