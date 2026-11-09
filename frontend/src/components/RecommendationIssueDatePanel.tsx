import {useEffect,useId,useRef,useState} from 'react';
import {Button} from 'antd';
import {CalendarOutlined} from '@ant-design/icons';
import {recommendationApi,type RecommendationDetail} from '../api';
import {getStoredAccessToken,getStoredUser,subscribeToAuthChanges} from '../authStorage';
import {useI18n} from '../i18n';
import Editor,{type RecommendationIssueDateCopy,type RecommendationIssueDateReview as Review,type RecommendationIssueDateRequest as Request} from './RecommendationIssueDateEditor';

const keys=['title','help','current','date','reference','hash','reviewer','reviewedAt','unknown','unknownHint','reviewedState','reviewed','save','reload','useSaved','loading','loadFailed','saveFailed','conflict','invalidResponse','saved','reloaded','invalidDate','invalidReference','invalidHash','unavailable'] as const;
type Session={id:number|null;agent:boolean;token:string|null;generation:number};
function readSession(generation:number):Session{const user=getStoredUser();return{id:user?.id??null,agent:user?.roles.includes('AGENT')===true,token:getStoredAccessToken(),generation};}
const conflict=()=>Object.assign(new Error('Recommendation changed'),{status:409,errorCode:'RECOMMENDATION_CHANGED'});

/** Merge only public date metadata after an exact parent-version write; never elevate an old article baseline. */
export function applyRecommendationIssueDate(detail:RecommendationDetail,postId:number,expectedVersion:number,review:Review):RecommendationDetail|undefined{
 if(detail.post.id!==postId||detail.post.version!==expectedVersion||review.source!=='REVIEWED_SOURCE'||!review.issueDate||![expectedVersion,expectedVersion+1].includes(review.version))return;
 return{...detail,post:{...detail.post,version:review.version,issueDate:review.issueDate,issueDateSource:'REVIEWED_SOURCE'}};
}
type Props={post:RecommendationDetail['post'];disabled?:boolean;onSaved:(value:Review,expectedVersion:number)=>void;onPendingChange?:(value:boolean)=>void;onVersionConflict?:()=>void};
export default function RecommendationIssueDatePanel({post,disabled=false,onSaved,onPendingChange,onVersionConflict}:Props){
 const {t}=useI18n(),id=useId(),[session,setSession]=useState(()=>readSession(0)),sessionRef=useRef(session),live=useRef(true),[open,setOpen]=useState(false),[visited,setVisited]=useState(false);
 const latest=useRef({post,disabled,onSaved,onPendingChange,onVersionConflict});latest.current={post,disabled,onSaved,onPendingChange,onVersionConflict};
 const acceptedWrite=useRef<{scope:string;value:Review;expectedVersion:number}>();
 const owner=!!session.token&&session.agent&&session.id!==null&&Number.isSafeInteger(session.id)&&session.id>0&&Number.isSafeInteger(post.merchantId)&&post.merchantId===session.id;
 const scope=JSON.stringify([post.id,session.id,session.generation]),scopeRef=useRef(scope);scopeRef.current=scope;
 function current(){const user=getStoredUser();return live.current&&scopeRef.current===scope&&sessionRef.current===session&&getStoredAccessToken()===session.token&&user?.id===session.id&&user.roles.includes('AGENT')&&latest.current.post.id===post.id&&latest.current.post.merchantId===session.id;}
 function changed(){if(current())latest.current.onVersionConflict?.();return conflict();}
 useEffect(()=>{
  live.current=true;const sync=()=>{const next=readSession(sessionRef.current.generation);const previous=sessionRef.current;if(next.id===previous.id&&next.token===previous.token&&next.agent===previous.agent)return;next.generation++;sessionRef.current=next;acceptedWrite.current=undefined;setSession(next);};sync();const stop=subscribeToAuthChanges(sync);return()=>{live.current=false;stop();};
 },[]);
 useEffect(()=>{setOpen(false);setVisited(false);acceptedWrite.current=undefined;latest.current.onPendingChange?.(false);},[scope,owner]);
 async function get(postId:number){
  if(!current()||postId!==post.id)throw conflict();const expected=post.version,value=await recommendationApi.getIssueDate(postId,session.token!);
  if(!current())throw conflict();if(value.version!==expected||latest.current.post.version!==expected)throw changed();return value;
 }
 async function save(postId:number,request:Readonly<Request>){
  if(!current()||latest.current.disabled||postId!==post.id||request.version!==latest.current.post.version)throw changed();const expected=request.version;
  try{const value=await recommendationApi.saveIssueDate(postId,request,session.token!);if(!current())throw conflict();if(latest.current.post.version!==expected||![expected,expected+1].includes(value.version))throw changed();acceptedWrite.current={scope,value,expectedVersion:expected};return value;}
  catch(error){if(current()&&(error as {status?:number})?.status===409)latest.current.onVersionConflict?.();throw error;}
 }
 function saved(value:Review){const write=acceptedWrite.current;if(!current()||!write||write.scope!==scope||write.value!==value||latest.current.post.version!==write.expectedVersion)return;acceptedWrite.current=undefined;latest.current.onSaved(value,write.expectedVersion);}
 if(!owner)return null;
 const copy=Object.fromEntries(keys.map(key=>[key,t('issueDate.'+key)])) as RecommendationIssueDateCopy;
 return <section className="rec-issue-date-host"><Button icon={<CalendarOutlined aria-hidden/>} aria-label={copy.title} disabled={disabled} aria-expanded={open} aria-controls={id} onClick={()=>{setOpen(value=>!value);setVisited(true);}}>{copy.title}</Button>
  {visited&&<div id={id} hidden={!open} style={{display:open?'block':'none'}}><fieldset disabled={disabled} style={{border:0,padding:0,minWidth:0}}>
   <Editor key={scope} post={post} actorKey={String(session.id)} sessionKey={String(session.generation)+':merchant-session'} copy={copy} get={get} save={save} onSaved={saved} onDirtyChange={value=>{if(current())latest.current.onPendingChange?.(value);}}/>
  </fieldset></div>}
 </section>;
}
