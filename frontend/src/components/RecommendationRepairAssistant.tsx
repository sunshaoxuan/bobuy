import {Alert,Button,Checkbox,Input,Modal,Spin,Tag} from 'antd';
import {useEffect,useState} from 'react';
import {recommendationApi as api,type LocaleRepairPreview,type SourceRepairPreview} from '../api';
import {useI18n} from '../i18n';

export default function RecommendationRepairAssistant({postId,mode,open,onClose,onApplied}:{postId:number;mode:'source'|'locale';open:boolean;onClose:()=>void;onApplied:()=>Promise<void>|void}){
 const {t}=useI18n(),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[overwrite,setOverwrite]=useState(false);
 const [source,setSource]=useState<SourceRepairPreview>(),[original,setOriginal]=useState<SourceRepairPreview>(),[locale,setLocale]=useState<LocaleRepairPreview>();
 useEffect(()=>{if(!open)setOverwrite(false);},[open]);
 useEffect(()=>{if(!open)return;let active=true;setLoading(true);setError('');setSource(undefined);setOriginal(undefined);setLocale(undefined);const request=mode==='source'?api.sourceRepairPreview(postId,overwrite):api.localeRepairPreview(postId);void request.then(value=>{if(!active)return;if(mode==='source'){setSource(value as SourceRepairPreview);setOriginal(value as SourceRepairPreview);}else setLocale(value as LocaleRepairPreview);}).catch(e=>active&&setError((e as Error).message)).finally(()=>active&&setLoading(false));return()=>{active=false;};},[open,mode,postId,overwrite]);
 const patchSource=(itemId:number,fieldName:string,patch:{suggestedValue?:string})=>setSource(value=>value&&({...value,items:value.items.map(item=>item.itemId===itemId?{...item,fields:item.fields.map(field=>field.field===fieldName?{...field,...patch}:field)}:item)}));
 const acceptAll=(ids?:number[])=>setSource(value=>value&&({...value,items:value.items.map(item=>ids&&!ids.includes(item.itemId)?item:{...item,fields:item.fields.map(field=>{const suggestion=original?.items.find(row=>row.itemId===item.itemId)?.fields.find(f=>f.field===field.field);return suggestion?.suggestedValue&&!field.suggestedValue?{...suggestion}:field;})})}));
 const apply=async()=>{setSaving(true);setError('');try{if(mode==='source'&&source)await api.sourceRepairApply(postId,source,overwrite);else if(locale){const edits=locale.suggestions.filter(s=>s.suggestion?.trim()).map(s=>({productId:s.productId,productVersion:s.productVersion,field:s.field,locale:s.locale,value:s.suggestion!.trim()}));if(!edits.length)throw Error(t('repair.none'));await api.localeRepairApply(postId,locale.version,edits);}await onApplied();onClose();}catch(e){setError((e as Error).message);}finally{setSaving(false);}};
 const fieldLabel=(field:string)=>t(`repair.field.${field}`), evidenceLabel=(value?:string)=>value==='product master'?t('repair.evidence.master'):t('repair.evidence.source');
 const channel=(value?:string)=>value==='COSTCO_ONLINE'?t('repair.channel.online'):value==='COSTCO_WAREHOUSE'?t('repair.channel.warehouse'):value;
 const localeLabel=(value:string)=>t(`repair.locale.${value}`), localeField=(value:string)=>t(`repair.locale_field.${value}`);
 const sourceCount=original?.items.reduce((count,item)=>count+item.fields.filter(field=>field.suggestedValue).length,0)??0;
 const groups=new Map<string,number[]>();
 original?.items.forEach(row=>{const key=JSON.stringify(row.fields.filter(f=>f.suggestedValue).map(f=>[f.field,f.suggestedValue]));groups.set(key,[...(groups.get(key)??[]),row.itemId]);});
 const readable=(field:SourceRepairPreview['items'][number]['fields'][number],value?:string)=>field.field==='sourceMessageKey'?t('repair.reviewed_campaign'):field.field==='supplierKey'?(field.displayValue??t('repair.supplier_unknown')):channel(value);
 return <Modal className="rec-repair-modal" open={open} width={860} title={t(mode==='source'?'repair.source_title':'repair.locale_title')} onCancel={onClose} footer={<><Button onClick={onClose}>{t('rec.cancel_edit')}</Button><Button type="primary" loading={saving} disabled={loading||(!source&&!locale)} onClick={()=>void apply()}>{t('repair.confirm')}</Button></>}>
  <p>{t('repair.review_hint')}</p>{error&&<Alert type="error" showIcon message={error}/>} {loading&&<div className="rec-repair-loading"><Spin/><span>{t(mode==='source'?'repair.deriving':'repair.generating')}</span></div>}
  {mode==='source'&&source&&<>
   <div className="rec-repair-toolbar"><Checkbox checked={overwrite} onChange={e=>setOverwrite(e.target.checked)}>{t('repair.overwrite')}</Checkbox><Button onClick={()=>acceptAll()}>{t('repair.accept_all')} ({sourceCount})</Button></div>
   <div className="rec-repair-list">{[...groups.values()].map((ids,index)=><section key={index} aria-label={t('repair.group').replace('{count}',String(ids.length))}>
    <div className="rec-repair-toolbar"><h3>{t('repair.group').replace('{count}',String(ids.length))}</h3><Button onClick={()=>acceptAll(ids)}>{t('repair.accept_group')}</Button></div>
    {source.items.filter(row=>ids.includes(row.itemId)).map(row=><div key={row.itemId}><h4>{row.itemName??t('repair.product_number').replace('{number}',String(row.itemId))}</h4>{row.fields.map(field=>{
     const value=field.suggestedValue,retained=!!field.currentValue&&!overwrite;
     const initial=original?.items.find(item=>item.itemId===row.itemId)?.fields.find(f=>f.field===field.field);
     return <div className="rec-repair-field" key={field.field}><strong>{fieldLabel(field.field)}</strong>
      {retained?<span>{readable(field,field.currentValue)}</span>:field.field==='sourceUrl'?<>
       {!initial?.suggestedValue&&<span>{t('repair.url_manual')}</span>}
       <Input aria-label={`${fieldLabel(field.field)} ${t('repair.edit')}`} value={value??''} placeholder={t('repair.url_manual')} onChange={e=>patchSource(row.itemId,field.field,{suggestedValue:e.target.value||undefined})}/>
      </>:value?<Input aria-label={`${fieldLabel(field.field)} ${t('repair.edit')}`} value={readable(field,value)} readOnly/>:<span>{t('repair.not_derivable')}</span>}
      {!retained&&value&&<><Tag color={field.evidence==='ai'&&value===initial?.suggestedValue?'purple':'blue'}>{field.field==='sourceUrl'&&value!==initial?.suggestedValue?t('repair.manual'):field.evidence==='ai'?t('repair.ai'):evidenceLabel(field.evidence)}</Tag><Button onClick={()=>patchSource(row.itemId,field.field,{suggestedValue:undefined})}>{t('repair.reject')}</Button></>}
     </div>;
    })}</div>)}
   </section>)}</div>
  </>}
  {mode==='locale'&&locale&&<div className="rec-repair-list">{locale.suggestions.map((row,index)=><section key={row.productId+row.field+row.locale}><div className="rec-repair-field"><strong>{row.productName??t('repair.product')} · {localeLabel(row.locale)}{localeField(row.field)}</strong>{row.aiSuggested&&<Tag color="purple">{t('repair.ai')}</Tag>}</div><Input.TextArea aria-label={`${localeLabel(row.locale)}${localeField(row.field)}`} placeholder={row.error?t('repair.ai_failed'):undefined} value={row.suggestion??''} autoSize={{minRows:2,maxRows:5}} onChange={e=>setLocale(value=>value&&({...value,suggestions:value.suggestions.map((s,i)=>i===index?{...s,suggestion:e.target.value}:s)}))}/>{row.error&&<Alert type="warning" message={t('repair.ai_failed')}/>}<Button onClick={()=>setLocale(value=>value&&({...value,suggestions:value.suggestions.map((s,i)=>i===index?{...s,suggestion:undefined}:s)}))}>{t('repair.reject')}</Button></section>)}</div>}
 </Modal>;
}
