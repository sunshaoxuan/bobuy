import {render,screen} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import {OfferInfo,factsError,parseBatch,japanDate} from './RecommendationFacts';

describe('source offer facts',()=>{
  it('keeps string codes, missing prices and single-ended dates without inventing facts',()=>{
    const [row]=parseBatch(JSON.stringify([{name:'Synthetic',itemNumber:'00123',imageUrl:'https://cds2.costcojapan.jp/cds/mail-images/test.png',offerEnd:'2026-11-22'}]));
    expect(row.itemNumber).toBe('00123');expect(row.referencePrice).toBeUndefined();expect(row.offerStart).toBeUndefined();
    expect(()=>parseBatch(JSON.stringify([{...row,itemNumber:123}]))).toThrow();
    expect(()=>parseBatch(JSON.stringify([{...row,currency:'USD'}]))).toThrow();
    expect(()=>parseBatch(JSON.stringify([{...row,imageUrl:'https://evil.test/x.png'}]))).toThrow();
    expect(factsError({...row,offerStart:'2026-11-23'})).toBeTruthy();
    expect(factsError({...row,offerEnd:'2026-02-30'})).toBeTruthy();
    expect(factsError({...row,referencePrice:1.001})).toBeTruthy();
  });
  it('uses Japan midnight for inclusive expired/upcoming states and distinguishes coupon issue',()=>{
    localStorage.setItem('bobbuy.locale','en-US');
    expect(japanDate(new Date('2026-10-26T14:59:59Z'))).toBe('2026-10-26');
    expect(japanDate(new Date('2026-10-26T15:00:00Z'))).toBe('2026-10-27');
    const view=render(<I18nProvider><OfferInfo today="2026-10-26" facts={{name:'Synthetic',referencePrice:400,originalPrice:500,discountAmount:100,priceUnit:'100g',offerEnd:'2026-10-26',couponEnd:'2026-10-20'}} /></I18nProvider>);
    expect(view.container.textContent).toContain('100g');expect(view.container.textContent).toContain('2026-10-20');
    expect(view.container.querySelector('.ant-tag')).toBeNull();
    view.rerender(<I18nProvider><OfferInfo today="2026-10-27" facts={{name:'Synthetic',offerEnd:'2026-10-26'}} /></I18nProvider>);
    expect(view.container.querySelector('.ant-tag')).toBeInTheDocument();
  });
});
