import {it,expect,beforeEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import {ServiceSummary} from './RecommendationBrowse';
import {serviceFixture,packageServiceFixture} from '../serviceOffer.fixture';
beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');});
it('keeps the legacy staff/hours and fee summary without package fiction',()=>{const view=render(<I18nProvider><ServiceSummary offer={serviceFixture()}/></I18nProvider>);expect(view.container).toHaveTextContent('26,400');expect(view.container).toHaveTextContent('990');expect(view.container.querySelectorAll('.service-package-summary')).toHaveLength(0);});
it.each(['ja-JP','zh-CN','zh-TW','en-US'])('renders four independent scoped prices in %s without a total, staff/hours or buying actions',locale=>{
 cleanup();localStorage.setItem('bobbuy_locale',locale);const offer=packageServiceFixture();const view=render(<I18nProvider><ServiceSummary offer={offer}/></I18nProvider>);
 const cards=view.container.querySelectorAll('.service-package-summary');expect(cards).toHaveLength(4);
 [64900,89100,35200,30080].forEach((price,i)=>{expect(cards[i]).toHaveTextContent(price.toLocaleString(locale));expect(cards[i]).toHaveTextContent(locale+' package '+(i+1));expect(cards[i]).toHaveTextContent('JPY');});
 expect(view.container).not.toHaveTextContent('81,510');expect(view.container).not.toHaveTextContent('111,210');expect(view.container.querySelector('del')).toBeNull();expect(view.container).not.toHaveTextContent('null');
 const fee=screen.getByText(offer.fees[0].descriptions[locale]);expect(fee).not.toHaveTextContent('JPY');expect(fee).not.toHaveTextContent('0 JPY');
 expect(screen.queryByRole('button')).toBeNull();expect(screen.queryByRole('link')).toBeNull();
 if(locale==='en-US'){expect(view.container).not.toHaveTextContent('Staff count');expect(view.container).not.toHaveTextContent('Service hours');}
});
