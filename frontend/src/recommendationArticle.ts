import type {RecommendationDetail,RecommendationSummary} from './api';
export function articleTitle(post:RecommendationSummary,locale:string){return locale==='ja-JP'?post.title:post.articleTitles?.[locale]?.trim()||post.title;}
export function articleText(detail:RecommendationDetail,locale:string){
 const sourceKnown=detail.articleSourceLocale==='ja-JP';
 const entry=locale!=='ja-JP'&&sourceKnown?detail.articleTranslations?.[locale]:undefined;
 const current=entry&&entry.sourceHash===detail.articleSourceHash;
 const title=current&&entry.title.trim()?entry.title:detail.post.title;
 const body=current&&entry.body.trim()?entry.body:detail.body;
 return {title,body,sourceKnown,missingTitle:!sourceKnown||(locale!=='ja-JP'&&!(current&&entry.title.trim())),missingBody:!sourceKnown||(locale!=='ja-JP'&&!(current&&entry.body.trim()))};
}
