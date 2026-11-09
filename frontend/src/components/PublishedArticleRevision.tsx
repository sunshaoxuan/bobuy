import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Checkbox,Input,Tabs} from 'antd';
import {recommendationApi,type ArticleRevisionArticles,type ArticleRevisionInput,type ArticleRevisionLocale,type RecommendationDetail} from '../api';
import {getStoredAccessToken,getStoredUser,getTestInjectedRole,getTestInjectedUser,subscribeToAuthChanges} from '../authStorage';
import {useI18n} from '../i18n';
import SafeArticleText from './SafeArticleText';

export const ARTICLE_REVISION_LOCALES=['ja-JP','zh-CN','zh-TW','en-US'] as const;
export function readArticleSession(){
 try{const user=getStoredUser();return {actorKey:JSON.stringify([user?.id??null,[...(user?.roles??[])].sort(),getTestInjectedRole(),getTestInjectedUser()]),token:getStoredAccessToken()};}
 catch{return {actorKey:'storage-unavailable',token:null};}
}
export function useArticleSession(){const[,refresh]=useState(0),generation=useRef(0);useEffect(()=>subscribeToAuthChanges(()=>{generation.current++;refresh(n=>n+1);}),[]);return {...readArticleSession(),generation:generation.current,currentGeneration:()=>generation.current};}
export type ArticleEditorState={detail?:RecommendationDetail;title:string;body:string};
export function acceptsArticleDetail(current:RecommendationDetail|undefined,next:RecommendationDetail){
 const content=(value:RecommendationDetail)=>JSON.stringify([value.post.title,value.body,value.articleSourceLocale,ARTICLE_REVISION_LOCALES.map(key=>value.articleTranslations?.[key])]);
 return !current||current.post.id!==next.post.id||next.post.version>current.post.version||(next.post.version===current.post.version&&next.articleSourceHash===current.articleSourceHash&&content(next)===content(current));
}
/** Detail/title/body move together only after the same monotonic acceptance decision. */
export function mergeArticleEditor(current:ArticleEditorState,next:RecommendationDetail,syncSource=false):ArticleEditorState{
 if(!acceptsArticleDetail(current.detail,next))return current;
 const dirty=!!current.detail&&(current.title!==current.detail.post.title||current.body!==current.detail.body);
 const sync=syncSource||!dirty||current.detail?.post.id!==next.post.id;
 return {detail:next,title:sync?next.post.title:current.title,body:sync?next.body:current.body};
}
function articlesFrom(detail:RecommendationDetail):ArticleRevisionArticles{
 return Object.fromEntries(ARTICLE_REVISION_LOCALES.map(locale=>{const text=detail.articleTranslations?.[locale];return [locale,text?{title:text.title,body:text.body}:locale==='ja-JP'&&detail.articleSourceLocale==='ja-JP'?{title:detail.post.title,body:detail.body}:{title:'',body:''}];})) as ArticleRevisionArticles;
}
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
function requestId(){if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const value=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return value.slice(0,8)+'-'+value.slice(8,12)+'-'+value.slice(12,16)+'-'+value.slice(16,20)+'-'+value.slice(20);}
type Props={detail:RecommendationDetail;disabled:boolean;onChanged:(detail:RecommendationDetail)=>void|boolean;onPending:(pending:boolean)=>void};
export default function PublishedArticleRevision(props:Props){return <ArticleRevisionSession key={props.detail.post.id} {...props}/>;}
function ArticleRevisionSession({detail,disabled,onChanged,onPending}:Props){
 const {t}=useI18n(),session=useArticleSession(),bound=useRef(session.actorKey),mounted=useRef(true),operation=useRef(0),token=useRef(session.token),latest=useRef(detail);if(acceptsArticleDetail(latest.current,detail))latest.current=detail;
 const[locale,setLocale]=useState<ArticleRevisionLocale>('ja-JP'),[base,setBase]=useState(detail),[drafts,setDrafts]=useState<ArticleRevisionArticles>(()=>articlesFrom(detail)),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[needsRebase,setNeedsRebase]=useState(false),[history,setHistory]=useState<Awaited<ReturnType<typeof recommendationApi.articleHistory>>>();
 const intention=useRef<{key:string;input:ArticleRevisionInput}>(),busyRef=useRef(false);
 const sameActor=session.actorKey===bound.current,published=detail.post.published&&!detail.serviceOffer;
 const original=articlesFrom(base),dirty=JSON.stringify(drafts)!==JSON.stringify(original),valid=ARTICLE_REVISION_LOCALES.every(key=>drafts[key].title.trim().length>0&&drafts[key].title.length<=200&&drafts[key].body.trim().length>0&&drafts[key].body.length<=100000);
 const pending=sameActor&&(busy||dirty||needsRebase);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operation.current++;};},[]);
 useEffect(()=>{onPending(pending);return()=>onPending(false);},[pending,onPending]);
 const authGeneration=useRef(session.generation);
 useEffect(()=>{if(token.current!==session.token||authGeneration.current!==session.generation||!sameActor){token.current=session.token;authGeneration.current=session.generation;operation.current++;busyRef.current=false;setBusy(false);setReviewed(false);setError('article.revision_session_changed');}},[session.token,session.generation,sameActor]);
 useEffect(()=>{
  if(detail.post.version===base.post.version&&detail.articleSourceHash===base.articleSourceHash)return;
  if(dirty||busy){setNeedsRebase(true);setReviewed(false);return;}
  if(acceptsArticleDetail(base,detail)){setBase(detail);setDrafts(articlesFrom(detail));intention.current=undefined;setReviewed(false);}
 },[detail.post.version,detail.articleSourceHash]);
 function begin(){const ticket=++operation.current,expected=readArticleSession(),generation=session.currentGeneration();busyRef.current=true;setBusy(true);return()=>mounted.current&&operation.current===ticket&&session.currentGeneration()===generation&&readArticleSession().actorKey===bound.current&&readArticleSession().token===expected.token;}
 function change(field:'title'|'body',value:string){operation.current++;intention.current=undefined;setDrafts(prior=>({...prior,[locale]:{...prior[locale],[field]:value}}));setReviewed(false);setError('');setNotice('');}
 async function save(){
  if(busyRef.current||disabled||!published||!sameActor||!valid||!dirty||!reviewed||needsRebase||!digest(base.articleSourceHash))return;
  const articles=Object.fromEntries(ARTICLE_REVISION_LOCALES.map(key=>[key,{...drafts[key]}])) as ArticleRevisionArticles;
  // This is an exact local intention key, not a source hash. Source hashes come only from the server.
  const key=JSON.stringify([detail.post.id,base.post.version,base.articleSourceHash,articles]);
  if(intention.current?.key!==key)intention.current={key,input:{requestId:requestId(),version:base.post.version,sourceHash:base.articleSourceHash,reviewed:true,articles}};
  const attempt=intention.current,current=begin();setError('');setNotice('');
  try{
   const result=await recommendationApi.articleRevision(detail.post.id,attempt.input);if(!current())return;
   if(result.requestId!==attempt.input.requestId||result.previousSourceHash!==attempt.input.sourceHash||!digest(result.articleSourceHash)||!digest(result.detail.articleSourceHash)||result.detail.post.id!==detail.post.id||!Number.isSafeInteger(result.appliedVersion)||result.appliedVersion<attempt.input.version||result.detail.post.version<result.appliedVersion||typeof result.replayed!=='boolean'||typeof result.current!=='boolean'||(result.current&&(result.detail.post.version!==result.appliedVersion||result.detail.articleSourceHash!==result.articleSourceHash)))throw Error('article.revision_invalid_result');
   const monotonic=acceptsArticleDetail(latest.current,result.detail);
   const accepted=monotonic&&onChanged(result.detail)!==false;
   if(!accepted||!result.current){setNeedsRebase(true);setReviewed(false);setNotice('article.revision_saved_newer');return;}
   setBase(result.detail);setDrafts(articlesFrom(result.detail));setNeedsRebase(false);setReviewed(false);intention.current=undefined;setNotice(result.replayed?'article.revision_replayed':'article.revision_saved');
  }catch(e){if(current()){setError((e as Error).message);if((e as {status?:number}).status===409){setNeedsRebase(true);setReviewed(false);}}}
  finally{if(current()){busyRef.current=false;setBusy(false);}}
 }
 async function loadLatest(){
  if(busyRef.current||!sameActor||disabled)return;const current=begin();setError('');setNotice('');
  try{const fresh=await recommendationApi.get(detail.post.id);if(!current())return;if(fresh.post.id!==detail.post.id||!digest(fresh.articleSourceHash)||!acceptsArticleDetail(latest.current,fresh))throw Error('article.revision_newer_response');
   if(onChanged(fresh)===false)throw Error('article.revision_newer_response');
   // Preserve all four local drafts; only the explicit rebase and intention boundary change.
   setBase(fresh);intention.current=undefined;setNeedsRebase(false);setReviewed(false);setNotice('article.revision_rebased');
  }catch(e){if(current())setError((e as Error).message);}finally{if(current()){busyRef.current=false;setBusy(false);}}
 }
 async function readHistory(){if(busyRef.current||!sameActor)return;const current=begin();setError('');try{const rows=await recommendationApi.articleHistory(detail.post.id);if(current())setHistory(rows);}catch(e){if(current())setError((e as Error).message);}finally{if(current()){busyRef.current=false;setBusy(false);}}}
 if(!sameActor)return <Alert type="warning" message={t('article.revision_session_changed')}/>;
 return <section aria-label={t('article.revision_title')}>
  <Alert type="info" message={t('article.revision_title')} description={t('article.revision_help')}/>
  {!published&&<Alert type="warning" message={t('article.revision_not_published')}/>}
  {!detail.articleSourceLocale&&<details><summary>{t('article.legacy')}</summary><h4>{detail.post.title}</h4><p style={{whiteSpace:'pre-wrap'}}><SafeArticleText text={detail.body}/></p></details>}
  {needsRebase&&<Alert type="warning" message={t('article.revision_conflict')}/>}
  {error&&<Alert type="error" message={t(error)}/>}{notice&&<Alert type="info" message={t(notice)}/>}
  <Tabs activeKey={locale} onChange={key=>setLocale(key as ArticleRevisionLocale)} items={ARTICLE_REVISION_LOCALES.map(key=>({key,label:key+(JSON.stringify(drafts[key])!==JSON.stringify(original[key])?' *':'')}))}/>
  <label>{t('rec.article_title')} ({locale})<Input aria-label={t('rec.article_title')+' '+locale} value={drafts[locale].title} maxLength={200} disabled={disabled||busy} onChange={e=>change('title',e.target.value)}/></label>
  <label>{t('rec.body')} ({locale})<Input.TextArea aria-label={t('rec.body')+' '+locale} value={drafts[locale].body} maxLength={100000} rows={12} disabled={disabled||busy} onChange={e=>change('body',e.target.value)}/></label>
  <p>{t('article.revision_url_help')}</p>
  <Checkbox disabled={disabled||busy||needsRebase||!valid||!published} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}>{t('article.revision_review')}</Checkbox>
  <div className="article-language-actions"><Button type="primary" loading={busy} disabled={disabled||busy||!reviewed||!valid||!dirty||needsRebase||!published||!digest(base.articleSourceHash)} onClick={()=>void save()}>{t('article.revision_save')}</Button><Button disabled={disabled||busy} onClick={()=>void loadLatest()}>{t('article.revision_read_latest')}</Button><Button disabled={busy} onClick={()=>void readHistory()}>{t('article.history')}</Button></div>
  {history&&<details open><summary>{t('article.history')} ({history.length})</summary>{history.map(row=><section key={row.id}><strong>#{row.id} · {row.recordedAt}</strong><h4>{row.facts.title}</h4><p style={{whiteSpace:'pre-wrap'}}><SafeArticleText text={row.facts.body}/></p>{Object.entries(row.facts.translations??{}).map(([key,text])=><details key={key}><summary>{key} · {text.title}</summary><p style={{whiteSpace:'pre-wrap'}}><SafeArticleText text={text.body}/></p></details>)}</section>)}</details>}
 </section>;
}
