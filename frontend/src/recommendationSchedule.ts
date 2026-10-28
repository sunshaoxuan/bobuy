import {useEffect,useState} from 'react';
import type {RecommendationDetail,RecommendationFacts} from './api';

export function japanDate(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function validDay(value:string|null|undefined):value is string{return !!value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
/** Only explicit item offer endings establish expiry. Coupon issuance alone is not redemption expiry. */
export function itemOfferExpired(item:RecommendationFacts,today:string){
 if(!validDay(today)||!validDay(item.offerEnd)||today<=item.offerEnd)return false;
 if(item.offerStart&&(!validDay(item.offerStart)||item.offerStart>item.offerEnd))return false;
 // A still open, incomplete or contradictory second period is not evidence that every benefit has ended.
 if(item.couponStart||item.couponEnd){if(!validDay(item.couponEnd)||today<=item.couponEnd)return false;if(item.couponStart&&(!validDay(item.couponStart)||item.couponStart>item.couponEnd))return false;}
 return true;
}
export function issueExpired(issue:RecommendationDetail,today:string){return issue.items.length>0&&issue.items.every(item=>itemOfferExpired(item,today));}
function published(issue:RecommendationDetail){const time=Date.parse(issue.post.publishedAt??'');return Number.isFinite(time)?time:0;}
/** Sorting never rewrites source dates or combines shared products from different issues. */
export function arrangeIssues(posts:RecommendationDetail[],today:string){
 const ordered=[...posts].sort((a,b)=>published(b)-published(a)||b.post.id-a.post.id);
 return {current:ordered.filter(post=>!issueExpired(post,today)),history:ordered.filter(post=>issueExpired(post,today))};
}
export function useJapaneseDay(){
 const [day,setDay]=useState(()=>japanDate());
 useEffect(()=>{let timer:number;const update=()=>{window.clearTimeout(timer);setDay(japanDate());const now=Date.now(),offset=9*60*60*1000,next=(Math.floor((now+offset)/86400000)+1)*86400000-offset;timer=window.setTimeout(update,Math.max(1,next-now+5));};update();document.addEventListener('visibilitychange',update);return()=>{window.clearTimeout(timer);document.removeEventListener('visibilitychange',update);};},[]);
 return day;
}
