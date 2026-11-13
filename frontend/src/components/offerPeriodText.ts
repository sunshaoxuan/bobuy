import type {PriceChangeView} from '../api';
export type OfferPeriodSource=Pick<PriceChangeView,'documentId'|'type'|'promotion'|'state'|'startsAt'|'endsAt'>;
import type {Locale} from '../i18n';

export const offerPeriodCopy = {
  'zh-CN': {label:'优惠期间',unknown:'优惠时间待确认',loading:'正在查看优惠时间',error:'暂时无法查看优惠时间，请稍后再试',join:'至',zone:'（日本时间）'},
  'zh-TW': {label:'優惠期間',unknown:'優惠時間待確認',loading:'正在查看優惠時間',error:'暫時無法查看優惠時間，請稍後再試',join:'至',zone:'（日本時間）'},
  'ja-JP': {label:'セール期間',unknown:'期間は確認中です',loading:'期間を確認しています',error:'期間を表示できません。しばらくしてからお試しください',join:'から',zone:'（日本時間）'},
  'en-US': {label:'Offer period',unknown:'Offer dates to be confirmed',loading:'Checking offer dates',error:'Offer dates are unavailable. Please try again shortly.',join:' to ',zone:' (Japan time)'}
};
const partsFormat=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function parts(at:number){return Object.fromEntries(partsFormat.formatToParts(at).map(p=>[p.type,p.value]));}
function midnight(at:number){const p=parts(at);return p.hour==='00'&&p.minute==='00'&&p.second==='00'&&at%1000===0;}

export function currentOfferPeriods(prices:OfferPeriodSource[],locale:Locale,now=Date.now()):string[]{
  const copy=offerPeriodCopy[locale],currentYear=parts(now).year;
  return [...new Set(prices.filter(p=>p.type==='PROMOTION'&&p.promotion&&p.state==='ACTIVE'&&Number.isFinite(Date.parse(p.startsAt??''))&&!!p.endsAt&&Date.parse(p.startsAt??'')<=now&&now<Date.parse(p.endsAt)).map(p=>{
    const start=Date.parse(p.startsAt??''),end=Date.parse(p.endsAt!),allDay=midnight(start)&&midnight(end),last=allDay?end-1:end;
    const year=parts(start).year!==parts(last).year||parts(start).year!==currentYear;
    const date=new Intl.DateTimeFormat(locale,{timeZone:'Asia/Tokyo',...(year?{year:'numeric' as const}:{}),month:locale==='en-US'?'short':'long',day:'numeric'});
    const time=(at:number)=>new Intl.DateTimeFormat(locale,{timeZone:'Asia/Tokyo',hour:'numeric',minute:'2-digit',...(parts(at).second!=='00'?{second:'2-digit' as const}:{}),hourCycle:'h23'}).format(at);
    const range=(a:string,b:string)=>a===b?a:a+copy.join+b+(locale==='ja-JP'?'まで':'');
    if(allDay)return range(date.format(start),date.format(last));
    const firstDate=date.format(start),lastDate=date.format(end);
    return range(firstDate+' '+time(start),(firstDate===lastDate?'':lastDate+' ')+time(end))+copy.zone;
  }))];
}
