import type {RecommendationItem} from './api';
export function recommendationText(item:RecommendationItem,locale:string){
 const text=item.translationStatus==='REVIEWED'?item.translations?.[locale]:undefined;
 const translated=locale!=='ja-JP'&&!!text?.name?.trim();
 const sourceFields=locale==='ja-JP'?[]:(['name','specification','description','offerNotes'] as const).filter(key=>!!item[key]?.trim()&&!text?.[key]?.trim());
 const field=(key:'specification'|'description'|'offerNotes')=>text?.[key]?.trim()?text[key]:item[key]||'';
 return {name:translated?`${text!.name}（${item.name}）`:item.name,primaryName:translated?text!.name:item.name,originalName:translated?item.name:undefined,
  specification:field('specification'),description:field('description'),
  offerNotes:field('offerNotes'),sourceFields,missing:locale!=='ja-JP'&&(!translated||sourceFields.length>0)};
}
