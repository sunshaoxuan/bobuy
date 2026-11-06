import {productMarkerApi,type ProductMarkerDefinition} from './api';

export const MARKER_COLORS=['red','orange','gold','green','blue','purple','gray'] as const;
export const MARKER_LOCALES=['ja-JP','zh-CN','zh-TW','en-US'] as const;
export function orderedMarkers(markers:ProductMarkerDefinition[],enabledOnly=false) {
  return [...new Map(markers.filter(marker=>!enabledOnly||marker.enabled).map(marker=>[marker.id,marker])).values()]
    .sort((a,b)=>a.sortOrder-b.sortOrder||(a.id<b.id?-1:a.id>b.id?1:0));
}
export function validMarkerBadge(value:string) {
  return Array.from(value).length===1&&!/[\u0000-\u0020\u007f-\u009f<>&"'\s]/u.test(value);
}
export async function readPublicMarkers(productIds:string[],active=()=>true) {
  const ids=[...new Set(productIds)],result:Record<string,ProductMarkerDefinition[]>={};
  for(let start=0;start<ids.length&&active();start+=100) {
    const batch=ids.slice(start,start+100),requested=new Set(batch);
    const assignments=await productMarkerApi.publicAssignments(batch);
    if(!active())return {};
    const seen=new Set<string>();
    for(const assignment of assignments) {
      if(!requested.has(assignment.productId)||seen.has(assignment.productId))throw new Error('marker.invalid_response');
      seen.add(assignment.productId);result[assignment.productId]=orderedMarkers(assignment.markers,true);
    }
  }
  return active()?result:{};
}
