import { Input, InputNumber, Tag,Checkbox,Select } from 'antd';
import type { RecommendationFacts } from '../api';
import { useI18n } from '../i18n';
import {japanDate} from '../recommendationSchedule';
import {resolvedOfferWindow} from '../referenceOfferWindow';
export {japanDate} from '../recommendationSchedule';

export const factFields = ['name','itemNumber','referencePrice','originalPrice','discountAmount','priceUnit','offerStart','offerEnd','couponStart','couponEnd','offerNotes'] as const;
const prices = ['referencePrice','originalPrice','discountAmount'];
const dates = ['offerStart','offerEnd','couponStart','couponEnd'];
export function factsError(facts: RecommendationFacts): string | undefined {
  if (!facts.name?.trim() || facts.name.length > 200) return 'rec.fields_required';
  if (facts.itemNumber != null && (typeof facts.itemNumber !== 'string' || facts.itemNumber.length > 255)) return 'rec.batch_invalid';
  for (const key of prices) { const value = facts[key as keyof RecommendationFacts]; if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 999999999999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 0.001)) return 'rec.offer_invalid'; }
  for (const key of dates) { const value = facts[key as keyof RecommendationFacts]; if (value && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) return 'rec.offer_invalid'; }
  if ((facts.offerStart && facts.offerEnd && facts.offerStart > facts.offerEnd) || (facts.couponStart && facts.couponEnd && facts.couponStart > facts.couponEnd) || (facts.originalPrice != null && facts.referencePrice != null && facts.originalPrice < facts.referencePrice)) return 'rec.offer_invalid';
  if ((facts.priceUnit?.length ?? 0)>100 || (facts.offerNotes?.length ?? 0)>2000) return 'rec.batch_invalid';
  const context=facts.referenceContext;
  if(context){
   for(const value of [context.activityStart,context.activityEnd])if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))return 'rec.offer_invalid';
   if(context.activityStart&&context.activityEnd&&context.activityStart>context.activityEnd)return 'rec.offer_invalid';
   if(context.activityApplies&&((!facts.offerStart&&context.activityStart)||(!facts.offerEnd&&context.activityEnd))&&(!context.windowEvidence?.trim()||!context.sourceUrl?.startsWith('https://')))return 'rec.offer_invalid';
   const window=resolvedOfferWindow(facts);if(window.start&&window.end&&window.start>window.end)return 'rec.offer_invalid';
  }
}
export function FactsForm({facts, onChange, disabled,identityReadOnly=false}: {facts: RecommendationFacts; onChange: (value: RecommendationFacts) => void; disabled?: boolean;identityReadOnly?:boolean}) {
  const {t} = useI18n();
  return <><div className="rec-facts-form">{factFields.map(key => <label key={key}>{t('rec.fact.'+key)}{prices.includes(key) ? <InputNumber value={facts[key] as number | null} min={0} max={999999999999.99} precision={2} disabled={disabled} onChange={value => onChange({...facts,[key]:value})} /> : <Input type={dates.includes(key) ? 'date' : 'text'} value={facts[key] ?? ''} maxLength={key === 'offerNotes' ? 2000 : key === 'name' ? 200 : key === 'priceUnit' ? 100 : 255} disabled={disabled||(identityReadOnly&&(key==='name'||key==='itemNumber'))} onChange={event => onChange({...facts,[key]:event.target.value || null})} />}</label>)}</div><details><summary>{t('ref.source_window')}</summary><p>{t('ref.window_help')}</p><div className="rec-facts-form">
   {(['supplierKey','variantKey','sourceMessageKey','sourceUrl','windowEvidence'] as const).map(key=><label key={key}>{t('ref.'+key)}<Input aria-label={t('ref.'+key)} disabled={disabled} maxLength={key==='windowEvidence'?2000:key==='sourceUrl'?2048:key==='supplierKey'?255:1000} value={facts.referenceContext?.[key]??''} onChange={e=>onChange({...facts,referenceContext:{...facts.referenceContext,[key]:e.target.value||undefined}})}/></label>)}
   <label>{t('ref.channel')}<Select aria-label={t('ref.channel')} allowClear value={facts.referenceContext?.channel} disabled={disabled} onChange={channel=>onChange({...facts,referenceContext:{...facts.referenceContext,channel}})} options={['COSTCO_WAREHOUSE','COSTCO_ONLINE'].map(value=>({value,label:t('ref.'+value)}))}/></label>
   {(['activityStart','activityEnd'] as const).map(key=><label key={key}>{t('ref.'+key)}<Input aria-label={t('ref.'+key)} type="date" disabled={disabled} value={facts.referenceContext?.[key]??''} onChange={e=>onChange({...facts,referenceContext:{...facts.referenceContext,[key]:e.target.value||null}})}/></label>)}
  </div><Checkbox disabled={disabled} checked={!!facts.referenceContext?.activityApplies} onChange={e=>onChange({...facts,referenceContext:{...facts.referenceContext,activityApplies:e.target.checked}})}>{t('ref.applies')}</Checkbox><Checkbox disabled={disabled} checked={!!facts.referenceContext?.startSearchComplete} onChange={e=>onChange({...facts,referenceContext:{...facts.referenceContext,startSearchComplete:e.target.checked}})}>{t('ref.searched')}</Checkbox></details></>;
}
export function OfferInfo({facts,today=japanDate(),compact=false}: {facts: RecommendationFacts; today?: string;compact?:boolean}) {
  const {t,locale} = useI18n();
  const window=resolvedOfferWindow(facts);const complete=!!window.start&&!!window.end;
  const period = (start?: string | null,end?: string | null) => start && end ? start+' – '+end : start ? t('rec.from')+' '+start : end ? t('rec.until')+' '+end : t('rec.period_unknown');
  return <div className="rec-offer-info">
    <div>{facts.originalPrice != null && <del>{t('rec.fact.originalPrice')}: {facts.originalPrice.toLocaleString(locale)} JPY</del>}</div>
    <strong>{t('rec.fact.referencePrice')}: {facts.referencePrice == null ? t('rec.not_stated') : facts.referencePrice.toLocaleString(locale)+' JPY'}{facts.priceUnit && ' / '+facts.priceUnit}</strong>
    {facts.discountAmount != null && <div>{t('rec.fact.discountAmount')}: {facts.discountAmount.toLocaleString(locale)} JPY{facts.priceUnit && ' / '+facts.priceUnit}</div>}
    <div className="rec-offer-period">{t('rec.offer_period')}: {window.start||(!facts.referenceContext?.startSearchComplete?t('ref.review_start'):'？')} – {window.end||'？'} <small>{t('rec.japan_dates')}</small>{facts.referenceContext?.activityApplies&&(!facts.offerStart||!facts.offerEnd)&&<small> · {t('ref.inherited')}</small>}</div>
    {complete&&today>window.end! ? <Tag color="default">{t('rec.expired')}</Tag> : complete&&today<window.start! ? <Tag color="blue">{t('rec.upcoming')}</Tag> : null}
    {facts.referenceQuote&&facts.referenceQuote.state!=='UNSCOPED'&&<div>{t('ref.current')}: {facts.referenceQuote.state==='ACTIVE'?facts.referenceQuote.amount?.toLocaleString(locale)+' JPY':t(facts.referenceQuote.state==='CONFLICT'?'ref.conflict':'ref.unknown')}</div>}
    {(facts.couponStart || facts.couponEnd) && <div>{t('rec.coupon_period')}: {period(facts.couponStart,facts.couponEnd)} <small>{t('rec.japan_dates')}</small></div>}
    {!compact&&facts.offerNotes && <p>{facts.offerNotes}</p>}
  </div>;
}
export type BatchFact = RecommendationFacts & {imageUrl?: string; fileName?: string; currency?: 'JPY'};
export function parseBatch(text: string): BatchFact[] {
  const rows: unknown = JSON.parse(text);
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 200) throw new Error('rec.batch_invalid');
  return rows.map((row,index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${index+1}: rec.batch_invalid`);
    const value = row as BatchFact;
    if (Object.keys(value).some(key => ![...factFields,'imageUrl','fileName','currency'].includes(key)) || (value.currency != null && value.currency !== 'JPY') || typeof value.name !== 'string' || factFields.some(key => !prices.includes(key) && value[key] != null && typeof value[key] !== 'string')) throw new Error(`${index+1}: rec.batch_invalid`);
    const error = factsError(value); if (error) throw new Error(`${index+1}: ${error}`);
    if (value.imageUrl && !/^https:\/\/cds2\.costcojapan\.jp\/cds\/mail-images\/[^\s#]+$/.test(value.imageUrl)) throw new Error(`${index+1}: rec.batch_image`);
    if (!value.imageUrl && !value.fileName) throw new Error(`${index+1}: rec.batch_image`);
    return value;
  });
}
