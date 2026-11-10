import type {ServiceOffer,ServiceTerms,ServicePackage} from './api';
export const serviceLocales=['ja-JP','zh-CN','zh-TW','en-US'] as const;
export const termFields=['title','description','eligibility','regions','restrictions','cancellation'] as const;
export function emptyServicePackage():ServicePackage{return{key:'pkg-'+crypto.randomUUID(),terms:Object.fromEntries(serviceLocales.map(l=>[l,{name:'',scope:''}])),originalPrice:null,price:null};}
export const taskPackages=(o:Pick<ServiceOffer,'basis'>)=>o.basis==='TASK_PACKAGES';
export function emptyServiceOffer():ServiceOffer{
 const term=():ServiceTerms=>({title:'',description:'',eligibility:'',regions:'',restrictions:'',cancellation:'',benefits:[]});
 return{sourceUrl:'',sourceText:'',provider:'',staff:null,hours:null,originalPrice:null,price:null,currency:'JPY',taxIncluded:true,fees:[],noExtraFees:false,applicationStart:null,applicationEnd:null,serviceStart:null,serviceEnd:null,terms:Object.fromEntries(serviceLocales.map(l=>[l,term()])),costsReviewed:false,windowsReviewed:false,reviewed:false};
}
export function serviceError(o:ServiceOffer):{key:string;locale?:string;section:string}|undefined{
 let url:URL;try{url=new URL(o.sourceUrl??'');if(url.protocol!=='https:'||url.username||url.password||url.hash)throw Error();}catch{return{key:'sourceUrl',section:'source'};}
 if(!o.sourceText?.trim())return{key:'sourceText',section:'source'};
 for(const key of ['provider','applicationEnd','serviceEnd'] as const)if(o[key]===null||o[key]==='')return{key,section:'basics'};
 if(o.basis!=null&&!['STAFF_HOURS','TASK_PACKAGES'].includes(o.basis))return{key:'basis',section:'basics'};
 const amount=(n:number|null)=>n!==null&&Number.isFinite(n)&&n>=0&&n<=999999999;
 if(taskPackages(o)){
  if([o.staff,o.hours,o.price,o.originalPrice].some(n=>n!==null)||!o.packages?.length||o.packages.length>20)return{key:'packages',section:'basics'};
  const keys=new Set<string>();
  for(const p of o.packages){
   if(!/^[a-z][a-z0-9-]{0,39}$/.test(p.key)||keys.has(p.key)||!amount(p.price)||p.originalPrice!==null&&(!amount(p.originalPrice)||p.originalPrice<p.price!))return{key:'packages',section:'basics'};keys.add(p.key);
   for(const locale of serviceLocales)if(!p.terms[locale]?.name.trim()||!p.terms[locale]?.scope.trim())return{key:'packages',locale,section:'basics'};
  }
 }else{
  if(o.packages?.length)return{key:'packages',section:'basics'};
  if(o.staff==null||o.staff<1||o.staff>10||!Number.isInteger(o.staff))return{key:'staff',section:'basics'};
  if(o.hours==null||!Number.isFinite(o.hours)||o.hours<=0||o.hours>24)return{key:'hours',section:'basics'};
  if(!amount(o.price)||o.originalPrice!==null&&(!amount(o.originalPrice)||o.originalPrice<o.price!))return{key:'price',section:'basics'};
 }
 if(o.applicationStart&&o.applicationStart>o.applicationEnd!||o.serviceStart&&o.serviceStart>o.serviceEnd!||o.applicationEnd!>o.serviceEnd!)return{key:'applicationEnd',section:'basics'};
 if(!o.noExtraFees&&!o.fees.length)return{key:'fees',section:'basics'};
 for(const fee of o.noExtraFees?[]:o.fees){if((fee.kind!=null&&!['FIXED','CONDITIONAL'].includes(fee.kind))||(fee.kind==='CONDITIONAL'?(!taskPackages(o)||fee.amount!==null):!amount(fee.amount)))return{key:'fees',section:'basics'};for(const locale of serviceLocales)if(!fee.descriptions[locale]?.trim())return{key:'fees',locale,section:'basics'};}
 for(const locale of serviceLocales)for(const key of termFields)if(!o.terms[locale]?.[key]?.trim())return{key,locale,section:'terms'};
 for(const key of ['costsReviewed','windowsReviewed','reviewed'] as const)if(!o[key])return{key,section:'source'};
}
