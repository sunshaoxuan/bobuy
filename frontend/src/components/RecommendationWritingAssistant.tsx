import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Checkbox,Input,Steps} from 'antd';
import {api,type RecommendationDetail} from '../api';
import {useI18n} from '../i18n';

export default function RecommendationWritingAssistant({detail,onApply,onPendingChange}:{detail:RecommendationDetail;onApply:(text:string)=>void;onPendingChange:(value:boolean)=>void}){
 const {t}=useI18n();const [step,setStep]=useState(0),[idea,setIdea]=useState(''),[brief,setBrief]=useState(''),[prompt,setPrompt]=useState(''),[draft,setDraft]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef(0);
 useEffect(()=>()=>{request.current++;},[]);
 useEffect(()=>{request.current++;setStep(0);setIdea('');setBrief('');setPrompt('');setDraft('');setConfirmed(false);setBusy(false);setError('');},[detail.post.id]);
 useEffect(()=>{onPendingChange(busy);return()=>onPendingChange(false);},[busy,onPendingChange]);
 const invalidate=()=>{request.current++;setBusy(false);setError('');setConfirmed(false);setDraft('');};
 async function generate(target:'intent'|'prompt'|'draft'){
  const token=++request.current;setBusy(true);setError('');
  try{const result=await api.recommendationWriting({step:target,idea,brief,prompt,briefConfirmed:target!=='intent',promptConfirmed:target==='draft',facts:detail.items.map(item=>JSON.stringify({name:item.name,itemNumber:item.itemNumber,specification:item.specification,price:item.referencePrice,originalPrice:item.originalPrice,discount:item.discountAmount,start:item.offerStart,end:item.offerEnd,conditions:item.offerNotes,currency:'JPY',priceMeaning:'supplier reference, not Bobuy selling price'}))});
   if(token!==request.current)return;
   if(target==='intent'){setBrief(result.text);setStep(0);}else if(target==='prompt'){setPrompt(result.text);setStep(1);}else{setDraft(result.text);setStep(2);}setConfirmed(false);
  }catch(e){if(token===request.current)setError((e as Error).message);}finally{if(token===request.current)setBusy(false);}
 }
 if(detail.post.published)return null;
 return <section className="rec-writing-assistant"><h2>{t('rec.assist.title')}</h2><p>{t('rec.assist.hint')}</p>
 <Steps current={step} items={['intent','prompt','draft'].map(k=>({title:t('rec.assist.'+k)}))} size="small"/>
 {error&&<Alert type="error" showIcon message={error} description={t('rec.assist.unavailable')}/>}
 {step===0&&<><label htmlFor="rec-writing-idea">{t('rec.assist.idea')}</label><Input.TextArea id="rec-writing-idea" value={idea} maxLength={8000} onChange={e=>{invalidate();setIdea(e.target.value);setBrief('');setPrompt('');}} rows={3}/><Button loading={busy} disabled={!idea.trim()||busy} onClick={()=>void generate('intent')}>{t('rec.assist.clarify')}</Button>
 {brief&&<><label htmlFor="rec-writing-brief">{t('rec.assist.brief')}</label><Input.TextArea id="rec-writing-brief" value={brief} maxLength={12000} rows={5} onChange={e=>{invalidate();setBrief(e.target.value);setPrompt('');}}/><Checkbox checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}>{t('rec.assist.confirm_brief')}</Checkbox><Button disabled={!confirmed||busy||!brief.trim()} onClick={()=>void generate('prompt')}>{t('rec.assist.make_prompt')}</Button></>}</>}
 {step===1&&<><label htmlFor="rec-writing-prompt">{t('rec.assist.prompt')}</label><Input.TextArea id="rec-writing-prompt" value={prompt} maxLength={16000} rows={7} onChange={e=>{invalidate();setPrompt(e.target.value);}}/><Checkbox checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}>{t('rec.assist.confirm_prompt')}</Checkbox><Button disabled={!confirmed||busy||!prompt.trim()} loading={busy} onClick={()=>void generate('draft')}>{t('rec.assist.generate')}</Button></>}
 {step===2&&<><label htmlFor="rec-writing-draft">{t('rec.assist.draft')}</label><Input.TextArea id="rec-writing-draft" value={draft} maxLength={100000} rows={10} onChange={e=>setDraft(e.target.value)}/><Button disabled={busy||!draft.trim()} onClick={()=>onApply(draft)}>{t('rec.assist.apply')}</Button><Button disabled={busy} onClick={()=>void generate('draft')}>{t('rec.assist.regenerate')}</Button></>}
 {step>0&&<Button onClick={()=>{invalidate();setStep(step-1);}}>{t('rec.assist.back')}</Button>}{busy&&<Button onClick={()=>{request.current++;setBusy(false);setError('');}}>{t('common.cancel')}</Button>}
 </section>;
}
