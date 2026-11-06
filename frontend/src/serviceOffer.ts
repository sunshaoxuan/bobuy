import type {ServiceOffer,ServiceTerms} from './api';
export const serviceLocales=['ja-JP','zh-CN','zh-TW','en-US'] as const;
export const termFields=['title','description','eligibility','regions','restrictions','cancellation'] as const;
export function emptyServiceOffer():ServiceOffer{
 const term=():ServiceTerms=>({title:'',description:'',eligibility:'',regions:'',restrictions:'',cancellation:'',benefits:[]});
 return{sourceUrl:'',sourceText:'',provider:'',staff:null,hours:null,originalPrice:null,price:null,currency:'JPY',taxIncluded:true,fees:[],noExtraFees:false,applicationStart:null,applicationEnd:null,serviceStart:null,serviceEnd:null,terms:Object.fromEntries(serviceLocales.map(l=>[l,term()])),costsReviewed:false,windowsReviewed:false,reviewed:false};
}
export function serviceError(o:ServiceOffer):{key:string;locale?:string;section:string}|undefined{
 let url:URL;try{url=new URL(o.sourceUrl??'');if(url.protocol!=='https:'||url.username||url.password||url.hash)throw Error();}catch{return{key:'sourceUrl',section:'source'};}
 if(!o.sourceText?.trim())return{key:'sourceText',section:'source'};
 for(const key of ['provider','staff','hours','price','applicationEnd','serviceEnd'] as const)if(o[key]===null||o[key]==='')return{key,section:'basics'};
 if(o.staff!<1||o.staff!>10||!Number.isInteger(o.staff))return{key:'staff',section:'basics'};
 if(o.hours!<=0||o.hours!>24)return{key:'hours',section:'basics'};
 if(!Number.isFinite(o.price)||o.price!<0||o.originalPrice!==null&&o.originalPrice<o.price!)return{key:'price',section:'basics'};
 if(o.applicationStart&&o.applicationStart>o.applicationEnd!||o.serviceStart&&o.serviceStart>o.serviceEnd!||o.applicationEnd!>o.serviceEnd!)return{key:'applicationEnd',section:'basics'};
 if(!o.noExtraFees&&!o.fees.length)return{key:'fees',section:'basics'};
 for(const fee of o.noExtraFees?[]:o.fees){if(fee.amount===null||!Number.isFinite(fee.amount)||fee.amount<0)return{key:'fees',section:'basics'};for(const locale of serviceLocales)if(!fee.descriptions[locale]?.trim())return{key:'fees',locale,section:'basics'};}
 for(const locale of serviceLocales)for(const key of termFields)if(!o.terms[locale]?.[key]?.trim())return{key,locale,section:'terms'};
 for(const key of ['costsReviewed','windowsReviewed','reviewed'] as const)if(!o[key])return{key,section:'source'};
}
