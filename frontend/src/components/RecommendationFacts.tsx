import { Input, InputNumber, Tag,Checkbox,Select } from 'antd';
import type { RecommendationFacts } from '../api';
import { useI18n } from '../i18n';
import {japanDate} from '../recommendationSchedule';
import {resolvedOfferWindow} from '../referenceOfferWindow';
import CardPrice from './CardPrice';
import {priceDocumentText} from './priceDocumentText';
export {japanDate} from '../recommendationSchedule';

export const factFields = ['name','brand','itemNumber','model','packaging','specification','referencePrice','originalPrice','discountAmount','priceUnit','offerStart','offerEnd','couponStart','couponEnd','offerNotes'] as const;
const prices = ['referencePrice','originalPrice','discountAmount'];
const dates = ['offerStart','offerEnd','couponStart','couponEnd'];
export function factsError(facts: RecommendationFacts): string | undefined {
  if (!facts.name?.trim() || facts.name.length > 200) return 'rec.fields_required';
  if (facts.itemNumber != null && (typeof facts.itemNumber !== 'string' || facts.itemNumber.length > 255)) return 'rec.batch_invalid';
  for (const key of prices) { const value = facts[key as keyof RecommendationFacts]; if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 999999999999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 0.001)) return 'rec.offer_invalid'; }
  for (const key of dates) { const value = facts[key as keyof RecommendationFacts]; if (value && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) return 'rec.offer_invalid'; }
  if ((facts.offerStart && facts.offerEnd && facts.offerStart > facts.offerEnd) || (facts.couponStart && facts.couponEnd && facts.couponStart > facts.couponEnd) || (facts.originalPrice != null && facts.referencePrice != null && facts.originalPrice < facts.referencePrice)) return 'rec.offer_invalid';
  if ((facts.priceUnit?.length ?? 0)>100 || (facts.offerNotes?.length ?? 0)>2000) return 'rec.batch_invalid';
  for(const [field,limit] of [['brand',200],['model',300],['packaging',1000],['specification',1000]] as const){const value=facts[field];if(value!=null&&(typeof value!=='string'||value.length>limit))return 'rec.batch_invalid';}
  const context=facts.referenceContext;
  if(context){
   for(const value of [context.activityStart,context.activityEnd])if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))return 'rec.offer_invalid';
   if(context.activityStart&&context.activityEnd&&context.activityStart>context.activityEnd)return 'rec.offer_invalid';
   if(context.activityApplies&&((!facts.offerStart&&context.activityStart)||(!facts.offerEnd&&context.activityEnd))&&(!context.windowEvidence?.trim()||!context.sourceUrl?.startsWith('https://')))return 'rec.offer_invalid';
   const window=resolvedOfferWindow(facts);if(window.start&&window.end&&window.start>window.end)return 'rec.offer_invalid';
  }
}
export function FactsForm({facts, onChange, disabled,identityReadOnly=false}: {facts: RecommendationFacts; onChange: (value: RecommendationFacts) => void; disabled?: boolean;identityReadOnly?:boolean}) {
  const {t,locale} = useI18n(),copy=priceDocumentText[locale];
  return <><p>{copy.hint} <a href="/admin/price-adjustments">{copy.title}</a></p><div className="rec-facts-form">{factFields.filter(key=>!['referencePrice','originalPrice','discountAmount','priceUnit','offerStart','offerEnd'].includes(key)).map(key => <label key={key}>{t('rec.fact.'+key)}<Input type={dates.includes(key) ? 'date' : 'text'} value={facts[key] ?? ''} maxLength={key === 'brand' ? 200 : key === 'model' ? 300 : key === 'packaging' || key === 'specification' ? 1000 : key === 'offerNotes' ? 2000 : key === 'name' ? 200 : 255} disabled={disabled||(identityReadOnly&&['name','itemNumber','brand','model','packaging','specification'].includes(key))} onChange={event => onChange({...facts,[key]:event.target.value || null})} /></label>)}</div><details><summary>{copy.source}</summary><p>{copy.sourceHint}</p><div className="rec-facts-form">
   {(['supplierKey','variantKey','sourceMessageKey','sourceUrl','windowEvidence'] as const).map(key=><label key={key}>{t('ref.'+key)}<Input aria-label={t('ref.'+key)} disabled={disabled} maxLength={key==='windowEvidence'?2000:key==='sourceUrl'?2048:key==='supplierKey'?255:1000} value={facts.referenceContext?.[key]??''} onChange={e=>onChange({...facts,referenceContext:{...facts.referenceContext,[key]:e.target.value||undefined}})}/></label>)}
   <label>{t('ref.channel')}<Select aria-label={t('ref.channel')} allowClear value={facts.referenceContext?.channel} disabled={disabled} onChange={channel=>onChange({...facts,referenceContext:{...facts.referenceContext,channel}})} options={['COSTCO_WAREHOUSE','COSTCO_ONLINE'].map(value=>({value,label:t('ref.'+value)}))}/></label>
  </div></details></>;
}
export function OfferInfo({facts,today=japanDate(),compact=false}: {facts: RecommendationFacts; today?: string;compact?:boolean}) {
  const {t,locale} = useI18n();
  const window=resolvedOfferWindow(facts);const complete=!!window.start&&!!window.end;
  const period = (start?: string | null,end?: string | null) => start && end ? start+' – '+end : start ? t('rec.from')+' '+start : end ? t('rec.until')+' '+end : t('rec.period_unknown');
  return <div className="rec-offer-info">
    <div>{facts.originalPrice != null && <del>{t('rec.fact.originalPrice')}: {facts.originalPrice.toLocaleString(locale)} JPY</del>}</div>
    {compact?<div className="card-reference-price"><small className="card-price-label">{t('detail.reference')}</small><CardPrice amount={facts.referencePrice} kind="reference"/>{facts.priceUnit&&<small className="card-price-unit">/ {facts.priceUnit}</small>}</div>:<strong>{t('rec.fact.referencePrice')}: {facts.referencePrice == null ? t('rec.not_stated') : facts.referencePrice.toLocaleString(locale)+' JPY'}{facts.priceUnit && ' / '+facts.priceUnit}</strong>}
    {facts.discountAmount != null && <div>{t('rec.fact.discountAmount')}: {facts.discountAmount.toLocaleString(locale)} JPY{facts.priceUnit && ' / '+facts.priceUnit}</div>}
    <div className="rec-offer-period">{priceDocumentText[locale].period}: {window.start||priceDocumentText[locale].unknown} / {facts.priceChange?.type==='PERMANENT'?priceDocumentText[locale].openEnd:window.end||priceDocumentText[locale].unknown} <small>{t('rec.japan_dates')}</small>{facts.priceChange&&<small>{priceDocumentText[locale].number}: {facts.priceChange.documentNumber}</small>}</div>
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
