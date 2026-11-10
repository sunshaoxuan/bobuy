import {describe,it,expect,vi} from 'vitest';
import type {PublicCatalogEntry,PublicCatalogPage,StoreProduct} from './api';
import {readPublicCatalog,searchPublicCatalog,filterPublicCatalog,catalogCategories,catalogSale,CATALOG_UNCLASSIFIED} from './publicCatalog';
const row=(id:number):PublicCatalogEntry=>({productId:String(id),merchantId:1,name:{'ja-JP':'Product '+id},description:{},specification:{},brand:null,itemNumber:'ITEM'+id,model:null,packaging:null,gallery:[],categories:[],referenceOffers:[],reviewedMaster:true});
const page=(items:PublicCatalogEntry[],index=0,total=items.length,hasNext=false):PublicCatalogPage=>({items,page:index,size:24,total,hasNext});

describe('complete public catalog traversal',()=>{
 it('reaches all pages including an exact-size last page and reports progress',async()=>{
  const rows=Array.from({length:48},(_,i)=>row(i));const progress=vi.fn();
  const load=vi.fn(async(index:number)=>page(rows.slice(index*24,(index+1)*24),index,48,index===0));
  expect(await readPublicCatalog(load,()=>true,progress)).toEqual(rows);
  expect(load.mock.calls).toEqual([[0],[1]]);expect(progress).toHaveBeenLastCalledWith(48,48);
 });
 it('reads a partial last page and allows search beyond first 24',async()=>{
  const rows=Array.from({length:25},(_,i)=>row(i));rows[24].name={'en-US':'Final-only item'};
  const all=await readPublicCatalog(async index=>page(rows.slice(index*24,(index+1)*24),index,25,index===0));
  expect(searchPublicCatalog(all,'final-only')).toEqual([rows[24]]);
 });
 it('returns empty only when total is zero',async()=>{
  expect(await readPublicCatalog(async()=>page([]))).toEqual([]);
  await expect(readPublicCatalog(async()=>page([],0,1))).rejects.toThrow('catalog.incomplete');
 });
 it('rejects duplicate identities and count drift instead of silently truncating',async()=>{
  await expect(readPublicCatalog(async()=>page([row(1),row(1)]))).rejects.toThrow('catalog.changed');
  await expect(readPublicCatalog(async index=>index===0?page([row(1)],0,2,true):page([row(2)],1,3))).rejects.toThrow('catalog.changed');
 });
 it.each([
  {page:1},{size:20},{total:-1},{total:1.5},{hasNext:undefined},{items:Array.from({length:25},(_,i)=>row(i))}
 ])('rejects malformed contract %j',async change=>{
  await expect(readPublicCatalog(async()=>({...page([row(1)]),...change}) as PublicCatalogPage)).rejects.toThrow('catalog.incomplete');
 });
 it('rejects empty/repeated continuation and missing final rows',async()=>{
  await expect(readPublicCatalog(async()=>page([],0,2,true))).rejects.toThrow('catalog.incomplete');
  await expect(readPublicCatalog(async()=>page([row(1)],0,1,true))).rejects.toThrow('catalog.incomplete');
  await expect(readPublicCatalog(async()=>page([row(1)],0,2,false))).rejects.toThrow('catalog.incomplete');
 });
 it('stops stale scopes before progress and another request',async()=>{
  let active=true;const progress=vi.fn();const load=vi.fn(async()=>{active=false;return page([row(1)],0,2,true);});
  expect(await readPublicCatalog(load,()=>active,progress)).toEqual([]);expect(progress).not.toHaveBeenCalled();expect(load).toHaveBeenCalledTimes(1);
 });
 it('propagates failed later pages for retry and never returns partial success',async()=>{
  await expect(readPublicCatalog(async index=>{if(index)throw new Error('offline');return page([row(1)],0,2,true);})).rejects.toThrow('offline');
 });
});
describe('catalog identity, classification and purchase boundaries',()=>{
 it('searches master fields across translations, not just rendered rows',()=>{
  const product={...row(1),brand:'Brand',model:'M-20',packaging:'box',specification:{'ja-JP':'500g'},description:{'en-US':'description'},categories:[{id:'a',name:{'zh-CN':'分类'}}]};
  for(const query of ['brand','item1','m-20','box','500g','description','分类','  product 1  '])expect(searchPublicCatalog([product],query)).toEqual([product]);
  expect(searchPublicCatalog([product],'absent')).toEqual([]);
 });
 it('counts multi-category masters once per category and keeps unclassified reachable',()=>{
  const category={id:'a',name:{'en-US':'Food'}},one={...row(1),categories:[category,category]},two=row(2);
  expect(catalogCategories([one,two])).toEqual({categories:[{...category,count:1}],unclassified:1,total:2});
  expect(filterPublicCatalog([one,two],'a')).toEqual([one]);expect(filterPublicCatalog([one,two],CATALOG_UNCLASSIFIED)).toEqual([two]);
  expect(filterPublicCatalog([one,two],'missing')).toEqual([]);
 });
 it('matches sale by identity and merchant, never by a historical price',()=>{
  const other={id:'1',merchantId:2,price:99} as StoreProduct;
  expect(catalogSale(row(1),[other])).toBeUndefined();
  const matching={...other,merchantId:1};expect(catalogSale(row(1),[other,matching])).toBe(matching);
 });
});
