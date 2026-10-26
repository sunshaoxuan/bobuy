import type {RecommendationItem} from './api';
export function recommendationText(item:RecommendationItem,locale:string){
 const text=item.translationStatus==='REVIEWED'?item.translations?.[locale]:undefined;
 const translated=locale!=='ja-JP'&&!!text?.name?.trim();
 return {name:translated?`${text!.name}（${item.name}）`:item.name,primaryName:translated?text!.name:item.name,originalName:translated?item.name:undefined,
  specification:text?.specification||item.specification||'',description:text?.description||item.description||'',
  offerNotes:text?.offerNotes||item.offerNotes||'',missing:locale!=='ja-JP'&&!translated};
}
