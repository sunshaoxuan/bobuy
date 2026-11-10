import {useEffect,useId,useRef,useState} from 'react';
import {Button,Drawer,Empty,Spin} from 'antd';
import {CalendarOutlined} from '@ant-design/icons';
import {Link,useLocation} from 'react-router-dom';
import {storefrontApi,type BrowsePage,type IssueDirectoryEntry,type RecommendationLabel} from '../api';
import {useBrowsePages} from '../browsePaging';
import {localizedContent,useI18n} from '../i18n';
import {selectedNode} from '../storeNavigation';
import {BrowseError} from './BrowseSupport';
import './issue-directory.css';

type Selected={id:number;title:string;publishedAt?:string;issueDate?:string|null;issueDateSource?:'REVIEWED_SOURCE'|'UNKNOWN';publicItemCount?:number;suppliers?:RecommendationLabel[]};
type DateClue={year?:string;month?:string;day?:string;label:string;value:string;kind:'issue'|'publication'};
export default function IssueDirectory({obscured,refresh,query='',authKey,selected,checkDataset,onRefresh}:{wide:boolean;primaryReady:boolean;obscured:boolean;refresh:number;query?:string;authKey?:string;selected?:Selected;checkDataset:(key:string,token:string)=>boolean;onRefresh:()=>void}){
 const {t,locale}=useI18n(),location=useLocation(),node=selectedNode(location.search),id=useId();
 const toggle=useRef<HTMLButtonElement>(null);
 const [expanded,setExpanded]=useState(false),[requested,setRequested]=useState('');
 const identity=JSON.stringify([node,locale,query,refresh,authKey]);
 const enabled=node!==-1&&requested===identity;
 const data=useBrowsePages<IssueDirectoryEntry>(identity,async(page,revision)=>{const result=await storefrontApi.browseIssues({page,revision,merchantId:node,locale,query,period:'all'});return {...result,scopeTotal:result.total,matchedTotal:result.total,categories:[],unclassified:0} as BrowsePage<IssueDirectoryEntry>;},row=>String(row.post.id),enabled,token=>checkDataset('directory',token),20);
 useEffect(()=>{setExpanded(false);setRequested('');},[identity]);
 useEffect(()=>{if(obscured)setExpanded(false);},[obscured]);
 function close(){setExpanded(false);}
 function open(){setRequested(identity);setExpanded(true);}
 const rows:Selected[]=data.items.map(row=>({id:row.post.id,title:row.title,publishedAt:row.post.publishedAt,
  // Only the reviewed field is a calendar fact. Conflicting DTO fields require review, never a guessed fallback.
  issueDate:row.issueDateSource==='REVIEWED_SOURCE'&&(row.post.issueDate==null||row.post.issueDate===row.issueDate)&&(row.post.issueDateSource===undefined||row.post.issueDateSource==='REVIEWED_SOURCE')?row.issueDate:null,
  issueDateSource:row.issueDateSource,publicItemCount:Number.isSafeInteger(row.publicItemCount)&&row.publicItemCount!>=0?row.publicItemCount:undefined,suppliers:row.suppliers}));
 // Selection never inserts or pins a row ahead of the server's date-ordered pages.
 const shown=rows;
 function path(value:number){const params=new URLSearchParams(location.search);params.set('topic',String(value));params.delete('item');return '/recommendations?'+params;}
 function dateParts(instant:Date,timeZone:'UTC'|'Asia/Tokyo',value:string,kind:DateClue['kind']):DateClue{
  const parts=new Intl.DateTimeFormat(locale,{timeZone,year:'numeric',month:'short',day:'2-digit'}).formatToParts(instant);
  return{year:parts.find(p=>p.type==='year')?.value,month:parts.find(p=>p.type==='month')?.value,day:parts.find(p=>p.type==='day')?.value,label:new Intl.DateTimeFormat(locale,{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(instant),value,kind};
 }
 function validCalendar(value:string){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000-'))return false;const instant=new Date(value+'T00:00:00Z');return Number.isFinite(instant.getTime())&&instant.toISOString().slice(0,10)===value;
 }
 function calendar(value?:string|null,source?:string):DateClue|undefined{
  // A LocalDate is a calendar fact, not the publication instant or a date guessed from the title.
  if(source!=='REVIEWED_SOURCE'||!value||!validCalendar(value))return;return dateParts(new Date(value+'T00:00:00Z'),'UTC',value,'issue');
 }
 function publication(value?:string):DateClue|undefined{
  // An Instant is a separate publication fact. Require an explicit offset; never infer the device timezone.
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)||!validCalendar(value.slice(0,10)))return;
  const instant=new Date(value);if(!Number.isFinite(instant.getTime()))return;return dateParts(instant,'Asia/Tokyo',value,'publication');
 }
 function dates(row:Selected){const issue=calendar(row.issueDate,row.issueDateSource),published=publication(row.publishedAt);return{issue,published,primary:issue??published};}
 function dateLabel(day:DateClue){return t(day.kind==='issue'?'directory.issue_date':'directory.published_date')+': '+day.label;}
 function suppliers(row:Selected){return [...new Map((row.suppliers??[]).filter(s=>typeof s?.id==='string'&&s.id&&s.name&&typeof s.name==='object').map(s=>[s.id,localizedContent(s.name,locale).trim()])).values()].filter(Boolean).join(' · ');}
 function label(row:Selected){const {issue,published}=dates(row);return [row.title,issue?dateLabel(issue):t('directory.date_unknown'),published?dateLabel(published):undefined,row.publicItemCount===undefined?undefined:t('directory.public_count',{count:row.publicItemCount}),suppliers(row)||undefined].filter(Boolean).join(' · ');}
 return <>
  <button ref={toggle} type="button" className="issue-directory-launcher" hidden={obscured} aria-label={t('rec.contents')} aria-expanded={expanded} aria-controls={expanded?id:undefined} onClick={open}><CalendarOutlined aria-hidden="true"/></button>
  <Drawer title={t('rec.contents')} placement="right" width="min(360px, 100vw)" open={expanded&&!obscured} onClose={close} keyboard maskClosable rootClassName="issue-directory-drawer" afterOpenChange={open=>{if(!open&&!obscured)toggle.current?.focus();}}>
   <aside className="issue-directory" data-expanded="true"><nav id={id} aria-label={t('rec.contents')} className="rec-issue-directory">
   {shown.length>0&&<ul>{shown.map(row=>{const {issue,published,primary:day}=dates(row),supplier=suppliers(row);return <li key={row.id}><Link onClick={close} to={path(row.id)} aria-current={row.id===selected?.id?'page':undefined} aria-label={label(row)}>
    <span className="issue-directory-icon" aria-hidden="true">
     {day?<time className="issue-directory-date" data-date-kind={day.kind} dateTime={day.value} title={dateLabel(day)}><span className="issue-directory-month">{day.month}</span><b>{day.day}</b><small>{day.year}</small></time>:<span className="issue-directory-date-unknown" title={t('directory.date_unknown')}><CalendarOutlined/></span>}
     {row.publicItemCount!==undefined&&<span className="issue-directory-count" title={t('directory.public_count',{count:row.publicItemCount})}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 14 5 8 8.5 2 5 8 1.5Zm-6 7L8 12l6-3.5M2 12l6 3.5 6-3.5"/></svg><b>{row.publicItemCount}</b></span>}
     {supplier&&<small className="issue-directory-supplier-compact">{supplier}</small>}
    </span>
    <span className="issue-directory-title"><span className="issue-directory-title-copy">{row.title}</span>{day&&<small className="issue-directory-date-status">{t(day.kind==='issue'?'directory.issue_date':'directory.published_date')}: <time dateTime={day.value}>{day.label}</time></small>}
     {supplier&&<small className="issue-directory-suppliers">{t('class.supplier')}: {supplier}</small>}</span>
   </Link></li>;})}</ul>}
   {data.busy&&<Spin/>}{data.error&&<BrowseError error={data.error} changed={data.changed} retry={data.retry} refresh={onRefresh}/>}
   {data.page&&!rows.length&&<Empty description={t('store.no_matches')}/>}
   {data.page?.hasNext&&<Button disabled={data.busy||!!data.error} onClick={data.next}>{t('directory.more')}</Button>}
  </nav></aside></Drawer>
 </>;
}
