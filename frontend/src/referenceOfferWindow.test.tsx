import {render,screen} from '@testing-library/react';
import {resolvedOfferWindow} from './referenceOfferWindow';
import {itemOfferExpired} from './recommendationSchedule';
import {OfferInfo,factsError} from './components/RecommendationFacts';
import {I18nProvider} from './i18n';
const context={activityStart:'2026-11-02',activityEnd:'2026-11-22',activityApplies:true,windowEvidence:'This section explicitly includes this product',sourceUrl:'https://www.costco.co.jp/source',startSearchComplete:true};
it('prefers item dates and only inherits reviewed applicable campaign boundaries',()=>{
 expect(resolvedOfferWindow({name:'x',offerStart:'2026-11-05',referenceContext:context})).toEqual({start:'2026-11-05',end:'2026-11-22'});
 expect(resolvedOfferWindow({name:'x',referenceContext:{...context,activityApplies:false}}).start).toBeFalsy();
 expect(resolvedOfferWindow({name:'x',referenceContext:{...context,windowEvidence:''}}).start).toBeFalsy();
 expect(factsError({name:'x',referenceContext:{...context,windowEvidence:''}})).toBeTruthy();
});
it('does not infer unknown starts or mark them expired after the known end',()=>{
 const facts={name:'x',offerEnd:'2026-10-01',referenceContext:{startSearchComplete:true}};
 expect(itemOfferExpired(facts,'2026-11-20')).toBe(false);
 const view=render(<I18nProvider><OfferInfo today="2026-11-20" facts={facts}/></I18nProvider>);
 expect(view.container.textContent).toContain('？');expect(view.container.querySelector('.ant-tag')).toBeNull();
});
it('keeps incomplete search distinct from a checked-but-unknown question mark',()=>{
 localStorage.setItem('bobbuy_locale','en-US');render(<I18nProvider><OfferInfo facts={{name:'x',offerEnd:'2026-11-08'}}/></I18nProvider>);
 expect(screen.getByText(/Start date needs review/)).toBeInTheDocument();
});
it('keeps explicit source facts and shows reference conflicts without choosing an amount',()=>{
 localStorage.setItem('bobbuy_locale','en-US');const facts={name:'x',referencePrice:100,referenceQuote:{state:'CONFLICT',amount:null,itemIds:[1,2],unknownWindows:0}};
 const view=render(<I18nProvider><OfferInfo facts={facts}/></I18nProvider>);expect(view.container.textContent).toContain('100 JPY');expect(view.container.textContent).toContain('Conflicting prices');
});
