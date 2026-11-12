import {expect,it} from 'vitest';
import type {PublicCatalogEntry,RecommendationItem} from './api';
import {productDetailContent} from './productDetailContent';
const fact=(id:number,extra:Partial<RecommendationItem>={}):RecommendationItem=>({id,productId:'p',name:'Product',itemNumber:'26440',specification:'240 tablets',description:'Shared historical introduction',imageUrl:'/photo.png',referencePrice:2820,...extra});
const entry=(first:RecommendationItem,second:RecommendationItem):PublicCatalogEntry=>({productId:'p',merchantId:1,name:{'en-US':'Product'},description:{'en-US':'Current master is not historical evidence'},specification:{'en-US':'Changed current specification'},itemNumber:'26440',brand:null,model:null,packaging:null,gallery:[],categories:[],reviewedMaster:true,referenceOffers:[{postId:7,facts:first},{postId:5,facts:second}]});
it('places exactly shared historical specification/introduction once and preserves both occurrence identities',()=>{
 const first=fact(1),second=fact(2);const result=productDetailContent(entry(first,second),'en-US');expect(result.specification).toBe('240 tablets');expect(result.description).toBe('Shared historical introduction');expect(result.rows.map(r=>r.key)).toEqual(['7:1','5:2']);expect(result.rows.map(r=>[r.name,r.specification,r.description])).toEqual([['','',''],['','','']]);expect(result.rows[0].facts).toBe(first);
});
it('does not merge same-named products with different stable IDs',()=>{
 const result=productDetailContent(entry(fact(1),fact(2,{productId:'other'})),'en-US');expect(result.specification).toBe('');expect(result.description).toBe('');expect(result.rows).toHaveLength(2);expect(result.rows[1].name).toBe('Product');expect(result.rows[1].sameIdentity).toBe(false);expect(result.rows.map(r=>r.specification)).toEqual(['240 tablets','240 tablets']);
});
it('does not treat a different SKU as shared identity even within one product response',()=>{
 const result=productDetailContent(entry(fact(1),fact(2,{itemNumber:'99999'})),'en-US');expect(result.description).toBe('');expect(result.rows[1].itemNumber).toBe('99999');expect(result.rows[1].description).toBe('Shared historical introduction');
});
it('keeps real packaging/version and channel differences instead of filling them from the current master',()=>{
 const a=fact(1,{specification:'240 tablets',packaging:'Box 240',referenceContext:{channel:'COSTCO_ONLINE',variantKey:'240-pack'}}),b=fact(2,{specification:'120 tablets',packaging:'Box 120',description:'Older wording',referenceContext:{channel:'COSTCO_WAREHOUSE',variantKey:'120-pack'}});const result=productDetailContent(entry(a,b),'en-US');expect(result.specification).toBe('');expect(result.description).toBe('');expect(result.packaging).toBe('');expect(result.rows.map(r=>r.specification)).toEqual(['240 tablets','120 tablets']);expect(result.rows.map(r=>r.description)).toEqual(['Shared historical introduction','Older wording']);expect(result.rows.map(r=>r.facts.referenceContext?.variantKey)).toEqual(['240-pack','120-pack']);
});
it('retains equal prices in distinct historical periods and never changes source numbers/nulls',()=>{
 const a=fact(1,{offerStart:'2026-11-02',offerEnd:'2026-11-15'}),b=fact(2,{offerStart:'2026-10-01',offerEnd:'2026-10-15',discountAmount:null});const value=entry(a,b),before=JSON.stringify(value),result=productDetailContent(value,'en-US');expect(result.rows).toHaveLength(2);expect(result.rows.map(r=>r.facts.referencePrice)).toEqual([2820,2820]);expect(result.rows[1].facts.discountAmount).toBeNull();expect(JSON.stringify(value)).toBe(before);
});
it('does not make unknown historical specification/introduction look like known current-master facts',()=>{
 const result=productDetailContent(entry(fact(1,{specification:null,description:null}),fact(2,{specification:null,description:null})),'en-US');expect(result.specification).toBe('');expect(result.description).toBe('');expect(result.rows.map(r=>r.specification)).toEqual(['','']);
});
it('retains ordinary master detail content when there are no historical references',()=>{const value=entry(fact(1),fact(2));value.referenceOffers=[];const result=productDetailContent(value,'en-US');expect(result.description).toBe('Current master is not historical evidence');expect(result.specification).toBe('Changed current specification');});
it.each(['ja-JP','zh-CN','zh-TW','en-US'] as const)('compares the actual supplied translation for %s without synthesizing a missing version',locale=>{
 const translated={name:'Translated '+locale,specification:'Actual '+locale,description:'Introduction '+locale},translations=locale==='ja-JP'?{}:{[locale]:translated};const a=fact(1,{translationStatus:'REVIEWED',translations}),value=entry(a,fact(2,{translationStatus:'REVIEWED',translations}));value.name={[locale]:locale==='ja-JP'?'Product':translated.name};const result=productDetailContent(value,locale);expect(result.specification).toBe(locale==='ja-JP'?'240 tablets':translated.specification);expect(result.rows.every(r=>!r.specification)).toBe(true);
});
