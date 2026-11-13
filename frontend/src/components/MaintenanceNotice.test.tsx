import {fireEvent,render,screen} from '@testing-library/react';
import {I18nProvider,supportedLocales,translate} from '../i18n';
import {storefrontApi} from '../api';
import {BrowseError} from './BrowseSupport';

afterEach(()=>{vi.unstubAllGlobals();});

it.each(supportedLocales)('keeps the real release503 rejected after read recovery and renders a readable, manual retry in %s',async locale=>{
 localStorage.setItem('bobbuy_locale',locale);
 const fetcher=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({message:'Release maintenance in progress'}),{status:503}));
 vi.stubGlobal('fetch',fetcher);
 let error='';try{await storefrontApi.trips();}catch(cause){error=(cause as Error).message;}
 expect(error).toBe(translate(locale,'maintenance.title'));
 const retry=vi.fn(),refresh=vi.fn();render(<I18nProvider><BrowseError error={error} retry={retry} refresh={refresh}/></I18nProvider>);
 expect(screen.getByRole('status')).toHaveTextContent(translate(locale,'maintenance.description'));
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 expect(fetcher).toHaveBeenCalledTimes(3);expect(retry).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:translate(locale,'maintenance.retry')}));
 expect(retry).toHaveBeenCalledTimes(1);expect(refresh).not.toHaveBeenCalled();
});

it('preserves an unrelated503 reason and ordinary retry instead of claiming a release',async()=>{
 localStorage.setItem('bobbuy_locale','en-US');
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify({message:'Public registration is unavailable'}),{status:503})));
 await expect(storefrontApi.trips()).rejects.toThrow('Public registration is unavailable');
 render(<I18nProvider><BrowseError error="Public registration is unavailable" retry={vi.fn()} refresh={vi.fn()}/></I18nProvider>);
 expect(screen.getByRole('alert')).toHaveTextContent('Public registration is unavailable');
 expect(screen.queryByText(translate('en-US','maintenance.title'))).not.toBeInTheDocument();
});

it('continues to distinguish a catalog revision conflict from a release notice',()=>{
 localStorage.setItem('bobbuy_locale','en-US');const retry=vi.fn(),refresh=vi.fn();
 render(<I18nProvider><BrowseError error="browse.changed" changed retry={retry} refresh={refresh}/></I18nProvider>);
 fireEvent.click(screen.getByRole('button',{name:translate('en-US','browse.refresh')}));
 expect(refresh).toHaveBeenCalledTimes(1);expect(retry).not.toHaveBeenCalled();
});
