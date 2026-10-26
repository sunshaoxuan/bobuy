import type {RecommendationDetail,RecommendationItem,RecommendationLabel} from './api';
export const UNCLASSIFIED='__unclassified';
export const itemCategories=(item:RecommendationItem)=>[...new Set(item.categoryIds??item.categories?.map(category=>category.id)??[])];
export function filterRecommendations(posts:RecommendationDetail[],category:string) {
 if(!category)return posts;
 return posts.map(post=>({...post,items:post.items.filter(item=>category===UNCLASSIFIED?itemCategories(item).length===0:itemCategories(item).includes(category))})).filter(post=>post.items.length>0);
}
export function categoryChoices(posts:RecommendationDetail[]) {
 const choices=new Map<string,RecommendationLabel&{count:number}>();let unclassified=0,total=0;
 for(const post of posts)for(const item of post.items){
  total++;const ids=itemCategories(item);if(!ids.length)unclassified++;
  for(const category of item.categories??[]){if(!ids.includes(category.id))continue;const value=choices.get(category.id);if(value)value.count++;else choices.set(category.id,{...category,count:1});}
 }
 return {categories:[...choices.values()],unclassified,total};
}
