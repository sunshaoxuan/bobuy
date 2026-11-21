import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {gridColumns,rowOffsets,visibleRows} from '../catalogWindow';
import type {ProductBrowseCard} from '../api';
import type {WindowRows} from '../useVisibleCatalog';
import {useI18n} from '../i18n';
export type GridMetrics={columns:number;width:number;gap:number;estimate:number};
export function useCatalogGridMetrics(){
 const probe=useRef<HTMLDivElement>(null),[metrics,setMetrics]=useState<GridMetrics>({columns:0,width:0,gap:24,estimate:400});
 useLayoutEffect(()=>{const el=probe.current;if(!el)return;const measure=()=>{const style=getComputedStyle(el),width=el.getBoundingClientRect().width||Math.max(200,innerWidth-32),columns=gridColumns(style.gridTemplateColumns,width,innerWidth<=767),gap=parseFloat(style.rowGap)||24,cell=(width-(columns-1)*(parseFloat(style.columnGap)||16))/columns;setMetrics(prior=>prior.columns===columns&&Math.abs(prior.width-width)<.5&&prior.gap===gap?prior:{columns,width,gap,estimate:cell+210});};measure();const observer=new ResizeObserver(measure);observer.observe(el);window.addEventListener('resize',measure);return()=>{observer.disconnect();window.removeEventListener('resize',measure);};},[]);
 return {probe,metrics};
}
type Measurements={key:string;heights:Record<number,number>};
function retained(key:string):Measurements{try{const value=JSON.parse(sessionStorage.getItem(key)||'{}');const heights=Object.fromEntries(Object.entries(value).filter(([row,height])=>/^\d+$/.test(row)&&typeof height==='number'&&height>0&&height<4000));return {key,heights:heights as Record<number,number>};}catch{return {key,heights:{}};}}
/** Keep section boundaries real while mounting only visible rows plus two rows of buffer.
 * Measured heights are retained for back/forward restoration, never product facts. */
export default function ViewportProductGrid({identity,section,revision,rows,metrics,ensure,renderCard,paused=false}:{identity:string;section:string;revision:string;rows:WindowRows;metrics:GridMetrics;ensure:(section:string,start:number,end:number)=>void;renderCard:(card:ProductBrowseCard,index:number,eager?:boolean)=>ReactNode;paused?:boolean}){
 const {t}=useI18n(),element=useRef<HTMLDivElement>(null),columns=Math.max(1,metrics.columns);
 const key='bobuy-grid-geometry:'+identity+':'+revision+':'+section+':'+Math.round(metrics.width);
 const [stored,setStored]=useState(()=>retained(key)),[windowRows,setWindowRows]=useState({first:0,last:0,focus:-1});
 const heights=stored.key===key?stored.heights:{};
 const offsets=useMemo(()=>rowOffsets(rows.total,columns,metrics.estimate,metrics.gap,heights),[rows.total,columns,metrics.estimate,metrics.gap,heights]);
 const latest=useRef({offsets,columns,metrics,paused});latest.current={offsets,columns,metrics,paused};
 const anchor=useRef<{row:number;top:number}>();
 useLayoutEffect(()=>{setStored(retained(key));},[key]);
 useLayoutEffect(()=>{
  const el=element.current;if(!el)return;let frame=0;
  const measure=()=>{frame=0;const {offsets,columns,metrics}=latest.current,r=el.getBoundingClientRect(),top=parseFloat(getComputedStyle(el.closest('.public-product-catalog')??el).getPropertyValue('--category-section-top'))||0;
   const range=visibleRows(offsets,top-r.top,innerHeight-r.top);
   const focused=document.activeElement?.closest<HTMLElement>('[data-window-row]'),focus=focused&&el.contains(focused)?Number(focused.dataset.windowRow):-1;
   setWindowRows(prior=>prior.first===range.first&&prior.last===range.last&&prior.focus===focus?prior:{...range,focus});};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};measure();
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);el.addEventListener('focusin',schedule);el.addEventListener('focusout',schedule);
  const observer=new ResizeObserver(schedule);observer.observe(el);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);el.removeEventListener('focusin',schedule);el.removeEventListener('focusout',schedule);};
 },[identity,key,paused]);
 useLayoutEffect(()=>{
  const el=element.current,a=anchor.current;anchor.current=undefined;if(!el||!a)return;const row=el.querySelector<HTMLElement>('[data-window-row="'+a.row+'"]');if(row){const delta=row.getBoundingClientRect().top-a.top;if(Math.abs(delta)>.5)window.scrollBy(0,delta);}
 },[stored]);
 useEffect(()=>{ensure(section,windowRows.first*columns,Math.min(rows.total,windowRows.last*columns));},[ensure,section,windowRows.first,windowRows.last,columns,rows.total]);
 useEffect(()=>()=>ensure(section,0,0),[ensure,section]);
 const mounted=Array.from({length:Math.max(0,windowRows.last-windowRows.first)},(_,i)=>windowRows.first+i);if(windowRows.focus>=0&&!mounted.includes(windowRows.focus))mounted.push(windowRows.focus);
 const mountedKey=mounted.join(',');
 useLayoutEffect(()=>{
  const el=element.current;if(!el)return;
  const measure=()=>{const measured:Record<number,number>={};for(const row of el.querySelectorAll<HTMLElement>('[data-window-row]'))if(!row.querySelector('.catalog-row-placeholder')){const height=row.getBoundingClientRect().height;if(height>0)measured[Number(row.dataset.windowRow)]=height;}
   setStored(prior=>{const before=prior.key===key?prior.heights:{};if(Object.entries(measured).every(([row,height])=>Math.abs((before[Number(row)]??0)-height)<.5))return prior;
    const visible=[...el.querySelectorAll<HTMLElement>('[data-window-row]')].find(row=>row.getBoundingClientRect().bottom>0);if(visible)anchor.current={row:Number(visible.dataset.windowRow),top:visible.getBoundingClientRect().top};
    const next={...before,...measured};try{sessionStorage.setItem(key,JSON.stringify(next));}catch{}return {key,heights:next};});};
  const observer=new ResizeObserver(measure);el.querySelectorAll('[data-window-row]').forEach(row=>observer.observe(row));measure();return()=>observer.disconnect();
 },[key,mountedKey,rows.items]);
 return <div ref={element} className="catalog-window" data-window-section={section} style={{height:offsets[offsets.length-1]??0}} aria-busy={rows.busy}>
  {mounted.map(row=><div key={columns+':'+row} data-window-row={row} className="catalog-master-grid catalog-window-row" style={{top:offsets[row]??0}}>
   {Array.from({length:Math.min(columns,rows.total-row*columns)},(_,col)=>{const index=row*columns+col,item=rows.items.get(index);return item?renderCard(item,index,index<columns):<div key={'pending-'+index} className="catalog-row-placeholder" style={{height:heights[row]??metrics.estimate}} aria-hidden="true">{col===0?t('browse.loading'):null}</div>;})}
  </div>)}
 </div>;
}
