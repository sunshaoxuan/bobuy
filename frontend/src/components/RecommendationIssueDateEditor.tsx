import {useEffect,useId,useRef,useState} from 'react';
import {Alert,Button,Checkbox,Input,Spin} from 'antd';

/** Private merchant response. Never pass evidence/reviewer fields into a public summary. */
export type RecommendationIssueDateReview={issueDate:string|null;sourceRef:string|null;sourceHash:string|null;reviewedBy:number|null;reviewedAt:string|null;source:'REVIEWED_SOURCE'|'UNKNOWN';version:number};
export type RecommendationIssueDateRequest={issueDate:string;sourceRef:string;sourceHash:string;version:number;reviewed:true};
export type RecommendationIssueDateCopy=Record<'title'|'help'|'current'|'date'|'reference'|'hash'|'reviewer'|'reviewedAt'|'unknown'|'unknownHint'|'reviewedState'|'reviewed'|'save'|'reload'|'useSaved'|'loading'|'loadFailed'|'saveFailed'|'conflict'|'invalidResponse'|'saved'|'reloaded'|'invalidDate'|'invalidReference'|'invalidHash'|'unavailable',string>;
type Draft={issueDate:string;sourceRef:string;sourceHash:string;reviewed:boolean};
type ErrorKind='loadFailed'|'saveFailed'|'conflict'|'invalidResponse';
type State={scope:string;review?:RecommendationIssueDateReview;draft:Draft;dirty:boolean;needsReload:boolean;busy:'read'|'save'|null;error?:ErrorKind;notice?:'saved'|'reloaded'};
type Props={post:{id:number;version:number};actorKey:string;sessionKey:string;copy:RecommendationIssueDateCopy;get:(postId:number)=>Promise<RecommendationIssueDateReview>;save:(postId:number,request:Readonly<RecommendationIssueDateRequest>)=>Promise<RecommendationIssueDateReview>;onSaved?:(value:RecommendationIssueDateReview)=>void;onDirtyChange?:(dirty:boolean)=>void};
const emptyDraft=():Draft=>({issueDate:'',sourceRef:'',sourceHash:'',reviewed:false});
const empty=(scope:string):State=>({scope,draft:emptyDraft(),dirty:false,needsReload:true,busy:null});
function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.slice(0,4)==='0000')return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
function validReference(value:string){
 if(!value||value.length>2048||/[\s\u0000-\u001f\u007f-\u009f\\<>"{}|^`]/.test(value)||value.includes('#')||/%(?![0-9a-fA-F]{2})/.test(value))return false;
 if(/^message:/i.test(value)){const key=value.slice(8);return !!key&&!key.startsWith('/');}
 if(!/^https:\/\//i.test(value))return false;
 try{const url=new URL(value),authority=value.match(/^https:\/\/([^/?#]*)/i)?.[1];return url.protocol==='https:'&&!!url.hostname&&!!authority&&!authority.includes('@')&&!url.username&&!url.password&&!url.hash;}catch{return false;}
}
export function recommendationIssueDateDraftError(value:Pick<Draft,'issueDate'|'sourceRef'|'sourceHash'>):'invalidDate'|'invalidReference'|'invalidHash'|undefined{
 if(!validDate(value.issueDate))return 'invalidDate';if(!validReference(value.sourceRef))return 'invalidReference';if(!/^[0-9a-fA-F]{64}$/.test(value.sourceHash))return 'invalidHash';
}
function validReview(value:RecommendationIssueDateReview){
 if(!value||!Number.isSafeInteger(value.version)||value.version<0)return false;
 if(value.source==='UNKNOWN')return [value.issueDate,value.sourceRef,value.sourceHash,value.reviewedBy,value.reviewedAt].every(v=>v===null);
 return value.source==='REVIEWED_SOURCE'&&typeof value.issueDate==='string'&&typeof value.sourceRef==='string'&&typeof value.sourceHash==='string'&&!recommendationIssueDateDraftError({issueDate:value.issueDate,sourceRef:value.sourceRef,sourceHash:value.sourceHash})&&typeof value.reviewedBy==='number'&&Number.isSafeInteger(value.reviewedBy)&&value.reviewedBy>0&&typeof value.reviewedAt==='string'&&/Z$/.test(value.reviewedAt)&&Number.isFinite(Date.parse(value.reviewedAt));
}
const draftFrom=(value:RecommendationIssueDateReview):Draft=>({issueDate:value.issueDate??'',sourceRef:value.sourceRef??'',sourceHash:value.sourceHash??'',reviewed:false});
function changed(error:unknown){const e=error as {status?:number;errorCode?:string;code?:string}|null;return e?.status===409||e?.errorCode==='RECOMMENDATION_CHANGED'||e?.code==='RECOMMENDATION_CHANGED';}

/** Standalone owner-only editor; the host binds authenticated GET/PUT and localized copy. */
export default function RecommendationIssueDateEditor({post,actorKey,sessionKey,copy,get,save,onSaved,onDirtyChange}:Props){
 const id=useId(),scope=JSON.stringify([post.id,actorKey,sessionKey]);
 const eligible=Number.isSafeInteger(post.id)&&post.id>0&&Number.isSafeInteger(post.version)&&post.version>=0&&!!actorKey&&!!sessionKey;
 const latestScope=useRef(scope),knownVersion=useRef(post.version),mounted=useRef(false),operation=useRef(0),writing=useRef<{scope:string;token:number}>();
 latestScope.current=scope;knownVersion.current=post.version;
 const callbacks=useRef({get,save,onSaved,onDirtyChange});callbacks.current={get,save,onSaved,onDirtyChange};
 const [state,setState]=useState<State>(()=>empty(scope));const view=state.scope===scope?state:empty(scope);
 const current=(token:number)=>mounted.current&&latestScope.current===scope&&operation.current===token;
 async function read(preserve:boolean){
  if(!eligible||latestScope.current!==scope||writing.current?.scope===scope&&writing.current.token===operation.current)return;
  const token=++operation.current;setState(previous=>({...((previous.scope===scope)?previous:empty(scope)),scope,busy:'read',error:undefined,notice:undefined,needsReload:true,draft:{...(previous.scope===scope?previous.draft:emptyDraft()),reviewed:false}}));
  try{const value=await callbacks.current.get(post.id);if(!current(token))return;if(!validReview(value))throw 'invalidResponse';if(value.version<knownVersion.current)throw 'conflict';
   setState(previous=>{const keep=previous.scope===scope&&preserve&&previous.dirty;return{scope,review:value,draft:keep?{...previous.draft,reviewed:false}:draftFrom(value),dirty:keep,needsReload:false,busy:null,notice:preserve?'reloaded':undefined};});
  }catch(error){if(current(token))setState(previous=>({...previous,busy:null,needsReload:true,error:error==='invalidResponse'?'invalidResponse':error==='conflict'||changed(error)?'conflict':'loadFailed'}));}
 }
 useEffect(()=>{mounted.current=true;setState(empty(scope));if(eligible)void read(false);return()=>{mounted.current=false;operation.current++;};},[scope,eligible]);
 useEffect(()=>{setState(previous=>previous.scope===scope&&previous.review&&post.version>previous.review.version?{...previous,needsReload:true,dirty:true,draft:{...previous.draft,reviewed:false},error:'conflict',notice:undefined}:previous);},[scope,post.version]);
 useEffect(()=>{callbacks.current.onDirtyChange?.(view.dirty);},[scope,view.dirty]);
 useEffect(()=>()=>{callbacks.current.onDirtyChange?.(false);},[]);
 function edit(patch:Partial<Draft>){setState(previous=>previous.scope===scope?{...previous,draft:{...previous.draft,...patch,reviewed:false},dirty:true,notice:undefined}:previous);}
 async function submit(){
  if(!eligible||view.busy||view.needsReload||!view.review||!view.draft.reviewed||recommendationIssueDateDraftError(view.draft)||writing.current?.scope===scope&&writing.current.token===operation.current)return;
  const request:RecommendationIssueDateRequest={issueDate:view.draft.issueDate,sourceRef:view.draft.sourceRef,sourceHash:view.draft.sourceHash.toLowerCase(),version:view.review.version,reviewed:true};
  const token=++operation.current,write={scope,token};writing.current=write;setState(previous=>({...previous,busy:'save',error:undefined,notice:undefined}));
  let accepted:RecommendationIssueDateReview|undefined;
  try{const value=await callbacks.current.save(post.id,request);if(!current(token))return;
   if(!validReview(value)||value.source!=='REVIEWED_SOURCE'||value.issueDate!==request.issueDate||value.sourceRef!==request.sourceRef||value.sourceHash?.toLowerCase()!==request.sourceHash)throw 'invalidResponse';
   if(value.version<request.version||value.version<knownVersion.current)throw 'conflict';
   setState({scope,review:value,draft:draftFrom(value),dirty:false,needsReload:false,busy:null,notice:'saved'});accepted=value;
  }catch(error){if(current(token))setState(previous=>({...previous,busy:null,needsReload:true,dirty:true,draft:{...previous.draft,reviewed:false},error:error==='invalidResponse'?'invalidResponse':error==='conflict'||changed(error)?'conflict':'saveFailed'}));}
  finally{if(writing.current===write)writing.current=undefined;}
  if(accepted&&current(token))callbacks.current.onSaved?.(accepted);
 }
 if(!eligible)return <Alert type="info" message={copy.unavailable}/>;
 const validation=recommendationIssueDateDraftError(view.draft),saving=view.busy==='save',ready=!!view.review&&!view.needsReload&&!view.busy;
 return <section className="rec-issue-date-editor" aria-label={copy.title} aria-busy={!!view.busy}>
  <h3>{copy.title}</h3><p>{copy.help}</p>
  {view.error&&<Alert type="error" message={copy[view.error]} showIcon/>}{view.notice&&<Alert type="success" message={copy[view.notice]} showIcon/>}
  {view.busy==='read'&&<span role="status"><Spin size="small"/> {copy.loading}</span>}
  <Button disabled={saving} onClick={()=>void read(true)}>{copy.reload}</Button>
  {view.review&&<><dl aria-label={copy.current} style={{overflowWrap:'anywhere'}}>
   <dt>{copy.current}</dt><dd>{view.review.source==='UNKNOWN'?copy.unknown:copy.reviewedState}</dd>
   {view.review.source==='UNKNOWN'?<dd>{copy.unknownHint}</dd>:<>
    <dt>{copy.date}</dt><dd><time dateTime={view.review.issueDate!}>{view.review.issueDate}</time></dd>
    <dt>{copy.reference}</dt><dd><code>{view.review.sourceRef}</code></dd><dt>{copy.hash}</dt><dd><code>{view.review.sourceHash}</code></dd>
    <dt>{copy.reviewer}</dt><dd>{view.review.reviewedBy}</dd><dt>{copy.reviewedAt}</dt><dd><time dateTime={view.review.reviewedAt!}>{view.review.reviewedAt}</time></dd>
   </>}
  </dl>
  <label htmlFor={id+'-date'}>{copy.date}</label><Input id={id+'-date'} type="date" value={view.draft.issueDate} disabled={saving} onChange={e=>edit({issueDate:e.target.value})}/>
  <label htmlFor={id+'-ref'}>{copy.reference}</label><Input id={id+'-ref'} value={view.draft.sourceRef} disabled={saving} autoComplete="off" onChange={e=>edit({sourceRef:e.target.value})}/>
  <label htmlFor={id+'-hash'}>{copy.hash}</label><Input id={id+'-hash'} value={view.draft.sourceHash} disabled={saving} autoComplete="off" spellCheck={false} onChange={e=>edit({sourceHash:e.target.value})}/>
  {view.dirty&&validation&&<Alert type="warning" message={copy[validation]}/>}
  <Checkbox checked={view.draft.reviewed} disabled={!ready||!!validation} onChange={e=>setState(previous=>({...previous,draft:{...previous.draft,reviewed:e.target.checked}}))}>{copy.reviewed}</Checkbox>
  <Button type="primary" loading={saving} disabled={!ready||!view.draft.reviewed||!!validation} onClick={()=>void submit()}>{copy.save}</Button>
  <Button disabled={!!view.busy} onClick={()=>setState(previous=>previous.scope===scope&&previous.review?{...previous,draft:draftFrom(previous.review),dirty:false,notice:undefined}:previous)}>{copy.useSaved}</Button>
  </>}
 </section>;
}
