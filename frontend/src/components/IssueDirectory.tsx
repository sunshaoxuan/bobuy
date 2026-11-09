import {useEffect,useId,useRef,useState} from 'react';
import {Button,Empty,Spin} from 'antd';
import {CalendarOutlined} from '@ant-design/icons';
import {Link,useLocation} from 'react-router-dom';
import {storefrontApi,type BrowsePage,type IssueDirectoryEntry,type RecommendationLabel} from '../api';
import {useBrowsePages} from '../browsePaging';
import {localizedContent,useI18n} from '../i18n';
import {selectedNode} from '../storeNavigation';
import {BrowseError} from './BrowseSupport';
import './issue-directory.css';

type Selected={id:number;title:string;publishedAt?:string;issueDate?:string|null;publicItemCount?:number;suppliers?:RecommendationLabel[]};
export default function IssueDirectory({wide,primaryReady,obscured,refresh,query='',authKey,selected,checkDataset,onRefresh}:{wide:boolean;primaryReady:boolean;obscured:boolean;refresh:number;query?:string;authKey?:string;selected?:Selected;checkDataset:(key:string,token:string)=>boolean;onRefresh:()=>void}){
 const {t,locale}=useI18n(),location=useLocation(),node=selectedNode(location.search),id=useId();
 const root=useRef<HTMLElement>(null),toggle=useRef<HTMLButtonElement>(null),suppressed=useRef(false),timer=useRef<ReturnType<typeof setTimeout>>();
 const [expanded,setExpanded]=useState(false),[pinned,setPinned]=useState(false),[requested,setRequested]=useState('');
 const identity=JSON.stringify([node,locale,query,refresh,authKey]);
 const enabled=node!==-1&&(primaryReady||(!wide&&requested===identity));
 const data=useBrowsePages<IssueDirectoryEntry>(identity,async(page,revision)=>{const result=await storefrontApi.browseIssues({page,revision,merchantId:node,locale,query,period:'all'});return {...result,scopeTotal:result.total,matchedTotal:result.total,categories:[],unclassified:0} as BrowsePage<IssueDirectoryEntry>;},row=>String(row.post.id),enabled,token=>checkDataset('directory',token),20);
 useEffect(()=>{setExpanded(false);setPinned(false);setRequested('');suppressed.current=false;},[identity]);
 function close(restore=false){setExpanded(false);setPinned(false);suppressed.current=true;if(restore)toggle.current?.focus();}
 useEffect(()=>{if(!expanded||obscured)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();close(true);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[expanded,obscured]);
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))close();};document.addEventListener('pointerdown',outside);return()=>{document.removeEventListener('pointerdown',outside);if(timer.current)clearTimeout(timer.current);};},[]);
 function open(){if(!suppressed.current){setExpanded(true);setRequested(identity);}}
 function leave(){if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{if(!root.current?.contains(document.activeElement)&&!pinned){setExpanded(false);suppressed.current=false;}},200);}
 const rows:Selected[]=data.items.map(row=>({id:row.post.id,title:row.title,publishedAt:row.post.publishedAt,issueDate:row.issueDate,publicItemCount:Number.isSafeInteger(row.publicItemCount)&&row.publicItemCount!>=0?row.publicItemCount:undefined,suppliers:row.suppliers}));
 // Selection never inserts or pins a row ahead of the server's date-ordered pages.
 const compact=rows.slice(0,4);
 const shown=wide&&!expanded?compact:rows;
 function path(value:number){const params=new URLSearchParams(location.search);params.set('topic',String(value));params.delete('item');return '/recommendations?'+params;}
 function calendar(value?:string|null){
  // A LocalDate is a calendar fact, not the publication instant or a date guessed from the title.
  if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return;const instant=new Date(value+'T00:00:00Z');if(!Number.isFinite(instant.getTime())||instant.toISOString().slice(0,10)!==value)return;
  const parts=new Intl.DateTimeFormat(locale,{timeZone:'UTC',year:'numeric',month:'short',day:'2-digit'}).formatToParts(instant);
  return{year:parts.find(p=>p.type==='year')?.value,month:parts.find(p=>p.type==='month')?.value,day:parts.find(p=>p.type==='day')?.value,label:new Intl.DateTimeFormat(locale,{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant)};
 }
 function suppliers(row:Selected){return [...new Map((row.suppliers??[]).filter(s=>typeof s?.id==='string'&&s.id&&s.name&&typeof s.name==='object').map(s=>[s.id,localizedContent(s.name,locale).trim()])).values()].filter(Boolean).join(' · ');}
 function label(row:Selected){const day=calendar(row.issueDate);return [row.title,day?t('directory.issue_date')+': '+day.label:t('directory.date_unknown'),row.publicItemCount===undefined?undefined:t('directory.public_count',{count:row.publicItemCount}),suppliers(row)||undefined].filter(Boolean).join(' · ');}
 return <aside ref={root} className={'issue-directory '+(wide?'issue-directory-floating':'issue-directory-inline')} data-expanded={expanded} hidden={obscured} onMouseEnter={()=>{if(timer.current)clearTimeout(timer.current);if(wide)open();}} onMouseLeave={leave} onFocusCapture={event=>{if(event.target!==toggle.current)suppressed.current=false;if(wide)open();}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)){suppressed.current=false;leave();}}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}}}>
  <div className="issue-directory-surface"><button ref={toggle} type="button" className="issue-directory-toggle" aria-expanded={expanded} aria-controls={id} onClick={()=>{if(pinned)close();else{suppressed.current=false;setPinned(true);setExpanded(true);setRequested(identity);}}}>{t('rec.contents')} <span aria-hidden="true">{expanded?'−':'＋'}</span></button>
  {!selected&&<small className="issue-directory-current">{t('browse.current')}</small>}
  <nav id={id} aria-label={t('rec.contents')} className="rec-issue-directory" hidden={!wide&&!expanded}>
   {shown.length>0&&<ul>{shown.map(row=>{const day=calendar(row.issueDate),supplier=suppliers(row);return <li key={row.id}><Link to={path(row.id)} aria-current={row.id===selected?.id?'page':undefined} aria-label={label(row)}>
    <span className="issue-directory-icon" aria-hidden="true">
     {day?<time className="issue-directory-date" dateTime={row.issueDate!}><span className="issue-directory-month">{day.month}</span><b>{day.day}</b><small>{day.year}</small></time>:<span className="issue-directory-date-unknown"><CalendarOutlined/><small>{t('directory.date_unknown')}</small></span>}
     {row.publicItemCount!==undefined&&<span className="issue-directory-count" title={t('directory.public_count',{count:row.publicItemCount})}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 14 5 8 8.5 2 5 8 1.5Zm-6 7L8 12l6-3.5M2 12l6 3.5 6-3.5"/></svg><b>{row.publicItemCount}</b></span>}
     {supplier&&<small className="issue-directory-supplier-compact">{supplier}</small>}
    </span>
    <span className="issue-directory-title"><span className="issue-directory-title-copy">{row.title}</span><small>{day?<>{t('directory.issue_date')}: <time dateTime={row.issueDate!}>{day.label}</time></>:t('directory.date_unknown')}</small>{supplier&&<small className="issue-directory-suppliers">{t('class.supplier')}: {supplier}</small>}</span>
   </Link></li>;})}</ul>}
   {data.busy&&<Spin/>}{data.error&&<BrowseError error={data.error} changed={data.changed} retry={data.retry} refresh={onRefresh}/>}
   {data.page&&!rows.length&&<Empty description={t('store.no_matches')}/>}
   {(expanded||!wide)&&data.page?.hasNext&&<Button disabled={data.busy||!!data.error} onClick={data.next}>{t('directory.more')}</Button>}
   {wide&&!expanded&&(rows.length>4||data.page?.hasNext)&&<button className="issue-directory-more" type="button" onClick={()=>{setPinned(true);setExpanded(true);}}>{t('directory.more')}</button>}
  </nav></div>
 </aside>;
}
