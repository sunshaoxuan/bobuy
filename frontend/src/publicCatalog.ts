import type {PublicCatalogEntry,PublicCatalogPage,StoreProduct} from './api';

export const CATALOG_BATCH = 24;
export const CATALOG_UNCLASSIFIED = '__unclassified';

export async function readPublicCatalog(load:(page:number)=>Promise<PublicCatalogPage>,active=()=>true,
  progress:(loaded:number,total:number)=>void=()=>{}) {
  const entries:PublicCatalogEntry[]=[],seen=new Set<string>();
  let expectedTotal:number|undefined;
  for(let page=0;page<=100000&&active();page++) {
    const result=await load(page);
    if(!active())return [];
    if(result.page!==page||result.size!==CATALOG_BATCH||!Number.isSafeInteger(result.total)||result.total<0||
      typeof result.hasNext!=='boolean'||!Array.isArray(result.items)||result.items.length>CATALOG_BATCH)
      throw new Error('catalog.incomplete');
    if(expectedTotal!==undefined&&expectedTotal!==result.total)throw new Error('catalog.changed');
    expectedTotal=result.total;
    for(const entry of result.items) {
      if(!entry.productId||seen.has(entry.productId))throw new Error('catalog.changed');
      seen.add(entry.productId);entries.push(entry);
    }
    progress(entries.length,result.total);
    if(entries.length>result.total)throw new Error('catalog.changed');
    if(!result.hasNext) {
      if(entries.length!==result.total)throw new Error('catalog.incomplete');
      return entries;
    }
    if(!result.items.length||entries.length>=result.total)throw new Error('catalog.incomplete');
  }
  if(active())throw new Error('catalog.incomplete');
  return [];
}
export function searchPublicCatalog(entries:PublicCatalogEntry[],query:string) {
  const needle=query.trim().toLocaleLowerCase();
  if(!needle)return entries;
  return entries.filter(entry=>[entry.productId,entry.itemNumber,entry.brand,entry.model,entry.packaging,
    ...Object.values(entry.name),...Object.values(entry.specification),...Object.values(entry.description),
    ...entry.categories.flatMap(category=>Object.values(category.name))].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle));
}
export function catalogCategories(entries:PublicCatalogEntry[]) {
  const categories=new Map<string,PublicCatalogEntry['categories'][number]&{count:number}>();
  let unclassified=0;
  for(const entry of entries) {
    if(!entry.categories.length)unclassified++;
    for(const category of new Map(entry.categories.map(value=>[value.id,value])).values()) {
      const old=categories.get(category.id);
      categories.set(category.id,{...category,count:(old?.count??0)+1});
    }
  }
  return {categories:[...categories.values()],unclassified,total:entries.length};
}
export function filterPublicCatalog(entries:PublicCatalogEntry[],category:string) {
  return category?entries.filter(entry=>category===CATALOG_UNCLASSIFIED?!entry.categories.length:entry.categories.some(value=>value.id===category)):entries;
}
export function catalogSale(entry:PublicCatalogEntry,products:StoreProduct[]) {
  return products.find(product=>product.id===entry.productId&&product.merchantId===entry.merchantId);
}
