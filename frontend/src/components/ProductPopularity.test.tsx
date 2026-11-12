import {act,render,screen,waitFor} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import {ProductPopularity,recordProductClick} from './ProductPopularity';
const response=(clicks:string)=>({ok:true,json:async()=>({data:{clicks}})}) as Response;
const tree=(id:string)=><I18nProvider><ProductPopularity id={id}/><ProductPopularity id={id}/></I18nProvider>;
beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');});
afterEach(()=>{vi.unstubAllGlobals();});
it('deduplicates reads and synchronizes two occurrences after every click',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response('0')).mockResolvedValueOnce(response('1')).mockResolvedValueOnce(response('2'));vi.stubGlobal('fetch',fetch);
 render(tree('same-product'));
 await waitFor(()=>expect(screen.getAllByText('0')).toHaveLength(2));expect(fetch).toHaveBeenCalledTimes(1);
 await act(()=>recordProductClick('same-product'));expect(screen.getAllByText('1')).toHaveLength(2);
 await act(()=>recordProductClick('same-product'));expect(screen.getAllByText('2')).toHaveLength(2);expect(fetch).toHaveBeenCalledTimes(3);
});
it('rejects stale initial reads and preserves exact bigint digits',async()=>{
 let finish!:(r:Response)=>void;const fetch=vi.fn().mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockResolvedValueOnce(response('9223372036854775807'));vi.stubGlobal('fetch',fetch);
 render(tree('stale-product'));await act(()=>recordProductClick('stale-product'));await act(async()=>finish(response('0')));
 expect(screen.getAllByLabelText('Views 9,223,372,036,854,775,807')).toHaveLength(2);expect(screen.getAllByText('9,223,372T')).toHaveLength(2);
});
it('refreshes all linked instances on cross-tab notification',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response('4')).mockResolvedValueOnce(response('5'));vi.stubGlobal('fetch',fetch);render(tree('peer-product'));
 await screen.findAllByText('4');act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'product-popularity-updated',newValue:JSON.stringify({id:'peer-product'})})));
 await screen.findAllByText('5');expect(fetch).toHaveBeenCalledTimes(2);
});
it('keeps counters with their product when an occurrence is relinked and never retries failed clicks',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(response('8')).mockResolvedValueOnce(response('0')).mockResolvedValueOnce({ok:false});vi.stubGlobal('fetch',fetch);const view=render(tree('old-product'));
 await screen.findAllByText('8');view.rerender(tree('new-product'));await screen.findAllByText('0');await act(()=>recordProductClick('new-product'));
 expect(screen.getAllByText('Unavailable')).toHaveLength(2);expect(fetch).toHaveBeenCalledTimes(3);
});
