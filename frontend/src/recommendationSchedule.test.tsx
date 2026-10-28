import {act,renderHook} from '@testing-library/react';
import {arrangeIssues,itemOfferExpired,issueExpired,japanDate,useJapaneseDay} from './recommendationSchedule';
import type {RecommendationDetail,RecommendationFacts} from './api';
const fact=(offerEnd?:string|null):RecommendationFacts=>({name:'Synthetic',offerEnd});
const issue=(id:number,facts:RecommendationFacts[],publishedAt?:string):RecommendationDetail=>({post:{id,title:'Synthetic '+id,published:true,version:1,updatedAt:'2099-01-01',publishedAt},body:'',items:facts.map((f,index)=>({...f,id:id*10+index,imageUrl:'',productId:'shared-fixture'}))});
it('orders publication newest first with stable ID fallback without using edits or merging offers',()=>{
 const old=issue(1,[{...fact(),referencePrice:100}],'2026-10-01T00:00:00Z'),fresh=issue(2,[{...fact(),referencePrice:200}],'2026-10-28T00:00:00Z');const input=[old,issue(3,[fact()]),fresh,issue(4,[fact()])];
 expect(arrangeIssues(input,'2026-10-28').current.map(p=>p.post.id)).toEqual([2,1,4,3]);expect(input[0]).toBe(old);expect(arrangeIssues(input,'2026-10-28').current.slice(0,2).map(p=>p.items[0].referencePrice)).toEqual([200,100]);
});
it('uses inclusive item end dates and never derives an end from start, title, coupon issuance or an empty issue',()=>{
 expect(itemOfferExpired(fact('2026-10-28'),'2026-10-28')).toBe(false);expect(itemOfferExpired(fact('2026-10-28'),'2026-10-29')).toBe(true);
 for(const f of [fact(),{...fact(),offerStart:'2026-10-01'},{...fact(),couponEnd:'2026-10-01'},fact('2026-02-30'),{...fact('2026-10-01'),offerStart:'2026-10-29'}])expect(itemOfferExpired(f,'2026-10-28')).toBe(false);
 expect(issueExpired(issue(1,[]),'2026-10-28')).toBe(false);
});
it('keeps mixed valid, future or unknown items current and archives only an entirely ended issue',()=>{
 const past=issue(1,[fact('2026-10-01'),fact('2026-10-27')]);const active=issue(2,[fact('2026-10-01'),fact('2026-10-28')]);const unknown=issue(3,[fact('2026-10-01'),fact()]);const future=issue(4,[fact('2026-11-01')]);
 expect(arrangeIssues([past,active,unknown,future],'2026-10-28').history.map(p=>p.post.id)).toEqual([1]);expect(arrangeIssues([past,active,unknown,future],'2026-10-28').current).toHaveLength(3);
});
it('does not hide an issue while its second period remains open or uncertain',()=>{
 expect(itemOfferExpired({...fact('2026-10-01'),couponEnd:'2026-10-30'},'2026-10-28')).toBe(false);
 expect(itemOfferExpired({...fact('2026-10-01'),couponStart:'2026-09-01'},'2026-10-28')).toBe(false);
 expect(itemOfferExpired({...fact('2026-10-01'),couponEnd:'2026-09-30'},'2026-10-28')).toBe(true);
});
it('uses JST midnight regardless of the browser time zone',()=>{expect(japanDate(new Date('2026-10-28T14:59:59.999Z'))).toBe('2026-10-28');expect(japanDate(new Date('2026-10-28T15:00:00Z'))).toBe('2026-10-29');});
it('updates an open page at JST midnight and after resume, and releases its timer',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-28T14:59:59Z'));const view=renderHook(useJapaneseDay);
 try{expect(view.result.current).toBe('2026-10-28');act(()=>vi.advanceTimersByTime(1006));expect(view.result.current).toBe('2026-10-29');vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(view.result.current).toBe('2026-11-02');view.unmount();expect(vi.getTimerCount()).toBe(0);}finally{view.unmount();vi.useRealTimers();}
});
