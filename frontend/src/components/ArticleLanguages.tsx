import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,Button,Checkbox,Input,Tabs} from 'antd';
import {recommendationApi,type RecommendationDetail} from '../api';
import {useI18n} from '../i18n';
import PublishedArticleRevision from './PublishedArticleRevision';
type Draft={title:string;body:string};
const locales=['ja-JP','zh-CN','zh-TW','en-US'];
type Props={detail:RecommendationDetail;title:string;body:string;sourceDirty:boolean;disabled:boolean;onTitle:(v:string)=>void;onBody:(v:string)=>void;onChanged:(v:RecommendationDetail)=>void|boolean;onPending:(v:boolean)=>void};
export default function ArticleLanguages(props:Props){
 const mode=useRef({id:props.detail.post.id,published:false,pending:false});if(mode.current.id!==props.detail.post.id)mode.current={id:props.detail.post.id,published:false,pending:false};
 const report=useCallback((pending:boolean)=>{mode.current.pending=pending;props.onPending(pending);},[props.onPending]);
 const published=(props.detail.post.published&&!props.detail.serviceOffer)||(mode.current.published&&mode.current.pending);mode.current.published=published;
 return published?<PublishedArticleRevision detail={props.detail} disabled={props.disabled} onChanged={props.onChanged} onPending={report}/>:<DraftArticleLanguages {...props} onPending={report}/>;
}
function DraftArticleLanguages({detail,title,body,sourceDirty,disabled,onTitle,onBody,onChanged,onPending}:Props){
 const {t}=useI18n();const [locale,setLocale]=useState('ja-JP'),[drafts,setDrafts]=useState<Record<string,Draft>>({}),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [history,setHistory]=useState<Awaited<ReturnType<typeof recommendationApi.articleHistory>>>();const active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>setReviewed(false),[detail.articleSourceHash]);
 const pending=busy||Object.entries(drafts).some(([key,value])=>value.title!==(detail.articleTranslations?.[key]?.title??'')||value.body!==(detail.articleTranslations?.[key]?.body??''));
 useEffect(()=>{onPending(pending);return()=>onPending(false);},[pending,onPending]);
 const source=locale==='ja-JP';const value=source?{title,body}:drafts[locale]??detail.articleTranslations?.[locale]??{title:'',body:''};
 function change(field:'title'|'body',text:string){if(source){(field==='title'?onTitle:onBody)(text);}else setDrafts(prior=>({...prior,[locale]:{title:value.title,body:value.body,[field]:text}}));setReviewed(false);setError('');}
 async function save(){if(!detail.articleSourceHash)return;setBusy(true);setError('');try{const next=await recommendationApi.articleLanguage(detail.post.id,{locale,...value,sourceHash:detail.articleSourceHash,version:detail.post.version,reviewed});if(active.current){onChanged(next);setDrafts(prior=>{const copy={...prior};delete copy[locale];return copy;});setReviewed(false);}}catch(e){if(active.current)setError((e as Error).message);}finally{if(active.current)setBusy(false);}}
 const stale=!source&&!!detail.articleTranslations?.[locale]&&detail.articleTranslations[locale].sourceHash!==detail.articleSourceHash;
 return <><Tabs activeKey={locale} onChange={key=>{setLocale(key);setReviewed(false);setError('');}} items={locales.map(key=>({key,label:(key==='ja-JP'?t('article.source_tab'):key)+(drafts[key]?' *':'')}))}/>
 {!detail.articleSourceLocale&&<Alert type="warning" message={t('article.legacy')}/>}
 {!source&&<Alert type="info" message={sourceDirty?t('article.save_source_first'):stale?t('article.stale'):t('article.manual')}/>}
 {source&&pending&&!busy&&<Alert type="info" message={t('article.pending_translations')}/>}
 {error&&<Alert type="error" message={error}/>}
 <label htmlFor={source?'rec-title':'rec-translated-title'}>{t('rec.article_title')}</label><Input id={source?'rec-title':'rec-translated-title'} value={value.title} maxLength={200} disabled={disabled||busy||(source?pending:sourceDirty||detail.articleSourceLocale!=='ja-JP')} onChange={e=>change('title',e.target.value)}/>
 <label htmlFor={source?'rec-body':'rec-translated-body'}>{t('rec.body')}</label><Input.TextArea id={source?'rec-body':'rec-translated-body'} value={value.body} maxLength={100000} rows={12} disabled={disabled||busy||(source?pending:sourceDirty||detail.articleSourceLocale!=='ja-JP')} onChange={e=>change('body',e.target.value)}/>
 {(!source||!detail.articleSourceLocale)&&<div className="article-language-actions"><Checkbox checked={reviewed} disabled={disabled||busy||(!source&&(sourceDirty||detail.articleSourceLocale!=='ja-JP'))} onChange={e=>setReviewed(e.target.checked)}>{t(source?'article.confirm_source':'article.review')}</Checkbox><Button disabled={disabled||!reviewed||busy||(!source&&sourceDirty)} loading={busy} onClick={()=>void save()}>{t(source?'article.confirm_source':'article.save_translation')}</Button></div>}
 <Button onClick={()=>{setError('');void recommendationApi.articleHistory(detail.post.id).then(rows=>{if(active.current)setHistory(rows);}).catch(e=>{if(active.current)setError(e.message);});}}>{t('article.history')}</Button>
 {history&&<details open><summary>{t('article.history')} ({history.length})</summary>{history.map(row=><section key={row.id}><strong>#{row.id} · {row.recordedAt}</strong><h4>{row.facts.title}</h4><p style={{whiteSpace:'pre-wrap'}}>{row.facts.body}</p>{Object.entries(row.facts.translations??{}).map(([key,text])=><details key={key}><summary>{key} · {text.title}</summary><p style={{whiteSpace:'pre-wrap'}}>{text.body}</p></details>)}</section>)}</details>}
 </>;
}
