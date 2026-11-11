import {useLayoutEffect,useRef} from 'react';
import {currencies} from '../currency';
import {useI18n} from '../i18n';
/** Fit the complete price on one baseline; normal amounts keep their large CSS size. */
export default function CardPrice({amount,currency='JPY',kind='sale'}:{amount?:number|null;currency?:string;kind?:'sale'|'reference'}){
 const {locale,t}=useI18n(),className=kind==='sale'?'card-sale-value':'card-reference-value';
 const money=useRef<HTMLDivElement>(null),price=useRef<HTMLElement>(null);
 const definition=currencies[currency as keyof typeof currencies];
 const formatted=amount==null?'':new Intl.NumberFormat(locale,{minimumFractionDigits:definition?.digits??2,maximumFractionDigits:Math.max(definition?.digits??2,Number.isInteger(amount)?0:2)}).format(amount);
 useLayoutEffect(()=>{
  const box=money.current,text=price.current;if(!box||!text)return;
  let frame=0,lastWidth=-1;
  const fit=()=>{
   frame=0;text.style.fontSize='';box.style.removeProperty('--card-amount-size');
   if(box.clientWidth<=0)return;
   const base=parseFloat(getComputedStyle(text).fontSize),symbol=box.querySelector('small')!;
   const available=box.clientWidth-symbol.getBoundingClientRect().width-parseFloat(getComputedStyle(box).columnGap);
   if(available>0&&text.scrollWidth>text.clientWidth){
    const size=Math.floor(base*(available-1)/text.scrollWidth*10)/10;
    text.style.fontSize=size+'px';box.style.setProperty('--card-amount-size',size+'px');
   }
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);};
  const observer=new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==lastWidth){lastWidth=width;schedule();}});
  fit();observer.observe(box);window.addEventListener('resize',schedule);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);};
 },[formatted,currency,kind,locale]);
 if(amount==null)return <strong className={className} style={{fontSize:14,fontWeight:400}}>{t('rec.not_stated')}</strong>;
 return <div ref={money} className="card-money" title={currency+' '+formatted}><small className="card-currency" title={currency} aria-label={currency}>{definition?.symbol??currency}</small><strong ref={price} className={className}>{formatted}</strong></div>;
}
