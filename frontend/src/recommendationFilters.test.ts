import {categoryChoices,filterRecommendations,UNCLASSIFIED} from './recommendationFilters';
import type {RecommendationDetail} from './api';
const posts:RecommendationDetail[]=[{post:{id:1,title:'Fixture',published:true,version:1,updatedAt:''},body:'',items:[
 {id:1,name:'Multi',imageUrl:'',categoryIds:['a','b'],categories:[{id:'a',name:{'en-US':'A'}},{id:'b',name:{'en-US':'B'}}]},
 {id:2,name:'A only',imageUrl:'',categoryIds:['a'],categories:[{id:'a',name:{'en-US':'A'}}]},
 {id:3,name:'Unknown',imageUrl:''}
]}];
it('filters multi-category items without duplication, retains all/unknown and handles stale empty categories',()=>{
 expect(filterRecommendations(posts,'a')[0].items.map(item=>item.id)).toEqual([1,2]);
 expect(filterRecommendations(posts,'b')[0].items.map(item=>item.id)).toEqual([1]);
 expect(filterRecommendations(posts,UNCLASSIFIED)[0].items[0].id).toBe(3);
 expect(filterRecommendations(posts,'missing')).toEqual([]);
 expect(filterRecommendations(posts,'')).toBe(posts);expect(posts[0].items).toHaveLength(3);
 expect(categoryChoices(posts)).toMatchObject({total:3,unclassified:1,categories:[{id:'a',count:2},{id:'b',count:1}]});
});
