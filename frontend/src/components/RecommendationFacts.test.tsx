import {render,screen} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import {OfferInfo,factsError,parseBatch,japanDate} from './RecommendationFacts';

describe('source offer facts',()=>{
  it.each([['en-US','Reference price (not real time)'],['zh-CN','参考售价（非实时）'],['zh-TW','參考售價（非即時）'],['ja-JP','参考価格（リアルタイムではありません）']])('separates compact price amount, non-live label, unit and actual dates in %s', (locale,label)=>{
    localStorage.setItem('bobbuy_locale',locale);const view=render(<I18nProvider><OfferInfo compact today="2026-11-10" facts={{name:'Synthetic card',referencePrice:1598,originalPrice:1998,priceUnit:'42g × 40',offerStart:'2026-11-08',offerEnd:'2026-11-15'}}/></I18nProvider>);
    expect(view.container.querySelector('.card-price-label')).toHaveTextContent(label);expect(view.container.querySelector('.card-reference-value')).toHaveTextContent('1,598');expect(view.container.querySelector('.card-reference-value')).not.toHaveTextContent('42g');expect(view.container.querySelector('.card-price-unit')).toHaveTextContent('/ 42g × 40');expect(view.container.querySelector('del')).toHaveTextContent('1,998');expect(view.container.textContent).toContain('2026-11-08');expect(view.container.textContent).toContain('2026-11-15');
  });
  it('keeps a missing compact price unknown rather than fabricating zero',()=>{
    localStorage.setItem('bobbuy_locale','en-US');const view=render(<I18nProvider><OfferInfo compact facts={{name:'Synthetic missing price'}}/></I18nProvider>);expect(view.container.querySelector('.card-reference-value')).toHaveTextContent('Not stated by source');expect(view.container.querySelector('.card-reference-value')).not.toHaveTextContent('0 JPY');
  });
  it('keeps explicit identity fields separate through the normal form/batch contract',()=>{
    const [row]=parseBatch(JSON.stringify([{name:'Diapers',brand:'Pampers',itemNumber:'independent-L',model:'Series',packaging:'80 pieces × 2 packs',specification:'L;80 pieces × 2',fileName:'reviewed.png'}]));
    expect(row.name).toBe('Diapers');expect(row.brand).toBe('Pampers');expect(row.packaging).toBe('80 pieces × 2 packs');expect(row.specification).toBe('L;80 pieces × 2');
    expect(factsError({...row,brand:123 as unknown as string})).toBeTruthy();expect(factsError({...row,model:'x'.repeat(301)})).toBeTruthy();
  });
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
    view.rerender(<I18nProvider><OfferInfo today="2026-10-27" facts={{name:'Synthetic',offerStart:'2026-10-01',offerEnd:'2026-10-26'}} /></I18nProvider>);
    expect(view.container.querySelector('.ant-tag')).toBeInTheDocument();
  });
});
