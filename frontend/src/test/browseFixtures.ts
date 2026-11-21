import type {BrowsePage,ProductBrowseCard,PublicCatalogEntry,RecommendationOccurrence,StoreProduct} from '../api';
export const markerFixture={id:'a',code:'new',badge:'N',name:{'en-US':'New'},description:{},color:'green' as const,sortOrder:0,enabled:true,version:0};
export const productCard=(id='p',merchantId=1):ProductBrowseCard=>({productId:id,merchantId,name:{'en-US':id==='p'?'Product':id},specification:{'en-US':'500 g'},brand:'Brand',model:'M',packaging:'Box',itemNumber:'ITEM',image:null,categories:[],markers:[markerFixture],reviewedMaster:true});
export const productDetail=(id='p',merchantId=1):PublicCatalogEntry=>({...productCard(id,merchantId),description:{'en-US':'Full description'},gallery:[],referenceOffers:[]});
export function browsePage<T>(items:T[],extra:Partial<BrowsePage<T>>={}):BrowsePage<T>{return {items,page:0,size:24,scopeTotal:items.length,matchedTotal:items.length,hasNext:false,revision:'r'.repeat(64),datasetRevision:'d'.repeat(64),categories:[],unclassified:items.length,markedScopeTotal:items.filter(item=>Array.isArray((item as ProductBrowseCard).markers)&&(item as ProductBrowseCard).markers.length>0).length,...extra};}
export const saleFixture=(id='p'):StoreProduct=>({id,merchantId:1,name:{'en-US':'Product'},description:{},brand:'Brand',price:120,currency:'JPY',categoryId:'',images:[],recommendationReady:true,priceRevision:1,priceToken:'quote-token'});
export const occurrence=(post=1,item=1,productId='p'):RecommendationOccurrence=>({key:post+':'+item,post:{id:post,title:'Issue '+post,published:true,version:1,updatedAt:'',merchantId:1},title:'Issue '+post,history:false,service:false,serviceSummary:null,item:{id:item,productId,name:'Item '+item,brand:'Brand',model:'',packaging:'',specification:'500 g',image:null,categories:[],translationStatus:'REVIEWED',translations:{},currency:'JPY'}});

/** Adapt a complete in-memory fixture to the viewport range requested by the UI.
 * Production never falls back to this; API-contract tests return exact ranges directly. */
export function viewportReply<T>(value:BrowsePage<T>,query:{offset?:number;limit?:number;category?:string}):BrowsePage<T>{
 if(query.offset===undefined||query.limit===undefined)return value;
 const start=value.offset===undefined?(value.page>0?0:query.offset):0;
 const slice=(items:T[])=>items.slice(start,start+query.limit!);
 return {...value,offset:query.offset,size:query.limit,selectedCategory:value.selectedCategory??query.category??'',items:slice(value.items),shelves:value.shelves?.map((s,index)=>({...s,items:query.offset===0&&value.items.length===0&&index>0?[]:slice(s.items)}))};
}
