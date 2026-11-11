import {act,render} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import CardPrice from './CardPrice';
it('preserves the whole maximum amount without break markup and keeps the currency code in its title',()=>{localStorage.setItem('bobbuy_locale','en-US');const view=render(<I18nProvider><CardPrice amount={999999999999.99} kind="reference"/></I18nProvider>);expect(view.container.querySelector('.card-reference-value')).toHaveTextContent('999,999,999,999.99');expect(view.container.querySelectorAll('wbr')).toHaveLength(0);expect(view.container.querySelector('.card-currency')).toHaveTextContent('¥');expect(view.container.querySelector('.card-currency')).toHaveAttribute('title','JPY');});
it('distinguishes a stated zero from an unknown price',()=>{localStorage.setItem('bobbuy_locale','en-US');const view=render(<I18nProvider><CardPrice amount={0}/></I18nProvider>);expect(view.container.querySelector('.card-sale-value')).toHaveTextContent('0');view.rerender(<I18nProvider><CardPrice amount={null}/></I18nProvider>);expect(view.container.querySelector('.card-sale-value')).toHaveTextContent('Not stated by source');expect(view.container.querySelector('.card-currency')).toBeNull();});
it('shrinks an overflowing price, restores its normal size after a width change and releases the observer',()=>{
 let width=120,resize:ResizeObserverCallback,frame:FrameRequestCallback;const disconnect=vi.fn();
 vi.stubGlobal('ResizeObserver',class{constructor(callback:ResizeObserverCallback){resize=callback;}observe(){}disconnect=disconnect;});
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frame=callback;return 1;});vi.stubGlobal('cancelAnimationFrame',vi.fn());
 vi.stubGlobal('getComputedStyle',()=>({fontSize:'24px',columnGap:'4px'}));
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockImplementation(function(this:HTMLElement){return this.classList.contains('card-money')?width:width-12;});
 vi.spyOn(HTMLElement.prototype,'scrollWidth','get').mockImplementation(function(this:HTMLElement){return Math.ceil(240*(parseFloat(this.style.fontSize)||24)/24);});
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({width:8} as DOMRect));
 try{const view=render(<I18nProvider><CardPrice amount={999999999999.99}/></I18nProvider>);const amount=view.container.querySelector('strong')!;
  expect(parseFloat(amount.style.fontSize)).toBeGreaterThan(0);expect(parseFloat(amount.style.fontSize)).toBeLessThan(24);expect(amount.textContent).toBe('999,999,999,999.99');
  width=400;act(()=>{resize!([{contentRect:{width}} as ResizeObserverEntry],{} as ResizeObserver);frame!(0);});expect(amount.style.fontSize).toBe('');
  view.unmount();expect(disconnect).toHaveBeenCalledOnce();
 }finally{vi.restoreAllMocks();vi.unstubAllGlobals();}
});
