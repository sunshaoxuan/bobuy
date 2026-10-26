import { Input, InputNumber, Tag } from 'antd';
import type { RecommendationFacts } from '../api';
import { useI18n } from '../i18n';

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
}
export function FactsForm({facts, onChange, disabled}: {facts: RecommendationFacts; onChange: (value: RecommendationFacts) => void; disabled?: boolean}) {
  const {t} = useI18n();
  return <div className="rec-facts-form">{factFields.map(key => <label key={key}>{t('rec.fact.'+key)}{prices.includes(key) ? <InputNumber value={facts[key] as number | null} min={0} max={999999999999.99} precision={2} disabled={disabled} onChange={value => onChange({...facts,[key]:value})} /> : <Input type={dates.includes(key) ? 'date' : 'text'} value={facts[key] ?? ''} maxLength={key === 'offerNotes' ? 2000 : key === 'name' ? 200 : key === 'priceUnit' ? 100 : 255} disabled={disabled} onChange={event => onChange({...facts,[key]:event.target.value || null})} />}</label>)}</div>;
}
export function japanDate(now = new Date()) { return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function OfferInfo({facts,today=japanDate(),compact=false}: {facts: RecommendationFacts; today?: string;compact?:boolean}) {
  const {t,locale} = useI18n();
  const period = (start?: string | null,end?: string | null) => start && end ? start+' – '+end : start ? t('rec.from')+' '+start : end ? t('rec.until')+' '+end : t('rec.period_unknown');
  return <div className="rec-offer-info">
    <div>{facts.originalPrice != null && <del>{t('rec.fact.originalPrice')}: {facts.originalPrice.toLocaleString(locale)} JPY</del>}</div>
    <strong>{t('rec.fact.referencePrice')}: {facts.referencePrice == null ? t('rec.not_stated') : facts.referencePrice.toLocaleString(locale)+' JPY'}{facts.priceUnit && ' / '+facts.priceUnit}</strong>
    {facts.discountAmount != null && <div>{t('rec.fact.discountAmount')}: {facts.discountAmount.toLocaleString(locale)} JPY{facts.priceUnit && ' / '+facts.priceUnit}</div>}
    <div className="rec-offer-period">{t('rec.offer_period')}: {period(facts.offerStart,facts.offerEnd)} {(facts.offerStart || facts.offerEnd) && <small>{t('rec.japan_dates')}</small>}</div>
    {facts.offerEnd && today > facts.offerEnd ? <Tag color="default">{t('rec.expired')}</Tag> : facts.offerStart && today < facts.offerStart ? <Tag color="blue">{t('rec.upcoming')}</Tag> : null}
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
