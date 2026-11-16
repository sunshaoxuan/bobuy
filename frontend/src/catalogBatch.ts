import type {BrowsePage} from './api';

/** Group fixed server pages without changing their offsets or revision contract. */
export async function catalogBatch<T>(request:(page:number,revision?:string)=>Promise<BrowsePage<T>>,page:number,revision:string|undefined,size:24|48):Promise<BrowsePage<T>> {
 if(size===24)return request(page,revision);
 const start=page*2;
 const first=await request(start,revision);
 function validate(value:BrowsePage<T>,index:number){
  if(value.page!==index||value.size!==24||!Array.isArray(value.items)||value.items.length>24||typeof value.hasNext!=='boolean'||!value.revision||!value.datasetRevision||!Number.isSafeInteger(value.matchedTotal)||value.matchedTotal<0||!Number.isSafeInteger(value.scopeTotal)||value.scopeTotal<value.matchedTotal)throw Error('browse.invalid');
  const end=index*24+value.items.length;
  if(value.hasNext?(value.items.length!==24||end>=value.matchedTotal):end!==value.matchedTotal)throw Error('browse.invalid');
  if(revision&&value.revision!==revision)throw Error('browse.changed');
 }
 validate(first,start);
 if(!first.hasNext)return {...first,page,size};
 const second=await request(start+1,first.revision);
 validate(second,start+1);
 if(second.revision!==first.revision||second.datasetRevision!==first.datasetRevision||second.matchedTotal!==first.matchedTotal||second.scopeTotal!==first.scopeTotal)throw Error('browse.changed');
 return {...first,page,size,items:[...first.items,...second.items],hasNext:second.hasNext};
}
