import {render} from '@testing-library/react';
import {I18nProvider} from './i18n';
import {OfferInfo} from './components/RecommendationFacts';
import messages from './locales/zh-TW';

beforeEach(()=>{localStorage.clear();localStorage.setItem('bobbuy_locale','zh-TW');});
it('renders Traditional Chinese quote labels while keeping missing prices and coupon dates distinct',()=>{
 const facts={name:'Synthetic',discountAmount:330,couponStart:'2026-11-09',couponEnd:'2026-11-22',offerNotes:'發券後兩週內使用'};
 const before=JSON.stringify(facts);
 const {container}=render(<I18nProvider><OfferInfo today="2026-11-09" facts={facts}/></I18nProvider>);
 const text=container.textContent??'';
 for(const label of ['優惠價／已知價格（JPY）','來源未註明','折扣金額（JPY）','優惠／兌換期間','優惠券發放期間','日本時間，包含起訖日','發券後兩週內使用'])expect(text).toContain(label);
 expect(text).toContain('330 JPY');expect(text).toContain('2026-11-09');expect(text).toContain('2026-11-22');
 expect(container.querySelector('.ant-tag')).toBeNull();expect(container.querySelector('button')).toBeNull();
 expect(JSON.stringify(facts)).toBe(before);
});
it('keeps known unit prices and all related quotation field labels in Traditional Chinese',()=>{
 const {container}=render(<I18nProvider><OfferInfo today="2026-11-09" facts={{name:'Synthetic',referencePrice:629,priceUnit:'100g'}}/></I18nProvider>);
 expect(container.textContent).toContain('629 JPY / 100g');
 for(const key of ['rec.fact.referencePrice','rec.fact.originalPrice','rec.fact.discountAmount','rec.fact.priceUnit','rec.fact.offerStart','rec.fact.offerEnd','rec.fact.couponStart','rec.fact.couponEnd','rec.fact.offerNotes','rec.offer_period','rec.coupon_period','rec.period_unknown','rec.not_stated','rec.japan_dates']){
  expect(messages[key]).not.toMatch(/[优价额计单开结发适来备兑时间]/);
 }
});
