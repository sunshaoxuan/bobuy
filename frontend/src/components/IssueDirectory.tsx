import {useEffect,useId,useRef,useState} from 'react';
import {Button,Empty,Spin} from 'antd';
import {Link,useLocation} from 'react-router-dom';
import {storefrontApi,type BrowsePage,type IssueDirectoryEntry} from '../api';
import {useBrowsePages} from '../browsePaging';
import {useI18n} from '../i18n';
import {selectedNode} from '../storeNavigation';
import {BrowseError} from './BrowseSupport';
import './issue-directory.css';

type Selected={id:number;title:string;publishedAt?:string;itemCount?:number};
export default function IssueDirectory({wide,primaryReady,obscured,refresh,query='',authKey,selected,checkDataset,onRefresh}:{wide:boolean;primaryReady:boolean;obscured:boolean;refresh:number;query?:string;authKey?:string;selected?:Selected;checkDataset:(key:string,token:string)=>boolean;onRefresh:()=>void}){
 const {t,locale}=useI18n(),location=useLocation(),node=selectedNode(location.search),id=useId();
 const root=useRef<HTMLElement>(null),toggle=useRef<HTMLButtonElement>(null),suppressed=useRef(false),timer=useRef<ReturnType<typeof setTimeout>>();
 const [expanded,setExpanded]=useState(false),[pinned,setPinned]=useState(false),[requested,setRequested]=useState('');
 const identity=JSON.stringify([node,locale,query,refresh,authKey]);
 const enabled=node!==-1&&(wide?primaryReady:requested===identity);
 const data=useBrowsePages<IssueDirectoryEntry>(identity,async(page,revision)=>{const result=await storefrontApi.browseIssues({page,revision,merchantId:node,locale,query,period:'all'});return {...result,scopeTotal:result.total,matchedTotal:result.total,categories:[],unclassified:0} as BrowsePage<IssueDirectoryEntry>;},row=>String(row.post.id),enabled,token=>checkDataset('directory',token),20);
 useEffect(()=>{setExpanded(false);setPinned(false);setRequested('');suppressed.current=false;},[identity]);
 useEffect(()=>{if(wide&&primaryReady)setRequested(identity);},[wide,primaryReady,identity]);
 function close(restore=false){setExpanded(false);setPinned(false);suppressed.current=true;if(restore)toggle.current?.focus();}
 useEffect(()=>{if(!expanded||obscured)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();close(true);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[expanded,obscured]);
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))close();};document.addEventListener('pointerdown',outside);return()=>{document.removeEventListener('pointerdown',outside);if(timer.current)clearTimeout(timer.current);};},[]);
 function open(){if(!suppressed.current){setExpanded(true);setRequested(identity);}}
 function leave(){if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{if(!root.current?.contains(document.activeElement)&&!pinned){setExpanded(false);suppressed.current=false;}},200);}
 const rows:Selected[]=data.items.map(row=>({id:row.post.id,title:row.title,publishedAt:row.post.publishedAt,itemCount:row.itemCount}));
 if(selected&&!rows.some(row=>row.id===selected.id))rows.unshift(selected);
 const compact=rows.slice(0,4);if(selected&&!compact.some(row=>row.id===selected.id)){compact[3]=selected;}
 const shown=wide&&!expanded?compact:rows;
 function path(value:number){const params=new URLSearchParams(location.search);params.set('topic',String(value));params.delete('item');return '/recommendations?'+params;}
 function date(value?:string){return value?new Date(value).toLocaleDateString(locale,{year:'numeric',month:'2-digit',day:'2-digit'}):t('rec.not_stated');}
 return <aside ref={root} className={'issue-directory '+(wide?'issue-directory-floating':'issue-directory-inline')} data-expanded={expanded} hidden={obscured} onMouseEnter={()=>{if(timer.current)clearTimeout(timer.current);if(wide)open();}} onMouseLeave={leave} onFocusCapture={event=>{if(event.target!==toggle.current)suppressed.current=false;if(wide)open();}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)){suppressed.current=false;leave();}}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}}}>
  <div className="issue-directory-surface"><button ref={toggle} type="button" className="issue-directory-toggle" aria-expanded={expanded} aria-controls={id} onClick={()=>{if(pinned)close();else{suppressed.current=false;setPinned(true);setExpanded(true);setRequested(identity);}}}>{t('rec.contents')} <span aria-hidden="true">{expanded?'−':'＋'}</span></button>
  {!selected&&<small className="issue-directory-current">{t('browse.current')}</small>}
  <nav id={id} aria-label={t('rec.contents')} className="rec-issue-directory" hidden={!wide&&!expanded}>
   {shown.length>0&&<ul>{shown.map(row=><li key={row.id}><Link to={path(row.id)} aria-current={row.id===selected?.id?'page':undefined} aria-label={`${row.title} · ${t('detail.published_date')}: ${date(row.publishedAt)}${row.itemCount===undefined?'':` · ${row.itemCount}`}`}><span className="issue-directory-icon" aria-hidden="true"><b>#{row.id}</b><small>{date(row.publishedAt)}</small><span className="issue-directory-short">{row.title.slice(0,8)}</span></span><span className="issue-directory-title">{row.title}{row.itemCount!==undefined&&<small>({row.itemCount})</small>}<small>{t('detail.published_date')}: {date(row.publishedAt)}</small></span></Link></li>)}</ul>}
   {data.busy&&<Spin/>}{data.error&&<BrowseError error={data.error} changed={data.changed} retry={data.retry} refresh={onRefresh}/>}
   {data.page&&!rows.length&&<Empty description={t('store.no_matches')}/>}
   {(expanded||!wide)&&data.page?.hasNext&&<Button disabled={data.busy||!!data.error} onClick={data.next}>{t('directory.more')}</Button>}
   {wide&&!expanded&&(rows.length>4||data.page?.hasNext)&&<button className="issue-directory-more" type="button" onClick={()=>{setPinned(true);setExpanded(true);}}>{t('directory.more')}</button>}
  </nav></div>
 </aside>;
}
