import {availableCategory,categoryChoices,filterRecommendations,issueScope,readAllIssues,UNCLASSIFIED} from './recommendationFilters';
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
it('scopes category counts to the topic, retains other categories after selection and clears an invalid category',()=>{
 const second:RecommendationDetail={...posts[0],post:{...posts[0].post,id:2},items:[{...posts[0].items[1],id:4,productId:'same-product',referencePrice:200}]};
 const all=[{...posts[0],items:posts[0].items.map(i=>({...i,productId:'same-product',referencePrice:100}))},second];
 expect(categoryChoices(issueScope(all,'2'))).toMatchObject({total:1,unclassified:0,categories:[{id:'a',count:1}]});
 expect(availableCategory(issueScope(all,'2'),'b')).toBe('');expect(availableCategory(issueScope(all,'2'),UNCLASSIFIED)).toBe('');
 expect(availableCategory(issueScope(all,'1'),'b')).toBe('b');
 const scope=issueScope(all,'1');expect(filterRecommendations(scope,'a')[0].items).toHaveLength(2);expect(categoryChoices(scope).categories.map(c=>c.id)).toEqual(['a','b']);
 expect(issueScope(all,'')).toBe(all);expect(filterRecommendations(all,'a').map(p=>p.items[0].referencePrice)).toEqual([100,200]);
});
it('loads all published issue pages without merging shared products or repeated issue rows',async()=>{
 const first=Array.from({length:20},(_,i)=>({...posts[0],post:{...posts[0].post,id:i+1}}));
 const last={...posts[0],post:{...posts[0].post,id:21}};const calls:number[]=[];
 const all=await readAllIssues(async page=>{calls.push(page);return page===0?first:[last];});
 expect(calls).toEqual([0,1]);expect(all).toHaveLength(21);expect(all[0].items).toHaveLength(3);expect(all[20].items).toHaveLength(3);
});
it('rejects repeating pages and stops loading when the browsing context is superseded',async()=>{
 const batch=Array.from({length:20},(_,i)=>({...posts[0],post:{...posts[0].post,id:i+1}}));
 await expect(readAllIssues(async()=>batch)).rejects.toThrow('Unable to load');
 let active=true;const result=await readAllIssues(async()=>{active=false;return batch;},()=>active);expect(result).toEqual([]);
});
