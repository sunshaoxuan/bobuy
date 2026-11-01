import type {RecommendationFacts} from './api';
export function resolvedOfferWindow(facts:RecommendationFacts){
 const c=facts.referenceContext;const inherit=!!(c?.activityApplies&&c.windowEvidence?.trim()&&c.sourceUrl?.startsWith('https://'));
 return {start:facts.offerStart||(inherit?c?.activityStart:null),end:facts.offerEnd||(inherit?c?.activityEnd:null)};
}
